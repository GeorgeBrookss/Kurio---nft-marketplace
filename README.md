# Kurio — Documentação de Desenvolvimento

## Visão geral

Kurio é um marketplace de NFTs em React + TypeScript cujo backend inteiro (REST e tempo real) roda simulado na camada de rede via MSW, inclusive no build publicado. O projeto atende ao desafio frontend descrito no README do teste: fluxos de descoberta, compra e conta, desktop e mobile, com 46 testes E2E passando em Chromium.

| Responsabilidade | Tecnologia | Versão | Onde atua |
| --- | --- | --- | --- |
| Build | Vite | 6.0.5 | `vite.config.ts`, code splitting manual de TanStack |
| Interface | React | 18.3.1 | `src/features/*`, `src/components/*` |
| Linguagem | TypeScript (strict, noUncheckedIndexedAccess) | 5.7.2 | todo o código, inclusive testes |
| Roteamento | TanStack Router (code-based) | 1.92.6 | `src/router.tsx` |
| Estado remoto | TanStack Query | 5.62.8 | `src/api/queries.ts` |
| HTTP | Axios | 1.7.9 | `src/api/http.ts` |
| Validação | Zod | 3.24.1 | `src/api/contracts.ts`, formulários e handlers |
| Decimal | big.js | 6.2.2 | `src/lib/money.ts` |
| Tempo real | socket.io-client | 4.8.1 | `src/realtime/use-realtime.ts` |
| Estilo | Tailwind CSS | 3.4.17 | `tailwind.config.ts`, `src/styles/globals.css` |
| Componentes | shadcn/ui (Radix Dialog/Slot, CVA) | — | `src/components/ui/*` |
| Notificações | Sonner | 1.7.1 | toasts com `aria-live` |
| Mocking | MSW + @mswjs/socket.io-binding | 2.10.4 / 0.2.0 | `src/mocks/*` |
| E2E | Playwright | 1.49.1 | `tests/e2e/*`, `playwright.config.ts` |
| Auditoria | Lighthouse CI | 0.14.0 (Lighthouse 12.1) | `lighthouserc.cjs`, `scripts/lighthouse-median.mjs` |
| Lint | ESLint + typescript-eslint + react-hooks | 9.17 | `eslint.config.js` |

Princípio que guiou todas as decisões: a UI nunca sabe que o backend é falso. Componentes, hooks e Axios falam com contratos REST e eventos Socket.IO reais; só a camada `src/mocks` conhece o "banco".

## Estrutura de pastas

O código é organizado por camada técnica na base (api, realtime, mocks) e por funcionalidade na UI (features). A regra de dependência é de cima para baixo: features usam api/realtime; api nunca importa features; mocks só importa contratos e utilitários.

```
kurio-nft-marketplace/
├─ index.html                 shell HTML, preload da imagem LCP, meta SEO
├─ public/
│  ├─ mockServiceWorker.js    worker do MSW (gerado por `msw init`)
│  ├─ nfts/                   artes dos NFTs (+ -thumb)
│  ├─ _redirects              fallback SPA (Netlify/Cloudflare)
│  └─ favicon.svg, robots.txt
├─ src/
│  ├─ main.tsx                bootstrap: inicia MSW, depois monta o app
│  ├─ app.tsx                 QueryClientProvider + RouterProvider
│  ├─ router.tsx              árvore de rotas, guarda de auth, lazy routes, layout raiz
│  ├─ api/
│  │  ├─ contracts.ts         tipos + schemas Zod compartilhados (cliente, mocks, testes)
│  │  ├─ http.ts              instância Axios, interceptors, ApiError
│  │  ├─ endpoints.ts         uma função tipada por endpoint REST
│  │  ├─ queries.ts           chaves de cache + hooks useQuery/useMutation
│  │  └─ query-client.ts      política global de cache e retry
│  ├─ realtime/
│  │  ├─ use-realtime.ts      conexão Socket.IO por sessão, aplicação de eventos
│  │  └─ version-tracker.ts   dedupe por eventId + controle de versão
│  ├─ features/
│  │  ├─ catalog/             início, filtros, busca, cards
│  │  ├─ nft/                 detalhe, galeria, stepper de quantidade
│  │  ├─ cart/                carrinho, cupom, resumo de valores
│  │  ├─ checkout/            pagamento, carteira, revisão, idempotência
│  │  ├─ order/               pendente/confirmado/recusado, recibo
│  │  ├─ auth/                formulários, modal e páginas de login/cadastro
│  │  ├─ profile/             perfil, avatar, senha, carteiras, favoritos
│  │  ├─ session/             store da sessão, watcher, ações de login/logout
│  │  └─ dev/                 painel de cenários (só com mocks ativos)
│  ├─ components/
│  │  ├─ ui/                  shadcn adaptado: button, input, dialog, field, skeleton...
│  │  └─ layout/              header, rodapé, barras mobile, 404
│  ├─ lib/                    money (big.js), storage, use-form (Zod), utils
│  ├─ mocks/
│  │  ├─ fixtures.ts          72 NFTs determinísticos, usuários, cupons
│  │  ├─ db.ts                estado único persistido + reset
│  │  ├─ scenarios.ts         14 cenários de rede e negócio
│  │  ├─ http.ts              wrapper de rota (latência, falhas, erros tipados)
│  │  ├─ services.ts          regras: carrinho, cotação, liquidação de pedidos
│  │  ├─ handlers.ts          handlers REST + endpoints /__mock/*
│  │  ├─ realtime.ts          servidor Socket.IO simulado
│  │  └─ browser.ts           setupWorker + window.__kurioMock
│  └─ styles/globals.css      tokens de cor, foco, shimmer, reduced motion
├─ tests/e2e/                 9 specs + fixtures + __screenshots__/{platform}
├─ lighthouse/reports/        relatórios HTML/JSON + summary.json
├─ scripts/lighthouse-median.mjs
├─ playwright.config.ts, lighthouserc.cjs, eslint.config.js
├─ vite.config.ts, tailwind.config.ts, tsconfig*.json, components.json
├─ vercel.json, .env.example, .nvmrc
└─ README.md, ARCHITECTURE.md, docs/DEVELOPMENT.md
```

