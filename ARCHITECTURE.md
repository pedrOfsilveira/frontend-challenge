# Arquitetura e decisões

Este documento descreve a implementação integrada: o que o código faz e por quê.
O que cada requisito tem como evidência está em [docs/evidencias.md](docs/evidencias.md).
Quando algo é comportamento pretendido sem medição final, o texto diz isso.

## Responsabilidades

SPA Vite com React 19/TypeScript, TanStack Router, TanStack Query, Axios,
Tailwind 4 e shadcn/Radix. O MSW intercepta REST e WebSocket em desenvolvimento
e no build de demonstração. O Socket.IO usa o `socket.io-client` real, com o
protocolo simulado por `ws.link` do MSW e `@mswjs/socket.io-binding`. Não há
blockchain nem pagamento real.

| Camada | Pasta | Papel |
|---|---|---|
| Contratos | `src/api/contracts` | Schemas Zod de REST, erros e eventos; tipos derivados. |
| Transporte | `src/api/http.ts`, `src/api/endpoints` | Axios (timeout 10 s), token, validação das respostas, `ApiError`. |
| Estado remoto | `src/features/*/queries.ts`, `src/api/query-keys.ts` | Queries/mutations e chaves por usuário e parâmetro. |
| Tempo real | `src/realtime` | Cliente Socket.IO, ledger, aplicação dos eventos e reconciliação. |
| Rotas | `src/routes` | Navegação, search params, proteção de `_privado`. |
| Mocks | `src/mocks` | Banco, domínio, handlers, cenários de rede, servidor Socket.IO e controles. |

Componentes não importam fixtures nem têm caminhos alternativos de negócio. O
`main.tsx` só carrega `src/mocks/browser.ts` quando `VITE_ENABLE_MOCKS === 'true'`.
A interface renderiza logo; Axios e Socket.IO aguardam o worker ficar pronto
(`setTransportReady`/`whenTransportReady`), para nenhuma requisição sair sem handler.

## Valores em ETH

ETH é sempre string decimal (até 18 casas) no transporte, no estado, na URL e no
banco simulado. `src/lib/eth.ts` converte para wei (`bigint`) para somar,
multiplicar por quantidade, subtrair e aplicar percentuais em basis points
(arredondando para baixo). Nenhum valor monetário passa por `number`.
Quantidades e basis points são inteiros. A cotação do servidor é a referência do
total: a interface exibe subtotal, desconto, taxa e total como a API os devolve.

## Contratos REST

Base `/api` (configurável por `VITE_API_URL`), JSON. Conta autenticada usa
`Authorization: Bearer <token>`. O visitante identifica o carrinho com
`X-Guest-Cart: guest_<uuid>`. Schemas completos em `src/api/contracts/`.

| Método e recurso | Entrada / saída principal |
|---|---|
| `POST /auth/register` | displayName, username, email, senha → sessão, usuário e avisos da mescla do carrinho (`cartMerge`). |
| `POST /auth/login` | email, senha → mesma resposta. |
| `GET /auth/session` | Sessão atual e usuário. |
| `POST /auth/logout` | Revoga o token. |
| `GET /nfts` | Busca, categorias, redes, faixa de preço, aba, sort, page/pageSize → items, total, páginas e facets. |
| `GET /nfts/featured` | Destaques. |
| `GET /nfts/:id` · `GET /nfts/:id/related` | Detalhe com edições · relacionados. |
| `GET /favorites` | IDs e resumos dos favoritos. |
| `PUT /favorites/:nftId` · `DELETE /favorites/:nftId` | Incluir · remover → lista atual. |
| `GET /cart` | Carrinho com versão, linhas, disponibilidade e cupom. |
| `POST /cart/items` | nftId, editionId, quantity → carrinho. |
| `PATCH /cart/items/:lineId` · `DELETE /cart/items/:lineId` | Quantidade · remoção → carrinho. |
| `PUT /cart/coupon` · `DELETE /cart/coupon` | Aplicar · remover → carrinho. |
| `GET /cart/quote?network=…&since=…` | Linhas, subtotal, desconto, taxa, total, validade e diferenças em relação a `since`. |
| `POST /orders` | Header `Idempotency-Key`; quoteId, walletId, collector, note → pedido (snapshot). |
| `GET /orders` · `GET /orders/:id` | Pendentes · estado e snapshot. |
| `GET /profile` · `PUT /profile` | Perfil · alterações validadas. |
| `PUT /profile/avatar` | Data URL PNG/JPEG/WebP até 512 KB, ou `null`. |
| `PUT /profile/password` | Senha atual, nova e confirmação → sem corpo. |
| `GET /wallets` | Slots `primary`/`secondary`, cada um carteira ou `null`. |
| `PUT /wallets/:slot` · `DELETE /wallets/:slot` | Cadastro/edição · remoção (só a secundária). |
| `POST /wallets/:id/connect` · `POST /wallets/:id/disconnect` | Conexão simulada aceita/recusada · desconexão. |

