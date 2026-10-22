# Orçamento de Bebidas — site independente

Interface web responsiva inspirada na estrutura da planilha `ORÇAMENTO DE BEBIDAS.xlsx`.

## Recursos
- Dashboard com orçamento anual, total comprometido, saldo, contas em aberto e gráficos.
- Cadastro, edição, exclusão, pesquisa e filtros de lançamentos.
- Campos: data da compra, vencimento, fornecedor, NF, categoria, valor e status.
- Orçamento mensal com saldo não utilizado carregado para o mês seguinte.
- Análise por categoria com totais mensais e anuais.
- Exportação CSV e backup/restauração JSON.
- Layout adaptado para computador e celular.

## Começar
Abra `index.html` em um navegador moderno. É possível publicar a pasta em um serviço de hospedagem estática, como GitHub Pages.

## Observação importante sobre armazenamento
Esta primeira versão usa `localStorage`: os dados ficam salvos no navegador/dispositivo em que forem cadastrados. Ela começa vazia e não importa os lançamentos do Excel. Para que os mesmos dados sejam compartilhados entre vários aparelhos/usuários, é necessário conectar um banco de dados online e configurar autenticação e regras de acesso.

O gráfico usa Chart.js por CDN, e as fontes usam Google Fonts. Para carregar esses recursos, o navegador precisa de conexão com a internet.
