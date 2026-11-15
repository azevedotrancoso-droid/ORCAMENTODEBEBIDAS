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

## Malote NF (nova aba)

Aba no fim do menu para agrupar notas fiscais por semana do mês. Cada malote tem mês, ano e semana
(1ª = dias 1–7, 2ª = 8–14, 3ª = 15–21, 4ª = 22–28, 5ª = 29 até o fim do mês) e várias notas
(nº da NF, fornecedor, data de compra e data de vencimento).

**Antes de usar:** rode o arquivo `malote.sql` uma vez no SQL Editor do Supabase. Sem isso a aba
funciona, mas salva só no aparelho atual (um aviso aparece na tela).

## Administrativo (RNC e Recusa/Devolução)
Aba nova no menu. Gera e guarda dois tipos de relatório, ambos com PDF A4 próprio (sem bibliotecas externas):
- **RNC — Relatório de Não Conformidade**: identificação, item/fornecedor, descrição, contenção, análise de causa (5 Porquês e 6M), plano de ação 5W2H, impactos, verificação de eficácia, encerramento e assinaturas, com base na ABNT NBR ISO 9001:2015 (8.7, 10.2, 7.5) e legislação aplicável ao tipo da ocorrência. A RNC só pode ser encerrada com causa raiz, ação registrada e eficácia confirmada.
- **RDM — Recusa e Devolução de Mercadorias**: fornecedor, NF-e (a chave de acesso preenche NF, série e CNPJ e tem o dígito verificador conferido), transporte, itens com totais, motivos, comprovações, providências, orientação fiscal conforme o tipo (recusa total, parcial ou devolução posterior) e prazos legais calculados a partir das datas informadas (CC art. 754 e 445; CDC arts. 18 e 26; manifestação do destinatário).
- **Organização**: número sequencial por tipo e ano (`RNC-2026-0001`, `RDM-2026-0001`), lista agrupada por mês, abas por tipo, filtros (ano, status, busca), editar, duplicar, excluir, baixar o PDF de qualquer relatório a qualquer momento e exportar o índice em PDF.
- **Banco**: rode `administrativo.sql` uma vez no Supabase (SQL Editor). Sem a tabela, os relatórios ficam só no aparelho e a tela avisa.
- **Atenção**: as referências legais são informativas e as regras de NF-e para recusa/devolução estão em transição (Ajuste SINIEF 49/2025 e alterações). Confirme com o contador antes de usar o texto fiscal como instrução oficial. O texto fica em `administrativo-pdf.js` (`fiscalRDM`, `REF`) para ser ajustado.
