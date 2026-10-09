/* Orçamentos de Andaimes — lógica de cálculo (pura) + interface */
'use strict';

// Celular/tablet: abre o compartilhar; computador: baixa o PDF direto
function entregaPdf(doc, nome) {
  const movel = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  if (movel && navigator.canShare) {
    const file = new File([doc.output('blob')], nome, { type: 'application/pdf' });
    if (navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: nome }).catch(() => { }); return; }
  }
  doc.save(nome);
}

// ---------- CÁLCULO ----------
// Cada tipo aponta para os itens do contrato: x.<mont>/x.<des> por regime (2=ADM, 3=Noturno, 4=Fim de semana, 5=Subestação)
// e disponibilização 7.<disp> (8.<disp> para material isolante).
const TIPOS = {
  andaime: { nome: 'Andaime (m³)', mont: 5, des: 6, disp: 2, dims: 'clal q', pisos: true },
  balanco: { nome: 'Andaime em balanço (m³)', mont: 1, des: 2, disp: 2, dims: 'clal q', pisos: true },
  escora:  { nome: 'Escoramento (m³)', mont: 7, des: 8, disp: 3, dims: 'clal q' },
  isol:    { nome: 'Isolamento de área / guarda-corpo / cerca / tubo de vida (m²)', mont: 9, des: 10, disp: 4, dims: 'ca q' },
  piso:    { nome: 'Pisos de madeira/alumínio (m²)', mont: 3, des: 4, disp: 1, dims: 'cl q' },
  vida:    { nome: 'Linha de vida com andaime montado (m)', mont: null, des: null, disp: 5, dims: 'c q' },
};
const REGIMES = [
  { k: 'pAdm', base: 2, nome: 'Seg–Sex ADM' },
  { k: 'pNot', base: 3, nome: 'Seg–Sex noturno/extra' },
  { k: 'pFds', base: 4, nome: 'Sáb/Dom/feriado' },
];
const numBr = v => { v = String(v).trim(); if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.'); const n = parseFloat(v); return isFinite(n) ? n : 0; };
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

function metragem(e) {
  const t = TIPOS[e.tipo], c = num(e.c), l = num(e.l), a = num(e.a), q = num(e.q);
  if (num(e.metManual) > 0) return num(e.metManual);
  switch (e.tipo) {
    case 'isol': return c * a * q;
    case 'piso': return c * l * q;
    case 'vida': return c * q;
    default: return c * l * a * q;
  }
}
function areaPisos(e) { return num(e.c) * num(e.l) * num(e.nPisos); }

// devolve linhas [{sgc,qtd,regime,grupo}] sem preços
function linhasDaEstrutura(e) {
  const t = TIPOS[e.tipo], out = [], M = metragem(e);
  const addServ = (base, pct, grupo) => {
    const f = pct / 100;
    if (f <= 0) return;
    if (t.mont != null) {
      if (e.montar !== false) out.push({ sgc: base + '.' + t.mont, qtd: M * f, grupo });
      if (e.desmontar !== false) out.push({ sgc: base + '.' + t.des, qtd: M * f, grupo });
    }
    if (t.pisos && e.incPisos) {
      const A = areaPisos(e);
      if (e.montar !== false) out.push({ sgc: base + '.3', qtd: A * f, grupo });
      if (e.desmontar !== false) out.push({ sgc: base + '.4', qtd: A * f, grupo });
    }
  };
  if (e.isolante) addServ(5, 100, 'Subestação (material isolante)');
  else REGIMES.forEach(r => addServ(r.base, num(e[r.k]), r.nome));
  const dias = num(e.dias);
  if (dias > 0) {
    const b = e.isolante ? 8 : 7, g = 'Disponibilização (' + dias + ' dias)';
    out.push({ sgc: b + '.' + t.disp, qtd: M * dias, grupo: g });
    if (t.pisos && e.incPisos) out.push({ sgc: b + '.1', qtd: areaPisos(e) * dias, grupo: g });
  }
  return out;
}

function calcEstrutura(e, mapa) {
  const linhas = linhasDaEstrutura(e).map(l => {
    const p = mapa.get(l.sgc);
    const preco = p ? num(p.preco) : 0;
    return { ...l, linha: p ? p.linha : '-', desc: p ? p.desc : '(item não encontrado: ' + l.sgc + ')', un: p ? p.un : '', preco, custo: preco * l.qtd, semPreco: !p };
  });
  return { metragem: metragem(e), linhas, total: linhas.reduce((s, l) => s + l.custo, 0) };
}
function calcPonto(p, mapa) {
  const ests = p.estruturas.map(e => calcEstrutura(e, mapa));
  return { ests, total: ests.reduce((s, x) => s + x.total, 0) };
}
function calcVerba(v, mapa) {
  const it = mapa.get(v.sgc), preco = it ? num(it.preco) : 0;
  return { it, preco, custo: preco * num(v.qtd) * num(v.meses) * num(v.pct) / 100 };
}
function calcOrc(o, mapa) {
  const pontos = o.pontos.map(p => calcPonto(p, mapa));
  const verbas = o.verbas.map(v => calcVerba(v, mapa));
  const totPontos = pontos.reduce((s, p) => s + p.total, 0);
  const totVerbas = verbas.reduce((s, v) => s + v.custo, 0);
  const subtotal = totPontos + totVerbas;
  const desconto = subtotal * num(o.desconto) / 100;
  const base = subtotal - desconto;
  const bdi = base * num(o.bdi) / 100;
  return { pontos, verbas, totPontos, totVerbas, subtotal, desconto, bdi, total: base + bdi };
}
const novaEstrutura = (x = {}) => ({ tipo: 'andaime', desc: '', c: 0, l: 0, a: 0, q: 1, nPisos: 0, incPisos: false, metManual: '', isolante: false, montar: true, desmontar: true, pAdm: 100, pNot: 0, pFds: 0, dias: 30, ...x });
const novoPonto = (nome = '') => ({ nome, estruturas: [novaEstrutura()] });
function exemplo() {
  const reg = { pAdm: 25, pNot: 50, pFds: 25, dias: 30 };
  return {
    ...novoOrc(), titulo: 'ORÇAMENTO ANDAIMES - CAMINHO SEGURO BRIT. PRIMÁRIA SLB III',
    pontos: [
      { nome: '1º PONTO DE ANDAIME', estruturas: [novaEstrutura({ tipo: 'isol', desc: 'Tubo de vida', c: 54, a: 2.5, q: 2, ...reg })] },
      { nome: '2º PONTO DE ANDAIME', estruturas: [novaEstrutura({ tipo: 'isol', desc: 'Tubo de vida', c: 131.1, a: 3, q: 1, ...reg })] },
      { nome: '3º PONTO DE ANDAIME', estruturas: [novaEstrutura({ tipo: 'isol', desc: 'Barreira física', c: 36, a: 1.5, q: 1, ...reg })] },
      { nome: '4º PONTO DE ANDAIME', estruturas: [novaEstrutura({ tipo: 'escora', desc: 'Escoramento', c: 2, l: 1, a: 3.5, q: 1, ...reg })] },
    ],
    verbas: verbasPadrao(),
  };
}
const verbasPadrao = () => [{ sgc: '1.1.1', qtd: 1, meses: 1, pct: 2.5 }, { sgc: '9.1', qtd: 2, meses: 1, pct: 2.5 }, { sgc: '9.4', qtd: 1, meses: 1, pct: 2.5 }];
function novoOrc() {
  const hoje = new Date().toISOString().slice(0, 10);
  return { id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), titulo: '', numero: '', data: hoje, cliente: '', local: '', contato: '', validade: 30, prazo: '', pagamento: '', responsavel: '', desconto: 0, bdi: 0, obs: '', pontos: [novoPonto('1º PONTO DE ANDAIME')], verbas: [] };
}
if (typeof module !== 'undefined') module.exports = { TIPOS, calcOrc, exemplo, novoOrc, novaEstrutura, metragem };

