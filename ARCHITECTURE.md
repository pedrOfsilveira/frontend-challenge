# Arquitetura e decisões

## Responsabilidades e precisão

SPA Vite com React/TypeScript, TanStack Router, TanStack Query, Axios, Tailwind 4
e shadcn/Radix. MSW intercepta a rede em dev e no build de demonstração.
Socket.IO usa o cliente real, com protocolo simulado por MSW e
`@mswjs/socket.io-binding`. Sem blockchain ou pagamentos reais.

`src/api/contracts` define schemas Zod; `src/api/endpoints` usa Axios e valida
respostas. Features combinam queries/mutations e componentes. Rotas cuidam da
navegação/proteção. Mocks concentram fixtures, persistência, regras e falhas;
componentes não importam fixtures nem contêm caminhos alternativos de negócio.

ETH permanece string decimal no transporte/estado. Aritmética usa wei (`bigint`,
18 casas). Quantidades e basis points são inteiros. A cotação da API é autoritativa.

## Contratos REST

Base `/api`, JSON, `Authorization: Bearer <token>` para contas; visitante usa
`X-Guest-Cart: guest_<uuid>`. Schemas completos em `src/api/contracts/`.

| Método e recurso | Entrada / saída principal |
|---|---|
| `POST /auth/register` | DisplayName, username, email, senha → sessão, usuário e ajustes da mescla do carrinho. |
| `POST /auth/login` | Email, senha → mesma resposta de autenticação. |
| `GET /auth/session` | Sessão atual e usuário. |
| `POST /auth/logout` | Revoga o token. |
| `GET /nfts` | Busca, categorias/redes, preços, aba, sort, page/pageSize → items, total, páginas e facets. |
| `GET /nfts/featured` | Destaques. |
| `GET /nfts/:id` / `GET /nfts/:id/related` | Detalhe com edições / relacionados. |
| `GET /favorites` | IDs e resumos dos favoritos do usuário. |
| `PUT /favorites/:nftId` / `DELETE /favorites/:nftId` | Incluir/remover → lista atual. |
| `GET /cart` | Carrinho com versão, linhas, disponibilidade e cupom. |
| `POST /cart/items` | nftId, editionId, quantity → carrinho. |
| `PATCH /cart/items/:lineId` / `DELETE /cart/items/:lineId` | Quantidade / remoção → carrinho. |
| `PUT /cart/coupon` / `DELETE /cart/coupon` | Aplicar código / remover → carrinho. |
| `GET /cart/quote?network=…&since=…` | Linhas, subtotal, desconto, taxa, total, validade e ajustes. |
| `POST /orders` | `Idempotency-Key`; quoteId, walletId, collector, note → pedido snapshot. |
| `GET /orders` / `GET /orders/:id` | Pendentes / estado e snapshot; outro usuário recebe 404. |
| `GET /profile` / `PUT /profile` | Perfil / alterações validadas → perfil atualizado. |
| `PUT /profile/avatar` | Data URL PNG/JPEG/WebP até 512 KB ou null → perfil. |
| `PUT /profile/password` | Senha atual, nova e confirmação → resposta sem corpo. |
| `GET /wallets` | Slots primary/secondary, cada um carteira ou null. |
| `PUT /wallets/:slot` | Cadastro/edição → carteira. |
| `DELETE /wallets/:slot` | Apenas secundária → lista atualizada. |
| `POST /wallets/:id/connect` / `disconnect` | Conexão simulada aceita/recusada/desconectada. |

Erros: `{ error: { code, message, fields?, details? } }`. `ApiError` normaliza
HTTP, rede, timeout, cancelamento e resposta inválida. Há 401, 403, 404, 409, 422
e falhas transitórias. A UI associa erros aos campos e apresenta recuperação.

## Sessão e privacidade

Sessão fictícia de duas horas, token no localStorage para refresh. Senhas do banco
simulado usam PBKDF2-SHA256 com salt, sem texto claro. É uma simulação local,
não uma estratégia de autenticação de produção.

Rotas `_privado` exigem sessão. Axios só sinaliza expiração se o 401 pertence ao
token ainda ativo; resposta atrasada não encerra outra conta. O login recebe um
caminho interno validado, preservando o destino. URLs externas, backslashes e
caracteres de controle são rejeitados. Rascunho do checkout fica por usuário em
sessionStorage; senhas de formulários não são persistidas.

Na entrada/saída: publicar identidade → cancelar queries privadas → remover cache
privado. O socket acompanha a troca do token. Chaves incluem usuário/carrinho
anônimo, isolando respostas atrasadas. Logout só anuncia saída após resposta.
Login/cadastro mesclam o carrinho anônimo no servidor; reduções por estoque
geram aviso antes de continuar.

## Carrinho, cotação e pedidos

O banco MSW persiste entre refreshes. Escritas usam fila serializada. Catálogo,
estoque, favoritos, carteiras, cotação e pedidos compartilham esse estado.

