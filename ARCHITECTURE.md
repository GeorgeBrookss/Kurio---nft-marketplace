# Arquitetura

## Visão geral

```
src/
  api/          contracts.ts (tipos + Zod), http.ts (Axios), endpoints.ts, queries.ts (TanStack Query), query-client.ts
  realtime/     use-realtime.ts (socket.io-client), version-tracker.ts (dedupe/versão)
  features/     catalog, nft, cart, checkout, order, auth, profile, session, dev (painel de cenários)
  components/   ui/ (shadcn adaptado), layout/ (header, rodapé, barras mobile, 404)
  mocks/        db.ts, fixtures.ts, scenarios.ts, http.ts, services.ts, handlers.ts, realtime.ts, browser.ts
  router.tsx    árvore de rotas (code-based), guarda de rotas privadas, code splitting
```

Fluxo de dados: **UI → hooks do Query → endpoints → Axios → (rede) → MSW handlers → db**. Eventos: **db → realtime.ts (MSW ws + binding Socket.IO) → socket.io-client → use-realtime → cache do Query**. Nenhum componente, hook ou cliente contém respostas fictícias; o painel de cenários só chama `/__mock/*` pela rede.

## Contratos REST

Todos os tipos estão em `src/api/contracts.ts` e são compartilhados por cliente, mocks e testes. ETH trafega como **string decimal**; quantidades são inteiras. Erros seguem `{ error: { code, message, fields?, details? } }`.

| Método | Rota | Auth | Respostas relevantes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | — | 201 `Session` · 422 `VALIDATION_ERROR` · 409 `EMAIL_TAKEN`/`USERNAME_TAKEN` |
| POST | `/api/auth/login` | — | 200 `Session` · 401 `INVALID_CREDENTIALS` |
| GET | `/api/auth/session` | ✔ | 200 `Session` · 401 `SESSION_EXPIRED`/`UNAUTHENTICATED` |
| POST | `/api/auth/logout` | ✔ | 204 (encerra sockets do usuário) |
| GET | `/api/nfts?q&category&network&minPrice&maxPrice&sort&tab&page` | — | 200 `CatalogResponse` (itens, paginação, facetas) · 500 |
| GET | `/api/nfts/:id` | — | 200 `Nft` · 404 `NOT_FOUND` |
| GET/PUT/DELETE | `/api/favorites[/:id]` | ✔ | 200 `{ nftIds }` · 404 · 500 |
| GET | `/api/cart` | opc. | 200 `Cart` (visitante via header `X-Cart-Id`) |
| POST | `/api/cart/items` | opc. | 201 `Cart` · 409 `AVAILABILITY_CONFLICT` (`details.available`) |
| PATCH/DELETE | `/api/cart/items/:itemId` | opc. | 200 `Cart` · 404 · 409 |
| POST | `/api/cart/merge` | ✔ | 200 `Cart` (mescla o carrinho do visitante, respeitando estoque) |
| POST/DELETE | `/api/cart/coupon` | opc. | 200 `Cart` · 422 `COUPON_INVALID`/`COUPON_EXPIRED` |
| POST | `/api/quotes` | opc. | 200 `Quote` (subtotal, desconto, taxa, total, `hash`) |
| POST | `/api/orders` + `Idempotency-Key` | ✔ | 201 `Order` (pending) · 200 mesma tentativa · 409 `IDEMPOTENCY_CONFLICT`/`QUOTE_STALE`/`AVAILABILITY_CONFLICT` · 409 `WALLET_REJECTED` |
| GET | `/api/orders/:id` | ✔ | 200 `Order` · 404 (também para pedido de outro usuário) |
| GET/PATCH | `/api/me/profile` | ✔ | 200 `Profile` · 422 · 409 `USERNAME_TAKEN`/`EMAIL_TAKEN` |
| POST | `/api/me/password` | ✔ | 204 · 422 (senha atual incorreta / regra de senha) |
| GET | `/api/me/wallets` · PUT `/api/me/wallets/:slot` | ✔ | 200 `WalletsResponse` · 422 (endereço duplicado na mesma rede, principal ausente) |
| GET/POST/DELETE | `/api/me/wallet-connection` | ✔ | Conexão simulada · 409 `WALLET_REJECTED` |

Falhas transitórias são representadas por `503 TRANSIENT`, `HttpResponse.error()` (conexão) e timeout.