Erros seguem `{ error: { code, message, fields?, details? } }`. `ApiError`
normaliza HTTP, rede, timeout, cancelamento e resposta fora do contrato, e marca
o que é transitório. Os handlers emitem 401 (`UNAUTHENTICATED`, `SESSION_EXPIRED`,
`INVALID_CREDENTIALS`), 404, 409 (estoque, cotação desatualizada, idempotência,
cadastro duplicado, pedido pendente, carteira), 422 (validação, cupom) e 503.
O contrato inclui `FORBIDDEN` (403), mas nenhum handler o emite hoje: um pedido
de outra conta responde 404, sem revelar que existe.

## Sessão

A sessão simulada dura 2 h. O token fica no `localStorage` (`kurio.session`) para
sobreviver ao refresh; outra aba que entra ou sai é acompanhada pelo evento
`storage`. É uma simulação local, não uma estratégia de autenticação de produção.

- **Proteção:** rotas sob `_privado` (pagamento, pedido, perfil, carteiras,
  favoritos) exigem sessão. O login recebe um caminho interno validado: URLs
  externas, `//`, barras invertidas e caracteres de controle são rejeitados.
- **Expiração:** o Axios só trata um 401 como expiração quando ele pertence ao
  token ainda ativo, para que uma resposta atrasada não encerre outra conta. Se
  um refresh interromper o redirecionamento depois que o token já foi apagado,
  o motivo "expirada" fica só no `sessionStorage` da aba até login/logout. O mock
  mantém o registro vencido até logout/reset, então pedidos repetidos continuam
  recebendo `SESSION_EXPIRED`.
- **Retomada:** o rascunho do checkout fica por usuário no `sessionStorage`.
  Depois do login, o usuário volta ao pagamento com nome e observação preservados.
  Senhas digitadas nunca são persistidas.
- **Troca de identidade:** a nova identidade é publicada; as queries privadas da
  anterior são canceladas e removidas. O ledger de eventos é zerado e o socket
  reconecta com o token novo. O logout só anuncia a saída depois da resposta.

## Cache e retries

Chaves públicas: `['nfts', 'list', params]`, `['nfts', 'detail', id]`, destaques e
relacionados. Chaves privadas: `['private', 'user:<id>' | 'guest:<id>', recurso, …]`.
O escopo isola usuários e o carrinho anônimo, e respostas atrasadas caem numa
chave que ninguém mais observa. O catálogo guarda filtros e paginação na URL;
mudar um filtro volta à página 1, e o histórico restaura o estado. O
`AbortSignal` do TanStack Query chega ao Axios.

- Queries ficam frescas por 30 s, e o foco da janela não força refetch.
- Só falhas transitórias (rede, timeout, 5xx) recebem até 2 retries. 4xx não se repete.
- A criação de pedido repete até 2 vezes, com backoff e a **mesma** chave de
  idempotência. As outras mutations não repetem sozinhas.
- Mutations gravam a resposta no cache ou invalidam o que depende delas.
- `keepNewestVersion` (`structuralSharing`) impede que uma resposta REST mais
  antiga sobrescreva a versão mais nova de um recurso ou de itens de lista.
- Um pedido pendente é consultado a cada 4 s como reforço ao Socket.IO. Pedidos
  terminais ficam em cache sem refetch: o recibo é um snapshot.

**Atualização otimista com rollback (favoritos):** `onMutate` cancela a consulta
de favoritos, guarda o estado anterior e aplica a mudança. Em caso de erro,
restaura o snapshot e mostra um erro com nova tentativa. No sucesso, grava a
lista devolvida pelo servidor. A mudança otimista não significa persistência
concluída.

## Carrinho