A revisão refaz a cotação. Se preço, estoque, cupom ou taxa mudarem, o pagamento
fica bloqueado até nova confirmação explícita. O servidor revalida cotação,
versão do carrinho, carteira/rede e disponibilidade ao criar o pedido.

Idempotência tem escopo por usuário e fingerprint canônico do corpo. Retry mantém
a chave: mesmo corpo recupera o pedido; corpo diferente com a mesma chave gera
409. A tentativa fica no sessionStorage. Após receber um pedido, a chave é
descartada para permitir uma futura compra distinta.

Pedido pendente reserva estoque. Confirmação/recusa são terminais; recusa devolve
estoque. Confirmar remove apenas unidades compradas, preservando o restante do
carrinho. Recibo usa snapshot de linhas, taxas e valores, sem ler preços atuais.
IDs/links de explorador são fictícios. Reload/reconexão consultam o pedido
existente, sem reenviar a compra.

## Cache e retries

Público: `['nfts', 'list', params]`, `['nfts', 'detail', id]` etc. Privado:
`['private', 'user:<id>' | 'guest:<id>', recurso, ...]`. Catálogo mantém
filtros/paginação na URL; mudar filtro reinicia página; histórico restaura o estado.
AbortSignal chega ao Axios.

Queries ficam frescas por 30 s; foco não força refetch. Só falhas transitórias
recebem até dois retries. Criação de pedido repete até duas vezes com a mesma
chave; outras mutations não repetem silenciosamente.

Mutations gravam respostas ou invalidam dependências. Favoritos têm atualização
otimista, cancelamento da consulta anterior, snapshot e rollback. Uma mudança
otimista não representa persistência concluída. `keepNewestVersion` impede
resposta REST atrasada de sobrescrever versões mais recentes do recurso/itens
de listas. Eventos invalidam cotações, mantendo REST como autoridade do total.

## Socket.IO

WebSocket em `/realtime/`, interceptado por MSW (`ws.link`) e codificado pelo
binding. `socket.io-client` é importado após o worker pronto: engine.io captura
o construtor WebSocket ao avaliar o módulo.

| Evento | Envelope e dados |
|---|---|
| `nft.updated` | id estável, type, resource `{type:'nft',id}`, version, occurredAt; preço, disponibilidade e edições. |
| `order.updated` | Mesmo envelope para order, userId; status, transação e motivo de recusa. |

Payloads são validados. Ledger LRU de 500 IDs remove duplicatas; versão por
recurso e versão no cache rejeitam eventos antigos. Pedidos de outra sessão são
descartados. O ledger zera na troca de identidade.

Reconexão invalida queries ativas já carregadas e paradas: REST recupera eventos
perdidos. Consultas em voo não são refeitas na primeira conexão. Cleanup libera
listeners/socket. O mock verifica token por envio e implementa heartbeat de 20 s.

## Perfil e carteiras

Usam contratos/query keys compartilhados com checkout. Avatar valida tipo,
tamanho e decodificação no cliente; servidor valida o contrato. Alterar endereço,
rede ou provedor desconecta a carteira até nova conexão. A principal é editável;
só a secundária pode ser removida.

Salvar perfil com troca de senha faz duas operações: perfil, depois senha. Não há
transação REST conjunta. Se a senha falhar, a UI informa que os dados já foram
salvos e preserva entrada para correção. Logout durante leitura de arquivo ou
entre operações impede envio à nova identidade.

O Figma pede apenas username no cadastro; a API exige também displayName. O
cadastro inicializa displayName com username, editável depois no perfil.

## UI e acessibilidade

Tokens, Roboto Mono local e assets vêm do Figma. shadcn/Radix fornece foco de
diálogos/drawers, tabs, slider e select. Skeletons têm shimmer e respeitam movimento
reduzido. Formulários associam labels/erros; feedback relevante é anunciado.

Mobile desenhado: 414 px. Verificação inclui 390/768/1440 e 414 para comparação.
Perfil/carteiras empilham campos e navegação no mobile; auth mantém modal desktop
e tela cheia mobile. Fora do escopo, login social/recuperação explicam a
indisponibilidade; atividade/ofertas/downloads são informativos.

Diferenças funcionais: cabeçalho autenticado mostra Minha conta; mensagens e
estados não desenhados seguem tokens; pedido pendente/recusado não mostra
confirmação. Conteúdo e preços vêm do servidor. Prefixo ENS suporta somente
`.eth`; não simula seleção de redes inexistentes.

Baselines cobrem início/detalhe/carrinho/pagamento em desktop/mobile. Axe e teclado
complementam inspeção visual; não equivalem a certificação WCAG ou teste de leitor
de tela. Lighthouse usa o mesmo build completo da demo.

## Limitações e escopo reduzido

- Servidor simulado é local à aba. Banco em localStorage; eventos não cruzam abas.
  Não há garantia de serialização entre abas concorrentes. Reload/reconexão refaz REST.
