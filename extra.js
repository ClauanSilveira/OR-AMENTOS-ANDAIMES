/* Visitas técnicas + Programação (produtividade) */
'use strict';
const CORE = typeof module !== "undefined" ? require("./app.js") : { TIPOS, metragem, novaEstrutura, novoOrc };
const unTipo = t => (t === 'isol' || t === 'piso') ? 'm²' : t === 'vida' ? 'm' : 'm³';
const N = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

// ---------- CÁLCULO DA PROGRAMAÇÃO ----------
// HH = metragem / índice (un/HH);  horas = HH / MOD;  dias = horas / jornada
function calcFase(M, ind, mod, jornada) {
  ind = N(ind); mod = N(mod); jornada = N(jornada) || 8;
  if (!(ind > 0) || !(mod > 0)) return { ind, mod, hh: 0, h: 0, d: 0, ok: false };
  const hh = M / ind, h = hh / mod;
  return { ind, mod, hh, h, d: h / jornada, ok: true };
}
function proxDiaUtil(d, fds) { d = new Date(d.getTime()); while (!fds && (d.getUTCDay() === 0 || d.getUTCDay() === 6)) d.setUTCDate(d.getUTCDate() + 1); return d; }
function somaDias(iso, n, fds) { // n dias de trabalho (n>=1): devolve a data do último dia
  if (!iso) return ''; let d = proxDiaUtil(new Date(iso + 'T00:00:00Z'), fds);
  for (let i = 1; i < n; i++) { d.setUTCDate(d.getUTCDate() + 1); d = proxDiaUtil(d, fds); }
  return d.toISOString().slice(0, 10);
}
function calcProg(p) {
  const itens = p.itens.map(it => {
    const M = CORE.metragem(it);
    const indM = N(it.indMont) || N(p.indMont), indD = N(it.indDesm) || N(p.indDesm) || indM, mod = N(it.mod) || N(p.mod);
    const mont = p.montar !== false ? calcFase(M, indM, mod, p.jornada) : null;
    const desm = p.desmontar !== false ? calcFase(M, indD, mod, p.jornada) : null;
    return { M, un: unTipo(it.tipo), mont, desm };
  });
  const soma = k => itens.reduce((s, i) => s + (i[k] ? i[k].h : 0), 0);
  const somaHH = k => itens.reduce((s, i) => s + (i[k] ? i[k].hh : 0), 0);
  const j = N(p.jornada) || 8;
  const tot = { hMont: soma('mont'), hDesm: soma('desm'), hhMont: somaHH('mont'), hhDesm: somaHH('desm') };
  tot.dMont = tot.hMont / j; tot.dDesm = tot.hDesm / j; tot.h = tot.hMont + tot.hDesm; tot.d = tot.h / j;
  tot.fimMont = tot.dMont > 0 ? somaDias(p.dataInicio, Math.ceil(tot.dMont - 1e-9), p.fds) : '';
  return { itens, tot };
}
const novaProg = () => ({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nome: '', local: '', dataInicio: '', mod: 4, jornada: 8, indMont: '', indDesm: '', montar: true, desmontar: false, fds: false, itens: [] });
if (typeof module !== 'undefined') module.exports = { calcProg, calcFase, somaDias, novaProg };