O carrinho vive no servidor simulado (persistido) e tem versão. Visitantes têm
um id `guest_<uuid>` no `localStorage`. Login e cadastro **mesclam** o carrinho
do visitante no servidor, limitando cada linha ao estoque atual. Quando alguma
quantidade é reduzida, `cartMerge` volta na resposta e o diálogo de login mostra
"N de M unidades preservadas" antes de continuar. Depois disso, o id anônimo é
descartado.

Adicionar, alterar e remover respeitam o estoque por edição no cliente (o stepper
para no estoque) e no servidor (`OUT_OF_STOCK`). Cupom inválido ou expirado é
recusado com mensagem no campo.

## Cotação, pedido e recibo

**Revalidação:** a revisão guarda o id da cotação exibida. Ela só abre com uma
cotação real da rede escolhida, nunca com o placeholder da rede anterior. Se uma
nova cotação chegar com outro id (preço, estoque, cupom ou taxa mudou), o
pagamento fica bloqueado até o usuário confirmar os novos valores. Ao criar o
pedido, o servidor revalida cotação (incluindo validade de 10 min), versão do
carrinho, carteira, rede, conexão e disponibilidade. Qualquer diferença gera 409
com a cotação nova em `details`.

**Idempotência:** a chave (`ord_<uuid>`) é derivada do corpo canônico do pedido e
tem escopo por usuário. Fica no `sessionStorage`, então sobrevive ao refresh da
aba. Clique repetido, retry automático e reenvio após timeout usam a mesma chave:
o servidor devolve o pedido já criado. A mesma chave com outro corpo responde
409 `IDEMPOTENCY_CONFLICT`. Depois que um pedido é recebido, a chave é
descartada, para que uma compra futura seja outra tentativa. Um segundo pedido
com outro já pendente é recusado (`ORDER_PENDING`).

**Estados:** um pedido pendente reserva estoque. Confirmação e recusa são
terminais. A recusa devolve o estoque e mantém o carrinho. A confirmação remove
do carrinho só as unidades compradas: o que foi adicionado durante o pendente
permanece. A tela de confirmação só aparece com status `confirmed` vindo do servidor.

**Recibo:** o pedido grava linhas, preços unitários, cupom, taxa e total no
momento da compra. O recibo lê esse snapshot, nunca o catálogo atual. Ids de
transação e links de explorador são fictícios.

## Socket.IO

WebSocket em `/realtime/` (origem configurável por `VITE_REALTIME_URL`),
interceptado por `ws.link` e codificado pelo binding. `socket.io-client` é
importado só depois do worker pronto, porque o engine.io captura o construtor
`WebSocket` ao avaliar o módulo. O cliente usa só o transporte `websocket` e
envia o token atual a cada (re)conexão.

| Evento | Envelope e dados |
|---|---|
| `nft.updated` | `id` estável, `type`, `resource {type:'nft', id}`, `version`, `occurredAt`; preço, disponibilidade e edições. |
| `order.updated` | Mesmo envelope para `order`, mais `userId`; status, transação e motivo da recusa. |

**Ordem e duplicatas:** os payloads são validados por schema. Um ledger guarda os
últimos 500 ids (LRU) e a maior versão vista por recurso. Na decisão, ele
considera também a versão que já está no cache, vinda do REST. Duplicatas e
eventos com versão menor ou igual são descartados sem gerar requisição. Um
pedido terminal não regride nem com versão maior. O servidor publica fora da
pilha do handler REST, então evento e resposta HTTP chegam sem ordem garantida;
a versão resolve.

**Aplicação:**
- `nft.updated` corrige o preço e o estoque exibidos no detalhe, nas listas e no
  carrinho. Toda listagem volta ao REST, porque filtro de preço, ordem, total,
  páginas e facetas são do servidor. As listas ativas refazem já; as outras,
  quando montarem. Se o NFT está no carrinho, as cotações são invalidadas e um
  aviso acessível (toast + `aria-live`) descreve a mudança.
- `order.updated` atualiza o pedido em cache. Sem o pedido no cache, consulta o
  REST. Num estado terminal, carrinho e catálogo também voltam ao REST.
- Eventos de pedido de outra conta são filtrados no servidor (token revalidado a
  cada envio) e de novo no cliente (`userId` da sessão atual).

