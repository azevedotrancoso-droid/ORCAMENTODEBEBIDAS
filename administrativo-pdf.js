/* Relatórios administrativos em PDF (RNC e Recusa/Devolução) — sem bibliotecas externas.
   Gera relatórios A4 retrato com cabeçalho, seções, tabelas, base legal, prazos calculados, assinaturas e rodapé numerado. */
(function (root) {
'use strict';
const WR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,556,222,556,333,1000,556,556,333,1000,667,333,1000,556,611,556,556,222,222,333,333,350,556,1000,333,1000,500,333,944,556,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const WB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,556,278,556,500,1000,556,556,333,1000,667,333,1000,556,611,556,556,278,278,500,500,350,556,1000,333,1000,556,333,944,556,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];

/* ---------- Texto (WinAnsi) ---------- */
const SPECIAL = {0x20AC:0x80, 0x201A:0x82, 0x2026:0x85, 0x2018:0x91, 0x2019:0x92, 0x201C:0x93, 0x201D:0x94, 0x2022:0x95, 0x2013:0x96, 0x2014:0x97, 0x2122:0x99, 0x2212:0x2D};
function bytesOf(s) {
  const out = [];
  for (const ch of String(s === undefined || s === null ? '' : s)) {
    let c = ch.codePointAt(0);
    if (c === 0xA0 || c < 32 || c === 127) c = 32;
    else if (c < 127 || (c >= 161 && c < 256)) { /* mantém */ }
    else if (SPECIAL[c] !== undefined) c = SPECIAL[c];
    else { const b = ch.normalize('NFD').charCodeAt(0); c = (b >= 32 && b < 127) ? b : 63; }
    out.push(c);
  }
  return out;
}
function tw(s, size, bold) { const t = bold ? WB : WR; let w = 0; bytesOf(s).forEach(c => { w += t[c - 32] || 556; }); return w * size / 1000; }
function pdfStr(s) { return '(' + bytesOf(s).map(c => (c === 40 || c === 41 || c === 92) ? '\\' + String.fromCharCode(c) : String.fromCharCode(c)).join('') + ')'; }
function clip(s, maxW, size, bold) {
  s = String(s === undefined || s === null ? '' : s);
  if (tw(s, size, bold) <= maxW) return s;
  let t = s; while (t.length > 1 && tw(t + '...', size, bold) > maxW) t = t.slice(0, -1);
  return t.replace(/\s+$/, '') + '...';
}

/* ---------- Formatação ---------- */
const n2 = v => String(Math.round(v * 100) / 100);
const rgb = h => [0, 2, 4].map(i => (parseInt(h.substr(i, 2), 16) / 255).toFixed(3)).join(' ');
function fmtNum(v, d) {
  d = d === undefined ? 2 : d; const neg = v < 0; const p = Math.abs(v).toFixed(d).split('.');
  return (neg ? '-' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (p[1] ? ',' + p[1] : '');
}
function money(v) { v = Math.round((Number(v) || 0) * 100) / 100; return (v < 0 ? '-' : '') + 'R$ ' + fmtNum(Math.abs(v)); }
const fmtDate = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';
const pad2 = v => String(v).padStart(2, '0');
const titleCase = s => String(s || '').toLowerCase().replace(/\b\w/g, m => m.toUpperCase());
const pct = v => fmtNum(v, 1) + '%';
function axisLabel(v) {
  const z = s => s.replace(/,0$/, '');
  if (v >= 1e6) return z(fmtNum(v / 1e6, 1)) + ' mi';
  if (v >= 1000) return z(fmtNum(v / 1000, 1)) + ' mil';
  return fmtNum(v, 0);
}

const W = 595.28, H = 841.89, MX = 40, CW = W - MX * 2, BOTTOM = H - 50;
const C = {navy:'102B46', navy2:'183B5F', blue:'3478F6', orange:'F39C3C', light:'F4F7FB', zebra:'F7F9FC', line:'D8E1EC',
  gray:'66768A', ink:'1B2939', green:'15966A', red:'C0392B', amber:'B26A00', white:'FFFFFF', sub:'9EB2C8',
  softBlue:'EAF1FD', softRed:'FDECEA', softAmber:'FFF4E0', softGreen:'E6F6EF'};
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/* ---------- Opções compartilhadas (a tela usa as mesmas listas) ---------- */
const OPT = {
  tipoNC: [['produto','Produto / mercadoria recebida'],['fornecedor','Fornecedor / serviço contratado'],['entrega','Entrega / transporte / logística'],['estoque','Armazenagem / estoque'],['seguranca_alimentos','Segurança de alimentos / sanitária'],['documental','Documental / fiscal'],['processo','Processo interno'],['cliente','Reclamação de cliente']],
  origem: [['recebimento','Recebimento de mercadorias'],['estoque','Estoque / armazenagem'],['producao','Produção / preparo'],['expedicao','Expedição / entrega'],['atendimento','Atendimento / salão'],['auditoria','Auditoria interna'],['reclamacao','Reclamação de cliente'],['fornecedor','Aviso do fornecedor']],
  gravidade: [['baixa','Baixa'],['media','Média'],['alta','Alta'],['critica','Crítica']],
  disposicao: [['aceitar','Aceitar com concessão'],['retrabalho','Retrabalho / reclassificação'],['quarentena','Segregar em quarentena'],['devolver','Devolver ao fornecedor'],['trocar','Troca pelo fornecedor'],['abater','Abatimento no preço'],['descartar','Descartar / inutilizar']],
  evidenciasRNC: [['fotos','Fotos / vídeos'],['nf','NF-e / DANFE'],['pedido','Pedido de compra'],['laudo','Laudo / certificado'],['checklist','Checklist de recebimento'],['temperatura','Registro de temperatura'],['amostra','Amostra retida'],['email','E-mails / comunicados']],
  impactos: [['seguranca','Segurança de alimentos / saúde do consumidor'],['cliente','Cliente / reputação'],['financeiro','Financeiro'],['operacional','Operação / abastecimento'],['fiscal','Fiscal / documental'],['legal','Legal / regulatório']],
  cat6m: [['metodo','Método'],['maquina','Máquina / equipamento'],['mao','Mão de obra'],['material','Material'],['medicao','Medição'],['meio','Meio ambiente']],
  tipoAcao: [['correcao','Correção'],['corretiva','Ação corretiva'],['preventiva','Ação preventiva']],
  statusAcao: [['pendente','Pendente'],['andamento','Em andamento'],['concluida','Concluída']],
  resultadoEficacia: [['pendente','Pendente'],['eficaz','Eficaz'],['nao_eficaz','Não eficaz']],
  statusRNC: [['aberta','Aberta'],['analise','Em análise de causa'],['acao','Ação em andamento'],['verificacao','Aguardando verificação de eficácia'],['encerrada','Encerrada'],['cancelada','Cancelada']],
  tipoOc: [['recusa_total','Recusa total no recebimento'],['recusa_parcial','Recusa parcial no recebimento'],['devolucao_total','Devolução total após o recebimento'],['devolucao_parcial','Devolução parcial após o recebimento']],
  motivos: [['avaria','Avaria / quebra / vazamento'],['vencido','Produto vencido ou validade insuficiente'],['lote','Lote / validade diferente do informado'],['quantidade','Quantidade divergente (falta ou sobra)'],['diferente','Produto diferente do pedido'],['preco','Preço / condição diferente do pedido'],['nf','NF com erro ou divergência de dados'],['embalagem','Embalagem violada ou inadequada'],['temperatura','Temperatura inadequada'],['defeito','Defeito / impróprio para consumo'],['atraso','Entrega fora do prazo combinado'],['nao_pedido','Mercadoria não solicitada'],['outro','Outro motivo']],
  motivoItem: [['avaria','Avaria'],['vencido','Vencido'],['lote','Lote/validade'],['falta','Falta'],['sobra','Sobra'],['diferente','Diferente do pedido'],['defeito','Defeito'],['preco','Preço'],['outro','Outro']],
  evidenciasRDM: [['fotos','Fotos da mercadoria e da embalagem'],['danfe','Verso do DANFE / canhoto com ressalva'],['cte','CT-e / conhecimento com ressalva'],['evento','Evento de manifestação registrado'],['termo','Termo assinado pelo motorista'],['email','E-mail / comunicação ao fornecedor'],['laudo','Laudo / conferência de recebimento'],['temperatura','Registro de temperatura']],
  providencia: [['devolucao','Devolução e crédito'],['troca','Troca da mercadoria'],['reposicao','Reposição da quantidade'],['abatimento','Abatimento no preço'],['reembolso','Reembolso / restituição'],['cancelamento','Cancelamento do pedido']],
  frete: [['fornecedor','Por conta do fornecedor'],['comprador','Por conta do comprador'],['transportadora','Por conta da transportadora']],
  cfop: [['','Não se aplica / a definir'],['5.202 / 6.202','5.202 / 6.202 — devolução de compra para comercialização'],['5.411 / 6.411','5.411 / 6.411 — devolução de compra com ICMS-ST'],['5.201 / 6.201','5.201 / 6.201 — devolução de compra para industrialização'],['1.202 / 2.202','1.202 / 2.202 — entrada por devolução de venda (fornecedor)'],['1.411 / 2.411','1.411 / 2.411 — entrada por devolução de venda com ICMS-ST (fornecedor)']],
  statusRDM: [['aberto','Aberto'],['aguardando','Aguardando fornecedor'],['coleta','Aguardando coleta / retorno'],['concluido','Concluído'],['cancelado','Cancelado']],
  simnao: [['','—'],['sim','Sim'],['nao','Não']]
};
function lab(list, key) { const f = (list || []).find(x => x[0] === key); return f ? f[1] : (key || ''); }

/* ---------- Datas e validações ---------- */
function addDays(iso, n) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00'); if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
const onlyDigits = s => String(s || '').replace(/\D/g, '');
function validCNPJ(v) {
  const s = onlyDigits(v); if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false;
  const calc = len => { let sum = 0, pos = len - 7; for (let i = len; i >= 1; i--) { sum += Number(s[len - i]) * pos--; if (pos < 2) pos = 9; } const r = sum % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === Number(s[12]) && calc(13) === Number(s[13]);
}
function formatCNPJ(v) { const s = onlyDigits(v); return s.length === 14 ? s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : String(v || ''); }
function validChave(v) {
  const s = onlyDigits(v); if (s.length !== 44) return false;
  let sum = 0, w = 2; for (let i = 42; i >= 0; i--) { sum += Number(s[i]) * w; w = w === 9 ? 2 : w + 1; }
  const r = sum % 11, dv = r < 2 ? 0 : 11 - r; return dv === Number(s[43]);
}
function parseChave(v) {
  const s = onlyDigits(v); if (s.length !== 44) return null;
  return {uf: s.slice(0, 2), aamm: s.slice(2, 6), cnpj: s.slice(6, 20), modelo: s.slice(20, 22), serie: String(Number(s.slice(22, 25))), numero: String(Number(s.slice(25, 34))), valida: validChave(s)};
}
function formatChave(v) { const s = onlyDigits(v); return s.length === 44 ? s.replace(/(\d{4})(?=\d)/g, '$1 ') : String(v || ''); }

/* ---------- Regras legais (texto e prazos) ---------- */
const REF = {
  iso: {t: 'ABNT NBR ISO 9001:2015 — itens 8.7, 10.2 e 7.5', d: 'Controle de saídas não conformes (8.7). Ao ocorrer uma não conformidade, a organização deve reagir, avaliar a necessidade de ação para eliminar a causa, implementar a ação, analisar criticamente a sua eficácia e, quando necessário, atualizar riscos e oportunidades e alterar o sistema de gestão da qualidade (10.2.1). A natureza da não conformidade, as ações tomadas e os resultados devem ser mantidos como informação documentada (10.2.2 e 7.5).'},
  iso84: {t: 'ABNT NBR ISO 9001:2015 — item 8.4', d: 'Controle de processos, produtos e serviços providos externamente: critérios para avaliação, seleção e reavaliação de fornecedores com base no desempenho e na conformidade do que é fornecido.'},
  cc441: {t: 'Código Civil (Lei nº 10.406/2002), arts. 441 a 446', d: 'Vícios redibitórios nos contratos comutativos: o adquirente pode enjeitar a coisa, redibindo o contrato, ou reclamar abatimento no preço (arts. 441 e 442). Prazo decadencial de 30 dias para bens móveis, contado da entrega efetiva (art. 445). Se o vício só puder ser conhecido mais tarde, o prazo conta da ciência, limitado a 180 dias para bens móveis (art. 445, §1º).'},
  cc313: {t: 'Código Civil, art. 313', d: 'O credor não é obrigado a receber prestação diversa da que lhe é devida, ainda que mais valiosa. Fundamento para recusar mercadoria diferente da pedida.'},
  cc754: {t: 'Código Civil, arts. 743 a 756 (transporte de coisas) — art. 754', d: 'Quem recebe as mercadorias deve conferi-las e apresentar as reclamações que tiver, sob pena de decadência dos direitos (caput). Em caso de perda parcial ou avaria não perceptível à primeira vista, o destinatário conserva a ação contra o transportador desde que denuncie o dano em dez dias a contar da entrega (parágrafo único).'},
  cdc18: {t: 'Código de Defesa do Consumidor (Lei nº 8.078/1990), arts. 18, 19 e 26', d: 'Aplicável quando a relação for de consumo. Vício de qualidade ou quantidade: o fornecedor tem 30 dias para sanar o vício; não sanado, o consumidor pode exigir substituição do produto, restituição da quantia paga ou abatimento proporcional do preço (art. 18, §1º; art. 19). São impróprios ao uso e consumo os produtos com prazo de validade vencido, deteriorados, avariados, adulterados ou em desacordo com normas regulamentares (art. 18, §6º). Prazo para reclamar: 30 dias para produtos não duráveis (art. 26, I).'},
  cdc10: {t: 'Código de Defesa do Consumidor, arts. 8º a 10', d: 'Proteção da saúde e da segurança do consumidor. O fornecedor que tiver conhecimento da periculosidade de um produto já colocado no mercado deve comunicar imediatamente às autoridades competentes e aos consumidores (art. 10, §1º).'},
  sanit: {t: 'Legislação sanitária e de bebidas', d: 'Decreto-Lei nº 986/1969 (normas básicas sobre alimentos); Lei nº 6.437/1977 (infrações à legislação sanitária federal); Lei nº 8.918/1994 e Decreto nº 6.871/2009 (padronização, classificação, registro, inspeção e fiscalização de bebidas); RDC ANVISA nº 216/2004 (boas práticas em serviços de alimentação) e RDC nº 275/2002 (boas práticas em estabelecimentos produtores e industrializadores de alimentos), conforme a atividade; RDC nº 727/2022 (rotulagem de alimentos embalados). Consultar também as normas sanitárias estaduais e municipais.'},
  nfe: {t: 'Ajuste SINIEF nº 07/05 (NF-e e DANFE) e legislação do ICMS da UF', d: 'Disciplina a emissão, a escrituração, os eventos (manifestação do destinatário, cancelamento) e a guarda da NF-e. Procedimentos de recusa e devolução devem seguir também o regulamento do ICMS do estado do estabelecimento.'},
  ctn: {t: 'Código Tributário Nacional (Lei nº 5.172/1966), art. 195, parágrafo único', d: 'Os comprovantes e documentos fiscais devem ser conservados até que ocorra a prescrição dos créditos tributários a que se referem (em regra, 5 anos). Recomenda-se manter este relatório e suas evidências pelo mesmo período.'}
};

function legalRNC(d) {
  const t = d.tipoNC || '', imp = d.impactos || [], r = [REF.iso];
  if (t === 'produto' || t === 'fornecedor') r.push(REF.iso84, REF.cc441, REF.cdc18);
  if (t === 'entrega') r.push(REF.iso84, REF.cc754);
  if (t === 'seguranca_alimentos' || t === 'estoque' || imp.includes('seguranca') || imp.includes('legal')) r.push(REF.sanit, REF.cdc10);
  if (t === 'documental' || imp.includes('fiscal')) r.push(REF.nfe);
  if (t === 'cliente') r.push(REF.cdc18);
  r.push(REF.ctn);
  const seen = new Set(); return r.filter(x => !seen.has(x.t) && seen.add(x.t));
}
function legalRDM(d) {
  const oc = d.tipoOc || 'recusa_total', mot = d.motivos || [];
  const r = [REF.cc754, REF.cc441];
  if (mot.includes('diferente') || mot.includes('nao_pedido') || mot.includes('quantidade')) r.push(REF.cc313);
  r.push(REF.cdc18);
  if (mot.includes('vencido') || mot.includes('defeito') || mot.includes('temperatura') || mot.includes('lote')) r.push(REF.sanit);
  r.push(REF.nfe, REF.ctn);
  const seen = new Set(); return r.filter(x => !seen.has(x.t) && seen.add(x.t));
}
function fiscalRDM(d) {
  const oc = d.tipoOc || 'recusa_total';
  if (oc === 'recusa_total') return {kind: 'info', title: 'Procedimento fiscal — recusa total no recebimento', text:
    '1. Anotar o motivo da recusa no verso do DANFE (ou no documento que acompanha a mercadoria) e devolver a carga ao transportador, conforme o regulamento do ICMS da UF.\n' +
    '2. O destinatário registra, na NF-e, o evento "Operação não Realizada" (210240) ou "Desconhecimento da Operação" (210220), com a justificativa. Nesse caso o destinatário não emite NF de devolução (Nota Técnica 2020.001 da NF-e).\n' +
    '3. O transportador registra o evento "Insucesso na Entrega da NF-e" ou "Insucesso na Entrega do CT-e".\n' +
    '4. O remetente, ao receber a mercadoria de volta, emite NF-e de entrada referenciando a NF-e original. O Ajuste SINIEF nº 49/2025 (alterado pelos Ajustes 8, 15, 20, 27 e 34/2026) disciplina essa NF-e como nota de crédito (finalidade 5, tipo 03 - retorno por recusa ou não localização), com obrigatoriedade fixada em 01/01/2027 pelo Ajuste SINIEF nº 27/2026. Antes disso, aplica-se a regra vigente na UF. Confirme o cronograma com o contador.'};
  if (oc === 'recusa_parcial') return {kind: 'info', title: 'Procedimento fiscal — recusa parcial no recebimento', text:
    '1. Anotar no verso do DANFE quais itens e quantidades foram recusados e o motivo; a NF-e original permanece válida para os itens aceitos.\n' +
    '2. O remetente emite NF-e de entrada apenas com os itens e quantidades recusados, referenciando a NF-e original (Ajuste SINIEF nº 49/2025, cláusula quinta, II, tipo 06 - recusa parcial; obrigatório a partir de 01/01/2027 conforme o Ajuste SINIEF nº 27/2026). Antes dessa data, seguir o procedimento vigente na UF.\n' +
    '3. O transportador registra "Insucesso na Entrega da NF-e" ou do CT-e. Confirme o procedimento com o contador.'};
  return {kind: 'info', title: 'Procedimento fiscal — devolução após o recebimento', text:
    '1. A mercadoria já foi recebida: o comprador emite NF-e de devolução (finalidade 4 - devolução de mercadoria), referenciando a chave de acesso da NF-e original, com o CFOP de devolução adequado (ex.: 5.202/6.202; 5.411/6.411 se houver ICMS-ST; 5.201/6.201 se para industrialização).\n' +
    '2. Os tributos destacados na NF-e original devem ser devolvidos de forma proporcional aos itens e às quantidades devolvidos, conforme a legislação do ICMS da UF e a tributação do produto.\n' +
    '3. O fornecedor registra a entrada da devolução (CFOP 1.202/2.202 ou 1.411/2.411, conforme o caso). Mercadoria de reposição exige nova NF-e de venda.\n' +
    '4. O cancelamento da NF-e original só é possível nas hipóteses e prazos do Ajuste SINIEF nº 07/05 e da UF; fora deles, usar a devolução. Confirme com o contador.'};
}
function prazosRDM(d) {
  const rows = [], rec = d.dataRecebimento;
  const fd = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';
  if (rec) {
    rows.push(['Ressalvar avaria ou falta aparente', 'CC, art. 754, caput', 'No ato da entrega (' + fd(rec) + ')']);
    rows.push(['Denunciar à transportadora avaria/falta não aparente', 'CC, art. 754, parágrafo único', fd(addDays(rec, 10))]);
    rows.push(['Reclamar vício da mercadoria (bem móvel)', 'CC, art. 445; CDC, art. 26, I (produtos não duráveis, se relação de consumo)', fd(addDays(rec, 30))]);
    rows.push(['Vício que só se revela mais tarde', 'CC, art. 445, §1º (da ciência, no máximo 180 dias)', fd(addDays(rec, 180))]);
  }
  if (d.dataEmissao) rows.push(['Manifestação conclusiva do destinatário na NF-e (nos casos de obrigatoriedade)', 'Ajuste SINIEF 07/05; NT 2020.001 (180 dias da autorização; usada a emissão como referência)', fd(addDays(d.dataEmissao, 180))]);
  if (d.comFornData) rows.push(['Prazo do fornecedor para sanar o vício (relação de consumo)', 'CDC, art. 18, §1º', fd(addDays(d.comFornData, 30))]);
  return rows;
}

/* ---------- Construção do PDF ---------- */
function build(opt) {
  const kind = opt.kind, gen = opt.generatedAt || new Date(), rep = opt.report || {}, d = rep.dados || {};
  const isRNC = kind === 'RNC', isIdx = kind === 'INDICE';
  const title = isIdx ? 'RELAÇÃO DE RELATÓRIOS ADMINISTRATIVOS' : isRNC ? 'RELATÓRIO DE NÃO CONFORMIDADE (RNC)' : 'RELATÓRIO DE RECUSA E DEVOLUÇÃO DE MERCADORIAS';
  const subtitle = isIdx ? (opt.filtroTexto || 'Todos os relatórios') : isRNC ? 'Registro, análise de causa e ação corretiva  •  ABNT NBR ISO 9001:2015' : 'Registro de recebimento  •  Código Civil  •  Ajuste SINIEF 07/05  •  CDC (quando aplicável)';
  const numero = rep.numero || (isIdx ? 'ÍNDICE' : 'SEM NÚMERO');
  const statusLabel = isIdx ? '' : lab(isRNC ? OPT.statusRNC : OPT.statusRDM, rep.status || d.status);
  const pages = []; let cur = null, y = 0;
  const push = s => cur.push(s);
  const Y = v => H - v;
  const dateBR = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';
  const genTxt = pad2(gen.getDate()) + '/' + pad2(gen.getMonth() + 1) + '/' + gen.getFullYear() + ' às ' + pad2(gen.getHours()) + ':' + pad2(gen.getMinutes());
  const v = x => (x === undefined || x === null || String(x).trim() === '') ? '—' : String(x);

  function rrPath(x, yy, w, h, r) {
    r = Math.min(r, w / 2, h / 2); const k = r * 0.5523, x0 = x, x1 = x + w, yt = Y(yy), yb = Y(yy + h), f = n2;
    return `${f(x0 + r)} ${f(yb)} m ${f(x1 - r)} ${f(yb)} l ${f(x1 - r + k)} ${f(yb)} ${f(x1)} ${f(yb + r - k)} ${f(x1)} ${f(yb + r)} c ` +
      `${f(x1)} ${f(yt - r)} l ${f(x1)} ${f(yt - r + k)} ${f(x1 - r + k)} ${f(yt)} ${f(x1 - r)} ${f(yt)} c ` +
      `${f(x0 + r)} ${f(yt)} l ${f(x0 + r - k)} ${f(yt)} ${f(x0)} ${f(yt - r + k)} ${f(x0)} ${f(yt - r)} c ` +
      `${f(x0)} ${f(yb + r)} l ${f(x0)} ${f(yb + r - k)} ${f(x0 + r - k)} ${f(yb)} ${f(x0 + r)} ${f(yb)} c h`;
  }
  function rect(x, yy, w, h, o) {
    o = o || {}; if (w <= 0 || h <= 0) return;
    let st = ''; if (o.fill) st += rgb(o.fill) + ' rg '; if (o.stroke) st += rgb(o.stroke) + ' RG ' + n2(o.lw || 0.6) + ' w ';
    const path = o.r ? rrPath(x, yy, w, h, o.r) : `${n2(x)} ${n2(Y(yy + h))} ${n2(w)} ${n2(h)} re`;
    push(`q ${st}${path} ${o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'} Q`);
  }
  function line(x1, y1, x2, y2, color, lw) { push(`q ${rgb(color)} RG ${n2(lw || 0.5)} w ${n2(x1)} ${n2(Y(y1))} m ${n2(x2)} ${n2(Y(y2))} l S Q`); }
  function text(s, x, yy, o) {
    o = o || {}; const size = o.size || 9; let str = String(s === undefined || s === null ? '' : s);
    if (o.maxW) str = clip(str, o.maxW, size, o.bold);
    const w = tw(str, size, o.bold); let px = x;
    if (o.align === 'right') px = x - w; else if (o.align === 'center') px = x - w / 2;
    push(`BT /${o.italic ? 'F3' : o.bold ? 'F2' : 'F1'} ${n2(size)} Tf ${rgb(o.color || C.ink)} rg ${n2(px)} ${n2(Y(yy))} Td ${pdfStr(str)} Tj ET`);
  }
  function wrap(s, maxW, size, bold) {
    s = String(s === undefined || s === null ? '' : s).replace(/\r/g, '');
    const out = [];
    s.split('\n').forEach(par => {
      if (!par.trim()) { out.push(''); return; }
      let ln = '';
      par.split(/\s+/).forEach(word => {
        if (!word) return;
        const test = ln ? ln + ' ' + word : word;
        if (tw(test, size, bold) <= maxW) { ln = test; return; }
        if (ln) { out.push(ln); ln = ''; }
        if (tw(word, size, bold) <= maxW) { ln = word; return; }
        let chunk = ''; for (const ch of word) { if (tw(chunk + ch, size, bold) > maxW) { out.push(chunk); chunk = ch; } else chunk += ch; }
        ln = chunk;
      });
      if (ln) out.push(ln);
    });
    while (out.length > 1 && out[out.length - 1] === '') out.pop();
    return out.length ? out : [''];
  }

  const LOGO = root.LOGO_PDF || null;
  const logoBin = LOGO ? atob(LOGO.b64) : null;
  function drawLogo(x, yy, bw, bh) {
    rect(x, yy, bw, bh, {fill: C.white, r: 9});
    if (!LOGO) return;
    const pw = bw - 10, ph = bh - 8, k = Math.min(pw / LOGO.w, ph / LOGO.h), iw = LOGO.w * k, ih = LOGO.h * k;
    push(`q ${n2(iw)} 0 0 ${n2(ih)} ${n2(x + (bw - iw) / 2)} ${n2(Y(yy + (bh - ih) / 2 + ih))} cm /Im1 Do Q`);
  }
  function logo(x, yy) {
    if (LOGO) { drawLogo(x, yy, 70, 50); return; }
    rect(x, yy, 46, 46, {fill: C.navy2, r: 13});
  }
  function pill(txt, x, yy, fill, color) { const w = tw(txt, 7.5, true) + 16; rect(x - w, yy, w, 15, {fill, r: 7.5}); text(txt, x - w / 2, yy + 10.5, {size: 7.5, bold: true, color, align: 'center'}); return w; }
  function newPage() {
    cur = []; pages.push(cur);
    if (pages.length === 1) {
      rect(0, 0, W, 92, {fill: C.navy}); rect(0, 92, W, 3, {fill: C.blue});
      logo(MX, 18);
      text('ORÇAMENTO DE BEBIDAS  •  ADMINISTRATIVO', MX + 84, 34, {size: 7.5, bold: true, color: C.sub});
      const tl = wrap(title, CW - 84 - 150, 14, true);
      tl.slice(0, 2).forEach((l, i) => text(l, MX + 84, 52 + i * 17, {size: 14, bold: true, color: C.white}));
      text(subtitle, MX + 84, 52 + Math.min(2, tl.length) * 17 + 1, {size: 7.8, color: C.sub, maxW: CW - 84 - 150});
      if (!isIdx) {
        text('Nº DO DOCUMENTO', W - MX, 31, {size: 6.8, bold: true, color: C.sub, align: 'right'});
        text(numero, W - MX, 49, {size: 14, bold: true, color: C.white, align: 'right'});
        if (statusLabel) pill(statusLabel.toUpperCase(), W - MX, 58, C.orange, C.navy);
      } else text(String(opt.total || 0) + ' registro(s)', W - MX, 49, {size: 12, bold: true, color: C.white, align: 'right'});
      y = 112;
    } else {
      rect(0, 0, W, 34, {fill: C.navy}); rect(0, 34, W, 2, {fill: C.blue});
      text('Orçamento de Bebidas  •  ' + (isIdx ? 'Relação de relatórios' : numero), MX, 22, {size: 9, bold: true, color: C.white});
      text(isIdx ? 'Administrativo' : (isRNC ? 'Relatório de Não Conformidade' : 'Recusa e Devolução de Mercadorias'), W - MX, 22, {size: 8, color: C.sub, align: 'right'});
      y = 52;
    }
  }
  const ensure = h => { if (y + h > BOTTOM) newPage(); };
  const gap = n => { y += (n === undefined ? 8 : n); };

  function section(n, ttl, sub) {
    ensure(46);
    rect(MX, y, CW, 22, {fill: C.navy, r: 4});
    rect(MX + 6, y + 4, 14, 14, {fill: C.blue, r: 7}); text(String(n), MX + 13, y + 14.3, {size: 8, bold: true, color: C.white, align: 'center'});
    text(ttl.toUpperCase(), MX + 28, y + 14.6, {size: 8.6, bold: true, color: C.white});
    if (sub) text(sub, W - MX - 8, y + 14.4, {size: 7.2, color: C.sub, align: 'right', maxW: CW * 0.5});
    y += 28;
  }
  function grid(fields, cols) {
    let i = 0;
    while (i < fields.length) {
      const row = []; let used = 0;
      while (i < fields.length && used + Math.min(cols, fields[i].span || 1) <= cols) { const s = Math.min(cols, fields[i].span || 1); row.push(Object.assign({}, fields[i], {span: s})); used += s; i++; }
      if (used < cols) row[row.length - 1].span += cols - used;
      const cw = CW / cols;
      const cells = row.map(f => ({f, w: cw * f.span, lines: wrap(v(f.v), cw * f.span - 14, 8.8, !!f.bold)}));
      const h = Math.max(30, 14 + Math.max.apply(null, cells.map(c => c.lines.length)) * 11.4 + 5);
      ensure(h);
      let x = MX;
      cells.forEach(c => {
        rect(x, y, c.w, h, {fill: c.f.fill || C.white, stroke: C.line, lw: 0.6});
        text(String(c.f.l).toUpperCase(), x + 7, y + 10.5, {size: 6.4, bold: true, color: C.gray, maxW: c.w - 14});
        c.lines.forEach((ln, k) => text(ln, x + 7, y + 22.5 + k * 11.4, {size: 8.8, bold: !!c.f.bold, color: c.f.color || C.ink}));
        x += c.w;
      });
      y += h;
    }
    gap(8);
  }
  function textBlock(label, str, o) {
    o = o || {}; const size = 8.8, lh = size * 1.4, pad = 8;
    const lines = wrap(v(str), CW - pad * 2, size, false);
    let i = 0, first = true;
    while (i < lines.length) {
      const head = first ? 16 : 0, avail = BOTTOM - y - head - pad * 2;
      if (avail < lh * 2 && (lines.length - i) > 1 || avail < lh) { newPage(); continue; }
      const fit = Math.max(1, Math.floor(avail / lh)), chunk = lines.slice(i, i + fit), h = head + pad * 2 + chunk.length * lh;
      rect(MX, y, CW, h, {fill: o.fill || C.white, stroke: o.stroke || C.line, lw: 0.6});
      if (first) text(String(label).toUpperCase(), MX + pad, y + 11, {size: 6.4, bold: true, color: C.gray});
      chunk.forEach((ln, k) => text(ln, MX + pad, y + head + pad + size * 0.9 + k * lh, {size, color: C.ink, italic: false}));
      y += h; i += chunk.length; first = false;
      if (i < lines.length) newPage();
    }
    gap(8);
  }
  function checks(items, selected, cols) {
    cols = cols || 2; const cw = CW / cols, sel = new Set(selected || []);
    for (let r = 0; r < items.length; r += cols) {
      const rowItems = items.slice(r, r + cols);
      const ls = rowItems.map(it => wrap(it[1], cw - 26, 8.3, sel.has(it[0])));
      const h = Math.max.apply(null, ls.map(l => l.length)) * 10.6 + 9;
      ensure(h);
      rowItems.forEach((it, c) => {
        const x = MX + c * cw, on = sel.has(it[0]);
        rect(x, y, cw, h, {fill: on ? C.softBlue : C.white, stroke: C.line, lw: 0.5});
        rect(x + 7, y + 5.5, 9, 9, {fill: on ? C.blue : C.white, stroke: on ? C.blue : '9AA9BA', lw: 0.8, r: 1.5});
        if (on) { line(x + 9, y + 10, x + 11.3, y + 12.6, C.white, 1.3); line(x + 11.3, y + 12.6, x + 14.6, y + 7.6, C.white, 1.3); }
        ls[c].forEach((ln, k) => text(ln, x + 22, y + 12.6 + k * 10.6, {size: 8.3, bold: on, color: on ? C.navy : C.gray}));
      });
      if (rowItems.length < cols) rect(MX + rowItems.length * cw, y, cw * (cols - rowItems.length), h, {fill: C.white, stroke: C.line, lw: 0.5});
      y += h;
    }
    gap(8);
  }
  function table(cols, rows, o) {
    o = o || {}; const size = o.size || 8, lh = size * 1.32, pv = 5, ph = 5, ws = cols.map(c => c.w * CW);
    const alignX = (c, x, w) => c.a === 'r' ? x + w - ph : c.a === 'c' ? x + w / 2 : x + ph;
    const head = () => {
      const hh = 20; rect(MX, y, CW, hh, {fill: C.navy2}); let x = MX;
      cols.forEach((c, i) => { text(c.h, alignX(c, x, ws[i]), y + 13, {size: 6.8, bold: true, color: C.white, align: c.a === 'r' ? 'right' : c.a === 'c' ? 'center' : 'left', maxW: ws[i] - ph * 2}); x += ws[i]; });
      y += hh;
    };
    ensure(20 + 34); head();
    rows.forEach((row, ri) => {
      const cells = Array.isArray(row) ? row : row.cells, bold = !Array.isArray(row) && row.bold, fill = !Array.isArray(row) && row.fill;
      const ls = cells.map((cv, i) => wrap(v(cv), ws[i] - ph * 2, size, bold));
      const h = Math.max.apply(null, ls.map(l => l.length)) * lh + pv * 2;
      if (y + h > BOTTOM) { newPage(); head(); }
      rect(MX, y, CW, h, {fill: fill || (ri % 2 ? C.zebra : C.white)});
      let x = MX;
      cells.forEach((cv, i) => {
        ls[i].forEach((ln, k) => text(ln, alignX(cols[i], x, ws[i]), y + pv + size * 0.92 + k * lh, {size, bold, color: C.ink, align: cols[i].a === 'r' ? 'right' : cols[i].a === 'c' ? 'center' : 'left'}));
        x += ws[i];
      });
      line(MX, y + h, MX + CW, y + h, C.line, 0.5);
      y += h;
    });
    if (!rows.length) { rect(MX, y, CW, 24, {fill: C.white, stroke: C.line, lw: 0.5}); text('Nenhum registro.', MX + CW / 2, y + 15, {size: 8.5, color: C.gray, align: 'center'}); y += 24; }
    rect(MX, y - 0.3, CW, 0.3, {fill: C.line});
    gap(10);
  }
  function callout(k, ttl, str) {
    const col = {info: [C.softBlue, C.blue], warn: [C.softAmber, 'E99832'], ok: [C.softGreen, C.green], bad: [C.softRed, C.red]}[k] || [C.softBlue, C.blue];
    const size = 8.2, lh = size * 1.38, lines = wrap(str, CW - 28, size, false);
    let i = 0, first = true;
    while (i < lines.length) {
      const head = first ? 17 : 0, avail = BOTTOM - y - head - 14;
      if (avail < lh * 2 && (lines.length - i) > 1 || avail < lh) { newPage(); continue; }
      const fit = Math.max(1, Math.floor(avail / lh)), chunk = lines.slice(i, i + fit), h = head + 14 + chunk.length * lh;
      rect(MX, y, CW, h, {fill: col[0], r: 5}); rect(MX, y, 4, h, {fill: col[1], r: 2});
      if (first) text(ttl, MX + 14, y + 14, {size: 9, bold: true, color: C.navy});
      chunk.forEach((ln, kk) => text(ln, MX + 14, y + head + 9 + size * 0.85 + kk * lh, {size, color: C.ink}));
      y += h; i += chunk.length; first = false; if (i < lines.length) newPage();
    }
    gap(9);
  }
  function refs(list) {
    list.forEach(r => {
      const size = 8, lh = size * 1.38, lines = wrap(r.d, CW - 24, size, false), h = 24 + lines.length * lh;
      ensure(Math.min(h, 90));
      if (y + h > BOTTOM) { // item longo: divide por linhas
        text(r.t, MX + 12, y + 11, {size: 8.8, bold: true, color: C.navy, maxW: CW - 24}); y += 18;
        lines.forEach(ln => { if (y + lh > BOTTOM) newPage(); text(ln, MX + 12, y + size, {size, color: C.ink}); y += lh; }); gap(8); return;
      }
      rect(MX, y, CW, h, {fill: C.light, r: 4}); rect(MX, y, 3, h, {fill: C.blue, r: 1.5});
      text(r.t, MX + 12, y + 13, {size: 8.8, bold: true, color: C.navy, maxW: CW - 24});
      lines.forEach((ln, k) => text(ln, MX + 12, y + 25 + k * lh, {size, color: C.ink}));
      y += h + 6;
    });
    gap(4);
  }
  function signatures(list) {
    ensure(86); const n = list.length, g = 16, w = (CW - g * (n - 1)) / n;
    list.forEach((s, i) => {
      const x = MX + i * (w + g);
      line(x, y + 36, x + w, y + 36, C.ink, 0.7);
      text(s.name || '', x + 1, y + 48, {size: 8.6, bold: true, color: C.ink, maxW: w - 2});
      text(s.role, x + 1, y + 59, {size: 7.2, bold: true, color: C.gray, maxW: w - 2});
      if (s.sub) text(s.sub, x + 1, y + 69, {size: 7, color: C.gray, maxW: w - 2});
    });
    y += 82;
  }
  const yn = x => x === 'sim' ? 'Sim' : x === 'nao' ? 'Não' : '—';
  const noteText = 'Este relatório foi gerado eletronicamente a partir dos dados registrados no sistema. As referências legais são informativas, vigentes até a data de emissão, e não substituem parecer jurídico, contábil ou fiscal. Confirme prazos, procedimentos e a legislação específica da UF e do município antes de agir.';

  /* ===== Conteúdo: RNC ===== */
  function bodyRNC() {
    const acoes = (d.acoes || []).filter(a => a && (a.oque || a.quem));
    const custo = acoes.reduce((s, a) => s + (Number(a.quanto) || 0), 0);
    section(1, 'Identificação e classificação');
    grid([{l: 'Nº do RNC', v: numero, bold: true}, {l: 'Data de abertura', v: dateBR(d.dataAbertura)}, {l: 'Status', v: statusLabel},
      {l: 'Data da ocorrência', v: dateBR(d.dataOcorrencia)}, {l: 'Hora', v: d.horaOcorrencia}, {l: 'Gravidade', v: lab(OPT.gravidade, d.gravidade), bold: true, color: d.gravidade === 'critica' || d.gravidade === 'alta' ? C.red : C.ink},
      {l: 'Setor / área responsável', v: d.setor, span: 2}, {l: 'Local da ocorrência', v: d.local},
      {l: 'Emitente (quem identificou)', v: d.emitente, span: 2}, {l: 'Origem', v: lab(OPT.origem, d.origem)},
      {l: 'Tipo de não conformidade', v: lab(OPT.tipoNC, d.tipoNC), span: 3}], 3);
    section(2, 'Item, fornecedor e documento');
    grid([{l: 'Produto / item / serviço', v: d.produto, span: 2}, {l: 'Código / SKU', v: d.codigo},
      {l: 'Lote', v: d.lote}, {l: 'Fabricação', v: dateBR(d.fabricacao)}, {l: 'Validade', v: dateBR(d.validade)},
      {l: 'Quantidade afetada', v: d.qtd ? d.qtd + (d.un ? ' ' + d.un : '') : ''}, {l: 'Valor afetado', v: d.valorAfetado ? money(d.valorAfetado) : '', bold: true}, {l: 'Pedido de compra', v: d.pedido},
      {l: 'Fornecedor', v: d.fornecedor, span: 2}, {l: 'CNPJ do fornecedor', v: d.cnpjFornecedor ? formatCNPJ(d.cnpjFornecedor) : ''},
      {l: 'Nota fiscal (nº / série)', v: d.nf}, {l: 'Data da NF', v: dateBR(d.dataNF)}, {l: 'Chave de acesso', v: d.chave ? formatChave(d.chave) : ''}], 3);
    section(3, 'Descrição da não conformidade', 'O quê, onde, quando e como foi identificada');
    textBlock('Descrição objetiva do fato', d.descricao);
    textBlock('Requisito não atendido (norma, especificação, contrato, pedido ou procedimento)', d.requisito);
    checks(OPT.evidenciasRNC, d.evidencias, 4);
    if (d.evidenciasOutras) textBlock('Outras evidências anexadas', d.evidenciasOutras);
    section(4, 'Contenção e disposição imediata', 'Correção do problema detectado');
    grid([{l: 'Disposição do item', v: lab(OPT.disposicao, d.disposicao), span: 2, bold: true}, {l: 'Responsável / prazo', v: [d.respContencao, d.prazoContencao ? dateBR(d.prazoContencao) : ''].filter(Boolean).join('  •  ')}], 3);
    textBlock('Ação de contenção realizada', d.contencao);
    section(5, 'Análise de causa raiz', d.metodoCausa === 'ishikawa' ? 'Diagrama de Ishikawa (6M)' : 'Método dos 5 Porquês');
    const pq = (d.porques || []).map((p, i) => [(i + 1) + 'º porquê', p]).filter(r => r[1]);
    if (pq.length) table([{h: 'ETAPA', w: 0.16}, {h: 'POR QUE ACONTECEU?', w: 0.84}], pq);
    ensure(40); text('CATEGORIAS DE CAUSA (6M)', MX, y + 8, {size: 6.8, bold: true, color: C.gray}); y += 14;
    checks(OPT.cat6m, d.categoria6M, 3);
    textBlock('Causa raiz identificada', d.causaRaiz, {fill: C.softAmber, stroke: 'F0D29A'});
    section(6, 'Plano de ação (5W2H)', acoes.length + ' ação(ões)');
    table([{h: 'TIPO', w: 0.09}, {h: 'O QUÊ', w: 0.19}, {h: 'POR QUÊ', w: 0.13}, {h: 'QUEM', w: 0.10}, {h: 'QUANDO', w: 0.11}, {h: 'COMO', w: 0.15}, {h: 'QUANTO', w: 0.10, a: 'r'}, {h: 'STATUS', w: 0.13}],
      acoes.map(a => [lab(OPT.tipoAcao, a.tipo), a.oque, a.porque, a.quem, a.quando ? dateBR(a.quando) : '', a.como, a.quanto ? money(a.quanto) : '', lab(OPT.statusAcao, a.status)]), {size: 7.4});
    section(7, 'Impactos e custos');
    checks(OPT.impactos, d.impactos, 2);
    grid([{l: 'Valor afetado (item)', v: d.valorAfetado ? money(d.valorAfetado) : '', bold: true}, {l: 'Custo previsto das ações', v: custo ? money(custo) : '', bold: true}, {l: 'Total estimado', v: (Number(d.valorAfetado) || 0) + custo ? money((Number(d.valorAfetado) || 0) + custo) : '', bold: true}], 3);
    if (d.impactoDescricao) textBlock('Descrição dos impactos', d.impactoDescricao);
    section(8, 'Verificação de eficácia', 'ISO 9001:2015, item 10.2.1 (e)');
    grid([{l: 'Data prevista da verificação', v: dateBR(d.verifData)}, {l: 'Resultado', v: lab(OPT.resultadoEficacia, d.verifResultado), bold: true, color: d.verifResultado === 'eficaz' ? C.green : d.verifResultado === 'nao_eficaz' ? C.red : C.ink}, {l: 'Responsável pela verificação', v: d.verifResp},
      {l: 'Riscos e oportunidades atualizados?', v: yn(d.riscosAtualizados)}, {l: 'Mudanças no SGQ necessárias?', v: yn(d.mudancaSGQ), span: 2}], 3);
    textBlock('Critério de eficácia (como saberemos que a causa foi eliminada)', d.verifCriterio);
    if (d.verifObs) textBlock('Observações da verificação', d.verifObs);
    section(9, 'Encerramento');
    grid([{l: 'Status final', v: statusLabel, bold: true}, {l: 'Data de encerramento', v: dateBR(d.dataEncerramento)}, {l: 'Prazo total (dias)', v: d.dataAbertura && d.dataEncerramento ? String(Math.max(0, Math.round((new Date(d.dataEncerramento + 'T12:00:00') - new Date(d.dataAbertura + 'T12:00:00')) / 86400000))) : ''}], 3);
    textBlock('Parecer final / lições aprendidas', d.parecerFinal);
    section(10, 'Base legal e normativa');
    refs(legalRNC(d));
    callout('warn', 'Aviso', noteText);
    ensure(130); section(11, 'Aprovações e assinaturas');
    const a = d.assinaturas || {};
    signatures([{name: a.emitente, role: 'EMITENTE', sub: 'Data: ____/____/______'}, {name: a.responsavel, role: 'RESPONSÁVEL PELA ÁREA', sub: 'Data: ____/____/______'}, {name: a.qualidade, role: 'QUALIDADE / GESTOR', sub: 'Data: ____/____/______'}]);
  }

  /* ===== Conteúdo: Recusa e Devolução ===== */
  function bodyRDM() {
    const itens = (d.itens || []).filter(i => i && (i.descricao || i.codigo)).map(i => Object.assign({}, i, {vt: (Number(i.qtdRec) || 0) * (Number(i.vlrUnit) || 0)}));
    const totRec = itens.reduce((s, i) => s + i.vt, 0), vNF = Number(d.valorNF) || 0;
    const cnpjOk = d.cnpj ? validCNPJ(d.cnpj) : null, chaveOk = d.chave ? validChave(d.chave) : null;
    section(1, 'Identificação da ocorrência');
    grid([{l: 'Nº do relatório', v: numero, bold: true}, {l: 'Data do relatório', v: dateBR(d.dataRelatorio)}, {l: 'Status', v: statusLabel},
      {l: 'Tipo de ocorrência', v: lab(OPT.tipoOc, d.tipoOc), span: 2, bold: true}, {l: 'Data e hora do recebimento', v: dateBR(d.dataRecebimento) + (d.horaRecebimento ? ' às ' + d.horaRecebimento : '')},
      {l: 'Local do recebimento', v: d.localRecebimento, span: 3}], 3);
    section(2, 'Fornecedor');
    grid([{l: 'Razão social / nome', v: d.fornecedor, span: 2, bold: true}, {l: 'CNPJ', v: d.cnpj ? formatCNPJ(d.cnpj) + (cnpjOk === false ? '  (dígito verificador inválido)' : '') : '', color: cnpjOk === false ? C.red : C.ink},
      {l: 'Contato', v: d.contato}, {l: 'Telefone', v: d.telefone}, {l: 'E-mail', v: d.email}], 3);
    section(3, 'Documento fiscal e transporte');
    grid([{l: 'NF-e nº', v: d.nf, bold: true}, {l: 'Série', v: d.serie}, {l: 'Data de emissão', v: dateBR(d.dataEmissao)},
      {l: 'Chave de acesso (44 dígitos)', v: d.chave ? formatChave(d.chave) + (chaveOk === false ? '  (chave inválida)' : '') : '', span: 3, color: chaveOk === false ? C.red : C.ink},
      {l: 'Pedido de compra', v: d.pedido}, {l: 'Valor total da NF', v: vNF ? money(vNF) : '', bold: true}, {l: 'CT-e / conhecimento', v: d.ctNumero},
      {l: 'Transportadora', v: d.transportadora, span: 2}, {l: 'CNPJ da transportadora', v: d.cnpjTransp ? formatCNPJ(d.cnpjTransp) : ''},
      {l: 'Motorista', v: d.motorista, span: 2}, {l: 'Placa / documento', v: [d.placa, d.docMotorista].filter(Boolean).join('  •  ')}], 3);
    section(4, 'Itens recusados / devolvidos', itens.length + ' item(ns)');
    const rows = itens.map((i, k) => [String(k + 1), i.codigo, i.descricao, i.un, fmtNum(Number(i.qtdNF) || 0, 0 + (String(i.qtdNF || '').includes('.') ? 2 : 0)), fmtNum(Number(i.qtdRec) || 0, String(i.qtdRec || '').includes('.') ? 2 : 0), money(i.vlrUnit), money(i.vt), [i.lote, i.validade ? dateBR(i.validade) : ''].filter(Boolean).join(' / '), lab(OPT.motivoItem, i.motivoItem)]);
    rows.push({cells: ['', '', 'TOTAL RECUSADO / DEVOLVIDO', '', '', '', '', money(totRec), '', ''], bold: true, fill: C.softBlue});
    table([{h: '#', w: 0.04, a: 'c'}, {h: 'CÓD.', w: 0.10}, {h: 'DESCRIÇÃO', w: 0.22}, {h: 'UN', w: 0.04, a: 'c'}, {h: 'QTD NF', w: 0.07, a: 'r'}, {h: 'QTD REC.', w: 0.08, a: 'r'}, {h: 'VLR UNIT.', w: 0.09, a: 'r'}, {h: 'VLR REC.', w: 0.10, a: 'r'}, {h: 'LOTE / VALIDADE', w: 0.13}, {h: 'MOTIVO', w: 0.13}], rows, {size: 7.4});
    grid([{l: 'Valor da NF', v: vNF ? money(vNF) : ''}, {l: 'Valor recusado / devolvido', v: money(totRec), bold: true, color: C.red}, {l: 'Valor aceito (NF − recusado)', v: vNF ? money(vNF - totRec) : '', bold: true, color: C.green}, {l: '% da NF recusado', v: vNF ? fmtNum(totRec / vNF * 100, 1) + '%' : ''}], 4);
    if (vNF && totRec > vNF + 0.005) callout('bad', 'Atenção: valor recusado maior que o valor da NF', 'Confira quantidades e valores unitários: o total dos itens recusados excede o valor total da nota fiscal informado.');
    section(5, 'Motivo(s) da recusa ou devolução');
    checks(OPT.motivos, d.motivos, 2);
    textBlock('Descrição detalhada do ocorrido', d.motivoDescricao);
    section(6, 'Condições e comprovações do recebimento');
    grid([{l: 'Embalagem / lacre íntegro?', v: yn(d.embalagemIntegra)}, {l: 'Temperatura aferida (°C)', v: d.temperatura}, {l: 'Ressalva anotada no DANFE / CT-e?', v: yn(d.ressalvaDanfe)},
      {l: 'Evento de manifestação registrado?', v: yn(d.eventoRegistrado)}, {l: 'Protocolo do evento', v: d.eventoProtocolo}, {l: 'Data do evento', v: dateBR(d.eventoData)},
      {l: 'Fornecedor comunicado em', v: d.comFornData ? dateBR(d.comFornData) + (d.comFornMeio ? '  •  ' + d.comFornMeio : '') : ''}, {l: 'Quem atendeu no fornecedor', v: d.comFornPessoa}, {l: 'Transportadora notificada em', v: dateBR(d.comTranspData)}], 3);
    checks(OPT.evidenciasRDM, d.evidencias, 2);
    if (d.evidenciasOutras) textBlock('Outras evidências', d.evidenciasOutras);
    section(7, 'Providências e documentos de retorno');
    grid([{l: 'Providência acordada', v: lab(OPT.providencia, d.providencia), bold: true, span: 2}, {l: 'Frete do retorno', v: lab(OPT.frete, d.frete)},
      {l: 'Prazo para coleta / retorno', v: dateBR(d.prazoColeta)}, {l: 'Mercadoria aguarda em', v: d.localAguarda, span: 2},
      {l: 'NF de devolução / entrada nº', v: [d.nfDevNumero, d.nfDevSerie ? 'série ' + d.nfDevSerie : ''].filter(Boolean).join(' / ')}, {l: 'Data da NF de retorno', v: dateBR(d.nfDevData)}, {l: 'CFOP', v: d.cfop},
      {l: 'Chave da NF de devolução / entrada', v: d.nfDevChave ? formatChave(d.nfDevChave) : '', span: 3},
      {l: 'Título / duplicata suspenso?', v: yn(d.tituloSuspenso)}, {l: 'Vencimento original', v: dateBR(d.vencimentoOriginal)}, {l: 'Valor de crédito / abatimento', v: d.valorAbatimento ? money(d.valorAbatimento) : ''}], 3);
    if (d.observacoes) textBlock('Observações', d.observacoes);
    section(8, 'Orientação fiscal e prazos legais', 'Calculados a partir das datas informadas');
    const f = fiscalRDM(d); callout(f.kind, f.title, f.text);
    const pz = prazosRDM(d);
    if (pz.length) table([{h: 'PRAZO / OBRIGAÇÃO', w: 0.4}, {h: 'FUNDAMENTO', w: 0.4}, {h: 'DATA LIMITE', w: 0.2, a: 'r'}], pz, {size: 7.6});
    else callout('warn', 'Prazos', 'Informe a data do recebimento e a data de emissão da NF-e para calcular os prazos legais.');
    section(9, 'Base legal e normativa');
    refs(legalRDM(d));
    callout('warn', 'Aviso', noteText);
    ensure(130); section(10, 'Assinaturas');
    const a = d.assinaturas || {};
    signatures([{name: a.recebedor, role: 'RESPONSÁVEL PELO RECEBIMENTO', sub: a.recebedorCargo || 'Data: ____/____/______'}, {name: a.motorista, role: 'MOTORISTA / TRANSPORTADOR', sub: a.motoristaDoc || 'Data: ____/____/______'}, {name: a.responsavel, role: 'COMPRAS / GESTOR', sub: a.responsavelCargo || 'Data: ____/____/______'}]);
  }

  /* ===== Conteúdo: índice ===== */
  function bodyIndice() {
    const list = opt.list || [];
    const byTipo = {RNC: [], RDM: []}; list.forEach(r => (byTipo[r.tipo] || (byTipo[r.tipo] = [])).push(r));
    section(1, 'Resumo');
    grid([{l: 'Relatórios de não conformidade (RNC)', v: String((byTipo.RNC || []).length), bold: true}, {l: 'Recusa e devolução (RDM)', v: String((byTipo.RDM || []).length), bold: true},
      {l: 'Valor recusado / afetado (soma)', v: money(list.reduce((s, r) => s + (Number(r.valor) || 0), 0)), bold: true}], 3);
    ['RNC', 'RDM'].forEach((t, k) => {
      const arr = (byTipo[t] || []).slice().sort((a, b) => String(a.numero).localeCompare(String(b.numero)));
      section(k + 2, t === 'RNC' ? 'Relatórios de não conformidade' : 'Recusa e devolução de mercadorias', arr.length + ' registro(s)');
      table([{h: 'Nº', w: 0.15}, {h: 'DATA', w: 0.1}, {h: 'FORNECEDOR', w: 0.27}, {h: 'NF', w: 0.1}, {h: 'REFERÊNCIA', w: 0.16}, {h: 'VALOR', w: 0.11, a: 'r'}, {h: 'STATUS', w: 0.11}],
        arr.map(r => [r.numero, dateBR(r.data_ref), r.fornecedor, r.nf, r.resumo, r.valor ? money(r.valor) : '', lab(t === 'RNC' ? OPT.statusRNC : OPT.statusRDM, r.status)]), {size: 7.6});
    });
  }

  newPage();
  if (isIdx) bodyIndice(); else if (isRNC) bodyRNC(); else bodyRDM();

  const total = pages.length;
  pages.forEach((ops, i) => {
    cur = ops;
    line(MX, H - 34, W - MX, H - 34, C.line, 0.6);
    text('Orçamento de Bebidas  •  ' + (isIdx ? 'Relação de relatórios' : numero) + '  •  Gerado em ' + genTxt + (opt.account ? '  •  ' + opt.account : ''), MX, H - 21, {size: 7, color: C.gray, maxW: CW - 80});
    text('Página ' + (i + 1) + ' de ' + total, W - MX, H - 21, {size: 7, color: C.gray, align: 'right'});
  });

  const docTitle = (isIdx ? 'Relação de relatórios' : numero + ' - ' + (isRNC ? 'Relatório de Não Conformidade' : 'Recusa e Devolução de Mercadorias'));
  const objs = [null, '<< /Type /Catalog /Pages 2 0 R >>', null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
    `<< /Title ${pdfStr(docTitle)} /Author ${pdfStr(opt.account || 'Orçamento de Bebidas')} /Creator ${pdfStr('Orçamento de Bebidas - Administrativo')} /Producer ${pdfStr('Orçamento de Bebidas')} /CreationDate (D:${gen.getFullYear()}${pad2(gen.getMonth() + 1)}${pad2(gen.getDate())}${pad2(gen.getHours())}${pad2(gen.getMinutes())}00) >>`];
  const kids = [];
  pages.forEach((ops, i) => {
    const po = 7 + i * 2, co = po + 1, body = ops.join('\n'); kids.push(po + ' 0 R');
    objs[po] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${logoBin ? ` /XObject << /Im1 ${7 + total * 2} 0 R >>` : ''} >> /Contents ${co} 0 R >>`;
    objs[co] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
  });

  if (logoBin) objs[7 + total * 2] = `<< /Type /XObject /Subtype /Image /Width ${LOGO.w} /Height ${LOGO.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBin.length} >>\nstream\n${logoBin}\nendstream`;
  objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${total} >>`;
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const off = [];
  for (let i = 1; i < objs.length; i++) { off[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xr = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + off.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xr}\n%%EOF`;
  const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}

const api = {build, OPT, lab, addDays, validCNPJ, validChave, parseChave, formatCNPJ, formatChave, onlyDigits, legalRNC, legalRDM, fiscalRDM, prazosRDM};
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AdmPdf = api;
})(typeof self !== 'undefined' ? self : this);