### Idempotência de pedidos

A chave é gerada por **tentativa** (mesma cotação + mesmos dados ⇒ mesma chave) e persistida em `localStorage` antes do envio, junto do corpo. No servidor simulado, `key → { userId, bodyHash, orderId }`:

- mesma chave + mesmo corpo ⇒ devolve o mesmo pedido (200);
- mesma chave + corpo diferente ⇒ `409 IDEMPOTENCY_CONFLICT`.

O cliente repete automaticamente a mesma tentativa em timeout ou falha de rede (até 3x). Após um refresh, o checkout oferece **Retomar sem duplicar**, ou leva ao pedido já criado. Um guard síncrono (`useRef`) bloqueia cliques repetidos no mesmo tick.

### Revalidação antes de confirmar

`POST /orders` recalcula a cotação e compara o `hash` enviado. Se houve mudança de preço, cupom, taxa ou estoque, responde `409 QUOTE_STALE` com a nova cotação e o carrinho. O cliente fecha a revisão, atualiza o cache e exige nova confirmação, com nova chave. A revisão aberta também é invalidada se a cotação em cache mudar por um evento `nft.updated`.

### Pedidos e recibo

O pedido nasce `pending` e é liquidado após 3 s: `confirmed` ou `declined`, ambos terminais. A liquidação revalida o estoque e, se confirmada, decrementa a disponibilidade (emitindo `nft.updated`) e remove do carrinho **apenas as quantidades compradas**. O recibo usa exclusivamente o snapshot gravado no pedido (itens, preços, taxas e total).

## Eventos Socket.IO

Envelope: `{ eventId, resource: { type, id }, version, emittedAt, data }`.

| Evento | Destino | Efeito no cliente |
| --- | --- | --- |
| `nft.updated` | todas as conexões | Atualiza listas e detalhe (só se `version` for maior que a em cache); se o NFT está em um carrinho em cache, invalida carrinho e cotação e anuncia a mudança (toast com `aria-live`) |
| `order.updated` | somente conexões do dono do pedido | Atualiza o pedido em cache se a versão for maior; ao chegar a estado terminal, invalida carrinho e cotação |

Garantias:

- **Duplicatas e eventos antigos:** `VersionTracker` descarta `eventId` repetidos e versões menores ou iguais à conhecida, e o cache só aceita versões maiores. Assim não há regressão de estado nem efeito repetido (toast).
- **Isolamento:** uma conexão por sessão, autenticada pelo token na query do handshake. Na troca de usuário ou no logout, o efeito é desmontado (listeners removidos, socket desconectado) e os caches privados são removidos. O servidor só envia `order.updated` ao dono.
- **Reconexão:** a cada `connect` após o primeiro, o cliente invalida catálogo, carrinho, cotação e pedidos ativos. Eventos perdidos durante a queda são recuperados via REST. Pedidos pendentes também fazem polling de 5 s como fallback.

### Transporte e limitações no ambiente de mocks

- MSW `ws.link('wss://realtime.kurio.mock/*')` + `@mswjs/socket.io-binding`, somente transporte `websocket`.
- O binding faz o handshake Engine.IO, mas não envia heartbeats; o mock envia `ping` a cada 20 s (sem isso o cliente cai em 30 s).
- Sem namespaces, rooms ou acks. O roteamento por usuário é feito no próprio handler.
- O `engine.io-client` captura `globalThis.WebSocket` ao ser avaliado. Por isso o `socket.io-client` é importado dinamicamente e só depois de `worker.start()`. Importá-lo antes faz a interceptação falhar silenciosamente (`ERR_NAME_NOT_RESOLVED`).
- Recusa de conexão (`dropRealtime(ms)`) fecha o socket no tick seguinte: fechar de forma síncrona deixava o cliente preso em CONNECTING. A reconexão completa ocorre em cerca de 5–6 s (timeout de conexão de 5 s).

## Sessão