**Reconciliação:** `src/realtime/refresh.ts` pede o estado atual ao REST sem
confiar numa resposta que já estava a caminho, porque ela pode ter sido calculada
antes da mudança:
- query parada → invalida (a ativa refaz já);
- em voo, ativa e com dados → invalida, o que cancela e refaz;
- em voo sem dados (primeira carga) ou sem observador → espera a resposta e
  então invalida uma vez; se a requisição falhar ou for cancelada, só marca como velha.

A cada CONNECT (primeira conexão ou reconexão), `reconcileAfterConnect` aplica
isso a todas as queries públicas e ao escopo privado atual, exceto pedidos
terminais. Como nenhum refetch gera eventos, não há laço.

**Cleanup:** `startRealtime` devolve uma função que remove os listeners, desliga
o refresher, desconecta o socket e cancela a inscrição na sessão.

## Perfil e carteiras

Usam os mesmos contratos e chaves do checkout. O avatar é validado no cliente
(tipo, tamanho, decodificação) e no servidor. Alterar endereço, rede ou provedor
desconecta a carteira até nova conexão. A principal é editável; só a secundária
pode ser removida.

Salvar o perfil com troca de senha são duas operações: perfil, depois senha. Não
há transação conjunta. Se a senha falhar, a interface informa que os dados já
foram salvos e preserva o que foi digitado. Um logout durante a leitura do
arquivo ou entre as operações impede o envio para outra identidade.

## Interface, acessibilidade e desvios do Figma

Tokens, Roboto Mono local e assets vêm do Figma. shadcn/Radix fornece foco em
diálogos e drawers, tabs, slider e select. Os skeletons têm shimmer, reservam o
espaço do conteúdo e respeitam movimento reduzido. Formulários associam labels e
erros; feedback de mutations e de tempo real é anunciado.

O Figma tem frames desktop e mobile de 414 px. A verificação usa 390/768/1440
mais 414 para comparação direta. Perfil, carteiras e confirmação não têm frame
mobile: os campos e a navegação empilham.

Desvios intencionais:

- **Cabeçalho desktop:** inclui "Favoritos" (o Figma tem quatro itens) e mostra
  "Minha conta" para a sessão autenticada. "Criadores" aparece como indisponível.
  A altura passou de 68 para 76 px.
- **Áreas de toque:** o stepper de quantidade e as pílulas de edição mantêm a
  geometria visual do Figma (20×30 / 33×49,5 e ovais de 28 px), mas o alvo de
  toque tem 44 px, por margens negativas ou `::after`. Voltar e favoritar no
  detalhe mobile têm 44 px. Os indicadores da galeria têm alvo mínimo de 24 px.
- **Cadastro:** o Figma pede só username; a API exige também displayName, que o
  cadastro preenche com o username e pode ser editado no perfil.
- **Ações fora de escopo:** login social, recuperação de senha, newsletter e
  "Criadores" explicam a indisponibilidade. Atividade, ofertas e downloads são
  informativos. O botão central de scan da barra mobile abre um aviso: o grupo
  `15:5529` do Figma não tem descrição nem interação de protótipo, então o ícone
  não ganhou um fluxo inventado.
- **Estados não desenhados** (pendente, recusado, erros, vazios, 404) seguem os
  tokens. Pedido pendente ou recusado não mostra a tela de confirmação.
- **ENS:** o prefixo aceita apenas `.eth`. Não há seleção de redes inexistentes.
- **Assets:** quatro imagens locais (em três tamanhos WebP) se repetem nas
  fixtures; não são 48 artes distintas. Foco visível foi acrescentado onde o
  Figma não o desenha.

Axe e testes de teclado complementam a inspeção visual. Não equivalem a teste
com leitor de tela nem a certificação WCAG.

## Performance

`scripts/lighthouse.mjs` audita início e detalhe nos perfis mobile e desktop,
com 3 execuções sequenciais cada e mediana. Usa o build completo da demo
(MSW, fontes, imagens e Socket.IO ativos) e termina com exit 1 se alguma meta
não for atingida.

Os relatórios versionados em `reports/lighthouse/` são **anteriores** a esta
integração e não medem a versão final:

| Página | Perfil | P | A | BP | SEO | LCP | TBT | CLS |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Início | Mobile | 55 | 100 | 96 | 92 | 5,64 s | 952 ms | 0 |
| Início | Desktop | 97 | 100 | 96 | 92 | 1,14 s | 94 ms | 0 |
| Detalhe | Mobile | 62 | 100 | 96 | 92 | 4,85 s | 909 ms | 0 |
| Detalhe | Desktop | 98 | 100 | 96 | 92 | 1,02 s | 80 ms | 0 |

