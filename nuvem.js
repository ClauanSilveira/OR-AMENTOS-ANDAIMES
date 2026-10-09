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
  let sess = lsGet(), admin = false, lista = [], filtro = '', msg = '', info = '', emailTmp = '', modo = 'entrar', ver = false, espera = false, rec = null;
  window.APP.nuvem = { get admin() { return admin; }, solicitar };

  const amigavel = m => {
    const t = String(m).toLowerCase();
    if (t.includes('invalid login')) return 'E-mail ou senha incorretos.';
    if (t.includes('not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    if (t.includes('already registered')) return 'Este e-mail já tem conta. Use a aba Entrar.';
    if (t.includes('at least') && t.includes('character')) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (t.includes('same password') || t.includes('different from the old')) return 'Escolha uma senha diferente da anterior.';
    if (t.includes('invalid format') || t.includes('invalid email') || t.includes('valid email')) return 'Digite um e-mail válido.';
    if (t.includes('rate limit') || t.includes('security purposes') || t.includes('too many')) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    if (t.includes('failed to fetch') || t.includes('networkerror') || t.includes('load failed')) return 'Sem conexão com a internet. Tente de novo.';
    if (t.includes('provider is not enabled') || t.includes('unsupported provider')) return 'Login com Google ainda não foi ativado no servidor.';
    return m;
  };
  async function http(path, { method = 'GET', body, token, extra } = {}) {
    let r; try { r = await fetch(URL + path, { method, headers: Object.assign({ apikey: KEY, Authorization: 'Bearer ' + (token || KEY), 'Content-Type': 'application/json' }, extra || {}), body: body ? JSON.stringify(body) : undefined }); } catch (e) { throw new Error(amigavel(e.message)); }
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
    if (!r.ok) throw new Error(amigavel((j && (j.msg || j.message || j.error_description || j.error)) || ('Erro ' + r.status)));
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
  const G = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
  function gate() {
    let g = $('#loginGate');
    if (sess) { if (g) g.hidden = true; papel(); return; }
    if (!g) { g = document.createElement('div'); g.id = 'loginGate'; document.body.appendChild(g); }
    g.hidden = false;
    const titulo = { entrar: 'Bem-vindo de volta', criar: 'Criar sua conta', esqueci: 'Recuperar senha', nova: 'Definir nova senha' }[modo];
    const sub = { entrar: 'Entre para enviar e acompanhar solicitações de visita.', criar: 'Use seu e-mail ou o Google para começar.', esqueci: 'Enviaremos um link para você criar uma nova senha.', nova: 'Escolha uma senha nova para entrar.' }[modo];
    const campoSenha = `<label class="lg-campo">Senha<div class="lg-senha"><input id="nuvSenha" type="${ver ? 'text' : 'password'}" autocomplete="${modo === 'entrar' ? 'current-password' : 'new-password'}" placeholder="${modo === 'entrar' ? 'Sua senha' : 'Mínimo 6 caracteres'}"><button type="button" class="lg-olho" id="nuvVer" aria-label="${ver ? 'Ocultar senha' : 'Mostrar senha'}">${ver ? 'Ocultar' : 'Mostrar'}</button></div></label>`;
    g.innerHTML = `<div class="lg-wrap"><img class="lg-logo" src="assets/logo-branca.png" alt="CBSI">
      <div class="lg-card">
        ${modo === 'entrar' || modo === 'criar' ? `<div class="lg-abas" role="tablist"><button type="button" role="tab" class="${modo === 'entrar' ? 'on' : ''}" data-lgm="entrar">Entrar</button><button type="button" role="tab" class="${modo === 'criar' ? 'on' : ''}" data-lgm="criar">Criar conta</button></div>` : ''}
        <h1 class="lg-tit">${titulo}</h1><p class="lg-sub">${sub}</p>
        ${msg ? `<div class="lg-aviso erro" role="alert">${esc(msg)}</div>` : ''}${info ? `<div class="lg-aviso ok" role="status">${esc(info)}</div>` : ''}
        <form id="nuvForm" novalidate>
          ${modo !== 'nova' ? `<label class="lg-campo">E-mail<input id="nuvEmail" type="email" inputmode="email" autocomplete="username" placeholder="voce@empresa.com" autocapitalize="none"></label>` : ''}
          ${modo !== 'esqueci' ? campoSenha : ''}
          ${modo === 'entrar' ? '<button type="button" class="lg-link" data-lgm="esqueci">Esqueci a senha</button>' : ''}
          <button class="lg-btn" id="nuvEntrar" type="submit" ${espera ? 'disabled' : ''}>${espera ? 'Aguarde…' : { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Enviar link', nova: 'Salvar senha' }[modo]}</button>
        </form>
        ${modo === 'entrar' || modo === 'criar' ? `<div class="lg-ou"><span>ou</span></div><button type="button" class="lg-google" id="nuvGoogle">${G}<span>Continuar com Google</span></button>` : `<button type="button" class="lg-link centro" data-lgm="entrar">Voltar para o login</button>`}
      </div></div>`;
    g.querySelectorAll('[data-lgm]').forEach(b => b.onclick = () => { modo = b.dataset.lgm; msg = ''; info = ''; gate(); });
    const v = $('#nuvVer'); if (v) v.onclick = () => { ver = !ver; $('#nuvSenha').type = ver ? 'text' : 'password'; v.textContent = ver ? 'Ocultar' : 'Mostrar'; v.setAttribute('aria-label', ver ? 'Ocultar senha' : 'Mostrar senha'); };
    const gb = $('#nuvGoogle'); if (gb) gb.onclick = () => { location.href = URL + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(location.origin + location.pathname); };
    $('#nuvForm').onsubmit = async e => {
      e.preventDefault(); if (espera) return;
      const email = $('#nuvEmail') ? $('#nuvEmail').value.trim() : '', senha = $('#nuvSenha') ? $('#nuvSenha').value : '';
      msg = ''; info = ''; emailTmp = email;
      if (modo !== 'nova' && !email) { msg = 'Digite seu e-mail.'; return gate(); }
      if (modo !== 'esqueci' && !senha) { msg = 'Digite sua senha.'; return gate(); }
      espera = true; gate();
      try {
        if (modo === 'esqueci') { await http('/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', body: { email } }); info = 'Se este e-mail tiver conta, enviamos o link de recuperação. Confira também o spam.'; modo = 'entrar'; }
        else if (modo === 'nova') { await http('/auth/v1/user', { method: 'PUT', token: rec.access_token, body: { password: senha } }); guarda(rec); rec = null; modo = 'entrar'; await depoisLogin(true); }
        else { await entrar(email, senha, modo === 'criar'); if (sess) await depoisLogin(true); }
      } catch (er) { msg = er.message; }
      espera = false; gate();
    };
    const em = $('#nuvEmail'); if (em && !em.value) { try { em.value = emailTmp || localStorage.getItem('orc.ultimoEmail') || ''; } catch (e2) { } }
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
      if (!j.access_token) { info = 'Conta criada! Enviamos um link para o seu e-mail. Confirme e depois entre.'; modo = 'entrar'; return; }
      guarda(j);
    } else guarda(await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: senha } }));
    try { localStorage.setItem('orc.ultimoEmail', email); } catch (e) { }
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
    const rc = h.get('type') === 'recovery';
    const j = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600 };
    history.replaceState(null, '', location.pathname + location.search);
    try { j.user = await http('/auth/v1/user', { token: j.access_token }); if (rc) { rec = j; modo = 'nova'; } else { guarda(j); novoLogin = true; } } catch (e) { msg = e.message; }
  }
  let novoLogin = false;
  voltaGoogle().then(() => { if (sess) { admin = admCache(); papel(); depoisLogin(novoLogin); } else gate(); });
  window.APP.onTab.nuvem = async () => { render(); if (sess) { try { await atualizar(); msg = ''; } catch (e) { msg = e.message; } render(); } };
})();
