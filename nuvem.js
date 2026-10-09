/* Solicitações na nuvem (Supabase, via REST). Quem solicita envia; o admin vê todas e muda o status. */
(() => {
  const URL = 'https://zwsddsnehvcnxufxzusz.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3c2Rkc25laHZjbnh1Znh6dXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1Njk2ODksImV4cCI6MjEwNzE0NTY4OX0.GXZUyONbZDyzCqk5mYYegSfZ78b7eiE98wu50bE3rGE';
  const STATUS = ['Não iniciado', 'Em andamento', 'Montado', 'Desmontado', 'Cancelado'];
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const br = d => d ? d.split('-').reverse().join('/') : '';
  const lsGet = () => { try { return JSON.parse(localStorage.getItem('orc.nuvem')); } catch (e) { return null; } };
  const lsSet = v => { try { v ? localStorage.setItem('orc.nuvem', JSON.stringify(v)) : localStorage.removeItem('orc.nuvem'); } catch (e) { } };
  let sess = lsGet(), admin = false, lista = [], filtro = '', msg = '';
  window.APP.nuvem = { get admin() { return admin; }, solicitar };

  async function http(path, { method = 'GET', body, token, extra } = {}) {
    const r = await fetch(URL + path, { method, headers: Object.assign({ apikey: KEY, Authorization: 'Bearer ' + (token || KEY), 'Content-Type': 'application/json' }, extra || {}), body: body ? JSON.stringify(body) : undefined });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
    if (!r.ok) throw new Error((j && (j.msg || j.message || j.error_description || j.error)) || ('Erro ' + r.status));
    return j;
  }
  const guarda = j => { sess = { token: j.access_token, refresh: j.refresh_token, email: j.user && j.user.email, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000 }; lsSet(sess); };
  async function token() {
    if (!sess) throw new Error('Entre com seu e-mail primeiro.');
    if (Date.now() > sess.exp) { try { guarda(await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sess.refresh } })); } catch (e) { sess = null; lsSet(null); throw new Error('Sessão expirada. Entre novamente.'); } }
    return sess.token;
  }
  const api = async (path, o = {}) => http('/rest/v1' + path, Object.assign({ token: await token() }, o));

  // ===== tela de login (bloqueia o app até entrar) =====
  const admCache = () => { try { return localStorage.getItem('orc.nuvemAdmin') === '1'; } catch (e) { return false; } };
  function papel() {
    const full = !sess || admin;
    document.querySelectorAll('nav button').forEach(b => { b.hidden = !full && !['nuvem', 'visita'].includes(b.dataset.tab); });
  }
  function gate() {
    let g = $('#loginGate');
    if (sess) { if (g) g.hidden = true; papel(); return; }
    if (!g) { g = document.createElement('div'); g.id = 'loginGate'; g.style.cssText = 'position:fixed;inset:0;z-index:99;background:#f4f7f9;overflow:auto;padding:16px'; document.body.appendChild(g); }
    g.hidden = false;
    g.innerHTML = `<div class="card" style="max-width:420px;margin:8vh auto 0"><img src="assets/logo.png" alt="CBSI" style="max-width:140px;display:block;margin:0 auto 10px"><h2 style="text-align:center">Andaimes</h2>
      <p class="dica" style="text-align:center">Entre para enviar e acompanhar solicitações de visita. ${esc(msg)}</p>
      <div class="grid"><label>E-mail<input id="nuvEmail" type="email" autocomplete="username"></label><label>Senha<input id="nuvSenha" type="password" autocomplete="current-password"></label></div>
      <div class="linha-btns"><button class="btn" id="nuvEntrar">Entrar</button><button class="btn sec" id="nuvCriar">Criar conta</button></div>
      <div class="linha-btns"><button class="btn sec" id="nuvGoogle" style="width:100%">Entrar com Google</button></div></div>`;
    $('#nuvGoogle').onclick = () => { location.href = URL + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(location.origin + location.pathname); };
    const go = criar => async () => {
      try { await entrar($('#nuvEmail').value.trim(), $('#nuvSenha').value, criar); if (sess) await depoisLogin(true); } catch (e) { msg = e.message; }
      gate();
    };
    $('#nuvEntrar').onclick = go(false); $('#nuvCriar').onclick = go(true);
  }
  async function depoisLogin(novo) {
    try { await atualizar(); msg = ''; } catch (e) { msg = e.message; if (!sess) { gate(); return; } admin = admCache(); }
    try { localStorage.setItem('orc.nuvemAdmin', admin ? '1' : '0'); } catch (e) { }
    gate();
    if (novo && admin) window.APP.orcEmBranco();
    document.querySelector('nav button[data-tab="' + (admin ? 'orcamento' : 'nuvem') + '"]').click();
  }

  async function entrar(email, senha, criar) {
    if (criar) {
      const j = await http('/auth/v1/signup', { method: 'POST', body: { email, password: senha } });
      if (!j.access_token) { msg = 'Conta criada. Confirme o e-mail que você recebeu e depois entre.'; return; }
      guarda(j);
    } else guarda(await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: senha } }));
    msg = '';
  }
  async function atualizar() {
    admin = await api('/rpc/sou_admin', { method: 'POST', body: {} }) === true;
    lista = await api('/visitas?select=id,status,local,data,dono_email,atualizado&order=atualizado.desc');
    // traz o status da nuvem para as visitas locais já enviadas
    const loc = window.APP.getExtras().visitas || []; let mudou = false;
    lista.forEach(n => loc.forEach(v => { if (v.nuvemId === n.id && v.status !== n.status) { v.status = n.status; mudou = true; } }));
    if (mudou) window.APP.refreshVis();
  }
  async function enviar() {
    const v = window.APP.getVisAtual(); if (!v) return alert('Crie uma visita primeiro.');
    const { nuvemId, ...dados } = JSON.parse(JSON.stringify(v));
    const linha = { local: v.local || null, data: v.data || null, dados };
    if (nuvemId) { await api('/visitas?id=eq.' + nuvemId, { method: 'PATCH', body: linha }); }
    else { const r = await api('/visitas', { method: 'POST', body: linha, extra: { Prefer: 'return=representation' } }); v.nuvemId = r[0].id; v.status = r[0].status; window.APP.refreshVis(); }
  }
  // botão da aba Visita: envia a visita atual e vai para a aba Solicitações
  async function solicitar() {
    await enviar(); msg = 'Visita enviada como solicitação.';
    document.querySelector('nav button[data-tab="nuvem"]').click();
  }
  async function importar(id) {
    const r = await api('/visitas?id=eq.' + id + '&select=id,status,dados');
    if (!r.length) return; const v = r[0].dados; v.nuvemId = r[0].id; v.status = r[0].status;
    const ja = (window.APP.getExtras().visitas || []).find(x => x.nuvemId === id);
    if (ja && !confirm('Já existe uma cópia desta visita neste aparelho. Importar mesmo assim?')) return;
    window.APP.addVisita(v); alert('Visita importada. Veja na aba Visita.');
  }

  function render() {
    const root = $('#nuvRoot'); if (!root) return;
    if (!sess) { gate(); return; }
    gate();
    const vis = lista.filter(n => !filtro || n.status === filtro);
    root.innerHTML = `<div class="card"><h2>Solicitações ${admin ? '(administrador)' : ''}</h2>
      <p class="dica">${esc(sess.email)} • ${admin ? 'você vê todas as solicitações e muda o status.' : 'você vê as suas; o status é atualizado pelo administrador.'} ${esc(msg)}</p>
      <div class="linha-btns"><button class="btn" id="nuvEnv">Enviar visita atual</button><button class="btn sec" id="nuvAtu">Atualizar</button><button class="btn x" id="nuvSair">Sair</button></div>
      <div class="seletor"><select id="nuvFil"><option value="">Todos os status (${lista.length})</option>${STATUS.map(s => `<option ${s === filtro ? 'selected' : ''} value="${s}">${s} (${lista.filter(n => n.status === s).length})</option>`).join('')}</select></div></div>
      ${vis.map(n => `<div class="card"><strong>${esc(n.local || 'Sem local')}</strong> <small>• ${esc(br(n.data))}</small>
        <div class="dica">${esc(n.dono_email || '')} • atualizado ${new Date(n.atualizado).toLocaleString('pt-BR')}</div>
        <div class="linha-btns">${admin ? `<select data-nst="${n.id}">${STATUS.map(s => `<option ${s === n.status ? 'selected' : ''}>${s}</option>`).join('')}</select>` : `<strong>${esc(n.status)}</strong>`}
        <button class="btn sec mini" data-nimp="${n.id}">Abrir no app</button>${admin || n.status === 'Não iniciado' ? `<button class="btn x mini" data-ndel="${n.id}">Excluir</button>` : ''}</div></div>`).join('') || '<div class="card"><p class="dica">Nenhuma solicitação.</p></div>'}`;
    $('#nuvFil').onchange = e => { filtro = e.target.value; render(); };
    $('#nuvSair').onclick = () => { sess = null; admin = false; lista = []; lsSet(null); msg = ''; render(); document.querySelector('nav button[data-tab="orcamento"]').click(); };
    const rod = f => async () => { try { msg = ''; await f(); await atualizar(); msg = ''; } catch (e) { msg = e.message; } render(); };
    $('#nuvAtu').onclick = rod(async () => { });
    $('#nuvEnv').onclick = rod(async () => { await enviar(); msg = 'Visita enviada.'; });
  }
  document.addEventListener('change', async e => { const id = e.target.dataset && e.target.dataset.nst; if (!id) return; try { await api('/visitas?id=eq.' + id, { method: 'PATCH', body: { status: e.target.value } }); await atualizar(); msg = ''; } catch (er) { msg = er.message; } render(); });
  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    try {
      if (d.nimp) await importar(d.nimp);
      else if (d.ndel && confirm('Excluir esta solicitação da nuvem?')) { await api('/visitas?id=eq.' + d.ndel, { method: 'DELETE' }); await atualizar(); render(); }
    } catch (er) { alert(er.message); }
  });
  // volta do login com Google: tokens vêm no fragmento (#access_token=...)
  async function voltaGoogle() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (h.get('error_description')) { msg = h.get('error_description'); history.replaceState(null, '', location.pathname + location.search); return; }
    if (!h.get('access_token')) return;
    const j = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600 };
    history.replaceState(null, '', location.pathname + location.search);
    try { j.user = await http('/auth/v1/user', { token: j.access_token }); guarda(j); novoLogin = true; } catch (e) { msg = e.message; }
  }
  let novoLogin = false;
  voltaGoogle().then(() => { if (sess) { admin = admCache(); papel(); depoisLogin(novoLogin); } else gate(); });
  window.APP.onTab.nuvem = async () => { render(); if (sess) { try { await atualizar(); msg = ''; } catch (e) { msg = e.message; } render(); } };
})();