- `Session { token, user, expiresAt }` em `localStorage` (nunca a senha). Ao iniciar, a sessão restaurada é validada em `GET /auth/session`.
- Qualquer `401 SESSION_EXPIRED`/`UNAUTHENTICATED` em requisição autenticada encerra a sessão (interceptor do Axios). O `SessionWatcher` limpa os caches privados e, se a rota for privada, redireciona para `/entrar?redirect=<rota>&expired=true`.
- O checkout mantém um rascunho do formulário em `localStorage`. O prefill a partir da carteira só preenche campos vazios, de modo que a retomada após novo login preserva o que foi digitado. Carrinho e tentativa pendente ficam no servidor e no storage.
- Logout e troca de usuário: `removeQueries(['private', userId])`, carrinho e cotação do usuário anterior; socket recriado. Abas são sincronizadas pelo evento `storage`.
- Rotas privadas (`/checkout`, `/perfil/*`, `/pedido/:id`) usam `beforeLoad`, que redireciona preservando o destino.

## Carrinho

- Fonte de verdade no servidor simulado. O visitante é identificado por `X-Cart-Id` (id persistido no cliente); o usuário, pela sessão.
- No login/cadastro: `POST /cart/merge` com o id do visitante. As quantidades são somadas e limitadas ao estoque, e o cupom do visitante é mantido se o usuário não tiver um.
- Cada item carrega `notice` quando preço ou estoque mudaram desde a última revisão (`price_changed`, `availability_reduced`, `sold_out`). Os dois últimos bloqueiam a finalização. Alterar a quantidade aceita o preço atual.
- Totais vêm sempre da cotação da API (`big.js` com arredondamento bancário no servidor). O cliente apenas formata.

## Estratégia de cache (TanStack Query)

| Dado | Chave | staleTime | Observações |
| --- | --- | --- | --- |
| Catálogo | `['nfts','list', paramsNormalizados]` | 30 s | `keepPreviousData`; `signal` cancela a requisição anterior; a chave por parâmetros descarta respostas fora de ordem |
| Detalhe | `['nfts','detail', id]` | 30 s | Sem retry em 404 |
| Carrinho | `['cart', 'user:id' \| 'guest:id']` | 10 s | Mutations escrevem a resposta no cache e invalidam a cotação |
| Cotação | `['quote', owner, cart.version]` | 0 | Invalidada por eventos e mutations |
| Privados | `['private', userId, ...]` | 15 s | Removidos no fim da sessão |
| Pedido | `['private', userId, 'order', id]` | 0 | Polling de 5 s enquanto pendente |

Retries: somente para falhas transitórias (rede, timeout, 5xx), até 2 tentativas com backoff exponencial (500 ms → 4 s). Mutations não têm retry automático; pedidos usam o mecanismo de idempotência acima. Atualização otimista com rollback: favoritos (`onMutate` / `onError`).

## Mocks (MSW)

- `db.ts`: estado único (catálogo, usuários, sessões, carrinhos, favoritos, perfis, carteiras, conexões, cotações, pedidos, idempotência), persistido em `localStorage` (`kurio:mock:db`, com versão de schema). O reset restaura a seed.
- `fixtures.ts`: 72 NFTs determinísticos (PRNG `mulberry32`, seed 2026). Os 9 primeiros reproduzem o grid do Figma. Há um NFT com edições esgotadas (`golden-signal-160`), 9 categorias, 3 redes e 2 usuários.
- `http.ts`: wrapper `route()` aplica latência do cenário, falha de conexão, 503 da primeira chamada (flaky) e converte `ApiFailure` em resposta tipada.
- Toda mutação no catálogo passa por `mutateNft()`, que incrementa a versão, persiste e emite `nft.updated`. REST e eventos ficam sempre consistentes.
- Ativação: `VITE_ENABLE_MOCKS=true`. O worker também está presente no build de demonstração.

## Acessibilidade

- Skip link, foco visível global, `main` focável.
- Diálogos Radix com foco preso e devolvido ao gatilho (o login do header usa `DialogTrigger`).
- `Field` associa label, `aria-invalid`, `aria-describedby` e `aria-required`; ao falhar o envio, o foco vai ao primeiro campo inválido. Erros da API são mapeados para os campos.
- Estados não dependem só de cor: `aria-pressed` em filtros, edições e favoritos; "(esgotada)" textual; ✓ nos filtros ativos.
- Mutations e mudanças em tempo real são anunciadas por toasts (`aria-live`); o total do resumo e o status do socket também usam `aria-live`.
- `prefers-reduced-motion` desativa shimmer e animações. Skeletons preservam as dimensões do conteúdo.

## Desvios do Figma e decisões de UX

