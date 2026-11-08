# Lighthouse — medianas de três execuções

Build de produção, cenário padrão dos mocks, sem sessão, Chrome novo por execução, throttling padrão mobile ou preset desktop; três medições sequenciais por página/perfil.

| Página | Perfil | P | A | BP | SEO | LCP (ms) | CLS | TBT (ms) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| inicio | mobile | 55 | 100 | 96 | 92 | 5644 | 0.000 | 952 |
| inicio | desktop | 97 | 100 | 96 | 92 | 1141 | 0.000 | 94 |
| detalhe | mobile | 62 | 100 | 96 | 92 | 4847 | 0.000 | 909 |
| detalhe | desktop | 98 | 100 | 96 | 92 | 1017 | 0.000 | 80 |

Ambiente e versões: [summary.json](summary.json). Relatórios individuais HTML/JSON neste diretório. As metas são P ≥90, A ≥95, BP ≥95 e SEO ≥90.
