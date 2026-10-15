# Kurio — Marketplace de NFTs

Implementação do desafio frontend em React + TypeScript com TanStack Router/Query, Axios, Socket.IO, Tailwind + shadcn/ui, MSW, Playwright e Lighthouse. Todo o backend (REST + tempo real) é simulado na camada de rede pelo MSW, inclusive no build publicado.

> Decisões, contratos, política de cache, reconciliação REST × Socket.IO, limitações e desvios do Figma: ver [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Requisitos

- Node.js ≥ 20.11 (testado com 22.x) e npm 10+
- Chromium do Playwright (`npx playwright install chromium`) **ou** um Chrome/Chromium local via `CHROME_PATH`

## Setup

```bash
npm ci
cp .env.example .env        # mocks ativados por padrão
npm run dev                 # http://localhost:5173
```

### Variáveis de ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga o MSW (REST + Socket.IO). Obrigatório no build de demonstração. |
| `VITE_API_URL` | `/api` | Base REST usada pelo Axios e pelos handlers. |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.mock` | Endpoint Socket.IO interceptado pelo MSW. |
| `VITE_HTTP_TIMEOUT` | `8000` | Timeout do Axios (ms). O cenário `order-timeout` responde em 12 s. |

## Comandos

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks |
| `npm run build` | Verificação de tipos + build otimizado |
| `npm run preview` | Serve o build em `http://localhost:4173` |
| `npm run typecheck` | `tsc` da aplicação e da configuração/testes |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright (builda e sobe o preview automaticamente) |
| `npm run test:e2e:update` | Regenera as baselines visuais |
| `npm run test:e2e:report` | Abre o relatório HTML (traces das falhas incluídos) |
| `npm run lighthouse` | 3 medições × (início, detalhe) × (mobile, desktop) + mediana em `lighthouse/reports/summary.json` |

Sem acesso ao download de navegadores do Playwright: `CHROME_PATH=/caminho/do/chrome npm run test:e2e` (o vídeo é desativado nesse modo por depender do ffmpeg do Playwright).

## Credenciais fictícias

| Usuário | E-mail | Senha | Observação |
| --- | --- | --- | --- |
| Ana | `ana@kurio.dev` | `Kurio2026!` | Carteira principal + secundária; 1 favorito |
| Bruno | `bruno@kurio.dev` | `Kurio2026!` | Só carteira principal; sem favoritos |

Senhas são guardadas apenas como `sha256` no banco simulado. Cupons: `KURIO10` (válido, 10%), `LANCAMENTO20` (expirado); qualquer outro é inválido.

## Cenários de simulação

Seleção, por ordem de prioridade:

1. Query string: `/?scenario=payment-declined` (fica persistido)
2. Botão **Cenários de demonstração** no rodapé (também permite reset e disparo de eventos)
3. Console: `await __kurioMock.scenario('slow')`

| Cenário | Efeito |
| --- | --- |
| `default` | Latência de 120–370 ms (seed fixa) |
| `slow` | Todas as respostas em ~2,5 s (skeletons) |
| `variable-latency` | Requisições ímpares do catálogo em 1,8 s, pares em 0,2 s → respostas fora de ordem |
| `empty` | Catálogo vazio |
| `offline` | Falha de conexão em todo REST |
| `flaky` | 1ª chamada de cada rota GET retorna 503; o retry automático recupera |
| `server-error` | Catálogo e detalhe retornam 500 |
| `session-expired` | Sessão expira 45 s após o login |
| `favorites-fail` | Mutations de favoritos retornam 500 (rollback otimista) |
| `price-change` | 1ª tentativa de pedido: preço do 1º item +10% → `409 QUOTE_STALE` |
| `sold-out` | 1ª tentativa de pedido: edição do 1º item esgota → `409 AVAILABILITY_CONFLICT` |
| `order-timeout` | Pedido criado, resposta após 12 s → timeout do Axios → retentativa com a mesma chave recupera o mesmo pedido |
| `payment-declined` | Liquidação recusa o pagamento |
| `wallet-reject` | Conexão da carteira recusada |

### Reset

Botão **Resetar dados e sessão** no painel, ou `await __kurioMock.reset()` seguido de `localStorage.clear()`. O reset restaura integralmente a seed (catálogo, usuários, carrinhos, favoritos, perfis, carteiras, pedidos).

### Controles de rede e eventos (`window.__kurioMock`)

Todos chamam endpoints `/__mock/*` interceptados pelo MSW; os efeitos chegam à UI por REST e Socket.IO, como em produção.

```js
await __kurioMock.updateNft('emerald-ape-042', { priceDeltaPct: 10 })   // emite nft.updated
await __kurioMock.updateNft('emerald-ape-042', { available: 0, edition: '1/50' })
await __kurioMock.replay('duplicate')     // reenvia o último evento (mesmo eventId)
await __kurioMock.replay('stale')         // reenvia com versão menor
await __kurioMock.dropRealtime(5000)      // derruba o socket e recusa reconexões por 5 s
await __kurioMock.expireSessions()        // força SESSION_EXPIRED na próxima chamada
```

## Reproduzindo os fluxos de falha

| Fluxo | Passos |
| --- | --- |
| Preço muda no carrinho | Adicione um NFT → `/carrinho` → painel: **+10% no 1º item** → aviso + resumo atualizado |
| Checkout com cotação desatualizada | Entre, abra **Revisar pedido** → painel: **+10%** → revisão fecha e exige nova confirmação |
| Edição esgota | Painel: **Esgotar 1º item** → item sinalizado, finalização bloqueada |
| Timeout do pedido | `?scenario=order-timeout` → confirme → ~8 s depois a retentativa recupera o mesmo pedido |
| Pagamento recusado | `?scenario=payment-declined` → confirme → "Pagamento recusado", itens preservados |
| Desconexão com pedido pendente | Confirme → painel: **Derrubar socket (5 s)** → recarregue → pedido recuperado sem nova compra |
| Sessão expirada no checkout | No checkout: painel **Expirar sessões** → qualquer ação → login → volta ao checkout com rascunho |
| Falha de favorito | `?scenario=favorites-fail` → favoritar → rollback + mensagem |

## Testes E2E

46 testes (35 desktop 1440 px + 11 mobile 390 px, marcados com `@mobile`), cobrindo os 12 itens do enunciado, incluindo regressão visual de início, detalhe, carrinho e pagamento (baselines em `tests/e2e/__screenshots__`). Cada teste usa um contexto de navegador novo (storage e Service Worker isolados), com cenário e latência definidos antes da inicialização da aplicação.

As baselines foram geradas com Chromium 141. Em outro ambiente, gere-as novamente com `npm run test:e2e:update` antes de versionar, para evitar diferenças de renderização de fonte.

## Deploy

`vercel.json` (rewrites SPA preservando `mockServiceWorker.js` e assets) e `public/_redirects` (Netlify/Cloudflare Pages) estão incluídos. Configure `VITE_ENABLE_MOCKS=true` no provedor.