| Item | Decisão | Motivo |
| --- | --- | --- |
| Imagens dos NFTs | Recortes dos frames enviados (4 artes), em WebP | Placeholders até o recebimento dos assets originais |
| Fonte | Roboto Mono local (`@fontsource`) | Mais próxima dos frames; precisa ser confirmada no Figma |
| Header no mobile | Oculto; navegação pela barra inferior + barra superior com voltar/título | Os frames mobile não têm header |
| Busca | Campo no topo do catálogo (todas as larguras) e lupa no header desktop | Requisito de busca e frame mobile |
| Faixa de preço | Dois campos numéricos + Aplicar, no lugar do slider duplo | Operável por teclado e leitor de tela sem componente extra |
| Login/cadastro | Modal no desktop (header) e páginas `/entrar` e `/cadastro` (frames mobile e retorno de rotas privadas) | Ambos os frames existem; a página permite `redirect` |
| Pagamento | Passo extra **Revisar pedido** (diálogo) antes de "Confirmar compra" | Requisito de revisão e de nova confirmação quando os valores mudam |
| Conectar carteira | Botão explícito Conectar/Desconectar | Requisito de simular conexão, recusa e desconexão |
| Ações fora do escopo | Criadores, Aprenda, Atividade, Ofertas, Downloads, Suporte, redes sociais, newsletter e login social exibem aviso "não faz parte desta demonstração" | Não aparentar sucesso funcional |
| Etherscan | Link simulado (`#simulado`) | Referência de transação é fictícia |
| Painel de cenários | Botão no rodapé, apenas com mocks ativos | Demonstração e testes manuais |

## Lighthouse

Configuração em `lighthouserc.cjs` (3 execuções; preset mobile padrão e `desktop`). A mediana é calculada por `scripts/lighthouse-median.mjs`, e os relatórios HTML/JSON ficam em `lighthouse/reports/`.

Medição local (Lighthouse 12.1.0 via @lhci/cli 0.14.0, Chromium 141 headless, contêiner Linux sem GPU e com CPU compartilhada, build de produção, cenário `default`):

| Perfil | Página | Perf. | A11y | BP | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mobile | início | 70 | 100 | 100 | 100 | 3,48 s | 0 | 803 ms |
| mobile | detalhe | 73 | 100 | 100 | 100 | 3,38 s | 0,018 | 697 ms |
| desktop | início | 74 | 100 | 100 | 100 | 0,97 s | 0 | 595 ms |
| desktop | detalhe | 84 | 100 | 100 | 100 | 1,03 s | 0,104 | 286 ms |

**Performance abaixo da meta (≥ 90). Causas identificadas:**

1. **MSW no caminho crítico.** O worker (~98 KB gzip) precisa registrar e ativar o Service Worker antes do primeiro fetch. No modo de demonstração, o primeiro render depende disso. As long tasks atribuídas a `browser-*.js` somam 250–450 ms.
2. **Avaliação do bundle inicial.** `app` + `tanstack` (~137 KB gzip) geram uma long task de 200–470 ms no mount.
3. **Ambiente de medição.** O contêiner tem CPU lenta: TBT de 595 ms no perfil desktop, que não aplica throttling, indica CPU inferior à de referência. Os números devem ser refeitos em máquina comum.

Já aplicado: code splitting (carrinho, checkout, pedido, perfil, auth e painel em chunks sob demanda), `socket.io-client` sob demanda, boot paralelo app + MSW, preload da imagem LCP, imagens WebP dimensionadas, fontes locais só com subset latin.

Próximos passos sugeridos:

- Shell estático do hero em `index.html` (melhora o LCP sem reduzir funcionalidade).
- Mover a geração do catálogo e a serialização do `localStorage` do mock para fora do caminho do primeiro request.
- Preload do woff2 principal ou `font-display: optional`. O CLS de 0,104 no detalhe desktop provavelmente vem da troca de fonte e ainda precisa de confirmação.

## Limitações conhecidas

- Estado do mock por navegador (`localStorage`): duas abas compartilham dados, dois navegadores não.
- Eventos só chegam a abas com o app aberto. A liquidação de pedidos ocorre por timer na página ou na próxima leitura (`GET /orders/:id`).
- Taxa de rede fixa (0.016 ETH), independente da rede escolhida.
- Edições `1/1` e `1/10` têm preço derivado do preço base (fixture).
- Galeria usa a mesma arte nas 4 miniaturas (placeholder).