// ---------- INTERFACE ----------
if (typeof document !== "undefined") window.APP = { onTab: {}, getExtras: () => ({}), setExtras: () => { } };
if (typeof document !== 'undefined') (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nq = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
  const brl = v => 'R$ ' + nf.format(v || 0);
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

  let precos = ls.get('orc.precos', null) || JSON.parse(JSON.stringify(window.PRECOS_PADRAO));
  let lista = ls.get('orc.lista', []);
  let atualId = ls.get('orc.atual', null);
  let mapa = new Map();
  const rebuild = () => { mapa = new Map(precos.map(p => [p.sgc, p])); };
  rebuild();
  let orc = lista.find(o => o.id === atualId) || lista[0];
  if (!orc) { orc = novoOrc(); orc.numero = proxNumero(); lista.push(orc); }
  atualId = orc.id;

  function proxNumero() { return 'ORC-' + new Date().getFullYear() + '-' + String(lista.length + 1).padStart(3, '0'); }
  function salvar() { ls.set('orc.lista', lista); ls.set('orc.atual', orc.id); ls.set('orc.precos', precos); }
  const dimNome = { c: 'Comprimento (m)', l: 'Largura (m)', a: 'Altura (m)', q: 'Qtd' };
  const fld = (i, j, k, label, v, extra = '') => `<label>${label}<input type="number" step="any" min="0" data-p="${i}" data-e="${j}" data-k="${k}" value="${v === '' || v == null ? '' : v}" ${extra}></label>`;

  // ----- render pontos -----
  function renderPontos() {
    $('#pontos').innerHTML = orc.pontos.map((p, i) => `
    <div class="card ponto">
      <div class="ponto-cab">
        <label>Nome do ponto<input data-p="${i}" data-k="nome" value="${esc(p.nome)}"></label>
        <button class="btn sec mini" data-act="dupPonto" data-p="${i}">Duplicar</button>
        <button class="btn x" data-act="delPonto" data-p="${i}">Remover</button>
      </div>
      ${p.estruturas.map((e, j) => renderEst(e, i, j)).join('')}
      <div class="linha-btns"><button class="btn sec" data-act="addEst" data-p="${i}">+ Estrutura neste ponto</button>
      <strong style="margin-left:auto">Total do ponto: <span data-out="ponto${i}"></span></strong></div>
    </div>`).join('');
    refresh();
  }
  function renderEst(e, i, j) {
    const t = TIPOS[e.tipo], d = t.dims.replace(/ /g, '');
    const dimsHtml = ['c', 'l', 'a', 'q'].filter(k => d.includes(k)).map(k => fld(i, j, k, dimNome[k], e[k])).join('');
    const dis = e.isolante ? 'disabled' : '';
    return `<div class="est">
      <div class="est-grid tipo">
        <label>Tipo de estrutura<select data-p="${i}" data-e="${j}" data-k="tipo" data-rerender>${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${k === e.tipo ? 'selected' : ''}>${v.nome}</option>`).join('')}</select></label>
        <label>Identificação (opcional)<input data-p="${i}" data-e="${j}" data-k="desc" value="${esc(e.desc)}" placeholder="ex.: Tubo de vida"></label>
        <label class="chk"><input type="checkbox" data-p="${i}" data-e="${j}" data-k="isolante" data-rerender ${e.isolante ? 'checked' : ''}> Material isolante (subestação)</label>
        <button class="btn x" data-act="delEst" data-p="${i}" data-e="${j}">Remover estrutura</button>
      </div>
      <div class="est-grid">${dimsHtml}${fld(i, j, 'metManual', 'Metragem manual', e.metManual, 'placeholder="auto"')}
        ${t.pisos ? `<label class="chk"><input type="checkbox" data-p="${i}" data-e="${j}" data-k="incPisos" data-rerender ${e.incPisos ? 'checked' : ''}> Incluir pisos</label>` : ''}
        ${t.pisos && e.incPisos ? fld(i, j, 'nPisos', 'Nº de pisos', e.nPisos) : ''}
      </div>
      <div class="est-grid">
        ${fld(i, j, 'pAdm', '% Seg–Sex ADM', e.pAdm, dis)}${fld(i, j, 'pNot', '% Seg–Sex noturno', e.pNot, dis)}${fld(i, j, 'pFds', '% Sáb/Dom/feriado', e.pFds, dis)}
        ${fld(i, j, 'dias', 'Dias de disponibilização', e.dias)}
        ${t.mont != null ? `<label class="chk"><input type="checkbox" data-p="${i}" data-e="${j}" data-k="montar" ${e.montar !== false ? 'checked' : ''}> Montagem</label>
        <label class="chk"><input type="checkbox" data-p="${i}" data-e="${j}" data-k="desmontar" ${e.desmontar !== false ? 'checked' : ''}> Desmontagem</label>` : ''}
      </div>
      <div class="presets">${e.isolante ? '' : ['100|0|0|100% ADM', '0|100|0|100% noturno', '0|0|100|100% fim de semana', '25|50|25|25/50/25'].map(s => { const [a, b, c, n] = s.split('|'); return `<button class="btn sec mini" data-act="preset" data-p="${i}" data-e="${j}" data-v="${a},${b},${c}">${n}</button>`; }).join('')}</div>
      <div class="soma" data-out="soma${i}_${j}"></div>
      <details><summary>Memória de cálculo — <span data-out="est${i}_${j}"></span></summary><div class="tabela-scroll" data-out="det${i}_${j}"></div></details>
    </div>`;
  }
  const tabLinhas = ls => `<table><tr><th>SGC</th><th>Contrato</th><th>Descrição</th><th>UN</th><th class="n">Custo</th></tr>` +
    (ls.length ? ls.map(l => `<tr${l.semPreco ? ' style="color:#b3261e"' : ''}><td>${l.sgc}</td><td>${l.linha}</td><td>${esc(l.desc)}</td><td>${esc(l.un)}</td><td class="n">${brl(l.custo)}</td></tr>`).join('') : '<tr><td colspan="5">Sem linhas (verifique %, dimensões e dias).</td></tr>') + '</table>';

  function renderVerbas() {
    $('#verbas').innerHTML = orc.verbas.map((v, i) => `<div class="verba">
      <label>Item<select data-v="${i}" data-k="sgc">${precos.map(p => `<option value="${esc(p.sgc)}" ${p.sgc === v.sgc ? 'selected' : ''}>${esc(p.sgc)} – ${esc(p.desc.slice(0, 70))} (${esc(p.un)})</option>`).join('')}</select></label>
      <label>Qtd<input type="number" step="any" min="0" data-v="${i}" data-k="qtd" value="${v.qtd}"></label>
      <label>Meses<input type="number" step="any" min="0" data-v="${i}" data-k="meses" value="${v.meses}"></label>
      <label>% rateio<input type="number" step="any" min="0" data-v="${i}" data-k="pct" value="${v.pct}"></label>
      <div><small>Custo</small><br><strong data-out="verba${i}"></strong></div>
      <button class="btn x" data-act="delVerba" data-v="${i}">✕</button></div>`).join('') || '<p class="dica">Nenhuma verba adicionada.</p>';
    refresh();
  }

  // ----- atualização de valores (sem re-render) -----
  function refresh() {
    const r = calcOrc(orc, mapa), out = k => document.querySelector(`[data-out="${k}"]`);
    r.pontos.forEach((p, i) => {
      out('ponto' + i) && (out('ponto' + i).textContent = brl(p.total));
      p.ests.forEach((x, j) => {
        const e = orc.pontos[i].estruturas[j], t = TIPOS[e.tipo];
        const un = e.tipo === 'isol' || e.tipo === 'piso' ? 'm²' : e.tipo === 'vida' ? 'm' : 'm³';
        out(`est${i}_${j}`) && (out(`est${i}_${j}`).textContent = `${nq.format(x.metragem)} ${un} • ${brl(x.total)}`);
        out(`det${i}_${j}`) && (out(`det${i}_${j}`).innerHTML = tabLinhas(x.linhas));
        const s = out(`soma${i}_${j}`);
        if (s) {
          if (e.isolante) { s.textContent = 'Execução 100% em regime de subestação (itens 5.x / 8.x).'; s.className = 'soma ok'; }
          else { const t = num(e.pAdm) + num(e.pNot) + num(e.pFds); s.textContent = `Soma dos regimes: ${nq.format(t)}%` + (Math.abs(t - 100) > 0.01 ? ' — atenção: deveria fechar 100%' : ' ✓'); s.className = 'soma ' + (Math.abs(t - 100) > 0.01 ? 'erro' : 'ok'); }
        }
      });
    });
    r.verbas.forEach((v, i) => out('verba' + i) && (out('verba' + i).textContent = brl(v.custo)));
    const L = (n, v, c = '') => `<div class="tot-linha ${c}"><span>${n}</span><span>${brl(v)}</span></div>`;
    $('#totais').innerHTML = orc.pontos.map((p, i) => L(esc(p.nome || 'Ponto ' + (i + 1)), r.pontos[i].total)).join('') + L('Verbas fixas / outros itens', r.totVerbas) + L('Subtotal', r.subtotal) +
      (r.desconto ? L('Desconto (' + nq.format(num(orc.desconto)) + '%)', -r.desconto) : '') + (r.bdi ? L('Impostos / BDI (' + nq.format(num(orc.bdi)) + '%)', r.bdi) : '') + L('TOTAL', r.total, 'final');
    $('#barTotal').textContent = brl(r.total);
    return r;
  }

  // ----- eventos -----
  function carregarCampos() { document.querySelectorAll('[data-f]').forEach(el => el.value = orc[el.dataset.f] ?? ''); }
  function tudo() { carregarCampos(); renderPontos(); renderVerbas(); renderSalvos(); }
  document.addEventListener('input', ev => {
    const el = ev.target, d = el.dataset;
    if (d.f) { orc[d.f] = el.type === 'number' ? el.value : el.value; }
    else if (d.p !== undefined && d.k) {
      const tgt = d.e !== undefined ? orc.pontos[d.p].estruturas[d.e] : orc.pontos[d.p];
      tgt[d.k] = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'checkbox' || d.rerender !== undefined) { if (d.rerender !== undefined) { renderPontos(); salvar(); return; } }
    } else if (d.v !== undefined) { orc.verbas[d.v][d.k] = el.value; }
    else if (d.pr !== undefined) { const p = precos[d.pr]; p[d.k] = d.k === 'preco' ? numBr(el.value) : el.value; rebuild(); }
    else return;
    refresh(); salvar();
  });
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const d = b.dataset, p = d.p !== undefined ? orc.pontos[d.p] : null;
    switch (d.act) {
      case 'addEst': p.estruturas.push(novaEstrutura()); renderPontos(); break;
      case 'delEst': if (p.estruturas.length > 1 || confirm('Remover a única estrutura do ponto?')) p.estruturas.splice(d.e, 1); renderPontos(); break;
      case 'delPonto': if (confirm('Remover este ponto?')) { orc.pontos.splice(d.p, 1); renderPontos(); } break;
      case 'dupPonto': orc.pontos.splice(+d.p + 1, 0, JSON.parse(JSON.stringify({ ...p, nome: p.nome + ' (cópia)' }))); renderPontos(); break;
      case 'preset': { const [a, bb, c] = d.v.split(',').map(Number); Object.assign(p.estruturas[d.e], { pAdm: a, pNot: bb, pFds: c }); renderPontos(); break; }
      case 'delVerba': orc.verbas.splice(d.v, 1); renderVerbas(); break;
      case 'delPreco': if (confirm('Excluir este item da tabela?')) { precos.splice(d.pr, 1); rebuild(); renderPrecos(); } break;
      case 'abrir': orc = lista.find(o => o.id === d.id); tudo(); mostrar('orcamento'); break;
      case 'excluir': if (confirm('Excluir este orçamento?')) { lista = lista.filter(o => o.id !== d.id); if (!lista.length) { const n = novoOrc(); n.numero = proxNumero(); lista.push(n); } if (orc.id === d.id) orc = lista[0]; tudo(); } break;
    }
    salvar();
  });
  $('#addPonto').onclick = () => { orc.pontos.push(novoPonto(`${orc.pontos.length + 1}º PONTO DE ANDAIME`)); renderPontos(); salvar(); window.scrollTo(0, document.body.scrollHeight); };
  $('#addVerba').onclick = () => { orc.verbas.push({ sgc: precos[0].sgc, qtd: 1, meses: 1, pct: 100 }); renderVerbas(); salvar(); };
  $('#addVerbasPadrao').onclick = () => { orc.verbas.push(...verbasPadrao()); renderVerbas(); salvar(); };
  $('#btnDup').onclick = () => { const c = JSON.parse(JSON.stringify(orc)); c.id = novoOrc().id; c.numero = proxNumero(); c.titulo = (c.titulo || 'Orçamento') + ' (cópia)'; lista.push(c); orc = c; tudo(); salvar(); alert('Orçamento duplicado.'); };

  // ----- abas -----
  function mostrar(t) { document.querySelectorAll('main > section').forEach(s => s.hidden = s.id !== 'tab-' + t); document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); if (t === 'salvos') renderSalvos(); if (t === 'precos') renderPrecos(); if (window.APP.onTab[t]) window.APP.onTab[t](); window.scrollTo(0, 0); }
  document.querySelectorAll('nav button').forEach(b => b.onclick = () => mostrar(b.dataset.tab));

  // ----- tabela de preços -----
  function renderPrecos() {
    const q = $('#buscaPreco').value.toLowerCase(); let g = '';
    $('#tabPrecos').innerHTML = '<tr><th>SGC</th><th>Contrato</th><th>Descrição</th><th>UN</th><th class="n">Preço unit. (R$)</th><th></th></tr>' +
      precos.map((p, i) => ({ p, i })).filter(({ p }) => !q || (p.sgc + ' ' + p.desc).toLowerCase().includes(q)).map(({ p, i }) => {
        const h = p.grupo !== g ? `<tr class="grp"><td colspan="6">${esc(p.grupo || 'Sem grupo')}</td></tr>` : ''; g = p.grupo;
        return h + `<tr><td><input data-pr="${i}" data-k="sgc" value="${esc(p.sgc)}" size="5"></td><td><input data-pr="${i}" data-k="linha" value="${esc(p.linha)}" size="4"></td><td><input data-pr="${i}" data-k="desc" value="${esc(p.desc)}"></td><td><input data-pr="${i}" data-k="un" value="${esc(p.un)}" size="8"></td><td class="ctb"><div><span>R$</span><input inputmode="decimal" data-pr="${i}" data-k="preco" value="${nf.format(p.preco || 0)}"></div></td><td><button class="btn x" data-act="delPreco" data-pr="${i}">✕</button></td></tr>`;
      }).join('');
  }
  document.addEventListener('focusout', ev => { const el = ev.target; if (el.dataset && el.dataset.k === 'preco' && el.dataset.pr !== undefined) el.value = nf.format(numBr(el.value)); });
  $('#buscaPreco').oninput = renderPrecos;
  $('#addPreco').onclick = () => { precos.push({ sgc: 'novo', linha: '', desc: 'Novo item', un: 'un', preco: 0, grupo: 'Itens adicionais' }); rebuild(); renderPrecos(); salvar(); };
  $('#resetPrecos').onclick = () => { if (confirm('Restaurar todos os preços para os valores da planilha?')) { precos = JSON.parse(JSON.stringify(window.PRECOS_PADRAO)); rebuild(); renderPrecos(); renderVerbas(); salvar(); } };

  // ----- salvos -----
  function renderSalvos() {
    $('#listaSalvos').innerHTML = lista.map(o => `<div class="salvo ${o.id === orc.id ? 'atual' : ''}"><div class="info"><strong>${esc(o.titulo || 'Sem título')}</strong><br><small>${esc(o.cliente)} ${o.data ? '• ' + o.data.split('-').reverse().join('/') : ''} • ${brl(calcOrc(o, mapa).total)}</small></div><button class="btn sec mini" data-act="abrir" data-id="${o.id}">Abrir</button><button class="btn x" data-act="excluir" data-id="${o.id}">Excluir</button></div>`).join('');
  }
  $('#novoOrc').onclick = () => { orc = novoOrc(); orc.numero = proxNumero(); lista.push(orc); tudo(); salvar(); mostrar('orcamento'); };
  $('#expOrc').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ lista, precos, extras: window.APP.getExtras() }, null, 1)], { type: 'application/json' })); a.download = 'orcamentos-backup.json'; a.click(); };
  $('#impOrc').onclick = () => $('#fileImp').click();
  $('#fileImp').onchange = async ev => { try { const d = JSON.parse(await ev.target.files[0].text()); const arr = d.lista || (Array.isArray(d) ? d : [d]); arr.forEach(o => { if (o && o.pontos) { o.id = novoOrc().id; lista.push(o); } }); if (d.extras) window.APP.setExtras(d.extras); if (d.precos && confirm('Importar também a tabela de preços do arquivo?')) { precos = d.precos; rebuild(); } tudo(); salvar(); } catch (e) { alert('Arquivo inválido.'); } ev.target.value = ''; };
  // exemplo
  const ex = document.createElement('button'); ex.className = 'btn sec'; ex.textContent = 'Carregar exemplo da planilha'; ex.onclick = () => { orc = exemplo(); orc.numero = proxNumero(); lista.push(orc); tudo(); salvar(); mostrar('orcamento'); }; $('#novoOrc').parentNode.insertBefore(ex, $('#impOrc'));

  // ----- PDF -----
  $('#btnPdf').onclick = () => {
    try { gerarPdf(); } catch (e) { console.error(e); alert('Erro ao gerar PDF: ' + e.message); }
  };
  function gerarPdf() {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const r = calcOrc(orc, mapa), W = 210, M = 12, AZ = [14, 63, 86], CI = [0, 173, 249];
    const m = v => brl(v).replace(/ /g, ' ');
    const dt = orc.data ? orc.data.split('-').reverse().join('/') : '';
    // cabeçalho
    doc.setFillColor(...AZ); doc.rect(0, 0, W, 30, 'F');
    doc.addImage(window.LOGO_BRANCA, 'PNG', M, 6, 46, 19.7);
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('ORÇAMENTO', W - M, 14, { align: 'right' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(dt, W - M, 21, { align: 'right' });
    doc.setFillColor(...CI); doc.rect(0, 30, W, 1.5, 'F');
    doc.setTextColor(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    const tit = doc.splitTextToSize(orc.titulo || 'Orçamento de serviços de andaimes', W - 2 * M); doc.text(tit, M, 40);
    let y = 40 + tit.length * 5.5;
    const info = [['Cliente', orc.cliente], ['Local / Unidade', orc.local], ['Responsável', orc.responsavel]].filter(x => x[1]);
    if (info.length) { doc.autoTable({ startY: y, body: info, theme: 'plain', styles: { fontSize: 9, cellPadding: 1 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45, textColor: AZ } }, margin: { left: M, right: M } }); y = doc.lastAutoTable.finalY + 9; }
    // resumo
    const sub = (t) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...AZ); doc.text(t, M, y); y += 2; };
    const contabil = col => ({ didParseCell: d => { if (d.column.index === col && d.section === 'head') d.cell.styles.halign = 'right'; if (d.column.index === col && d.section === 'body' && d.cell.colSpan === 1) d.cell.styles.valign = 'middle'; if (d.column.index === col && d.cell.colSpan === 1 && /^-?[\d.]+,\d{2}$/.test(d.cell.text.join(''))) { d.cell.contabil = true; } }, didDrawCell: d => { if (d.cell.contabil) { doc.setFont('helvetica', d.cell.styles.fontStyle || 'normal'); doc.setFontSize(d.cell.styles.fontSize); doc.setTextColor(0); doc.text('R$', d.cell.x + 1.5, d.cell.y + d.cell.height / 2 + d.cell.styles.fontSize * 0.12, {}); } } });
    const head = { fillColor: AZ, textColor: 255, fontSize: 8.5 };
    sub('RESUMO');
    const res = orc.pontos.map((p, i) => [p.nome || 'Ponto ' + (i + 1), nf.format(r.pontos[i].total)]);
    if (r.verbas.length) res.push(['Verbas fixas / outros itens', nf.format(r.totVerbas)]);
    res.push([{ content: 'Subtotal', styles: { fontStyle: 'bold' } }, { content: nf.format(r.subtotal), styles: { fontStyle: 'bold' } }]);
    if (r.desconto) res.push([`Desconto (${nq.format(num(orc.desconto))}%)`, nf.format(-r.desconto)]);
    if (r.bdi) res.push([`Impostos / BDI (${nq.format(num(orc.bdi))}%)`, nf.format(r.bdi)]);
    res.push([{ content: 'TOTAL GERAL', styles: { fontStyle: 'bold', fillColor: [233, 246, 253], fontSize: 11 } }, { content: nf.format(r.total), styles: { fontStyle: 'bold', fillColor: [233, 246, 253], fontSize: 11 } }]);
    doc.autoTable({ startY: y, head: [['Descrição', 'Valor (R$)']], body: res, headStyles: head, ...contabil(1), styles: { fontSize: 9 }, columnStyles: { 1: { halign: 'right', cellWidth: 45 } }, margin: { left: M, right: M } });
    y = doc.lastAutoTable.finalY + 8;
    // detalhamento
    const cols = { 0: { cellWidth: 14 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 26 }, 3: { cellWidth: 34, halign: 'right' } };
    const ensure = h => { if (y + h > 280) { doc.addPage(); y = 16; } };
    orc.pontos.forEach((p, i) => {
      ensure(30); sub((p.nome || 'Ponto ' + (i + 1)).toUpperCase());
      const body = [];
      p.estruturas.forEach((e, j) => {
        const x = r.pontos[i].ests[j], t = TIPOS[e.tipo];
        const dm = ['c', 'l', 'a', 'q'].filter(k => t.dims.includes(k)).map(k => ({ c: 'C', l: 'L', a: 'A', q: 'Qtd' }[k] + ' ' + nq.format(num(e[k])))).join(' × ');
        body.push([{ content: `${e.desc ? e.desc + ' — ' : ''}${t.nome}   |   ${dm}${e.isolante ? '   |   Material isolante' : ''}`, colSpan: 4, styles: { fillColor: [223, 233, 238], fontStyle: 'bold', textColor: AZ } }]);
        let g = '';
        x.linhas.forEach(l => { if (l.grupo !== g) { g = l.grupo; body.push([{ content: g + (g.startsWith('Disp') ? '' : ` — ${nq.format(num(e.isolante ? 100 : e[REGIMES.find(z => z.nome === g)?.k]))}% executado`), colSpan: 4, styles: { fontStyle: 'italic', textColor: 90 } }]); } body.push([l.sgc, l.desc, l.un, nf.format(l.custo)]); });
      });
      body.push([{ content: 'Total do ponto', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, { content: nf.format(r.pontos[i].total), styles: { fontStyle: 'bold', halign: 'right' } }]);
      doc.autoTable({ startY: y, head: [['Item', 'Descrição', 'UN', 'Total (R$)']], body, headStyles: head, ...contabil(3), styles: { fontSize: 7.5, cellPadding: 1.4 }, columnStyles: cols, margin: { left: M, right: M } });
      y = doc.lastAutoTable.finalY + 8;
    });
    if (r.verbas.length) {
      ensure(30); sub('VERBAS FIXAS / OUTROS ITENS');
      const body = orc.verbas.map((v, i) => [v.sgc, r.verbas[i].it ? r.verbas[i].it.desc : '-', r.verbas[i].it ? r.verbas[i].it.un : '', nf.format(r.verbas[i].custo)]);
      body.push([{ content: 'Total', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } }, { content: nf.format(r.totVerbas), styles: { fontStyle: 'bold', halign: 'right' } }]);
      doc.autoTable({ startY: y, head: [['Item', 'Descrição', 'UN', 'Total (R$)']], body, headStyles: head, ...contabil(3), styles: { fontSize: 7.5, cellPadding: 1.4 }, columnStyles: cols, margin: { left: M, right: M } });
      y = doc.lastAutoTable.finalY + 8;
    }
    if (orc.obs.trim()) { ensure(25); sub('OBSERVAÇÕES'); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40); const t = doc.splitTextToSize(orc.obs, W - 2 * M); t.forEach(ln => { ensure(5); doc.text(ln, M, y + 4); y += 4.5; }); y += 8; }
    const n = doc.getNumberOfPages();
    for (let k = 1; k <= n; k++) { doc.setPage(k); doc.setFontSize(8); doc.setTextColor(130); doc.text(`Página ${k} de ${n}`, W / 2, 291, { align: 'center' }); }
    const nome = `Orcamento_${(orc.cliente || orc.titulo || 'andaimes').replace(/[^\w-]+/g, '_').slice(0, 40)}_${orc.data || ''}.pdf`;
    entregaPdf(doc, nome);
  }

  window.APP.getOrc = () => orc;
  window.APP.addOrc = o => { o.id = novoOrc().id; lista.push(o); orc = o; tudo(); salvar(); mostrar('orcamento'); };
  window.APP.mostrar = mostrar;
  window.APP.getLista = () => lista;
  window.APP.calcEst = e => calcEstrutura(e, mapa);
  window.APP.fmt = { esc, nf, nq, brl, ls };
  window.APP.proxNumero = proxNumero;
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  tudo(); salvar();
})();
