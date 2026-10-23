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

## Armazenamento
Os dados ficam no Supabase (banco online), por conta de usuário, com login por e-mail e senha.
Cada usuário só acessa os próprios registros (regras RLS). Funciona em qualquer aparelho com o mesmo login.

## Publicar
Envie `index.html`, `style.css`, `script.js`, `exportar-excel.js` e `README.md` para a raiz do repositório (GitHub Pages).
No Supabase, em Authentication > URL Configuration, informe o endereço do site em Site URL.

O gráfico usa Chart.js e o banco usa supabase-js, ambos por CDN; o navegador precisa de internet.

## Exportação para Excel
Os botões de exportação geram uma planilha .xlsx com 3 abas (Resumo, Lançamentos e Por categoria), com fórmulas, filtros, totais e formatação. Não depende de bibliotecas externas.

## Baixa automática
Notas cuja data de vencimento chegou passam sozinhas para PAGO: o Supabase faz isso todo dia às 00:05 (horário de Brasília) e o site também confere ao abrir.
