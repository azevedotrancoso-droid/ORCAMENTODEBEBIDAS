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

## Tema claro/escuro
O botão (lua/sol) no topo alterna o tema; no login ele fica no canto superior direito. A escolha fica salva no navegador (`ob-theme`); sem escolha, o sistema segue o tema do aparelho. As cores ficam em variáveis CSS no início de `style.css`, e os gráficos se ajustam sozinhos. PDFs e Excel exportados continuam sempre no padrão claro, e a impressão também.

## Instalar como aplicativo (PWA)
- **Computador e Android (Chrome/Edge):** abra o site e use o botão “Instalar aplicativo” no menu lateral, ou o ícone de instalar na barra de endereço.
- **iPhone/iPad:** abra no Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.
- Exige endereço `https` (o GitHub Pages já é). Depois de instalado, a interface abre mesmo sem internet; dados e login precisam de conexão.
- Ao publicar uma versão nova, aumente o número em `CACHE_NAME` no `sw.js` (`v2` → `v3`) para os aparelhos atualizarem.

## Armazenamento
Os dados ficam no Supabase (banco online), por conta de usuário, com login por e-mail e senha.
Cada usuário só acessa os próprios registros (regras RLS). Funciona em qualquer aparelho com o mesmo login.

## Publicar
Envie **todos** os arquivos da pasta para a raiz do repositório (GitHub Pages), inclusive `.nojekyll`, `manifest.webmanifest`, `sw.js`, `pwa.js`, `offline.html` e os ícones `.png`/`.svg`. Sem o manifest, o service worker e os ícones, o navegador não oferece a instalação.
No Supabase, em Authentication > URL Configuration, informe o endereço do site em Site URL.

O gráfico usa Chart.js e o banco usa supabase-js, ambos por CDN; o navegador precisa de internet.

## Relatórios em PDF
Na página Relatórios, escolha o ano e baixe um PDF A4 paisagem (sem bibliotecas externas):
- **Relatório de lançamentos**: resumo com indicadores e gráficos, orçamento mensal e lançamentos agrupados por mês, com subtotais e totais pago/em aberto.
- **Resumo por categoria**: resumo, quadro mensal por categoria e gráfico de evolução.

## Exportação para Excel
Os botões "Exportar Excel" das páginas Lançamentos e Análise por categoria geram uma planilha .xlsx com 3 abas (Resumo, Lançamentos e Por categoria), com fórmulas, filtros, totais e formatação. Não depende de bibliotecas externas.

## Baixa automática
Notas cuja data de vencimento chegou passam sozinhas para PAGO: o Supabase faz isso todo dia às 00:05 (horário de Brasília) e o site também confere ao abrir.

## Vários usuários
Os dados pertencem a um "espaço de trabalho" do dono. Para dar acesso a outra pessoa, ela cria conta no site e depois se cadastra na tabela `orc_membros` do Supabase (user_id = id dela, dono_id = id do dono). Quem não está na tabela vê só os próprios dados (vazio).

## Malote NF (módulo Administrativo)

Aba no fim do menu para agrupar notas fiscais por semana do mês. Cada malote tem mês, ano e semana
(1ª = dias 1–7, 2ª = 8–14, 3ª = 15–21, 4ª = 22–28, 5ª = 29 até o fim do mês) e várias notas
(nº da NF, fornecedor, data de compra e data de vencimento).

**Antes de usar:** rode o arquivo `malote.sql` uma vez no SQL Editor do Supabase. Sem isso a aba
funciona, mas salva só no aparelho atual (um aviso aparece na tela).

## Módulos
Depois do login aparece a tela **"Escolha o módulo que você quer usar agora"**, com um card por módulo. Os módulos são separados: cada um mostra só o próprio menu e as próprias páginas.
- **Orçamento de Bebidas**: Dashboard, Lançamentos, Orçamento trimestral, Análise por categoria e Relatórios.
- **Administrativo**: Malote NF e Nota de Recusa e Devolução de Mercadoria (formulário com prévia ao vivo e PDF A4, no mesmo modelo do documento original).

Para trocar de módulo, use o botão **Todos os módulos** (topo do menu lateral, atalho **Alt+0**) e escolha o outro card.
O site lembra a última página de cada módulo. Recarregar a página mantém o módulo; uma nova visita começa na seleção.
Para criar um módulo novo, veja o comentário no início de `modulos.js`.

## PWA / Android
- **Instalar:** no Android o botão "Instalar aplicativo" aparece no menu lateral e na tela de módulos (ou use ⋮ → "Instalar aplicativo" no Chrome). Os atalhos do ícone (segurar o ícone do app) abrem direto: Novo lançamento, Malote NF, Nota de Recusa e Dashboard.
- **Botão Voltar do Android:** fecha o menu ou o formulário aberto, volta para a página anterior e depois para a seleção de módulos; só então sai do app. Recarregar mantém você na mesma página.
- **Tela:** respeita a barra de status e a barra de gestos (áreas seguras), usa `100dvh`, formulários abrem como "folha" na parte de baixo do celular, campos e botões com no mínimo 44 px de toque e fonte de 16 px nos campos (evita o zoom automático).
- **Ícones:** `icon-192/512` (padrão), `icon-maskable-192/512` (formato adaptável do Android) e `icon-monochrome-512` (ícone temático do Android 13+).
- **Atualização:** quando há versão nova aparece a barra "Nova versão do aplicativo disponível. Atualizar". O app confere se há versão nova ao voltar para ele.
- **Para publicar uma versão nova:** aumente o número em `CACHE_NAME` no `sw.js` (v19 → v20) e o `?v=` dos arquivos alterados no `index.html`.