// ---------- INTERFACE ----------
if (typeof document !== 'undefined') (function () {
  const { esc, nf, nq, brl, ls } = window.APP.fmt, $ = s => document.querySelector(s);
  const hoje = () => new Date().toISOString().slice(0, 10);
  const br = d => d ? d.split('-').reverse().join('/') : '';
  let visitas = ls.get('orc.visitas', []), progs = ls.get('orc.progs', []);
  let vis = visitas.find(v => v.id === ls.get('orc.visAtual', '')) || visitas[0];
  let prog = progs.find(v => v.id === ls.get('orc.progAtual', '')) || progs[0];
  let falhou = false;
  function persist() {
    try { localStorage.setItem('orc.visitas', JSON.stringify(visitas)); localStorage.setItem('orc.progs', JSON.stringify(progs)); localStorage.setItem('orc.visAtual', JSON.stringify(vis && vis.id)); localStorage.setItem('orc.progAtual', JSON.stringify(prog && prog.id)); return true; }
    catch (e) { if (!falhou) { falhou = true; alert('Memória do aparelho cheia. Exporte o backup (aba Salvos) e apague visitas antigas.'); } return false; }
  }
  const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  window.APP.getExtras = () => ({ visitas, progs });
  window.APP.getVisAtual = () => vis;
  window.APP.addVisita = v => { v.id = uid(); visitas.push(v); vis = v; persist(); renderVisita(); mostrarVisita(); };
  window.APP.novaVisita = () => { novaV(); mostrarVisita(); };
  window.APP.refreshVis = () => { persist(); if (!$('#tab-visita').hidden) renderVisita(); };
  const mostrarVisita = () => { const b = document.querySelector('nav button[data-tab="visita"]'); if (b) b.click(); };
  window.APP.setExtras = e => { (e.visitas || []).forEach(v => { v.id = uid(); visitas.push(v); }); (e.progs || []).forEach(v => { v.id = uid(); progs.push(v); }); vis = vis || visitas[0]; prog = prog || progs[0]; persist(); };

  const CHK_E = [['limpeza', 'Necessita de limpeza no local'], ['@limpeza', ''], ['parada', 'Execução em parada'], ['rotina', 'Execução em rotina'], ['bloqueio', 'Necessário bloqueio'], ['material', 'Material disponível no local'], ['solo', 'Solo adequado para implantação'], ['acesso', 'Livre acesso para descarga do material']];
  const CHK_D = [['batedor', 'Apoio de Batedor ou acesso especial'], ['treino', 'Treinamento de acesso a área'], ['spot', 'Necessidade de SPOT'], ['interf', 'Interferência de outras empresas'], ['ancora', 'Ponto de ancoragem'], ['andRotina', 'Andaime de Rotina'], ['andExtra', 'Andaime Extra']];
  const tipoOpts = sel => Object.entries(CORE.TIPOS).map(([k, t]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(t.nome)}</option>`).join('');
  const novaVisita = () => ({ id: uid(), data: hoje(), representante: '', solicitante: '', local: '', inicio: '', equipe: '', prioridade: '', checks: {}, pontosLimpeza: '', obs: '', andaimes: [{ tipo: 'andaime', desc: '', c: '', l: '', a: '', q: 1 }], assCbsi: '', assCliente: '', croqui: '', fotos: [], status: 'Não iniciado' });
  const STATUS = ['Não iniciado', 'Em andamento', 'Montado', 'Desmontado', 'Cancelado'];
  let filtroSt = '';
  const stDe = v => v.status || 'Não iniciado';
  const nomeVis = v => (v.local || 'Sem local') + (v.data ? ' • ' + br(v.data) : '');

  // ===== pad de desenho =====
  const ferr = { cor: '#000000', tam: 3, borracha: false };
  function pad(cv, w, h, get, set) {
    cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); ctx.lineCap = ctx.lineJoin = 'round';
    const src = get(); if (src) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, w, h); im.src = src; }
    let on = false, ult = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * w / r.width, (e.clientY - r.top) * h / r.height]; };
    const traco = (a, b) => { ctx.globalCompositeOperation = ferr.borracha ? 'destination-out' : 'source-over'; ctx.strokeStyle = ferr.cor; ctx.lineWidth = ferr.borracha ? ferr.tam * 5 : ferr.tam; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
    cv.onpointerdown = e => { e.preventDefault(); on = true; ult = pos(e); cv.setPointerCapture(e.pointerId); traco(ult, [ult[0] + .01, ult[1]]); };
    cv.onpointermove = e => { if (!on) return; e.preventDefault(); const p = pos(e); traco(ult, p); ult = p; };
    const fim = () => { if (!on) return; on = false; set(cv.toDataURL('image/png')); persist(); };
    cv.onpointerup = fim; cv.onpointercancel = fim;
    cv.limpar = () => { ctx.clearRect(0, 0, w, h); set(''); persist(); };
  }

  // ===== VISITA =====
  function renderVisita() {
    const root = $('#visRoot');
    if (!vis) { root.innerHTML = '<div class="card"><p class="dica">Nenhuma visita criada.</p><button class="btn" id="visNova">+ Nova visita</button></div>'; $('#visNova').onclick = novaV; $('#visBar').textContent = '—'; return; }
    const f = (k, lab, tipo = 'text', extra = '') => `<label>${lab}<input type="${tipo}" ${extra} data-vf="${k}" value="${esc(vis[k])}"></label>`;
    const chk = ([k, lab]) => k === '@limpeza' ? `<div class="chk-linha" ${vis.checks.limpeza === 's' ? '' : 'hidden'}><span style="flex:1"><input data-vf="pontosLimpeza" placeholder="Caso sim, informar pontos de limpeza" value="${esc(vis.pontosLimpeza)}"></span></div>` :
      `<div class="chk-linha"><span>${lab}</span><div class="sn"><button class="s ${vis.checks[k] === 's' ? 'on' : ''}" data-vk="${k}" data-v="s">Sim</button><button class="n ${vis.checks[k] === 'n' ? 'on' : ''}" data-vk="${k}" data-v="n">Não</button></div></div>`;
    root.innerHTML = `
    <div class="card seletor"><select id="visFil"><option value="">Todos os status (${visitas.length})</option>${STATUS.map(s => `<option value="${s}" ${s === filtroSt ? 'selected' : ''}>${s} (${visitas.filter(v => stDe(v) === s).length})</option>`).join('')}</select>
      <select id="visSel">${visitas.filter(v => v === vis || !filtroSt || stDe(v) === filtroSt).map(v => `<option value="${v.id}" ${v.id === vis.id ? 'selected' : ''}>${esc('[' + stDe(v) + '] ' + nomeVis(v))}</option>`).join('')}</select>
      <button class="btn" id="visNova">+ Nova</button><button class="btn pdf" id="visSolic">Enviar solicitação</button><button class="btn sec" id="visDup">Duplicar</button><button class="btn x" id="visDel">Excluir</button></div>
    <div class="card"><h2>Relatório de visita técnica</h2><div class="grid">
      ${f('data', 'Data da visita', 'date')}${f('representante', 'Representante CBSI')}${f('solicitante', 'Solicitante (cliente)')}${f('local', 'Local')}
      ${f('inicio', 'Início previsto', 'date')}${f('equipe', 'Quant. de equipe', 'number', 'min="0"')}
      <label>Status<select data-vf="status" ${vis.nuvemId && !(window.APP.nuvem && window.APP.nuvem.admin) ? 'disabled title="O status é atualizado pelo administrador"' : ''}>${STATUS.map(p => `<option ${p === stDe(vis) ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
      <label>Prioridade<select data-vf="prioridade">${['', 'Baixa', 'Média', 'Alta', 'Urgente'].map(p => `<option ${p === vis.prioridade ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div></div>
    <div class="card"><h2>Itens de verificação</h2><div class="cols2"><div>${CHK_E.map(chk).join('')}</div><div>${CHK_D.map(chk).join('')}</div></div></div>
    <div class="card"><h2>Observações gerais</h2><textarea rows="5" data-vf="obs">${esc(vis.obs)}</textarea></div>
    <div class="card"><h2>Descrição do andaime</h2>
      ${vis.andaimes.map((a, i) => `<div class="est"><div class="est-grid tipo"><label>Tipo<select data-va="${i}" data-k="tipo">${tipoOpts(a.tipo)}</select></label><label>Identificação<input data-va="${i}" data-k="desc" value="${esc(a.desc)}" placeholder="ex.: Torre acesso correia"></label><button class="btn x" data-vdel="${i}">Remover</button></div>
      <div class="est-grid">${['c:Comp. (m)', 'l:Larg. (m)', 'a:Alt. (m)', 'q:Qtd'].map(s => { const [k, l] = s.split(':'); return `<label>${l}<input type="number" step="any" min="0" data-va="${i}" data-k="${k}" value="${a[k]}"></label>`; }).join('')}</div><div class="res" data-vres="${i}"></div></div>`).join('')}
      <div class="linha-btns"><button class="btn sec" id="visAdd">+ Andaime</button>
      <select id="visImpOrc"><option value="">Importar do orçamento…</option>${(window.APP.getLista() || []).map((o, k) => `<option value="${k}">${esc((o.numero ? o.numero + ' - ' : '') + (o.titulo || o.local || 'Sem título'))}</option>`).join('')}</select></div>
      <div class="kpis" id="visKpis"></div></div>
    <div class="card"><h2>Croqui</h2><div class="tools"><button class="btn sec mini on" data-tool="pen">Caneta</button><button class="btn sec mini" data-tool="eraser">Borracha</button>
      ${['#000000', '#1565c0', '#c62828'].map(c => `<button class="cor ${c === ferr.cor ? 'on' : ''}" style="background:${c}" data-cor="${c}"></button>`).join('')}
      <button class="btn x mini" data-limpa="croqui">Limpar</button></div><canvas id="cvCroqui" class="pad grade"></canvas></div>
    <div class="card"><h2>Fotos</h2><div class="linha-btns"><label class="btn sec fotobtn">📷 Tirar foto<input type="file" accept="image/*" capture="environment" id="visFotoCam" hidden></label><label class="btn sec fotobtn">🖼️ Galeria<input type="file" accept="image/*" multiple id="visFotoGal" hidden></label></div>
      <div class="fotos">${(vis.fotos || []).map((f, i) => `<div class="foto"><img src="${f.d}" alt="Foto ${i + 1}"><input data-vfo="${i}" placeholder="Legenda (opcional)" value="${esc(f.t)}"><button class="btn x mini" data-vfdel="${i}">Remover</button></div>`).join('') || '<p class="dica">Nenhuma foto. As fotos saem no PDF da visita.</p>'}</div></div>
    <div class="card"><h2>Assinaturas</h2><div class="cols2"><div><small>CBSI</small><canvas id="cvAssC" class="pad"></canvas><button class="btn x mini" data-limpa="assCbsi">Limpar</button></div><div><small>Cliente</small><canvas id="cvAssK" class="pad"></canvas><button class="btn x mini" data-limpa="assCliente">Limpar</button></div></div></div>`;
    pad($('#cvCroqui'), 760, 1000, () => vis.croqui, d => vis.croqui = d);
    pad($('#cvAssC'), 600, 240, () => vis.assCbsi, d => vis.assCbsi = d);
    pad($('#cvAssK'), 600, 240, () => vis.assCliente, d => vis.assCliente = d);
    $('#visFotoCam').onchange = $('#visFotoGal').onchange = addFotos;
    $('#visFil').onchange = e => { filtroSt = e.target.value; const l = visitas.filter(v => !filtroSt || stDe(v) === filtroSt); if (l.length && !l.includes(vis)) vis = l[0]; persist(); renderVisita(); };
    $('#visSel').onchange = e => { vis = visitas.find(v => v.id === e.target.value); persist(); renderVisita(); };
    $('#visSolic').onclick = async () => { try { await window.APP.nuvem.solicitar(); } catch (e) { alert(e.message); } };
    $('#visNova').onclick = novaV; $('#visDup').onclick = () => { const c = JSON.parse(JSON.stringify(vis)); c.id = uid(); visitas.push(c); vis = c; persist(); renderVisita(); };
    $('#visDel').onclick = () => { if (confirm('Excluir esta visita?')) { visitas = visitas.filter(v => v !== vis); vis = visitas[0]; persist(); renderVisita(); } };
    $('#visAdd').onclick = () => { vis.andaimes.push({ tipo: 'andaime', desc: '', c: '', l: '', a: '', q: 1 }); persist(); renderVisita(); };
    $('#visImpOrc').onchange = e => { const o = window.APP.getLista()[e.target.value]; if (o) importaOrc(o); };
    $('#visBar').textContent = nomeVis(vis);
    atualizaVis();
  }
  // cálculo automático dos andaimes da visita (metragem e custo pela tabela de preços)
  function atualizaVis() {
    if (!vis) return; let tot = 0; const porUn = {};
    vis.andaimes.forEach((a, i) => {
      const x = window.APP.calcEst(CORE.novaEstrutura(a)), un = unTipo(a.tipo); tot += x.total; porUn[un] = (porUn[un] || 0) + x.metragem;
      const el = document.querySelector(`[data-vres="${i}"]`); if (el) el.innerHTML = `Metragem: <b>${nq.format(Math.round(x.metragem * 1000) / 1000)} ${un}</b> • Custo: <b>${brl(x.total)}</b>`;
    });
    const k = (l, v) => `<div class="kpi"><small>${l}</small><strong>${v}</strong></div>`, el = $('#visKpis');
    if (el) el.innerHTML = Object.entries(porUn).map(([un, m]) => k('Total ' + un, nq.format(Math.round(m * 1000) / 1000))).join('') + k('Custo estimado', brl(tot));
  }
  function importaOrc(o) {
    const novos = [];
    o.pontos.forEach(p => p.estruturas.forEach(e => novos.push({ ...JSON.parse(JSON.stringify(e)), desc: [p.nome, e.desc].filter(Boolean).join(' - ') })));
    if (!novos.length) return alert('Este orçamento não tem andaimes.');
    if (vis.andaimes.length === 1 && !vis.andaimes[0].desc && !N(vis.andaimes[0].c) && !N(vis.andaimes[0].l) && !N(vis.andaimes[0].a)) vis.andaimes = [];
    vis.andaimes.push(...novos);
    if (!vis.local) vis.local = o.local || ''; if (!vis.solicitante) vis.solicitante = o.cliente || '';
    persist(); renderVisita();
  }
  // fotos: redimensiona (máx. 1280px) e comprime em JPEG para caber no localStorage
  function reduzFoto(file) {
    return new Promise((ok, no) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1280 / Math.max(im.width, im.height)), w = Math.round(im.width * k), h = Math.round(im.height * k), c = document.createElement('canvas');
        c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url); ok({ d: c.toDataURL('image/jpeg', 0.7), w, h, t: '' });
      };
      im.onerror = () => { URL.revokeObjectURL(url); no(new Error('imagem inválida')); };
      im.src = url;
    });
  }
  async function addFotos(e) {
    const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
    vis.fotos = vis.fotos || [];
    for (const f of files) {
      try { const ft = await reduzFoto(f); vis.fotos.push(ft); if (!persist()) { vis.fotos.pop(); break; } }
      catch (err) { alert('Não foi possível ler a foto.'); }
    }
    renderVisita();
  }
  function novaV() { vis = novaVisita(); visitas.push(vis); persist(); renderVisita(); }
  $('#visRoot').addEventListener('input', e => {
    const d = e.target.dataset;
    if (d.vfo !== undefined) { vis.fotos[d.vfo].t = e.target.value; persist(); return; }
    if (d.vf !== undefined) vis[d.vf] = e.target.value; else if (d.va !== undefined) vis.andaimes[d.va][d.k] = e.target.value; else return;
    if (d.vf === 'status') { renderVisita(); return; }
    if (d.vf === 'local' || d.vf === 'data') $('#visBar').textContent = nomeVis(vis); persist(); if (d.va !== undefined) atualizaVis();
  });
  $('#visRoot').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.vk) { vis.checks[d.vk] = vis.checks[d.vk] === d.v ? '' : d.v; persist(); renderVisita(); }
    else if (d.vfdel !== undefined) { if (confirm('Remover esta foto?')) { vis.fotos.splice(d.vfdel, 1); persist(); renderVisita(); } }
    else if (d.vdel !== undefined) { vis.andaimes.splice(d.vdel, 1); persist(); renderVisita(); }
    else if (d.tool) { ferr.borracha = d.tool === 'eraser'; document.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x === b)); }
    else if (d.cor) { ferr.cor = d.cor; ferr.borracha = false; document.querySelectorAll('[data-cor]').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x.dataset.tool === 'pen')); }
    else if (d.limpa) { if (confirm('Limpar?')) { const id = { croqui: 'cvCroqui', assCbsi: 'cvAssC', assCliente: 'cvAssK' }[d.limpa]; $('#' + id).limpar(); } }
  });
  window.APP.onTab.visita = () => { renderVisita(); };

  // visita -> orçamento atual (importa os andaimes como um ponto e calcula pela tabela de preços)
  function opcoesVisita() {
    const sel = $('#impVisita'); if (!sel) return;
    sel.innerHTML = '<option value="">Importar andaimes da visita…</option>' + visitas.map(v => `<option value="${v.id}">${esc(nomeVis(v))}</option>`).join('');
  }
  $('#impVisita').onchange = e => {
    const v = visitas.find(x => x.id === e.target.value); e.target.value = ''; if (!v) return;
    const ests = v.andaimes.filter(a => a.desc || N(a.c) || N(a.l) || N(a.a)).map(a => CORE.novaEstrutura({ tipo: a.tipo, desc: a.desc, c: a.c, l: a.l, a: a.a, q: a.q || 1 }));
    if (!ests.length) return alert('Esta visita não tem andaimes preenchidos.');
    const o = window.APP.getOrc(), vazio = p => p.estruturas.length === 1 && !p.estruturas[0].desc && !N(p.estruturas[0].c) && !N(p.estruturas[0].l) && !N(p.estruturas[0].a);
    if (o.pontos.length === 1 && vazio(o.pontos[0])) o.pontos = [];
    o.pontos.push({ nome: 'VISITA ' + br(v.data) + (v.local ? ' - ' + v.local : ''), estruturas: ests });
    if (!o.cliente) o.cliente = v.solicitante || ''; if (!o.local) o.local = v.local || ''; if (!o.responsavel) o.responsavel = v.representante || '';
    if (!o.titulo && v.local) o.titulo = 'Orçamento de andaimes - ' + v.local;
    window.APP.recarregarOrc();
  };
  window.APP.onTab.orcamento = opcoesVisita; opcoesVisita();

  // visita -> orçamento / programação
  $('#visToOrc').onclick = () => {
    if (!vis) return; const o = CORE.novoOrc(); o.numero = window.APP.proxNumero(); o.titulo = 'Orçamento de andaimes - ' + (vis.local || ''); o.local = vis.local; o.cliente = vis.solicitante; o.data = hoje(); o.responsavel = vis.representante;
    o.pontos = [{ nome: 'ANDAIMES DA VISITA ' + br(vis.data), estruturas: vis.andaimes.map(a => CORE.novaEstrutura({ tipo: a.tipo, desc: a.desc, c: a.c, l: a.l, a: a.a, q: a.q || 1, isolante: false })) }];
    window.APP.addOrc(o);
  };
  $('#visToProg').onclick = () => { if (!vis) return; const p = novaProg(); p.nome = 'Programação - ' + (vis.local || ''); p.local = vis.local; p.dataInicio = vis.inicio || ''; p.mod = vis.equipe || 4; p.itens = vis.andaimes.map(a => ({ nome: a.desc, tipo: a.tipo, c: a.c, l: a.l, a: a.a, q: a.q || 1 })); progs.push(p); prog = p; persist(); window.APP.mostrar('prog'); };

  // ===== PROGRAMAÇÃO =====
  const fh = h => h <= 0 ? '—' : (h >= 1 ? nq.format(Math.round(h * 100) / 100) + ' h' : Math.round(h * 60) + ' min');
  const fd = d => d <= 0 ? '—' : nq.format(Math.round(d * 100) / 100) + ' dia' + (d > 1 ? 's' : '');
  function renderProg() {
    const root = $('#progRoot');
    if (!prog) { root.innerHTML = '<div class="card"><p class="dica">Nenhuma programação criada.</p><button class="btn" id="progNova">+ Nova programação</button></div>'; $('#progNova').onclick = novaP; $('#progBar').textContent = '—'; return; }
    const f = (k, lab, tipo = 'text', extra = '') => `<label>${lab}<input type="${tipo}" ${extra} data-pf="${k}" value="${esc(prog[k])}"></label>`;
    root.innerHTML = `
    <div class="card seletor"><select id="progSel">${progs.map(v => `<option value="${v.id}" ${v.id === prog.id ? 'selected' : ''}>${esc(v.nome || 'Sem nome')}</option>`).join('')}</select>
      <button class="btn" id="progNova">+ Nova</button><button class="btn sec" id="progDup">Duplicar</button><button class="btn x" id="progDel">Excluir</button></div>
    <div class="card"><h2>Equipe e produtividade</h2>
      <p class="dica">Índice de produtividade = quanto a equipe produz por homem-hora (HH), na unidade do andaime (m³/HH para andaimes e escoramento, m²/HH para isolamento e pisos, m/HH para linha de vida). Horas = metragem ÷ índice ÷ MOD.</p>
      <div class="grid">${f('nome', 'Nome da programação')}${f('local', 'Local / frente')}${f('dataInicio', 'Data de início', 'date')}
      ${f('mod', 'Quantidade de MOD (pessoas)', 'number', 'min="0" step="any"')}${f('jornada', 'Jornada (h/dia)', 'number', 'min="0" step="any"')}
      ${f('indMont', 'Índice de montagem (un/HH)', 'number', 'min="0" step="any"')}${f('indDesm', 'Índice de desmontagem (un/HH)', 'number', 'min="0" step="any" placeholder="igual à montagem"')}</div>
      <div class="linha-btns"><label class="chk"><input type="checkbox" data-pc="montar" ${prog.montar !== false ? 'checked' : ''}> Montagem</label><label class="chk"><input type="checkbox" data-pc="desmontar" ${prog.desmontar ? 'checked' : ''}> Desmontagem</label><label class="chk"><input type="checkbox" data-pc="fds" ${prog.fds ? 'checked' : ''}> Trabalha sáb/dom</label></div></div>
    <div class="card"><h2>Andaimes</h2>
      ${prog.itens.map((it, i) => `<div class="est"><div class="est-grid tipo"><label>Identificação<input data-pi="${i}" data-k="nome" value="${esc(it.nome)}" placeholder="ex.: Torre 1"></label><label>Tipo<select data-pi="${i}" data-k="tipo" data-rer>${tipoOpts(it.tipo)}</select></label><button class="btn x" data-pdel="${i}">Remover</button></div>
      <div class="est-grid">${CORE.TIPOS[it.tipo].dims.replace(/ /g, '').split('').map(k => `<label>${{ c: 'Comp. (m)', l: 'Larg. (m)', a: 'Alt. (m)', q: 'Qtd' }[k]}<input type="number" step="any" min="0" data-pi="${i}" data-k="${k}" value="${it[k] ?? ''}"></label>`).join('')}
        <label>Metragem manual<input type="number" step="any" min="0" data-pi="${i}" data-k="metManual" value="${it.metManual ?? ''}" placeholder="auto"></label>
        <label>MOD (opcional)<input type="number" step="any" min="0" data-pi="${i}" data-k="mod" value="${it.mod ?? ''}" placeholder="${prog.mod}"></label>
        <label>Índice mont. (opc.)<input type="number" step="any" min="0" data-pi="${i}" data-k="indMont" value="${it.indMont ?? ''}"></label>
        <label>Índice desm. (opc.)<input type="number" step="any" min="0" data-pi="${i}" data-k="indDesm" value="${it.indDesm ?? ''}"></label></div>
      <div class="res" data-pres="${i}"></div></div>`).join('') || '<p class="dica">Nenhum andaime. Adicione abaixo ou importe.</p>'}
      <div class="linha-btns"><button class="btn sec" id="pAdd">+ Andaime</button><button class="btn sec" id="pImpOrc">Importar do orçamento atual</button>
      <select id="pImpVis"><option value="">Importar de visita…</option>${visitas.map(v => `<option value="${v.id}">${esc(nomeVis(v))}</option>`).join('')}</select></div></div>
    <div class="card"><h2>Resultado</h2><div class="kpis" id="progKpis"></div><div id="progFim" class="dica" style="margin-top:8px"></div></div>`;
    $('#progSel').onchange = e => { prog = progs.find(v => v.id === e.target.value); persist(); renderProg(); };
    $('#progNova').onclick = novaP; $('#progDup').onclick = () => { const c = JSON.parse(JSON.stringify(prog)); c.id = uid(); c.nome += ' (cópia)'; progs.push(c); prog = c; persist(); renderProg(); };
    $('#progDel').onclick = () => { if (confirm('Excluir esta programação?')) { progs = progs.filter(v => v !== prog); prog = progs[0]; persist(); renderProg(); } };
    $('#pAdd').onclick = () => { prog.itens.push({ nome: '', tipo: 'andaime', c: '', l: '', a: '', q: 1 }); persist(); renderProg(); };
    $('#pImpOrc').onclick = () => { const o = window.APP.getOrc(); o.pontos.forEach(p => p.estruturas.forEach(e => prog.itens.push({ nome: [p.nome, e.desc].filter(Boolean).join(' - '), tipo: e.tipo, c: e.c, l: e.l, a: e.a, q: e.q, metManual: e.metManual }))); if (!prog.local) prog.local = o.local; persist(); renderProg(); };
    $('#pImpVis').onchange = e => { const v = visitas.find(x => x.id === e.target.value); if (v) { v.andaimes.forEach(a => prog.itens.push({ nome: a.desc, tipo: a.tipo, c: a.c, l: a.l, a: a.a, q: a.q || 1 })); persist(); renderProg(); } };
    atualizaProg();
  }
  function atualizaProg() {
    if (!prog) return; const r = calcProg(prog);
    r.itens.forEach((x, i) => { const el = document.querySelector(`[data-pres="${i}"]`); if (!el) return; const par = (n, f) => f ? (f.ok ? `${n}: ${nq.format(Math.round(f.hh * 100) / 100)} HH • ${fh(f.h)} • ${fd(f.d)}` : `${n}: informe índice e MOD`) : ''; el.innerHTML = `Metragem: <b>${nq.format(Math.round(x.M * 1000) / 1000)} ${x.un}</b>${x.mont ? '<br>' + par('Montagem', x.mont) : ''}${x.desm ? '<br>' + par('Desmontagem', x.desm) : ''}`; });
    const t = r.tot, k = (l, v) => `<div class="kpi"><small>${l}</small><strong>${v}</strong></div>`;
    $('#progKpis').innerHTML = (prog.montar !== false ? k('Montagem', fd(t.dMont)) + k('Horas montagem', fh(t.hMont)) + k('HH montagem', nq.format(Math.round(t.hhMont * 10) / 10)) : '') + (prog.desmontar ? k('Desmontagem', fd(t.dDesm)) + k('Horas desmontagem', fh(t.hDesm)) : '') + k('Total', fd(t.d));
    $('#progFim').textContent = prog.dataInicio && t.fimMont ? `Início ${br(prog.dataInicio)} - término da montagem previsto em ${br(t.fimMont)} (${prog.fds ? 'todos os dias' : 'dias úteis'}, jornada de ${N(prog.jornada) || 8} h).` : 'Informe a data de início para ver a data prevista de término.';
    $('#progBar').textContent = fd(t.d);
  }
  function novaP() { prog = novaProg(); prog.nome = 'Programação ' + (progs.length + 1); progs.push(prog); persist(); renderProg(); }
  $('#progRoot').addEventListener('input', e => {
    const d = e.target.dataset;
    if (d.pf !== undefined) prog[d.pf] = e.target.value; else if (d.pi !== undefined) { prog.itens[d.pi][d.k] = e.target.value; if (d.rer !== undefined) { persist(); renderProg(); return; } } else if (d.pc) prog[d.pc] = e.target.checked; else return;
    persist(); atualizaProg();
  });
  $('#progRoot').addEventListener('click', e => { const b = e.target.closest('[data-pdel]'); if (b) { prog.itens.splice(b.dataset.pdel, 1); persist(); renderProg(); } });
  window.APP.onTab.prog = renderProg;

  // ===== PDFs =====
  function cab(doc, titulo, d1, d2, d3) {
    const W = 210, M = 10; doc.setDrawColor(40); doc.setLineWidth(0.3); doc.rect(M, 8, W - 2 * M, 22);
    doc.line(M + 42, 8, M + 42, 30); doc.line(W - M - 48, 8, W - M - 48, 30);
    doc.addImage(window.LOGO_COR, 'PNG', M + 3, 11, 36, 15.4);
    doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(doc.splitTextToSize(titulo, 90), M + 42 + (W - 2 * M - 90) / 2 - 3, 17, { align: 'center' });
    doc.setFontSize(9); doc.text(d1, W - M - 24, 14, { align: 'center' }); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(d2, W - M - 46, 21); doc.text(d3, W - M - 46, 27);
  }
  const AZ = [14, 63, 86];
  function pdfVisita(v) {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true }), M = 10, W = 210, mg = { left: M, right: M };
    cab(doc, 'RELATÓRIO VISITA TÉCNICA ANDAIME - PARÁ', 'FO - 1939', 'Revisão:   0', 'Data Rev.:   26/02/2026');
    const head = { fillColor: AZ, textColor: 255, halign: 'center', fontSize: 8.5 }, st = { fontSize: 8.5, lineColor: [40, 40, 40], lineWidth: 0.2, cellPadding: 1.8 };
    doc.autoTable({ startY: 33, theme: 'grid', head: [['Data Visita', 'Representante CBSI', 'Solicitante Cliente', 'Local']], body: [[br(v.data), v.representante, v.solicitante, v.local]], headStyles: head, styles: st, margin: mg });
    doc.autoTable({ startY: doc.lastAutoTable.finalY, theme: 'grid', head: [['Início Previsto', 'Quant. de Equipe', 'Prioridade']], body: [[br(v.inicio), v.equipe, v.prioridade]], headStyles: head, styles: st, margin: mg });
    const mk = k => k === '' ? ['', '', ''] : [CHK_LBL[k], v.checks[k] === 's' ? 'X' : '', v.checks[k] === 'n' ? 'X' : ''];
    const E = ['limpeza', '@', 'parada', 'rotina', 'bloqueio', 'material', 'solo', 'acesso'], D = ['batedor', 'treino', 'spot', 'interf', 'ancora', 'andRotina', 'andExtra', ''];
    const body = E.map((e, i) => { const l = e === '@' ? ['Caso sim, informar pontos de limpeza' + (v.checks.limpeza === 's' && v.pontosLimpeza ? ': ' + v.pontosLimpeza : ''), '', ''] : mk(e); return [...l, ...mk(D[i])]; });
    const pen = mk('andExtra'), c = { valign: 'middle' }; // célula direita vazia: o último item ocupa as duas linhas
    body[6].splice(3, 3, { content: pen[0], rowSpan: 2, styles: c }, { content: pen[1], rowSpan: 2, styles: c }, { content: pen[2], rowSpan: 2, styles: c });
    body[7] = body[7].slice(0, 3);
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 2, theme: 'grid', head: [['Itens de Verificação', 'Sim', 'Não', 'Itens de Verificação', 'Sim', 'Não']], body, headStyles: head, styles: st, margin: mg, columnStyles: { 0: { cellWidth: 75 }, 1: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }, 2: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }, 3: { cellWidth: 75 }, 4: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }, 5: { cellWidth: 10, halign: 'center', fontStyle: 'bold' } } });
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 2, theme: 'grid', head: [['Observações Gerais:']], body: [[v.obs || ' ']], headStyles: { ...head, halign: 'left' }, styles: st, bodyStyles: { minCellHeight: 30, valign: 'top' }, margin: mg });
    const lin = v.andaimes.map(a => [CORE.TIPOS[a.tipo].nome.replace(/ \(.*\)$/, '') + (a.desc ? ' - ' + a.desc : ''), a.q || '', a.c, a.l, a.a]);
    while (lin.length < 7) lin.push(['', '', '', '', '']);
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 2, theme: 'grid', head: [['Descrição Andaime', 'Qtd', 'Comp.', 'Larg.', 'Alt.']], body: lin, headStyles: head, styles: st, bodyStyles: { minCellHeight: 6 }, margin: mg, columnStyles: { 1: { cellWidth: 14, halign: 'center' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 20, halign: 'center' }, 4: { cellWidth: 20, halign: 'center' } } });
    let y = doc.lastAutoTable.finalY + 2; if (y > 240) { doc.addPage(); y = 12; }
    const wA = (W - 2 * M) / 2, hA = Math.min(40, 287 - y); doc.setDrawColor(40);
    [['Assinatura CBSI', v.assCbsi, M], ['Assinatura Cliente', v.assCliente, M + wA]].forEach(([t, img, x]) => { doc.setFillColor(...AZ); doc.rect(x, y, wA, 6, 'F'); doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.text(t, x + wA / 2, y + 4.2, { align: 'center' }); doc.rect(x, y, wA, hA); if (img) doc.addImage(img, 'PNG', x + 4, y + 8, wA - 8, (wA - 8) * 0.4); });
    doc.addPage(); cab(doc, 'RELATÓRIO VISITA TÉCNICA ANDAIME - PARÁ', 'FO - 1939', 'Revisão:   0', 'Data Rev.:   26/02/2026');
    doc.setFillColor(...AZ); doc.rect(M, 33, W - 2 * M, 6, 'F'); doc.setTextColor(255); doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text('Croqui Andaime', W / 2, 37.2, { align: 'center' });
    const gx = M, gy = 39, gw = W - 2 * M, gh = 245; doc.setDrawColor(215); doc.setLineWidth(0.1);
    for (let x = gx; x <= gx + gw + .01; x += 5) doc.line(x, gy, x, gy + gh); for (let yy = gy; yy <= gy + gh + .01; yy += 5) doc.line(gx, yy, gx + gw, yy);
    doc.setDrawColor(40); doc.setLineWidth(0.3); doc.rect(gx, gy, gw, gh); if (v.croqui) doc.addImage(v.croqui, 'PNG', gx, gy, gw, gh);
    (v.fotos || []).forEach((f, i) => {
      if (i % 2 === 0) { doc.addPage(); cab(doc, 'RELATÓRIO VISITA TÉCNICA ANDAIME - PARÁ', 'FO - 1939', 'Revisão:   0', 'Data Rev.:   26/02/2026'); doc.setFillColor(...AZ); doc.rect(M, 33, W - 2 * M, 6, 'F'); doc.setTextColor(255); doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text('Registro Fotográfico', W / 2, 37.2, { align: 'center' }); }
      const top = 42 + (i % 2) * 124, bw = W - 2 * M, bh = 112, k = Math.min(bw / f.w, bh / f.h), w = f.w * k, h = f.h * k;
      doc.setDrawColor(40); doc.setLineWidth(0.2); doc.rect(M, top, bw, bh + 8);
      doc.addImage(f.d, 'JPEG', M + (bw - w) / 2, top + (bh - h) / 2, w, h);
      doc.setTextColor(20); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`Foto ${i + 1}${f.t ? ' - ' + f.t : ''}`.slice(0, 110), M + 2, top + bh + 5.5);
    });
    const n = doc.getNumberOfPages(); for (let k = 1; k <= n; k++) { doc.setPage(k); doc.setFontSize(8); doc.setTextColor(120); doc.text(`Página ${k} de ${n}`, W / 2, 291, { align: 'center' }); }
    entrega(doc, `Visita_${(v.local || 'andaimes').replace(/[^\w-]+/g, '_').slice(0, 30)}_${v.data}.pdf`);
  }
  const CHK_LBL = Object.fromEntries([...CHK_E, ...CHK_D]);
  function entrega(doc, nome) { entregaPdf(doc, nome); }
  $('#visPdf').onclick = () => { if (!vis) return; try { pdfVisita(vis); } catch (e) { console.error(e); alert('Erro ao gerar PDF: ' + e.message); } };

  function pdfProg(p) {
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true }), M = 10, r = calcProg(p), W = 210;
    cab(doc, 'PROGRAMAÇÃO DE ANDAIMES', 'PROGRAMAÇÃO', 'Início: ' + br(p.dataInicio), (p.local || '').slice(0, 28));
    const head = { fillColor: AZ, textColor: 255, fontSize: 8.5 }, mg = { left: M, right: M };
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30); doc.text(p.nome || '', M, 37);
    doc.autoTable({ startY: 40, head: [['MOD', 'Jornada', 'Índice montagem', 'Índice desmontagem', 'Regime']], body: [[nq.format(N(p.mod)), (N(p.jornada) || 8) + ' h/dia', nq.format(N(p.indMont)) + ' un/HH', nq.format(N(p.indDesm) || N(p.indMont)) + ' un/HH', p.fds ? 'Todos os dias' : 'Dias úteis']], headStyles: head, styles: { fontSize: 8.5 }, margin: mg });
    const body = r.itens.map((x, i) => { const it = p.itens[i], t = (x.mont?.h || 0) + (x.desm?.h || 0), tt = (x.mont?.d || 0) + (x.desm?.d || 0); return [it.nome || '(sem nome)', CORE.TIPOS[it.tipo].nome.replace(/ \(.*\)$/, ''), nq.format(Math.round(x.M * 100) / 100) + ' ' + x.un, nq.format(Math.round(((x.mont?.hh || 0) + (x.desm?.hh || 0)) * 10) / 10), fh(t), fd(tt)]; });
    body.push([{ content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } }, { content: nq.format(Math.round((r.tot.hhMont + r.tot.hhDesm) * 10) / 10), styles: { fontStyle: 'bold' } }, { content: fh(r.tot.h), styles: { fontStyle: 'bold' } }, { content: fd(r.tot.d), styles: { fontStyle: 'bold' } }]);
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 5, head: [['Andaime', 'Tipo', 'Metragem', 'HH', 'Horas', 'Dias']], body, headStyles: head, styles: { fontSize: 8.5 }, margin: mg, columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } } });
    let y = doc.lastAutoTable.finalY + 8; doc.setTextColor(30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    if (p.montar !== false) { doc.text(`Montagem: ${fd(r.tot.dMont)} (${fh(r.tot.hMont)})`, M, y); y += 6; }
    if (p.desmontar) { doc.text(`Desmontagem: ${fd(r.tot.dDesm)} (${fh(r.tot.hDesm)})`, M, y); y += 6; }
    if (p.dataInicio && r.tot.fimMont) doc.text(`Início ${br(p.dataInicio)} - término da montagem previsto em ${br(r.tot.fimMont)}`, M, y);
    doc.setFontSize(8); doc.setTextColor(120); doc.text('Horas = metragem ÷ índice de produtividade ÷ MOD', W / 2, 291, { align: 'center' });
    entrega(doc, `Programacao_${(p.nome || 'andaimes').replace(/[^\w-]+/g, '_').slice(0, 30)}.pdf`);
  }
  $('#progPdf').onclick = () => { if (!prog) return; try { pdfProg(prog); } catch (e) { console.error(e); alert('Erro ao gerar PDF: ' + e.message); } };
})();