- Um evento pode se perder entre a primeira resposta REST em voo e o CONNECT,
  até novo refetch/reconexão.
- Reset sem reload pode deixar versões altas no cache. Use `?mock-reset` com
  recarga; E2E também usa contexto novo.
- Binding não simula long-polling, rooms/namespaces; roteamento privado e
  heartbeat são implementados no mock.
- Token local, carteiras e pagamentos servem à demonstração; não há operação financeira real.
- Quatro imagens locais se repetem nas fixtures; não são 48 artworks distintos.
- A análise estática dos forks não reproduziu builds/auditorias deles. Essas
  alegações não são evidência desta entrega. A retomada não copiou código
  adicional de forks: usa contratos locais e Figma.
- Performance mobile ficou abaixo de 90; veja os resultados e causas abaixo.
- O endereço técnico `.vercel.app` exige autenticação da plataforma. O domínio
  público `racing-sable-eislhs3.tmp.now` serve a aplicação sem esse bloqueio.

## Evidências finais (08/11/2026)

Typecheck, lint e build aprovados; **33 testes unitários** e **54 E2E** aprovados.
A suíte E2E final usou Chromium 158 em 1440×1000 e 390×844, sem atualizar
baselines e sem retries. Login, cadastro, perfil e carteiras também foram
comparados com Figma em 390/414/768/1440. Revisão independente do diff corrigiu
concorrência entre logins e a prova de retry após um único envio com timeout real.
Instalação do lockfile sem scripts, typecheck, lint e build passaram em uma cópia
limpa do código versionado. O primeiro install offline falhou por ausência de
pacotes no store de `/tmp`; o install online do mesmo lockfile passou.

Lighthouse 13.6, três execuções por página/perfil no build completo da demo:

| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO |
|---|---|---:|---:|---:|---:|
| Início | Mobile | 55 | 100 | 96 | 92 |
| Início | Desktop | 97 | 100 | 96 | 92 |
| Detalhe | Mobile | 62 | 100 | 96 | 92 |
| Detalhe | Desktop | 98 | 100 | 96 | 92 |

[Medianas, métricas e relatórios completos](reports/lighthouse/summary.md).
**A meta de performance mobile não foi atingida.** O comando termina com exit 1
por essa razão. LCP mobile: 5,64 s no início e 4,85 s no detalhe; TBT: 952/909 ms.
O relatório aponta execução de JavaScript na inicialização: aproximadamente
2,1 s em uma execução do início, incluindo aplicação e MSW; o chunk do MSW tem
cerca de 176 KB transferidos, e o Lighthouse estima 129 KB de JS não usado nessa
navegação. Esses valores descrevem a demo, não um backend real. A inicialização
do worker e dos handlers precede a renderização para evitar requests não tratados.
O build mantém fontes, imagens, mocks e Socket.IO ativos na auditoria.

A correção de reserva de espaço no detalhe reduziu CLS de 0,224 para **0,000**;
as quatro medianas finais têm CLS zero. Próximas melhorias: reduzir importações
na inicialização do mock, carregar cenários/controles sob demanda e medir o custo
do bootstrap. Não foram removidas funções para melhorar artificialmente a nota.
As medições são locais e variam com o ambiente; não são medições da URL pública.

## Publicação

`vercel.json` configura SPA fallback e preserva assets/API/worker. Worker recebe
no-cache e escopo `/`; sem CSP bloqueando WebSocket simulado. Instalação usa
lockfile com scripts das dependências desativados. `pnpm-workspace.yaml` nega
explicitamente o build do MSW: o worker já está versionado e não precisa de
postinstall. Isso evita `ERR_PNPM_IGNORED_BUILDS` no pnpm 12, sem liberar scripts.

[README](README.md) descreve credenciais/cenários; [testes](tests/README.md)
descreve isolamento e auditorias. [Enunciado original](docs/challenge.md) permanece separado.

Publicação assumida pelo candidato: https://racing-sable-eislhs3.tmp.now.
Acesso HTTP direto às rotas SPA e ao service worker confirmado após a
transferência; o worker mantém MIME JavaScript e headers sem cache.

Validação externa após transferência: **35 de 36 E2E passaram**. O restante
reproduziu perda intermitente do aviso de sessão expirada quando um refresh
interrompe o redirecionamento após o token já ter sido apagado. A correção local
preserva apenas o motivo em sessionStorage da aba até login/logout; não guarda
dados da conta. O domínio publicado ainda está na versão anterior a essa correção.
O deploy da correção exige autenticar a CLI na conta que assumiu o projeto.

Após a correção, typecheck/lint/build e os **54 E2E locais passaram novamente**
(sem atualizar baselines). A regressão inclui reabrir diretamente o checkout com
o token já removido. Os relatórios Lighthouse acima antecedem essa correção de
sessão; ela não foi medida em nova auditoria de performance.