Nesses relatórios, **a meta de performance mobile (≥ 90) não foi atingida.** O
custo apontado é a execução de JavaScript na inicialização, incluindo o
bootstrap do MSW (chunk de ~176 KB transferidos). Essa é uma pista de
investigação, não a causa única comprovada. Também desde então, a reconciliação
no CONNECT faz um GET extra por query que estava em voo na primeira carga,
depois que os dados já aparecem.

Auditoria do build final: Medianas de 3 execuções (09/11/2026, commit `347e855`, preview local, Lighthouse via `pnpm audit:lighthouse`): início mobile P55/A100/BP96/SEO92, LCP 5.570 ms, CLS 0, TBT 919 ms; início desktop P97/A100/BP96/SEO92, LCP 1.129 ms, TBT 71 ms; detalhe mobile P61/A100/BP96/SEO92, LCP 4.942 ms, CLS 0, TBT 878 ms; detalhe desktop P98/A100/BP96/SEO92, LCP 1.100 ms, TBT 74 ms. Meta de performance mobile (≥90) **não atingida**. Causas medidas: primeiro render do React (~2,1 s de scripting a 4× CPU, com layouts forçados em `use-sliding-indicator` e `MobilePurchaseBar`), chunk HTTP (~600 ms, construção de schemas zod), chunk do mock (~176 KB gzip no caminho crítico do LCP do detalhe, ~77 KB de tough-cookie/tldts) e um GET extra por query em voo no primeiro CONNECT.
Não há modo exclusivo para a auditoria, e nenhuma funcionalidade foi removida
para melhorar a nota.

## Limitações do ambiente simulado

- **Escopo da aba:** o servidor simulado roda em cada aba. O banco fica no
  `localStorage` e é compartilhado, mas eventos não cruzam abas, e não há
  serialização entre abas concorrentes. Dentro da aba, as escritas passam por
  uma fila serializada.
- **Transporte Socket.IO:** o binding não simula long-polling, rooms nem
  namespaces, e não envia ping. O mock lê o token do pacote CONNECT, implementa
  heartbeat de 20 s e faz o roteamento por usuário. Conexão recusada (`offline`,
  `realtime.pause()`) é simulada com `error` + `close`.
- **Eventos perdidos:** o servidor só entrega a quem está conectado. Enquanto o
  socket está fora, a recuperação depende da reconciliação REST no CONNECT
  seguinte (ou da consulta de 4 s de um pedido pendente).
- **Reset sem recarga:** `__kurioMock.reset()` sem recarregar pode deixar
  versões altas no cache da interface, e eventos com versões reiniciadas seriam
  descartados como antigos. Use `?mock-reset`, que recarrega; os E2E também usam
  contexto novo.
- **Respostas canceladas:** respostas obsoletas do catálogo são canceladas pelo
  `AbortSignal`. O descarte de uma resposta antiga já entregue depende da chave
  por parâmetros e do `keepNewestVersion`.
- **Sem 403 emitido:** ver [Contratos REST](#contratos-rest).
- **Segurança:** token local, senhas com hash, carteiras e pagamentos servem à
  demonstração; não há operação financeira real.
- **Forks:** a análise de forks de terceiros foi estática e não é evidência
  desta entrega. Nenhum código de fork foi copiado: tudo usa os contratos locais e o Figma.

## Publicação

`vercel.json` instala com `--frozen-lockfile --ignore-scripts`, faz o build com
`pnpm build` e aplica SPA fallback, exceto para `assets/`, `api/`, `realtime/`,
o worker, `robots.txt` e `favicon.ico`. O worker recebe
`no-cache, no-store, must-revalidate` e `Service-Worker-Allowed: /`. Não há CSP
bloqueando o WebSocket simulado. `pnpm-workspace.yaml` nega o build do `msw`
porque o worker já está versionado, o que evita `ERR_PNPM_IGNORED_BUILDS`
sem liberar scripts.

Revisão publicada, URL e paridade com o repositório: pendente de validação final.
Publicação: https://racing-sable-eislhs3.vercel.app, produção Vercel construída a partir do código validado em `347e855` e enviado ao `main` de https://github.com/pedrOfsilveira/frontend-challenge.