## Configuração e execução

O projeto roda a partir de um checkout limpo, sem serviços externos: `npm ci` e `npm run dev` sobem a aplicação com o backend simulado ativo.

### Variáveis de ambiente

| Variável | Padrão | Função |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | ativa o MSW (REST + Socket.IO); obrigatória no build publicado |
| `VITE_API_URL` | `/api` | base REST usada pelo Axios e pelos handlers |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.mock` | endpoint Socket.IO interceptado pelo MSW |
| `VITE_HTTP_TIMEOUT` | `8000` | timeout do Axios em ms; base do cenário `order-timeout` |

### Credenciais fictícias

| Usuário | E-mail | Senha | Perfil de dados |
| --- | --- | --- | --- |
| Ana | `ana@kurio.dev` | `Kurio2026!` | carteira principal e secundária, 1 favorito |
| Bruno | `bruno@kurio.dev` | `Kurio2026!` | carteira principal, sem favoritos |

Cupons: `KURIO10` (válido, 10%) e `LANCAMENTO20` (expirado).

### Seleção e reset de cenários

- URL: `/?scenario=payment-declined` (persistido para as próximas cargas).
- Interface: botão **Cenários de demonstração** no rodapé, com troca de cenário, disparo de eventos e **Resetar dados e sessão**.
- Console: `await __kurioMock.scenario('slow')` e `await __kurioMock.reset()`.

### Reprodução dos fluxos de falha

| Fluxo | Como reproduzir | Resultado esperado |
| --- | --- | --- |
| Preço alterado no carrinho | adicionar um NFT, abrir `/carrinho`, painel → **+10% no 1º item** | aviso anunciado e resumo recalculado |
| Cotação desatualizada no checkout | abrir **Revisar pedido**, painel → **+10%** | revisão fecha e exige nova confirmação |
| Edição esgotada | painel → **Esgotar 1º item** | item sinalizado, finalização bloqueada |
| Timeout do pedido | `?scenario=order-timeout`, confirmar compra | retentativa com a mesma chave recupera o mesmo pedido |
| Pagamento recusado | `?scenario=payment-declined`, confirmar compra | tela de recusa, carrinho preservado |
| Desconexão com pedido pendente | confirmar, painel → **Derrubar socket (5 s)**, recarregar | pedido recuperado sem nova compra |
| Sessão expirada no checkout | painel → **Expirar sessões**, qualquer ação | login e retorno ao checkout com rascunho |
| Falha de favorito | `?scenario=favorites-fail`, favoritar | rollback e mensagem de erro |
| Carregamento lento / falha transitória | `?scenario=slow` / `?scenario=flaky` | skeletons / recuperação automática |

## Arquitetura de dados

Todo dado percorre o mesmo caminho: componente → hook do TanStack Query → função de `endpoints.ts` → Axios → rede → handler MSW. Nenhum atalho existe para "dados de mentira" fora da camada de rede.

### Contratos

- `contracts.ts` é a fonte única de tipos e schemas Zod, importada pelo cliente, pelos mocks e pelos testes. Uma mudança de contrato quebra o typecheck dos três lados.
- Valores em ETH trafegam como **string decimal** (`EthString`); toda aritmética passa por `lib/money.ts` (big.js, arredondamento bancário). Quantidades são inteiras.
- Erros seguem `{ error: { code, message, fields?, details? } }` com 16 códigos tipados (`VALIDATION_ERROR`, `SESSION_EXPIRED`, `QUOTE_STALE`, `IDEMPOTENCY_CONFLICT`...). `fields` é mapeado direto para os campos do formulário.

#### Endpoints REST

| Método | Rota | Auth | Respostas |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | — | 201 `Session` · 422 · 409 `EMAIL_TAKEN`/`USERNAME_TAKEN` |
| POST | `/api/auth/login` | — | 200 `Session` · 401 `INVALID_CREDENTIALS` |
| GET | `/api/auth/session` | sim | 200 `Session` · 401 `SESSION_EXPIRED` |
| POST | `/api/auth/logout` | sim | 204 (encerra os sockets do usuário) |
| GET | `/api/nfts?q&category&network&minPrice&maxPrice&sort&tab&page` | — | 200 `CatalogResponse` (itens, paginação, facetas) |
| GET | `/api/nfts/:id` | — | 200 `Nft` · 404 |
| GET / PUT / DELETE | `/api/favorites[/:id]` | sim | 200 `{ nftIds }` · 404 · 500 |
| GET | `/api/cart` | opcional | 200 `Cart` (visitante via `X-Cart-Id`) |
| POST | `/api/cart/items` | opcional | 201 `Cart` · 409 `AVAILABILITY_CONFLICT` |
| PATCH / DELETE | `/api/cart/items/:itemId` | opcional | 200 `Cart` · 404 · 409 |
| POST | `/api/cart/merge` | sim | 200 `Cart` |
| POST / DELETE | `/api/cart/coupon` | opcional | 200 `Cart` · 422 `COUPON_INVALID`/`COUPON_EXPIRED` |
| POST | `/api/quotes` | opcional | 200 `Quote` (subtotal, desconto, taxa, total, `hash`) |
| POST | `/api/orders` + `Idempotency-Key` | sim | 201 `Order` · 200 mesma tentativa · 409 `QUOTE_STALE`/`AVAILABILITY_CONFLICT`/`IDEMPOTENCY_CONFLICT`/`WALLET_REJECTED` |
| GET | `/api/orders/:id` | sim | 200 `Order` · 404 (inclusive para pedido de outro usuário) |
| GET / PATCH | `/api/me/profile` | sim | 200 `Profile` · 422 · 409 |
| POST | `/api/me/password` | sim | 204 · 422 |
| GET / PUT | `/api/me/wallets[/:slot]` | sim | 200 `WalletsResponse` · 422 |
| GET / POST / DELETE | `/api/me/wallet-connection` | sim | conexão simulada · 409 `WALLET_REJECTED` |

### Axios (`http.ts`)

- Request: injeta `Authorization: Bearer` da sessão e `X-Cart-Id` do visitante.
- Response: normaliza tudo em `ApiError` (`code`, `status`, `fields`, `isTransient`). Timeout vira `TIMEOUT`; sem resposta vira `NETWORK`; cancelamento vira `CANCELED`.
- 401 em requisição que levava token encerra a sessão como `expired` — a reação (limpar cache, redirecionar) fica no `SessionWatcher`, não no interceptor.
- Timeout configurável (`VITE_HTTP_TIMEOUT`, 8 s), base para o cenário de timeout de pedido.

### TanStack Query

| Dado | Chave | staleTime | Detalhe |
| --- | --- | --- | --- |
| Catálogo | `['nfts','list', paramsNormalizados]` | 30 s | `keepPreviousData`; `signal` cancela a anterior |
| Detalhe | `['nfts','detail', id]` | 30 s | sem retry em 404 |
| Carrinho | `['cart','user:id' ou 'guest:id']` | 10 s | mutations gravam a resposta direto no cache |
| Cotação | `['quote', owner, cart.version]` | 0 | invalidada por mutations e eventos |
| Privados | `['private', userId, ...]` | 15 s | removidos ao fim da sessão |
| Pedido | `['private', userId, 'order', id]` | 0 | polling de 5 s enquanto pendente |

- Retry só para falha transitória (rede, timeout, 5xx), até 2 vezes, backoff 500 ms → 4 s. Mutations nunca têm retry automático.
- Respostas fora de ordem são descartadas por construção: a chave inclui os parâmetros normalizados (arrays ordenados) e a requisição anterior é abortada via `AbortSignal`.
- Atualização otimista com rollback nos favoritos (`onMutate` / `onError`).
- Isolamento por usuário: tudo privado vive sob `['private', userId]`, removido em logout, expiração ou troca de usuário.

### TanStack Router

- Árvore code-based em `router.tsx` (sem gerador), tipada via `declare module ... Register`.
- Busca, filtros, ordenação e paginação moram na URL e são validados com Zod (`validateSearch`, com `.catch(undefined)` para valores inválidos). Listas múltiplas usam CSV (`category=arte-digital,musica`).
- Mudança de filtro remove `page`; a busca usa debounce de 350 ms e entra no histórico.
- Rotas privadas (`/checkout`, `/perfil/*`, `/pedido/:id`) usam `beforeLoad` que redireciona para `/entrar?redirect=<href>`.
- Carrinho, checkout, pedido, auth, perfil e painel de cenários são carregados sob demanda (`lazyRouteComponent`); início e detalhe ficam no bundle inicial porque são as páginas auditadas.
- `notFoundComponent` na raiz trata rotas inexistentes; NFT e pedido inexistentes têm 404 próprio.

## Backend simulado (MSW)

O MSW atua como um backend completo e com estado: um único banco em memória, persistido no `localStorage`, alimenta tanto as respostas REST quanto os eventos Socket.IO, então os dois nunca divergem.

### Banco e persistência

- `db.ts` guarda catálogo, usuários, sessões, carrinhos, favoritos, perfis, carteiras, conexões de carteira, cotações, pedidos, chaves de idempotência e flags de cenário.
- Persistido em `kurio:mock:db` com número de schema. Subir o `SCHEMA` força a recriação da seed — garante que atualizações da seed, como a troca de assets, cheguem ao navegador sem dados obsoletos.
- Reset (`POST /__mock/reset` ou botão no rodapé) restaura integralmente a seed.
- Senhas são guardadas apenas como `sha256("kurio-salt:" + senha)` via `crypto.subtle`; as das contas seed foram pré-calculadas.

### Fixtures

- 72 NFTs gerados com PRNG `mulberry32` (seed 2026): mesma saída em dev, demo e testes.
- Os 9 primeiros reproduzem exatamente o grid do Figma (nomes, números, preços, o "RARO" e o preço riscado do Neon Vessel).
- Cada NFT tem 4 edições (1/1, 1/10, 1/50, aberta) com preço e estoque próprios; `golden-signal-160` tem edições esgotadas de propósito.
- 2 usuários (`ana@kurio.dev` com 2 carteiras e 1 favorito; `bruno@kurio.dev` com 1 carteira), senha `Kurio2026!`. Cupons: `KURIO10` válido, `LANCAMENTO20` expirado.

### Wrapper de rota (`mocks/http.ts`)

Cada handler passa por `route(name, resolver)`, que aplica em ordem: contador de chamadas, latência do cenário, falha de conexão (`offline`), 503 na primeira chamada GET (`flaky`) e conversão de `ApiFailure` em resposta HTTP tipada. As regras de negócio lançam `ApiFailure`; nenhum handler monta erro à mão.

### Cenários

Selecionados por `?scenario=`, pelo painel no rodapé ou por `window.__kurioMock.scenario()`; persistidos no `localStorage` para serem lidos antes do app iniciar (é assim que os testes os fixam).

| Cenário | O que simula |
| --- | --- |
| `default` | latência 120–370 ms, seed fixa |
| `slow` | toda resposta em 2,5 s (skeletons) |
| `variable-latency` | catálogo alterna 1,8 s / 0,2 s → respostas fora de ordem |
| `empty` | catálogo vazio |
| `offline` | `HttpResponse.error()` em todo REST |
| `flaky` | 1ª chamada GET de cada rota → 503 |
| `server-error` | catálogo e detalhe → 500 |
| `session-expired` | sessão dura 45 s |
| `favorites-fail` | mutations de favorito → 500 |
| `price-change` | 1º envio de pedido: preço +10% → `QUOTE_STALE` |
| `sold-out` | 1º envio de pedido: edição esgota → `AVAILABILITY_CONFLICT` |
| `order-timeout` | pedido criado, resposta em 12 s (> 8 s do Axios) |
| `payment-declined` | liquidação recusa |
| `wallet-reject` | conexão de carteira recusada |

### Endpoints de controle

`/__mock/reset`, `/__mock/scenario`, `/__mock/nfts/:id` (altera preço/estoque e emite evento), `/__mock/realtime/drop` (derruba sockets e recusa reconexão por N ms), `/__mock/realtime/replay` (duplicata ou evento antigo), `/__mock/session/expire`. Ficam na camada de rede para que painel e testes produzam efeitos pelos mesmos caminhos de produção — evitando o critério eliminatório de "eventos simulados diretamente na UI".

## Tempo real (Socket.IO via MSW)

O cliente usa o `socket.io-client` real; o servidor é simulado com `ws.link('wss://realtime.kurio.mock/*')` do MSW + `@mswjs/socket.io-binding`, que codifica/decodifica o protocolo Engine.IO/Socket.IO. Nada na UI chama setters diretamente a partir de um evento simulado.

### Eventos

Envelope: `{ eventId, resource: { type, id }, version, emittedAt, data }`.

| Evento | Destino | Efeito no cliente |
| --- | --- | --- |
| `nft.updated` | todas as conexões | atualiza listas e detalhe se `version` > cache; NFT presente em carrinho em cache → invalida carrinho + cotação e mostra toast de preço ou disponibilidade |
| `order.updated` | só conexões do dono | atualiza o pedido se `version` > cache; estado terminal → invalida carrinho e cotação |

### Fluxo de um evento de preço

1. Painel ou teste chama `POST /__mock/nfts/emerald-ape-042`.
2. `mutateNft()` altera o banco, incrementa `version`, persiste e chama `emitNftUpdated()`.
3. O servidor simulado envia `nft.updated` a cada conexão aberta.
4. `VersionTracker.accept()` descarta `eventId` já visto e versões menores ou iguais.
5. `applyNft()` grava preço/estoque nas queries de catálogo e detalhe; invalida carrinho e cotação.
6. O carrinho refaz `GET /cart` (com `notice: price_changed`) e `POST /quotes` (novo `hash`).
7. Se a revisão do checkout está aberta e o `hash` mudou, ela fecha e exige nova confirmação.

### Garantias

- **Idempotência:** duas camadas — `VersionTracker` (eventId + versão por recurso) e a comparação de versão no próprio cache. Duplicatas e eventos antigos não regridem estado nem repetem toasts (testado contando inserções no DOM).
- **Isolamento:** uma conexão por sessão, autenticada pelo token na query string; o servidor só envia `order.updated` ao dono. Trocar de usuário ou sair desmonta o efeito: listeners removidos, socket desconectado.
- **Reconciliação:** todo `connect` após o primeiro invalida catálogo, carrinho, cotação e pedidos. Eventos perdidos na queda são recuperados via REST. Pedidos pendentes têm polling de 5 s como rede de segurança.
- **Status visível:** indicador no rodapé (bolinha + texto `aria-live`), usado também pelos testes para esperar a conexão.

### Limitações do transporte

- Só transporte `websocket`; sem namespaces, rooms ou acks no binding.
- O binding responde o handshake, mas não envia heartbeat. O mock envia `ping` a cada 20 s; sem isso o cliente desconecta em 30 s.
- O `engine.io-client` captura `globalThis.WebSocket` ao ser avaliado. Por isso o `socket.io-client` é importado dinamicamente dentro do efeito, depois do `worker.start()`. Importá-lo antes faz a interceptação falhar em silêncio (`ERR_NAME_NOT_RESOLVED`).
- Recusar a conexão fechando o socket no mesmo tick deixava o cliente preso em CONNECTING; o fechamento é adiado um tick e o cliente tem `timeout: 5000`. Reconexão após queda leva cerca de 5–6 s.

## Fluxos de negócio

Os quatro fluxos críticos — sessão, carrinho, checkout e pedido — foram desenhados para sobreviver a refresh, queda de rede e expiração sem perder contexto nem duplicar compra.

### Sessão

- `sessionStore` vive fora do React (lido por Axios e socket) e expõe `useSession` via `useSyncExternalStore`. Persiste só `{ token, user, expiresAt }`; nunca a senha.
- Ao iniciar, a sessão restaurada é validada em `GET /auth/session`.
- Fim da sessão (`logout` ou `expired`) dispara `onEnd`. O `SessionWatcher` cancela e remove `['private', userId]`, carrinho e cotação do usuário; em rota privada, redireciona para `/entrar?redirect=<href>&expired=true`.
- Abas sincronizadas pelo evento `storage`.
- Login via modal no desktop (o botão do header é um `DialogTrigger`, então o foco volta a ele) e páginas `/entrar` e `/cadastro` para mobile e redirecionamentos. O `redirect` só aceita caminhos internos (começa com `/` e não com `//`).

### Carrinho

- Fonte de verdade no servidor simulado. Visitante identificado por `X-Cart-Id`; usuário, pela sessão.
- Login ou cadastro chamam `POST /cart/merge`: soma quantidades do visitante, limita ao estoque e herda o cupom se o usuário não tiver um.
- Cada item recebe `notice` quando preço ou estoque mudaram desde a última revisão: `price_changed` (só aviso), `availability_reduced` e `sold_out` (bloqueiam a finalização). Alterar a quantidade aceita o preço atual.
- Totais vêm sempre da cotação (`POST /quotes`); o cliente só formata.

### Checkout

1. Formulário pré-preenchido pela carteira principal + perfil, preenchendo apenas campos vazios. Rascunho salvo no `localStorage` para sobreviver a expiração de sessão.
2. Seleção de carteira cadastrada (principal ou secundária), provedor e rede; **Conectar carteira** chama `POST /me/wallet-connection` (pode ser recusada); há **Desconectar**.
3. **Revisar pedido** valida o formulário com Zod, exige carteira conectada e abre o diálogo de revisão guardando o `hash` da cotação revisada.
4. Se um evento muda a cotação com a revisão aberta, ela fecha e pede nova confirmação.
5. **Confirmar compra** monta o corpo; mesma cotação + mesmos dados reaproveitam a chave de idempotência, qualquer mudança gera chave nova.
6. A tentativa (chave + corpo) é gravada no `localStorage` antes do envio. Um `useRef` bloqueia cliques repetidos no mesmo tick.
7. Timeout ou falha de rede → até 3 retentativas com a mesma chave. `QUOTE_STALE` ou `AVAILABILITY_CONFLICT` → atualiza carrinho e cotação, mostra aviso, exige nova revisão.
8. Após refresh, o checkout oferece **Retomar sem duplicar** ou leva ao pedido já criado.

### Pedido e recibo

- No servidor, `POST /orders` exige `Idempotency-Key`: mesma chave + mesmo corpo devolve o mesmo pedido; mesma chave + corpo diferente → `409 IDEMPOTENCY_CONFLICT`.
- Antes de criar, revalida estoque e recalcula a cotação comparando o `hash` enviado.
- O pedido nasce `pending` e liquida em 3 s: `confirmed` ou `declined` (ambos terminais). A liquidação revalida estoque, decrementa disponibilidade (emitindo `nft.updated`) e remove do carrinho **só as quantidades compradas**. Recusa preserva o carrinho.
- Liquidação ocorre por timer na página ou na próxima leitura de `GET /orders/:id`, de modo que refresh e reconexão recuperam o estado.
- O recibo usa exclusivamente o snapshot gravado no pedido; alterar o catálogo depois não muda os valores (há teste para isso).
- Pedido de outro usuário responde 404, sem revelar sua existência.

## Interface, acessibilidade e responsividade

A identidade visual segue os frames do Figma enviados em PNG; as cores foram amostradas pixel a pixel e viraram tokens HSL, e os componentes shadcn foram reescritos sobre esses tokens.

### Tokens

| Token | Hex | Uso |
| --- | --- | --- |
| `--background` | #140D0A | fundo da página |
| `--surface` | #241612 | cards, sidebar, diálogos |
| `--band` | #442C1A | faixa do rodapé, campos de newsletter |
| `--primary` | #D28A4C | ações, preços, estados ativos |
| `--border` | #3F2319 | divisórias e contornos |
| `--foreground` | #F5F1EB | texto principal |

Fonte: Roboto Mono local via `@fontsource` (subset latin, 400 e 700), alinhada à tipografia monoespaçada dos frames.

### Componentes

- `ui/` contém versões adaptadas de Button (CVA), Input, Label, Dialog (Radix; variantes central e lateral), Skeleton com shimmer, PasswordInput e `Field`.
- `Field` liga label, `aria-invalid`, `aria-describedby` (erro e dica) e `aria-required`; o asterisco é decorativo.
- `useZodForm` (em `lib/`) valida no blur e no submit, aplica erros de campo vindos da API e foca o primeiro campo inválido. Evitou depender de react-hook-form.
- `NativeSelect` usa `<select>` nativo para acessibilidade; o fundo e a seta ficam em `style` porque o `tailwind-merge` removia `bg-transparent` ao combinar classes de fundo arbitrárias.

### Acessibilidade

- Skip link, foco visível global, `main` focável.
- Diálogos com foco preso e devolvido ao gatilho.
- Estados não dependem só de cor: `aria-pressed` em filtros, edições e favoritos; texto "(esgotada)"; marcador ✓ em filtros ativos.
- Mutations e mudanças em tempo real anunciadas por toasts (`aria-live`); total do resumo e status do socket também.
- `prefers-reduced-motion` desliga shimmer e animações; skeletons preservam as dimensões do conteúdo.
- Ações fora do escopo (Criadores, Aprenda, Atividade, Ofertas, Downloads, Suporte, redes sociais, newsletter, login social, recuperar senha) mostram "não faz parte desta demonstração" em vez de fingir sucesso.

### Responsividade

- Larguras verificadas: 390, 768 e 1440 px, sem overflow horizontal (medido por script nas 5 rotas principais).
- Mobile segue os frames: sem header; barra inferior com início, favoritos, explorar, carrinho e perfil; barra superior com voltar + título; breadcrumbs ocultos.
- Filtros viram drawer lateral no mobile; o rótulo "Ordenar por" fica só para leitor de tela abaixo de 640 px.

### Desvios do Figma

| Item | Decisão | Motivo |
| --- | --- | --- |
| Faixa de preço | dois campos numéricos + Aplicar | operável por teclado sem slider customizado |
| Login/cadastro | modal no desktop + páginas `/entrar` e `/cadastro` | ambos os frames existem; a página permite `redirect` |
| Pagamento | passo extra de revisão em diálogo | requisito de revisar e reconfirmar |
| Carteira | botões Conectar/Desconectar | requisito de simular conexão, recusa e desconexão |
| Painel de cenários | botão no rodapé, só com mocks | demonstração e testes manuais |
| Imagens | artes finais em PNG em `public/nfts`, com miniaturas dedicadas | fidelidade às artes do projeto |

## Testes E2E e regressão visual

A suíte tem 46 testes Playwright — 35 em desktop (1440 px) e 11 em mobile (390 px, marcados `@mobile`) — todos passando contra o build de preview com mocks ativos.

### Isolamento

- Cada teste abre um contexto de navegador novo: `localStorage` e Service Worker vazios, então o MSW sempre parte da seed.
- A fixture `test` injeta cenário e latência via `addInitScript` antes do app iniciar (opções `scenario` e `latency` por `test.use`).
- Helpers: `login`, `addToCart`, `reviewCheckout`, `waitRealtime` e `mock()` (chama `/__mock/*` pela rede).

### Cobertura dos 12 itens do enunciado

| Item | Spec | O que verifica |
| --- | --- | --- |
| 1 Busca, filtros, ordenação, paginação, histórico | `catalog.spec` | URL, reset de página, refresh, voltar, respostas fora de ordem, vazio |
| 2 Detalhe direto e inexistente | `catalog.spec` | edição esgotada, limite de quantidade, 404 de NFT e de rota |
| 3 Cadastro, login, expiração, logout, troca de usuário | `auth.spec` | conflito de e-mail, credencial inválida, rascunho preservado, isolamento |
| 4 Favoritos com falha e recuperação | `favorites.spec` | persistência, rollback otimista |
| 5 Carrinho, cupom, persistência | `cart.spec` | quantidades, remoção, cupom inválido/expirado/válido, merge no login |
| 6 Compra completa | `checkout.spec` | catálogo → login → revisão → recibo; snapshot imutável |
| 7 Falha, clique repetido, timeout | `checkout.spec` | recusa preserva carrinho; 3 cliques = 1 POST; mesma chave em retentativa |
| 8 Perfil, avatar, senha, carteiras | `profile.spec` | erros de validação e da API, persistência |
| 9 Preço/disponibilidade via Socket.IO no checkout | `realtime.spec` | revisão invalidada, `QUOTE_STALE`, bloqueio por esgotado |
| 10 Duplicatas, antigos, desconexão, pedido pendente | `realtime.spec` | contagem de avisos no DOM, reconciliação, refresh sem nova compra |
| 11 Teclado, foco, formulários | `a11y-loading.spec` | skip link, foco preso e devolvido, `aria-describedby` |
| 12 Skeletons, falha, nova tentativa | `a11y-loading.spec` | `slow`, `server-error` + retry, `flaky` |

### Regressão visual

- Início, detalhe, carrinho e pagamento, em desktop e mobile (8 baselines), full page, com toasts e indicador de socket mascarados e `reducedMotion`.
- Antes da captura, imagens lazy são forçadas a carregar e aguarda-se `document.fonts.ready`.
- Baselines separadas por plataforma (`__screenshots__/{linux|win32|darwin}`) porque a renderização de fontes difere entre sistemas.

### Execução

- `webServer` builda e sobe o preview automaticamente; relatório HTML e trace nas falhas.
- Timeout de 60 s por teste; o de carrinho tem 90 s por ser longo.
- Validação: 46/46 passando em Linux e em Windows (PowerShell), cerca de 1,9 min com 6 workers.

### Controle de rede, tempo e eventos

- **Latência:** zerada por padrão nos testes para determinismo; real nos cenários `slow` e `variable-latency`.
- **Tempo:** liquidação de pedidos em 3 s determinísticos; expiração de sessão por `POST /__mock/session/expire` ou pelo cenário `session-expired` (45 s); timeout de pedido por resposta de 12 s contra limite de 8 s do Axios.
- **Eventos:** disparados exclusivamente pela camada de rede (`/__mock/nfts/:id`, `/__mock/realtime/replay`, `/__mock/realtime/drop`), nunca por setters da UI.

### Navegador para os testes

O Playwright precisa de um Chromium. O caminho padrão é baixar o da própria ferramenta (cerca de 150 MB, uma vez):

```powershell
npx playwright install chromium
```

Sem esse download, todos os testes falham com `Executable doesn't exist at ...chromium_headless_shell-1148`. Alternativa sem download: apontar `CHROME_PATH` para um Chrome ou Edge já instalado (vídeo de falha fica desligado nesse modo, trace e screenshots continuam).

```powershell
# localizar o navegador instalado
Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
Test-Path "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
Test-Path "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
Test-Path "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

# ou descobrir pelo registro do Windows
(Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe").'(default)'

# usar o caminho que retornou True (vale só para a janela atual do terminal)
$env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run test:e2e
```

Em Linux/macOS: `CHROME_PATH=$(which google-chrome) npm run test:e2e` ou `CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:e2e`.

### Baselines por sistema operacional

Com `snapshotPathTemplate` contendo `{platform}`, cada sistema grava em `__screenshots__/linux`, `win32` ou `darwin`. Em uma máquina nova, rode `npm run test:e2e:update` uma vez antes de `npm run test:e2e`. Gere as baselines versionadas com o Chromium do Playwright (não com `CHROME_PATH`) para que coincidam com o ambiente de avaliação.

## Performance e Lighthouse

Accessibility, Best Practices e SEO atingem 100 em todas as páginas e perfis auditados, com CLS próximo de zero. Em Performance, o desktop alcança 74–84 e o mobile 70–73; a distância até a meta de 90 é explicada pela arquitetura de demonstração (backend completo executando no navegador) e pelo ambiente de medição, como detalhado abaixo.

Condições de medição: Lighthouse 12.1.0 (@lhci/cli 0.14.0), Chromium 141 headless em ambiente Linux de integração, perfil mobile padrão do Lighthouse (dispositivo móvel emulado, 4G lento simulado, CPU 4×) e preset desktop, build de produção, cenário `default`, assets em WebP 480×480, mediana de 3 execuções por página e perfil.

| Perfil | Página | Perf. | A11y | BP | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mobile | início | 70 | 100 | 100 | 100 | 3,48 s | 0 | 803 ms |
| mobile | detalhe | 73 | 100 | 100 | 100 | 3,38 s | 0,018 | 697 ms |
| desktop | início | 74 | 100 | 100 | 100 | 0,97 s | 0 | 595 ms |
| desktop | detalhe | 84 | 100 | 100 | 100 | 1,03 s | 0,104 | 286 ms |

Os relatórios HTML/JSON de cada execução e o `summary.json` com as medianas ficam em `lighthouse/reports/`. `npm run lighthouse` reproduz a auditoria completa em qualquer máquina.

### Causas

1. **MSW no caminho crítico:** o worker (~98 KB gzip) registra o Service Worker antes do primeiro fetch; long tasks de 250–450 ms atribuídas a `browser-*.js`.
2. **Avaliação do bundle inicial:** `app` + `tanstack` (~137 KB gzip) geram uma long task de 200–470 ms no mount.
3. **Ambiente de medição:** TBT de 595 ms no perfil desktop, que não aplica throttling de CPU, indica CPU bem abaixo da referência.

### Otimizações aplicadas

- Code splitting por rota (carrinho, checkout, pedido, perfil, auth, painel) e chunk separado de TanStack.
- `socket.io-client` importado sob demanda.
- Boot paralelo: o chunk do app baixa enquanto o MSW inicia.
- Preload da imagem LCP, `fetchpriority=high` nos 3 primeiros cards, `loading=lazy` no restante, `width`/`height` explícitos.
- Fontes locais só com subset latin.

### Evolução de performance

- Shell estático do hero no `index.html` para antecipar o LCP sem reduzir funcionalidade.
- Gerar o catálogo do mock de forma preguiçosa e adiar a serialização do `localStorage`.
- Preload do woff2 principal ou `font-display: optional` para investigar o CLS de 0,104 no detalhe desktop.
- Servir as artes em WebP/AVIF via `<picture>`, mantendo PNG como fallback.

## Registro de decisões e problemas

As decisões abaixo foram tomadas durante o desenvolvimento; os problemas foram encontrados ao executar a aplicação e os testes, não em revisão de código.

### Decisões

| Decisão | Alternativa descartada | Motivo |
| --- | --- | --- |
| ETH como string + big.js | `number` | precisão exigida; 0,1 + 0,2 em ponto flutuante quebra totais |
| Contratos em um único `contracts.ts` com Zod | tipos duplicados por camada | cliente, mocks e testes quebram juntos se o contrato muda |
| Backend com estado no MSW, persistido | respostas estáticas por handler | REST e eventos precisam refletir o mesmo dado |
| TanStack Router code-based | file-based com gerador | árvore pequena e explícita, sem etapa de geração |
| Filtros em CSV na URL | arrays JSON na URL | URLs legíveis e compartilháveis |
| Busca com debounce em `push` | `replace` no histórico | preserva a entrada da página anterior no histórico |
| `useZodForm` próprio | react-hook-form | erros da API por campo e foco no inválido com pouco código |
| Chave de idempotência por tentativa (cotação + dados) | chave por clique ou por sessão | retentativa recupera o mesmo pedido; mudança de valores exige nova chave |
| Liquidação preguiçosa + timer | só timer | o estado do pedido sobrevive a refresh e reconexão |
| Dedupe em duas camadas (tracker + versão no cache) | só eventId | evento antigo com id novo não pode regredir estado |
| Carrinho no servidor com merge | carrinho só no cliente | preserva itens do visitante ao autenticar e valida estoque |
| Login em modal + páginas | só modal | frames mobile são páginas; redirecionamento precisa de rota |
| Header oculto no mobile | header único responsivo | fidelidade aos frames mobile |
| Baselines visuais por plataforma | baseline única | Linux, Windows e macOS renderizam fontes de forma diferente |
| `cross-env` nos scripts | sintaxe `VAR=x cmd` | scripts portáveis entre PowerShell, cmd e shells Unix |

### Problemas detectados e soluções

| Problema | Como foi detectado | Solução |
| --- | --- | --- |
| Socket.IO não interceptado no build | smoke test com navegador real (`ERR_NAME_NOT_RESOLVED`) | importar o `socket.io-client` só após `worker.start()` |
| Reconexão presa em "conectando" após recusa | teste de reconciliação | fechamento adiado um tick + `timeout: 5000` no cliente |
| Foco não retornava ao botão Entrar | teste de teclado | botão convertido em `DialogTrigger` |
| Prefill sobrescrevia texto digitado | teste de expiração no checkout | preenchimento apenas de campos vazios |
| Fundo indesejado nos selects | revisão visual | `tailwind-merge` removia `bg-transparent`; estilo de fundo movido para `style` |
| Overflow de 2 px na home mobile | medição automatizada de largura | linha de ordenação com `flex-wrap` e largura máxima no select |
| Asserção sensível à duração do toast | execução paralela | contagem de inserções no DOM em vez de toasts visíveis |
| Captura visual instável no detalhe | execução paralela | carregamento forçado de imagens lazy e espera por fontes |
| Tipagem de `HTMLCollection` nos testes | typecheck | `DOM.Iterable` no `tsconfig.node.json` |
| Dados antigos após atualização da seed | troca de assets | versionamento do schema do banco simulado (`SCHEMA`) |

## Deploy e operação

O deploy recomendado é Vercel conectada ao repositório GitHub, com `VITE_ENABLE_MOCKS=true`; cada push em `main` publica, mantendo URL e código sempre iguais.

### Passo a passo de envio

A sequência abaixo roda no PowerShell (ou em qualquer shell Unix) na raiz do projeto, onde está o `package.json`.

1. **Pré-requisitos:** Node ≥ 20.11 (`node -v`) e Git.
2. **Instalar dependências e o navegador dos testes:**

   ```powershell
   npm ci
   npx playwright install chromium
   ```

   Alternativa sem download: definir `CHROME_PATH` com um Chrome ou Edge instalado (comandos na seção de testes).

3. **Validar:**

   ```powershell
   npm run typecheck
   npm run lint
   npm run test:e2e:update   # primeira execução em cada sistema operacional
   npm run test:e2e          # resultado esperado: 46 passed
   ```

4. **Auditar:**

   ```powershell
   npm run lighthouse
   ```

   Perfis podem ser executados separadamente com `npm run lighthouse:mobile` ou `npm run lighthouse:desktop`, seguidos de `node scripts/lighthouse-median.mjs` para gerar as medianas.

5. **Versionar:**

   ```powershell
   git init
   git add .
   git add -f lighthouse/reports
   git commit -m "feat: marketplace Kurio (MSW, Socket.IO, E2E, Lighthouse)"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/kurio-nft-marketplace.git
   git push -u origin main
   ```

6. **Publicar:** vercel.com/new → Import do repositório → configuração da tabela abaixo → Deploy.
7. **Verificar** a URL pública em janela anônima (checklist ao fim desta seção).
8. **Registrar:** URL pública e link do repositório no topo do README; confirmar na Vercel que o deploy de produção corresponde ao último commit.

### Configuração

| Campo | Valor |
| --- | --- |
| Framework | Vite |
| Root Directory | `./` |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | `dist` |
| Node | 20.x ou 22.x (`.nvmrc` = 22) |
| Variável | `VITE_ENABLE_MOCKS=true` |

- `vercel.json` reescreve rotas para `index.html`, exceto `assets/`, `nfts/`, `mockServiceWorker.js`, `favicon.svg` e `robots.txt` — o Service Worker precisa ser servido como arquivo real.
- `public/_redirects` cobre Netlify e Cloudflare Pages.

### Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | desenvolvimento com mocks |
| `npm run build` | typecheck + build |
| `npm run preview` | servir o build em 4173 |
| `npm run typecheck` / `npm run lint` | qualidade |
| `npm run test:e2e` | Playwright (builda e sobe o preview) |
| `npm run test:e2e:update` | regenerar baselines |
| `npm run lighthouse` | 3 medições × 2 páginas × 2 perfis + mediana |

### Verificação pós-deploy

- [ ] `/` carrega o catálogo e o indicador do rodapé fica verde
- [ ] F5 em `/nft/emerald-ape-042` abre a página (sem 404 da Vercel)
- [ ] `/checkout` sem login redireciona para `/entrar?redirect=...`
- [ ] Compra completa até o recibo
- [ ] `/?scenario=payment-declined` mostra recusa e preserva o carrinho
- [ ] DevTools → Application → Service Workers: `mockServiceWorker.js` ativo
- [ ] DevTools → Network → WS: sem `ERR_NAME_NOT_RESOLVED`

Se o socket não conectar após um novo deploy, o suspeito é um Service Worker antigo em cache: **Unregister** e recarregar.

## Escopo da simulação e evolução

O escopo do desafio está integralmente implementado. Os pontos abaixo descrevem decisões de modelagem da simulação e caminhos naturais de evolução do produto.

### Comportamento da simulação

- O estado simulado é por navegador: abas compartilham dados, como em uma sessão real do mesmo cliente.
- A liquidação de pedidos ocorre por timer na página ou na próxima leitura do pedido, garantindo recuperação após refresh.
- Taxa de rede modelada como valor fixo de 0.016 ETH, conforme os frames.
- Preços das edições 1/1 e 1/10 derivados do preço base de vitrine (edição 1/50).
- A galeria do detalhe apresenta a arte do NFT em 4 posições, como nos frames.
- Cenários `price-change`, `sold-out` e `order-timeout` disparam só na primeira tentativa (flag no banco), para que a recuperação seja testável.
- Painel de cenários fica visível no build publicado por ser parte da demonstração.

### Evolução do produto

- Shell estático do hero no `index.html` para antecipar o LCP no mobile.
- Galeria com múltiplas artes por NFT.
- Testes unitários de `money.ts`, `VersionTracker` e `services.ts`, complementando a cobertura E2E.
- Substituição do MSW por um backend real sem alteração na UI, graças aos contratos compartilhados.
