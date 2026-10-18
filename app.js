/* ============================================================
   MISIÓN ESTRELLAS · app.js
   SPA estática para GitHub Pages + Supabase
   - Hijos: solo lectura (tareas, estrellas, penalizaciones, premios)
   - Papás: zona privada con código familiar (Supabase Auth)
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- Configuración ---------------- */
  const CFG = window.APP_CONFIG || {};
  const CONFIGURED = Boolean(
    CFG.SUPABASE_URL && !String(CFG.SUPABASE_URL).includes('TU-') &&
    CFG.SUPABASE_ANON_KEY && !String(CFG.SUPABASE_ANON_KEY).includes('TU-')
  );
  const sb = CONFIGURED ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

  /* ---------------- Utilidades ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfWeek = d => addDays(d, -((d.getDay() + 6) % 7));
  const weekdayNum = iso => ((parseISO(iso).getDay() + 6) % 7) + 1;
  const seguro = msg => window.confirm(msg);

  const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
  const DIAS_MAY = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
  const DIAS_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const fmtDia = iso => `${DIAS[weekdayNum(iso) - 1]} ${parseISO(iso).getDate()}`;
  const fmtRango = ws => {
    const a = ws, b = addDays(ws, 4);
    return a.getMonth() === b.getMonth()
      ? `${a.getDate()} al ${b.getDate()} de ${MESES_LARGO[b.getMonth()]}`
      : `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]}`;
  };

  const CATS = {
    personal: { emoji: '🪥', label: 'Personal' },
    casa: { emoji: '🧹', label: 'Casa' },
    educativo: { emoji: '📚', label: 'Educativo' }
  };
  const CAT_ORDER = ['personal', 'casa', 'educativo'];

  const EMOJIS = ['⭐', '🪥', '👕', '🧼', '🚿', '🦷', '💇', '🛏️', '🧹', '🧸', '🍽️', '🪴', '🗑️', '👖', '📚', '✍️', '🔢', '📝', '📖', '🎨', '🗣️', '🎵', '🎁', '🌟', '💧', '🍬', '🛴', '🚲', '📺', '🎮', '🕹️', '❤️', '😴', '🏃', '🐶', '🐱'];
  const EMOJIS_KID = ['🦊', '🐼', '🦁', '🐯', '🐨', '🐰', '🦄', '🦖', '🐉', '🦅', '🦋', '🐬', '🐶', '🐱', '🐸', '🐵'];
  const SUGGESTIONS = {
    personal: ['Lavarse los dientes', 'Vestirse solo', 'Lavarse la cara', 'Lavarse las manos', 'Ducha', 'Peinarse'],
    casa: ['Hacer la cama', 'Barrer', 'Recoger los juguetes', 'Poner la mesa', 'Ordenar la ropa', 'Regar las plantas'],
    educativo: ['Leer 10 minutos', 'Dictado', 'Multiplicaciones', 'Deberes', 'Estudiar tabla', 'Dibujar']
  };
  const SUGGESTIONS_EXTRA = ['Recoger el escritorio', 'Regar las plantas', 'Ayudar con la compra', 'Leer un cuento a su hermano', 'Ordenar la mochila', 'Poner la mesa'];
  const PEN_REASONS = ['No hizo la tarea', 'No hizo los deberes', 'No recogió sus juguetes', 'Mal comportamiento', 'No obedeció'];
  const COLORS = ['#7c3aed', '#ec4899', '#f97316', '#0ea5e9', '#22c55e', '#ef4444', '#8b5cf6', '#14b8a6'];
  const REWARD_DAYS = [
    { day: 'viernes', name: 'Viernes', emoji: '🎮', label: 'Jugar a la tablet' },
    { day: 'sabado', name: 'Sábado', emoji: '🕹️', label: 'Tiempo extra de tablet' },
    { day: 'domingo', name: 'Domingo', emoji: '📺', label: 'Película + tablet' }
  ];
  const TABS = [
    { id: 'tareas', label: '🗓️ Tareas' },
    { id: 'extras', label: '🎁 Extras' },
    { id: 'penalizaciones', label: '🚫 Penalizaciones' },
    { id: 'recompensas', label: '🏆 Recompensas' },
    { id: 'hijos', label: '👧 Hijos' }
  ];

  /* ---------------- Estado ---------------- */
  const hoy = new Date();
  const state = {
    view: 'home',                    // home | kids | child | login | parents | admin
    session: null,
    role: null,                      // 'parent' | 'kids' | null
    isAdmin: false,
    myFamilyId: null,
    adminFamilies: [],
    childId: null,
    weekStart: startOfWeek(hoy),
    day: Math.min(Math.max(weekdayNum(toISO(hoy)), 1), 5),
    tab: 'tareas',
    data: { children: [], templates: [], overrides: [], completions: [], extras: [], penalties: [], rewards: [] }
  };
  let lastActivity = Date.now();

  /* ================= DATOS ================= */
  /* Todo se filtra por la familia del usuario que tiene sesión;
     además Supabase (RLS) no devolvería datos de otras familias. */
  async function loadData() {
    const fam = state.myFamilyId;
    const vacio = { children: [], templates: [], overrides: [], completions: [], extras: [], penalties: [], rewards: [] };
    if (!fam) { state.data = vacio; state.childId = null; return; }

    const { data: kids, error: kErr } = await sb.from('children').select('*').eq('family_id', fam).order('created_at');
    if (kErr) throw kErr;
    const ids = (kids || []).map(k => k.id);
    if (!ids.length) { state.data = { ...vacio, children: kids || [] }; state.childId = null; return; }

    const [t, co, e, p, r] = await Promise.all([
      sb.from('task_templates').select('*').in('child_id', ids),
      sb.from('completions').select('*').in('child_id', ids),
      sb.from('extra_tasks').select('*').in('child_id', ids),
      sb.from('penalties').select('*').in('child_id', ids),
      sb.from('rewards').select('*').eq('family_id', fam)
    ]);
    const err = t.error || co.error || e.error || p.error || r.error;
    if (err) throw err;

    const tplIds = (t.data || []).map(x => x.id);
    let o = { data: [], error: null };
    if (tplIds.length) o = await sb.from('task_overrides').select('*').in('template_id', tplIds);
    if (o.error) throw o.error;

    state.data = {
      children: kids || [], templates: t.data || [], overrides: o.data || [],
      completions: co.data || [], extras: e.data || [], penalties: p.data || [], rewards: r.data || []
    };
    if (state.childId && !state.data.children.some(x => x.id === state.childId)) state.childId = null;
    if (!state.childId && state.data.children.length) state.childId = state.data.children[0].id;
  }

  const childById = id => state.data.children.find(c => c.id === id);

  function statsFor(childId) {
    const d = state.data;
    const done = d.completions.filter(x => x.child_id === childId && x.status === 'done').length;
    const extra = d.extras.filter(x => x.child_id === childId && x.status === 'done').reduce((s, x) => s + x.stars, 0);
    const points = d.penalties.filter(x => x.child_id === childId).reduce((s, x) => s + x.points, 0);
    const lost = Math.floor(points / 3);
    return { done, extra, points, lost, dots: points % 3, total: Math.max(0, done + extra - lost) };
  }

  function tasksForDay(childId, iso) {
    const wd = weekdayNum(iso);
    const list = [];
    for (const t of state.data.templates) {
      if (t.child_id !== childId || t.weekday !== wd) continue;
      const ov = state.data.overrides.find(o => o.template_id === t.id && o.date === iso);
      if (ov && ov.disabled) continue;
      const comp = state.data.completions.find(c => c.template_id === t.id && c.date === iso);
      list.push({
        id: t.id, cat: t.category,
        title: (ov && ov.title) || t.title,
        emoji: (ov && ov.emoji) || t.emoji,
        status: comp ? comp.status : 'pending',
        onlyWeek: Boolean(ov)
      });
    }
    list.sort((a, b) => CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat));
    return list;
  }

  const extrasForDay = (childId, iso) => state.data.extras.filter(e => e.child_id === childId && e.date === iso);
  const extrasForWeek = childId => {
    const isos = [0, 1, 2, 3, 4].map(i => toISO(addDays(state.weekStart, i)));
    return state.data.extras.filter(e => e.child_id === childId && isos.includes(e.date)).sort((a, b) => a.date.localeCompare(b.date));
  };
  const rewardFor = day => state.data.rewards.find(r => r.day === day) || { day, min_stars: 0, ...(REWARD_DAYS.find(x => x.day === day) || {}) };

  /* ================= MUTACIONES ================= */
  async function mutate(fn, okMsg) {
    try {
      await fn();
      await loadData();
      render();
      if (okMsg) toast(okMsg);
      return true;
    } catch (err) {
      console.error(err);
      toast('No se ha podido guardar 😕 (¿sin conexión?)', true);
      return false;
    }
  }

  function setStatus(tid, iso, status) {
    const comp = state.data.completions.find(c => c.template_id === tid && c.date === iso);
    const nuevo = !(comp && comp.status === status);
    mutate(async () => {
      if (!comp) {
        const t = state.data.templates.find(x => x.id === tid);
        await sb.from('completions').upsert({ template_id: tid, child_id: t.child_id, date: iso, status }, { onConflict: 'template_id,date' });
      } else if (comp.status === status) {
        await sb.from('completions').delete().eq('id', comp.id);
      } else {
        await sb.from('completions').update({ status }).eq('id', comp.id);
      }
    }).then(ok => { if (ok && nuevo && status === 'done') confetti(); });
  }

  const saveTemplate = (id, values) => mutate(async () => {
    if (id) await sb.from('task_templates').update(values).eq('id', id);
    else await sb.from('task_templates').insert({ ...values, child_id: state.childId });
  }, id ? 'Tarea actualizada ✏️' : 'Tarea añadida ➕');

  const deleteTemplate = id => mutate(async () => { await sb.from('task_templates').delete().eq('id', id); }, 'Tarea borrada 🗑️');

  const saveOverride = (tid, iso, values) => mutate(async () => {
    await sb.from('task_overrides').upsert({ template_id: tid, date: iso, ...values }, { onConflict: 'template_id,date' });
  }, 'Cambio aplicado solo a esta semana 📅');

  const clearOverride = (tid, iso) => mutate(async () => {
    await sb.from('task_overrides').delete().eq('template_id', tid).eq('date', iso);
  }, 'Vuelta a la tarea original ↩️');

  const saveExtra = (id, values, childId) => mutate(async () => {
    if (id) await sb.from('extra_tasks').update(values).eq('id', id);
    else await sb.from('extra_tasks').insert({ ...values, child_id: childId });
  }, id ? 'Tarea extra actualizada 🎁' : 'Tarea extra añadida 🎁');

  const deleteExtra = id => mutate(async () => { await sb.from('extra_tasks').delete().eq('id', id); }, 'Tarea extra borrada 🗑️');

  function toggleExtra(id) {
    const ex = state.data.extras.find(e => e.id === id);
    const nuevo = ex.status !== 'done';
    mutate(async () => { await sb.from('extra_tasks').update({ status: nuevo ? 'done' : 'pending' }).eq('id', id); })
      .then(ok => { if (ok && nuevo) confetti(); });
  }

  const addPenalty = values => mutate(async () => { await sb.from('penalties').insert({ ...values, child_id: state.childId }); }, 'Penalización aplicada 🚫');
  const deletePenalty = id => mutate(async () => { await sb.from('penalties').delete().eq('id', id); }, 'Penalización anulada ↩️');

  const saveReward = (day, values) => mutate(async () => {
    await sb.from('rewards').upsert({ day, ...values }, { onConflict: 'day' });
  }, 'Recompensa guardada 🏆');

  const saveChild = (id, values) => mutate(async () => {
    if (id) await sb.from('children').update(values).eq('id', id);
    else await sb.from('children').insert(values);
  }, id ? 'Hijo actualizado 👧' : 'Hijo añadido 👧');

  const deleteChild = id => mutate(async () => { await sb.from('children').delete().eq('id', id); }, 'Hijo borrado 🗑️');

  async function copyWeek() {
    const prev = addDays(state.weekStart, -7);
    const prevISOs = [0, 1, 2, 3, 4].map(i => toISO(addDays(prev, i)));
    const newISOs = [0, 1, 2, 3, 4].map(i => toISO(addDays(state.weekStart, i)));
    const tpls = new Set(state.data.templates.map(t => t.id));
    const ovRows = state.data.overrides
      .filter(o => prevISOs.includes(o.date) && tpls.has(o.template_id))
      .map(o => ({ template_id: o.template_id, date: newISOs[prevISOs.indexOf(o.date)], title: o.title, emoji: o.emoji, disabled: o.disabled }));
    const exRows = state.data.extras
      .filter(e => prevISOs.includes(e.date))
      .map(e => ({ child_id: e.child_id, date: newISOs[prevISOs.indexOf(e.date)], title: e.title, emoji: e.emoji, stars: e.stars, status: 'pending' }));
    if (!ovRows.length && !exRows.length) return toast('La semana anterior no tenía cambios ni extras 🙂');
    await mutate(async () => {
      if (ovRows.length) await sb.from('task_overrides').upsert(ovRows, { onConflict: 'template_id,date' });
      if (exRows.length) await sb.from('extra_tasks').insert(exRows);
    }, 'Semana copiada 📋');
  }

  async function login(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      toast(/fetch|network|Failed/i.test(error.message || '') ? 'Sin conexión a internet 📡' : 'Email o código incorrectos 🔐', true);
      return false;
    }
    state.session = true;
    state.tab = 'tareas';
    try {
      await loadIdentity();
      await loadData();
    } catch (e) { console.error(e); }
    state.view = state.role === 'kids' ? 'kids' : 'parents';
    render();
    return true;
  }

  async function logout(auto) {
    try { await sb.auth.signOut(); } catch (e) { console.error(e); }
    state.session = null;
    state.role = null;
    state.isAdmin = false;
    state.myFamilyId = null;
    state.adminFamilies = [];
    state.view = 'home';
    render();
    if (auto) toast('Sesión cerrada por seguridad 🔒');
  }

  /* ================= IDENTIDAD Y ADMINISTRACIÓN ================= */
  async function loadIdentity() {
    state.role = null; state.isAdmin = false; state.myFamilyId = null;
    const { data: u } = await sb.auth.getUser();
    const user = u && u.user;
    if (!user) return;
    const { data: adm } = await sb.rpc('is_admin');
    state.isAdmin = Boolean(adm);
    const { data: mem } = await sb.from('family_members').select('role, family_id').eq('user_id', user.id).maybeSingle();
    if (mem) { state.role = mem.role; state.myFamilyId = mem.family_id; }
  }

  async function loadAdmin() {
    const { data, error } = await sb.from('families')
      .select('id, name, created_at, children(count), family_members(count)')
      .order('created_at');
    if (error) throw error;
    state.adminFamilies = data || [];
  }

  /* Llama a la Edge Function "admin-familias" (solo administrador) */
  async function invokeAdmin(payload) {
    const { data, error } = await sb.functions.invoke('admin-familias', { body: payload });
    if (error) {
      let msg = 'No se ha podido llamar a la función admin-familias 🛠️';
      try {
        const j = await error.context && error.context.json && error.context.json();
        if (j && j.error) msg = j.error;
      } catch (e) { /* sin cuerpo legible */ }
      return { error: msg };
    }
    if (data && data.error) return { error: data.error };
    return data || {};
  }

  /* El administrador crea su propia familia desde el cliente (sin Edge Function) */
  async function createMyFamily(name) {
    try {
      const { data: u } = await sb.auth.getUser();
      const { data: fam, error } = await sb.from('families').insert({ name }).select('id').single();
      if (error) throw error;
      const { error: mErr } = await sb.from('family_members').insert({ user_id: u.user.id, family_id: fam.id, role: 'parent' });
      if (mErr) throw mErr;
      const { error: rErr } = await sb.from('rewards').insert([
        { family_id: fam.id, day: 'viernes', min_stars: 8, emoji: '🎮', label: 'Jugar a la tablet' },
        { family_id: fam.id, day: 'sabado', min_stars: 10, emoji: '🕹️', label: 'Tiempo extra de tablet' },
        { family_id: fam.id, day: 'domingo', min_stars: 12, emoji: '📺', label: 'Película + tablet' }
      ]);
      if (rErr) throw rErr;
      await loadIdentity();
      await loadData();
      await loadAdmin();
      render();
      toast('Tu familia está lista 🏠');
    } catch (err) {
      console.error(err);
      toast('No se pudo crear la familia 😕', true);
    }
  }

  const deleteFamily = id => mutate(async () => {
    const { error } = await sb.from('families').delete().eq('id', id);
    if (error) throw error;
  }, 'Familia borrada 🗑️');

  /* ================= UI HELPERS ================= */
  let toastTimer;
  function toast(msg, err) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = err ? 'show err' : 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, 2600);
  }

  function confetti() {
    const box = $('#confetti');
    const emo = ['⭐', '🎉', '✨', '🌟', '🎊', '💛'];
    for (let i = 0; i < 22; i++) {
      const s = document.createElement('span');
      s.textContent = emo[i % emo.length];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.top = (-10 - Math.random() * 20) + 'vh';
      s.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      s.style.fontSize = (18 + Math.random() * 20) + 'px';
      box.appendChild(s);
      setTimeout(() => s.remove(), 3400);
    }
  }

  function openSheet(html) {
    $('#sheet').innerHTML = html;
    $('#sheet').hidden = false;
    $('#sheet-back').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    $('#sheet-back').hidden = true;
    $('#sheet').innerHTML = '';
    document.body.style.overflow = '';
  }

  const emoGrid = (name, actual) => `
    <div class="emo-grid" data-picker="${name}">
      ${EMOJIS.map(e => `<button type="button" data-act="pick-emo" data-emo="${e}" class="${e === actual ? 'on' : ''}">${e}</button>`).join('')}
    </div>
    <input type="hidden" name="${name}" value="${esc(actual)}">`;

  const kidEmoGrid = actual => `
    <div class="emo-grid" data-picker="emoji">
      ${EMOJIS_KID.map(e => `<button type="button" data-act="pick-emo" data-emo="${e}" class="${e === actual ? 'on' : ''}">${e}</button>`).join('')}
    </div>
    <input type="hidden" name="emoji" value="${esc(actual)}">`;

  const daySelect = (name, isoActual) => `
    <select name="${name}">
      ${[0, 1, 2, 3, 4].map(i => {
        const iso = toISO(addDays(state.weekStart, i));
        return `<option value="${iso}" ${iso === isoActual ? 'selected' : ''}>${DIAS_MAY[i]} ${parseISO(iso).getDate()}</option>`;
      }).join('')}
    </select>`;

  /* ================= VISTAS ================= */
  function viewNotConfigured() {
    return `
    <div class="notconfig">
      <div class="home-hero">
        <img src="icon-192.png" alt="">
        <h1>Misión Estrellas ⭐</h1>
        <p>Falta configurar la aplicación</p>
      </div>
      <div class="card">
        <h3 style="margin-bottom:10px">🔧 Pasos rápidos</h3>
        <ol>
          <li>Crea una cuenta gratis en <b>supabase.com</b> y un <b>New Project</b>.</li>
          <li>En <b>Project Settings ⚙️ → API</b> copia la <b>Project URL</b> y la clave <b>anon public</b> y pégalas en el archivo <code>config.js</code>.</li>
          <li>En <b>SQL Editor</b> pega todo el archivo <code>sql/schema.sql</code> y pulsa <b>RUN</b> (no olvides poner tu email como administrador).</li>
          <li>En <b>Authentication → Users → Add user</b> crea tu cuenta de administrador.</li>
          <li>En <b>Authentication → Sign In / Providers → Email</b> desactiva <b>Allow new users to sign up</b>.</li>
          <li>Despliega la función <code>admin-familias</code> (ver README paso 8) para dar de alta familias.</li>
        </ol>
        <p class="muted">La guía completa está en el archivo <code>README.md</code> del proyecto.</p>
      </div>
    </div>`;
  }

  function viewHome() {
    const d = new Date();
    return `
    <div class="home-hero">
      <img src="icon-192.png" alt="">
      <h1>Misión Estrellas ⭐</h1>
      <p>Tareas, estrellas y recompensas</p>
    </div>
    <p class="home-date">📅 ${DIAS_LARGO[d.getDay()]}, ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}</p>
    <div class="home-actions">
      <button class="btn big gold" data-act="go-kids">👧👦 Ver mis estrellas</button>
      ${state.role === 'kids' ? '' : '<button class="btn big ghost" data-act="go-parents">🔐 Zona de papás</button>'}
    </div>`;
  }

  function kidCard(kid) {
    const s = statsFor(kid.id);
    return `
    <button class="kid-card" data-act="select-child" data-id="${kid.id}">
      <div class="kid-avatar" style="background:${esc(kid.color)}22">${esc(kid.emoji)}</div>
      <div class="name">${esc(kid.name)}</div>
      <div class="stars">⭐ ${s.total}</div>
    </button>`;
  }

  function viewKids() {
    const kids = state.data.children;
    return `
    <div class="topbar">
      <button class="icon-btn" data-act="go-home">←</button>
      <h2 class="page-title">¿Quién eres? 👇</h2>
    </div>
    ${kids.length
      ? `<div class="kids-grid">${kids.map(kidCard).join('')}</div>`
      : `<div class="empty"><span class="emo">👨‍👩‍👧‍👦</span>Todavía no hay hijos.<br>Los papás pueden añadirlos en la zona privada.</div>`}`;
  }

  function childHead(kid, backTo, title) {
    return `
    <div class="topbar">
      <button class="icon-btn" data-act="${backTo}">←</button>
      <h2 class="page-title">${title}</h2>
      <button class="icon-btn" data-act="go-home">🏠</button>
    </div>
    <div class="child-head">
      <div class="kid-avatar" style="background:${esc(kid.color)}33">${esc(kid.emoji)}</div>
      <div class="who">
        <h2>${esc(kid.name)}</h2>
        <span class="readonly-tag">🔒 Vista de solo lectura</span>
      </div>
    </div>`;
  }

  function starTotalCard(s) {
    return `
    <div class="star-total">
      <div class="big-star">⭐</div>
      <div class="count">${s.total}</div>
      <div class="label">estrellas en total</div>
      <div class="stat-row">
        <div class="stat ok"><div class="n">${s.done}</div><div class="t">Tareas ✅</div></div>
        <div class="stat ok"><div class="n">+${s.extra}</div><div class="t">Extras 🎁</div></div>
        <div class="stat bad"><div class="n">-${s.lost}</div><div class="t">Perdidas 💔</div></div>
        <div class="stat bad"><div class="n">${s.points}</div><div class="t">Puntos 🚫</div></div>
      </div>
      <div class="dots">${[0, 1, 2].map(i => `<i class="${i < s.dots ? 'on' : ''}"></i>`).join('')}</div>
      <div class="muted center" style="margin-top:5px">🚫 ${s.dots}/3 puntos · con 3 se pierde 1 estrella</div>
    </div>`;
  }

  function rewardsCard(total) {
    return `
    <div class="card">
      <p class="card-title">🏆 Recompensas de fin de semana</p>
      <div class="rewards">
        ${REWARD_DAYS.map(rd => {
          const r = rewardFor(rd.day);
          const min = Number(r.min_stars) || 0;
          const pct = min <= 0 ? 100 : Math.min(100, Math.round(total / min * 100));
          const won = total >= min;
          return `
          <div class="reward ${won ? 'won' : ''}">
            <div class="emo">${esc(r.emoji)}</div>
            <div class="info">
              <div class="day">${rd.name} · ${esc(r.label)}</div>
              <div class="need">⭐ ${total} / ${min} estrellas</div>
              <div class="bar"><i style="width:${pct}%"></i></div>
            </div>
            <div class="state">${won ? '🎉' : '🔒'}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function dayTabs(childId, interactive) {
    return `
    <div class="daytabs">
      ${DIAS_CORTO.map((d, i) => {
        const iso = toISO(addDays(state.weekStart, i));
        const total = tasksForDay(childId, iso).length;
        const ok = tasksForDay(childId, iso).filter(t => t.status === 'done').length;
        const sub = total ? `✅${ok}/${total}` : '—';
        return `<button class="daytab ${state.day === i + 1 ? 'on' : ''}" ${interactive ? `data-act="select-day" data-day="${i + 1}"` : ''}>
          <span>${d}</span><span class="sub">${sub}</span>
        </button>`;
      }).join('')}
    </div>`;
  }

  const weekNav = () => `
    <div class="weeknav">
      <button class="icon-btn" data-act="week-prev">◀</button>
      <div class="label">📅 Semana del ${fmtRango(state.weekStart)}</div>
      <button class="icon-btn" data-act="week-next">▶</button>
    </div>`;

  function taskRowChild(t) {
    const cls = t.status === 'done' ? 'done' : t.status === 'failed' ? 'failed' : '';
    const estado = t.status === 'done' ? '✅⭐' : t.status === 'failed' ? '❌' : '⏳';
    return `
    <div class="task ${cls}" data-cat="${t.cat}">
      <div class="emo">${esc(t.emoji)}</div>
      <div class="body">
        <div class="t">${esc(t.title)}</div>
        <span class="cat">${CATS[t.cat].emoji} ${CATS[t.cat].label}</span>
        ${t.onlyWeek ? '<span class="cat only-week">📅 solo esta semana</span>' : ''}
      </div>
      <div class="state">${estado}</div>
    </div>`;
  }

  function taskRowParent(t, iso) {
    const cls = t.status === 'done' ? 'done' : t.status === 'failed' ? 'failed' : '';
    return `
    <div class="task parent ${cls}" data-cat="${t.cat}">
      <div class="emo">${esc(t.emoji)}</div>
      <div class="body">
        <div class="t">${esc(t.title)}</div>
        <span class="cat">${CATS[t.cat].emoji} ${CATS[t.cat].label}</span>
        ${t.onlyWeek ? '<span class="cat only-week">📅 solo esta semana</span>' : ''}
      </div>
      <div class="actions">
        <button class="mini ok" title="Completada" data-act="mark" data-tid="${t.id}" data-status="done">✅</button>
        <button class="mini no" title="No hecha" data-act="mark" data-tid="${t.id}" data-status="failed">❌</button>
        <button class="mini" title="Editar siempre" data-act="edit-tpl" data-tid="${t.id}">✏️</button>
        <button class="mini warn" title="Solo esta semana" data-act="override" data-tid="${t.id}" data-date="${iso}">📅</button>
        <button class="mini" title="Borrar" data-act="del-tpl" data-tid="${t.id}">🗑️</button>
      </div>
    </div>`;
  }

  const extraRow = (e, parent) => `
    <div class="task ${e.status === 'done' ? 'done' : ''} ${parent ? 'parent' : ''}" data-cat="extra">
      <div class="emo">${esc(e.emoji)}</div>
      <div class="body">
        <div class="t">${esc(e.title)}</div>
        <span class="cat">🎁 Extra · ${DIAS_MAY[weekdayNum(e.date) - 1]} ${parseISO(e.date).getDate()} · +${e.stars} ⭐</span>
      </div>
      ${parent
        ? `<div class="actions">
             <button class="mini ok" title="Hecha" data-act="toggle-extra" data-eid="${e.id}">✅</button>
             <button class="mini" title="Editar" data-act="edit-extra" data-eid="${e.id}">✏️</button>
             <button class="mini" title="Borrar" data-act="del-extra" data-eid="${e.id}">🗑️</button>
           </div>`
        : `<div class="state">${e.status === 'done' ? '✅⭐' : '⏳'}</div>`}
    </div>`;

  function viewChild() {
    const kid = childById(state.childId);
    if (!kid) return viewKids();
    const s = statsFor(kid.id);
    const iso = toISO(addDays(state.weekStart, state.day - 1));
    const tasks = tasksForDay(kid.id, iso);
    const extras = extrasForDay(kid.id, iso);
    const perfect = tasks.length > 0 && tasks.every(t => t.status === 'done');
    const pens = state.data.penalties.filter(p => p.child_id === kid.id).slice(0, 5);

    return `
    ${childHead(kid, 'go-kids', 'Mis estrellas')}
    ${starTotalCard(s)}
    ${rewardsCard(s.total)}
    ${weekNav()}
    ${dayTabs(kid.id, true)}
    <div id="tab-body">
      ${perfect ? '<div class="banner perfect">🎉 ¡DÍA PERFECTO! ¡Has hecho todas tus tareas! 🌟</div>' : ''}
      ${tasks.length ? tasks.map(taskRowChild).join('') : '<div class="empty"><span class="emo">😴</span>No hay tareas este día</div>'}
      ${extras.length ? `<div class="section-gap"></div>${extras.map(e => extraRow(e, false)).join('')}` : ''}
    </div>
    <div class="card">
      <p class="card-title">🚫 Mis penalizaciones</p>
      ${s.points === 0
        ? '<div class="center" style="font-size:34px">🎉</div><p class="center muted" style="margin:4px 0 0">¡Ninguna penalización! Sigue así 💪</p>'
        : `<div class="pen-list">${pens.map(p => `
            <div class="pen">
              <span class="pts">-${p.points} 🚫</span>
              <div class="txt">${esc(p.reason || 'Penalización')}<small>${DIAS_MAY[weekdayNum(p.date) - 1] || ''} ${parseISO(p.date).getDate()} ${MESES[parseISO(p.date).getMonth()]}</small></div>
            </div>`).join('')}</div>`}
      <p class="muted center" style="margin:10px 0 0">Cada 3 puntos 🚫 se pierde 1 estrella ⭐</p>
    </div>`;
  }

  function viewLogin() {
    return `
    <div class="login-wrap">
      <img src="icon-192.png" alt="">
      <h2>🔐 Entrar</h2>
      <p>Email de vuestra familia y vuestro código</p>
      <div class="login-card">
        <form id="form-login">
          <div class="field">
            <label>Email</label>
            <input type="email" name="email" autocomplete="username" required autofocus placeholder="padres@familia.com">
          </div>
          <div class="field">
            <label>Código (contraseña)</label>
            <input type="password" name="password" autocomplete="current-password" required placeholder="••••••">
          </div>
          <button class="btn big" type="submit">Entrar 🔓</button>
        </form>
      </div>
      <p class="muted" style="color:#fff;opacity:.9;margin-top:14px">¿Eres administrador? Entra con tu cuenta de administrador.</p>
      <p style="margin-top:10px"><button class="btn ghost small" data-act="go-home">← Volver</button></p>
    </div>`;
  }

  /* ---------- Vista administrador ---------- */
  function viewAdmin() {
    const fams = state.adminFamilies;
    return `
    <div class="topbar">
      <button class="icon-btn" data-act="go-parents">←</button>
      <h2 class="page-title">🛠️ Administración</h2>
      <div class="grow"></div>
      <button class="icon-btn" title="Cerrar sesión" data-act="logout">🔒</button>
    </div>
    <div class="card">
      <p class="card-title">➕ Dar de alta una familia</p>
      <p class="muted" style="margin-top:0">Crea la cuenta de papás y, si quieres, una cuenta de solo lectura para sus niños.</p>
      <button class="btn big" data-act="new-family">🛠️ Nueva familia</button>
    </div>
    ${state.myFamilyId ? '' : `
    <div class="card">
      <p class="card-title">🏠 Tu familia</p>
      <p class="muted" style="margin-top:0">Todavía no tienes familia propia. Crea una para usar la app con tus hijos.</p>
      <button class="btn gold" data-act="my-family">➕ Crear MI familia</button>
    </div>`}
    <div class="card">
      <p class="card-title">👨‍👩‍👧‍👦 Familias (${fams.length})</p>
      ${fams.length ? fams.map(f => `
        <div class="task parent" data-cat="casa">
          <div class="emo">🏠</div>
          <div class="body">
            <div class="t">${esc(f.name)}</div>
            <span class="cat">👧 ${f.children && f.children[0] ? f.children[0].count : 0} hijos · 👥 ${f.family_members && f.family_members[0] ? f.family_members[0].count : 0} cuentas</span>
          </div>
          <div class="actions">
            <button class="mini" title="Añadir cuenta" data-act="add-account" data-fid="${f.id}" data-name="${esc(f.name)}">➕</button>
            <button class="mini" title="Borrar familia" data-act="del-family" data-fid="${f.id}" data-name="${esc(f.name)}">🗑️</button>
          </div>
        </div>`).join('') : '<p class="muted center">Aún no hay familias 🏡</p>'}
    </div>
    <div class="card tight center muted">
      🛡️ Cada familia solo ve a sus hijos. El acceso está protegido en el servidor (Supabase RLS): ni siquiera abriendo el código se pueden ver datos de otras familias.
    </div>`;
  }

  function sheetCreada(emails) {
    return `
    <div class="sheet-head"><h3>✅ Cuentas creadas</h3><button class="sheet-close" data-act="close-sheet">✕</button></div>
    <div class="card tight">
      <p style="margin-top:0"><b>📧 Comunica a esa familia estos datos:</b></p>
      <ul style="padding-left:18px;margin:8px 0">
        ${emails.map(e => `<li><code>${esc(e)}</code></li>`).join('')}
      </ul>
      <p class="muted" style="margin-bottom:0">La contraseña la elegiste tú al crearla. Si la olvidan, bórrales la cuenta y créales otra desde aquí (o pídeles que la cambien en Supabase).</p>
    </div>`;
  }

  function sheetNewFamily() {
    return `
    <div class="sheet-head"><h3>🛠️ Nueva familia</h3><button class="sheet-close" data-act="close-sheet">✕</button></div>
    <form id="form-new-family">
      <div class="field"><label>Nombre de la familia</label><input name="name" required placeholder="Familia García"></div>
      <div class="field"><label>Email de papás</label><input name="parent_email" type="email" required placeholder="padres@familia.com"></div>
      <div class="field"><label>Código de papás (mínimo 6 caracteres)</label><input name="parent_password" type="password" required minlength="6" placeholder="••••••"></div>
      <div class="field">
        <label>Cuenta de solo lectura para los niños (opcional)</label>
        <input name="kids_email" type="email" placeholder="hijos@familia.com" style="margin-bottom:8px">
        <input name="kids_password" type="password" minlength="6" placeholder="Código de los niños (mínimo 6)">
      </div>
      <button class="btn big" type="submit">🛠️ Crear familia</button>
    </form>
    <p class="muted center" style="margin:10px 0 0">La cuenta de niños solo puede mirar: no tiene botones de edición y Supabase rechaza cualquier escritura con esa cuenta.</p>`;
  }

  function sheetAddAccount(fid, name) {
    return `
    <div class="sheet-head"><h3>➕ Cuenta para ${esc(name)}</h3><button class="sheet-close" data-act="close-sheet">✕</button></div>
    <form id="form-add-account" data-fid="${fid}">
      <div class="field"><label>Tipo de cuenta</label>
        <select name="role">
          <option value="parent">👨‍👩‍👧 Papás (puede escribir)</option>
          <option value="kids">👧 Niños (solo lectura)</option>
        </select>
      </div>
      <div class="field"><label>Email</label><input name="email" type="email" required placeholder="mama@familia.com"></div>
      <div class="field"><label>Código (mínimo 6 caracteres)</label><input name="password" type="password" required minlength="6" placeholder="••••••"></div>
      <button class="btn big" type="submit">➕ Crear cuenta</button>
    </form>
    <p class="muted center" style="margin:10px 0 0">Así mamá y papá pueden tener cada uno su cuenta en la misma familia.</p>`;
  }

  function sheetMyFamily() {
    return `
    <div class="sheet-head"><h3>🏠 Crear MI familia</h3><button class="sheet-close" data-act="close-sheet">✕</button></div>
    <form id="form-my-family">
      <div class="field"><label>Nombre de tu familia</label><input name="name" required placeholder="Nuestra familia"></div>
      <button class="btn gold big" type="submit">➕ Crear</button>
    </form>
    <p class="muted center" style="margin:10px 0 0">Usarás tu propia cuenta de administrador como cuenta de papás.</p>`;
  }

  /* ---------- Zona padres ---------- */
  function tabTareas() {
    const iso = toISO(addDays(state.weekStart, state.day - 1));
    const tasks = tasksForDay(state.childId, iso);
    const extras = extrasForDay(state.childId, iso);
    return `
    ${weekNav()}
    ${dayTabs(state.childId, true)}
    <div class="card">
      <p class="card-title">🗓️ Tareas del ${fmtDia(iso)}</p>
      ${tasks.map(t => taskRowParent(t, iso)).join('')}
      ${extras.map(e => extraRow(e, true)).join('')}
      <button class="btn ghost" data-act="add-task">➕ Añadir tarea este día</button>
    </div>
    <div class="card tight center">
      <button class="btn small ghost" data-act="copy-week">📋 Copiar la semana anterior</button>
      <p class="muted" style="margin:8px 0 0">Copia los cambios "solo esta semana" y las tareas extra de la semana pasada.</p>
    </div>`;
  }

  function tabExtras() {
    const extras = extrasForWeek(state.childId);
    return `
    ${weekNav()}
    <div class="card">
      <p class="card-title">🎁 Tareas extra de la semana</p>
      ${extras.length ? extras.map(e => extraRow(e, true)).join('') : '<p class="muted center">Sin tareas extra esta semana 🎁</p>'}
      <button class="btn green" data-act="add-extra">➕ Nueva tarea extra</button>
      <p class="muted" style="margin:10px 0 0">Sirven para recuperar estrellas perdidas ⭐</p>
    </div>`;
  }

  function tabPenalizaciones() {
    const pens = state.data.penalties.filter(p => p.child_id === state.childId);
    const s = statsFor(state.childId);
    return `
    <div class="card">
      <p class="card-title">🚫 Añadir penalización</p>
      <form id="form-penalty">
        <div class="field">
          <label>Motivo</label>
          <div class="suggests">${PEN_REASONS.map(r => `<button type="button" data-act="pen-reason" data-reason="${esc(r)}">${esc(r)}</button>`).join('')}</div>
          <input name="reason" id="pen-reason" placeholder="Motivo… (opcional)">
        </div>
        <div class="row2">
          <div class="field"><label>Día</label>${daySelect('date', toISO(new Date()))}</div>
          <div class="field"><label>Puntos</label>
            <select name="points">${[1, 2, 3].map(n => `<option value="${n}">${n} ${n === 1 ? 'punto' : 'puntos'}</option>`).join('')}</select>
          </div>
        </div>
        <button class="btn danger big" type="submit">🚫 Aplicar penalización</button>
      </form>
    </div>
    <div class="card">
      <p class="card-title">📋 Historial (${pens.length})</p>
      ${pens.length ? `<div class="pen-list">${pens.map(p => `
        <div class="pen">
          <span class="pts">-${p.points} 🚫</span>
          <div class="txt">${esc(p.reason || 'Penalización')}<small>${DIAS_MAY[weekdayNum(p.date) - 1] || ''} ${parseISO(p.date).getDate()} ${MESES[parseISO(p.date).getMonth()]}</small></div>
          <button class="mini" title="Anular" data-act="del-pen" data-pid="${p.id}">↩️</button>
        </div>`).join('')}</div>` : '<p class="muted center">Nada por aquí 🎉</p>'}
      <p class="muted center" style="margin:10px 0 0">Ahora: ${s.points} puntos → ${s.lost} estrellas perdidas (faltan ${3 - s.dots} para la siguiente)</p>
    </div>`;
  }

  function tabRecompensas() {
    return REWARD_DAYS.map(rd => {
      const r = rewardFor(rd.day);
      const emo = ['🎮', '🕹️', '📺', '🎲', '🛴', '🚲', '🎨', '🎬', '⏱️'];
      return `
      <div class="card">
        <form id="form-reward" data-day="${r.day}">
          <p class="card-title">${esc(r.emoji)} ${rd.name}</p>
          <div class="row2">
            <div class="field">
              <label>Estrellas mínimas</label>
              <input type="number" name="min_stars" min="0" max="99" value="${Number(r.min_stars) || 0}" required>
            </div>
            <div class="field">
              <label>Icono</label>
              <div class="emo-grid" data-picker="emoji" style="max-height:64px">
                ${[...new Set([esc(r.emoji), ...emo])].map(e => `<button type="button" data-act="pick-emo" data-emo="${e}" class="${e === esc(r.emoji) ? 'on' : ''}">${e}</button>`).join('')}
              </div>
              <input type="hidden" name="emoji" value="${esc(r.emoji)}">
            </div>
          </div>
          <div class="field">
            <label>Recompensa</label>
            <input name="label" value="${esc(r.label)}" required>
          </div>
          <button class="btn" type="submit">💾 Guardar</button>
        </form>
      </div>`;
    }).join('') + `
    <div class="card tight center muted">
      Las recompensas se muestran a los hijos con las estrellas totales (tareas + extras − penalizaciones).
    </div>`;
  }

  function tabHijos() {
    return `
    <div class="card">
      <p class="card-title">👧👧 Hijos de la familia</p>
      ${state.data.children.length ? state.data.children.map(k => {
        const s = statsFor(k.id);
        return `
        <div class="task parent" data-cat="educativo">
          <div class="emo">${esc(k.emoji)}</div>
          <div class="body">
            <div class="t">${esc(k.name)}</div>
            <span class="cat">⭐ ${s.total} estrellas · 🚫 ${s.points} puntos</span>
          </div>
          <div class="actions">
            <button class="mini" title="Editar" data-act="edit-child" data-id="${k.id}">✏️</button>
            <button class="mini" title="Borrar" data-act="del-child" data-id="${k.id}">🗑️</button>
          </div>
        </div>`;
      }).join('') : '<p class="muted center">Añade a tu primer hijo 👶</p>'}
      <button class="btn" data-act="add-child">➕ Añadir hijo</button>
    </div>
    <div class="card tight center muted">
      Los hijos entran sin código y solo pueden mirar 👀<br>
      Recuerda pulsar 🔒 para cerrar la sesión de papás cuando terminéis.
    </div>`;
  }

  function viewParents() {
    if (state.role !== 'parent' && !state.isAdmin) { state.view = 'home'; return viewHome(); }
    const kids = state.data.children;
    if (kids.length && !state.childId) state.childId = kids[0].id;
    if (!kids.length) state.tab = 'hijos';
    const body = {
      tareas: tabTareas, extras: tabExtras, penalizaciones: tabPenalizaciones,
      recompensas: tabRecompensas, hijos: tabHijos
    }[state.tab] || tabTareas;

    return `
    <div class="topbar">
      <h2 class="page-title">🔐 Zona de papás</h2>
      <div class="grow"></div>
      ${state.isAdmin ? '<button class="icon-btn" title="Administración" data-act="go-admin">🛠️</button>' : ''}
      <button class="icon-btn" title="Ver como hijo" data-act="preview">👀</button>
      <button class="icon-btn" title="Cerrar sesión" data-act="logout">🔒</button>
    </div>
    ${kids.length ? `<div class="child-chips">${kids.map(k => `
      <button class="chip ${k.id === state.childId ? 'on' : ''}" data-act="pick-child" data-id="${k.id}">
        <span class="em">${esc(k.emoji)}</span>${esc(k.name)} · ⭐${statsFor(k.id).total}
      </button>`).join('')}</div>` : ''}
    <div class="parent-tabs">
      ${TABS.map(t => `<button class="ptab ${state.tab === t.id ? 'on' : ''}" data-act="ptab" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="tab-body">${body()}</div>`;
  }

  /* ---------- Sheets (modales) ---------- */
  function sheetTemplate(tid, weekday) {
    const t = tid ? state.data.templates.find(x => x.id === tid) : null;
    const cat = t ? t.category : 'personal';
    return `
    <div class="sheet-head"><h3>${t ? '✏️ Editar tarea' : '➕ Nueva tarea'} · ${DIAS[weekday - 1]}</h3><button class="sheet-close" data-act="close-sheet">✕</button></div>
    <form id="form-template" data-id="${t ? t.id : ''}" data-wd="${weekday}">
      <div class="field">
        <label>Categoría</label>
        <div class="cat-chips">
          ${CAT_ORDER.map(c => `<button type="button" data-act="pick-cat" data-cat="${c}" class="${c === cat ? 'on' : ''}">${CATS[c].emoji} ${CATS[c].label}</button>`).join('')}
        </div>
        <input type="hidden" name="category" value="${cat}">
      </div>
      <div class="field"><label>Icono</label>${emoGrid('emoji', t ? t.emoji : '⭐')}</div>
      <div class="field">
        <label>Título</label>
        <input name="title" required value="${t ? esc(t.title) : ''}" placeholder="¿Qué hay que hacer?">
        <div class="suggests" data-sugs="${cat}">
          ${SUGGESTIONS[cat].map(s => `<button type="button" data-act="pick-title" data-title="${esc(s)}">${esc(s)}</button>`).join('')}
        </div>
      </div>
      <button class="btn big" type="submit">${t ? '💾 Guardar cambios' : '➕ Añadir tarea'}</button>
    </form>
    ${t ? `
    <div class="btn-row">
      <button class="btn ghost small" data-act="tpl-active" data-id="${t.id}">${t.active ? '⏸️ Desactivar' : '▶️ Activar'}</button>
      <button class="btn danger small" data-act="del-tpl" data-tid="${t.id}">🗑️ Borrar</button>
    </div>
    <p class="muted center" style="margin:10px 0 0">La plantilla se repite todas las semanas. Para un cambio puntual usa 📅 en la lista.</p>` : ''}`;
  }

  function sheetOverride(tid, iso) {
    const t = state.data.templates.find(x => x.id === tid);
    const ov = state.data.overrides.find(o => o.template_id === tid && o.date === iso);
    return `
    <div class="sheet-head"><h3>📅 Solo el ${fmtDia(iso)}</h3><button class="sheet-close" data-act="close-sheet">✕</button></div>
    <p class="muted" style="margin-top:0">Cambia la tarea únicamente en esta semana. Las demás semanas siguen igual.</p>
    <form id="form-override" data-tid="${tid}" data-date="${iso}">
      <div class="field"><label>Icono</label>${emoGrid('emoji', (ov && ov.emoji) || t.emoji)}</div>
      <div class="field">
        <label>Título</label>
        <input name="title" required value="${esc((ov && ov.title) || t.title)}">
        <div class="suggests">
          ${SUGGESTIONS[t.category].map(s => `<button type="button" data-act="pick-title" data-title="${esc(s)}">${esc(s)}</button>`).join('')}
        </div>
      </div>
      <button class="btn big" type="submit">💾 Guardar</button>
    </form>
    <div class="btn-row">
      <button class="btn ghost small" data-act="hide-week" data-tid="${tid}" data-date="${iso}">🙈 Ocultar esta semana</button>
      ${ov ? `<button class="btn danger small" data-act="clear-ovr" data-tid="${tid}" data-date="${iso}">↩️ Quitar cambio</button>` : ''}
    </div>`;
  }

  function sheetExtra(eid, dayIso) {
    const e = eid ? state.data.extras.find(x => x.id === eid) : null;
    const iso = e ? e.date : (dayIso || toISO(addDays(state.weekStart, state.day - 1)));
    return `
    <div class="sheet-head"><h3>${e ? '✏️ Editar' : '➕ Nueva'} tarea extra</h3><button class="sheet-close" data-act="close-sheet">✕</button></div>
    <form id="form-extra" data-id="${e ? e.id : ''}">
      <div class="row2">
        <div class="field"><label>Día</label>${daySelect('date', iso)}</div>
        <div class="field"><label>Estrellas ⭐</label>
          <select name="stars">${[1, 2, 3].map(n => `<option value="${n}" ${e && e.stars === n ? 'selected' : ''}>+${n} estrella${n > 1 ? 's' : ''}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field"><label>Icono</label>${emoGrid('emoji', e ? e.emoji : '🎁')}</div>
      <div class="field">
        <label>Título</label>
        <input name="title" required value="${e ? esc(e.title) : ''}" placeholder="¿Qué extra puede hacer?">
        <div class="suggests">
          ${SUGGESTIONS_EXTRA.map(s => `<button type="button" data-act="pick-title" data-title="${esc(s)}">${esc(s)}</button>`).join('')}
        </div>
      </div>
      <button class="btn green big" type="submit">${e ? '💾 Guardar' : '➕ Añadir extra'}</button>
    </form>`;
  }

  function sheetChild(id) {
    const c = id ? childById(id) : null;
    const color = c ? c.color : COLORS[state.data.children.length % COLORS.length];
    return `
    <div class="sheet-head"><h3>${c ? '✏️ Editar hijo' : '➕ Añadir hijo'}</h3><button class="sheet-close" data-act="close-sheet">✕</button></div>
    <form id="form-child" data-id="${c ? c.id : ''}">
      <div class="field"><label>Nombre</label><input name="name" required value="${c ? esc(c.name) : ''}" placeholder="Nombre"></div>
      <div class="field"><label>Animalito</label>${kidEmoGrid(c ? c.emoji : '🦊')}</div>
      <div class="field">
        <label>Color</label>
        <div class="color-grid" data-picker="color">
          ${COLORS.map(col => `<button type="button" data-act="pick-color" data-color="${col}" class="${col === color ? 'on' : ''}" style="background:${col}"></button>`).join('')}
        </div>
        <input type="hidden" name="color" value="${color}">
      </div>
      <button class="btn big" type="submit">${c ? '💾 Guardar' : '➕ Añadir'}</button>
    </form>`;
  }

  /* ================= RENDER ================= */
  function render() {
    const app = $('#app');
    if (!CONFIGURED) { app.innerHTML = viewNotConfigured(); return; }
    const views = { home: viewHome, kids: viewKids, child: viewChild, login: viewLogin, parents: viewParents, admin: viewAdmin };
    app.innerHTML = (views[state.view] || viewHome)();
  }

  /* ================= EVENTOS ================= */
  document.addEventListener('click', async ev => {
    lastActivity = Date.now();
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const d = el.dataset;

    switch (act) {
      /* navegación */
      case 'go-home': state.view = 'home'; render(); break;
      case 'go-kids': state.view = 'kids'; render(); break;
      case 'go-parents':
        if (state.role === 'parent' || state.isAdmin) { state.view = 'parents'; render(); }
        else { state.view = 'login'; render(); }
        break;
      case 'go-admin':
        state.view = 'admin';
        try { await loadAdmin(); } catch (e) { console.error(e); toast('No se pudo cargar la lista de familias 📡', true); }
        render();
        break;
      case 'new-family': openSheet(sheetNewFamily()); break;
      case 'add-account': openSheet(sheetAddAccount(d.fid, d.name)); break;
      case 'del-family':
        if (seguro(`¿Borrar la familia "${d.name}" y TODOS sus datos?`)) {
          await deleteFamily(d.fid);
          await loadAdmin();
          render();
        }
        break;
      case 'my-family': openSheet(sheetMyFamily()); break;
      case 'select-child': state.childId = d.id; state.view = 'child'; render(); break;
      case 'preview': state.view = 'kids'; render(); break;
      case 'logout': await logout(false); break;

      /* semana y días */
      case 'week-prev': state.weekStart = addDays(state.weekStart, -7); render(); break;
      case 'week-next': state.weekStart = addDays(state.weekStart, 7); render(); break;
      case 'select-day': state.day = Number(d.day); render(); break;

      /* padres: pestañas e hijo activo */
      case 'ptab': state.tab = d.tab; render(); break;
      case 'pick-child': state.childId = d.id; render(); break;

      /* marcar tareas */
      case 'mark': setStatus(d.tid, toISO(addDays(state.weekStart, state.day - 1)), d.status); break;

      /* plantillas */
      case 'add-task': openSheet(sheetTemplate(null, state.day)); break;
      case 'edit-tpl': openSheet(sheetTemplate(d.tid, state.day)); break;
      case 'del-tpl':
        closeSheet();
        if (seguro('¿Borrar esta tarea para siempre? Se borrarán también sus marcas.')) await deleteTemplate(d.tid);
        break;
      case 'tpl-active': {
        const t = state.data.templates.find(x => x.id === d.id);
        await saveTemplate(t.id, { active: !t.active });
        closeSheet();
        break;
      }

      /* cambios solo esta semana */
      case 'override': openSheet(sheetOverride(d.tid, d.date)); break;
      case 'hide-week':
        closeSheet();
        await saveOverride(d.tid, d.date, { disabled: true });
        break;
      case 'clear-ovr':
        closeSheet();
        await clearOverride(d.tid, d.date);
        break;

      /* semana */
      case 'copy-week': await copyWeek(); break;

      /* extras */
      case 'add-extra': openSheet(sheetExtra(null)); break;
      case 'edit-extra': openSheet(sheetExtra(d.eid)); break;
      case 'toggle-extra': toggleExtra(d.eid); break;
      case 'del-extra':
        if (seguro('¿Borrar esta tarea extra?')) await deleteExtra(d.eid);
        break;

      /* penalizaciones */
      case 'pen-reason': { const i = $('#pen-reason'); if (i) { i.value = d.reason; i.focus(); } break; }
      case 'del-pen': await deletePenalty(d.pid); break;

      /* hijos */
      case 'add-child': openSheet(sheetChild(null)); break;
      case 'edit-child': openSheet(sheetChild(d.id)); break;
      case 'del-child':
        if (seguro('¿Borrar este hijo y todos sus datos?')) { closeSheet(); await deleteChild(d.id); }
        break;

      /* selectores dentro de sheets */
      case 'pick-emo': {
        const form = el.closest('form') || el.closest('#sheet');
        const grid = el.closest('.emo-grid');
        grid.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
        const hidden = form.querySelector(`input[name="${grid.dataset.picker}"]`);
        if (hidden) hidden.value = d.emo;
        break;
      }
      case 'pick-color': {
        const grid = el.closest('.color-grid');
        grid.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
        el.closest('form').querySelector('input[name="color"]').value = d.color;
        break;
      }
      case 'pick-cat': {
        const form = el.closest('form');
        el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
        form.querySelector('input[name="category"]').value = d.cat;
        const sugs = form.querySelector('.suggests');
        if (sugs) sugs.innerHTML = SUGGESTIONS[d.cat].map(s => `<button type="button" data-act="pick-title" data-title="${esc(s)}">${esc(s)}</button>`).join('');
        break;
      }
      case 'pick-title': {
        const form = el.closest('form');
        form.querySelector('input[name="title"]').value = d.title;
        break;
      }

      case 'close-sheet': closeSheet(); break;
    }
  });

  document.addEventListener('submit', async ev => {
    ev.preventDefault();
    lastActivity = Date.now();
    const f = ev.target;
    const fd = new FormData(f);
    const id = f.dataset.id || '';

    if (f.id === 'form-login') {
      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Comprobando…';
      const ok = await login(String(fd.get('email') || '').trim(), String(fd.get('password') || ''));
      if (!ok) render();
      return;
    }

    if (f.id === 'form-new-family') {
      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Creando…';
      const res = await invokeAdmin({
        action: 'create-family',
        name: fd.get('name'),
        parent_email: fd.get('parent_email'),
        parent_password: fd.get('parent_password'),
        kids_email: fd.get('kids_email') || null,
        kids_password: fd.get('kids_password') || null
      });
      if (res.error) { btn.disabled = false; btn.textContent = '🛠️ Crear familia'; toast(res.error, true); return; }
      closeSheet();
      try { await loadAdmin(); } catch (e) { console.error(e); }
      render();
      openSheet(sheetCreada(res.emails || []));
      return;
    }

    if (f.id === 'form-add-account') {
      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Creando…';
      const res = await invokeAdmin({
        action: 'add-account',
        family_id: f.dataset.fid,
        role: fd.get('role'),
        email: fd.get('email'),
        password: fd.get('password')
      });
      if (res.error) { btn.disabled = false; btn.textContent = '➕ Crear cuenta'; toast(res.error, true); return; }
      closeSheet();
      try { await loadAdmin(); } catch (e) { console.error(e); }
      render();
      openSheet(sheetCreada(res.emails || []));
      return;
    }

    if (f.id === 'form-my-family') {
      closeSheet();
      await createMyFamily(String(fd.get('name') || '').trim());
      return;
    }

    if (f.id === 'form-template') {
      const ok = await saveTemplate(id, {
        category: fd.get('category'), title: String(fd.get('title')).trim(),
        emoji: fd.get('emoji'), weekday: Number(f.dataset.wd)
      });
      if (ok) closeSheet();
      return;
    }

    if (f.id === 'form-override') {
      const ok = await saveOverride(f.dataset.tid, f.dataset.date, {
        title: String(fd.get('title')).trim(), emoji: fd.get('emoji'), disabled: false
      });
      if (ok) closeSheet();
      return;
    }

    if (f.id === 'form-extra') {
      const ok = await saveExtra(id, {
        date: fd.get('date'), title: String(fd.get('title')).trim(),
        emoji: fd.get('emoji'), stars: Number(fd.get('stars')) || 1
      }, state.childId);
      if (ok) closeSheet();
      return;
    }

    if (f.id === 'form-penalty') {
      await addPenalty({ date: fd.get('date'), reason: String(fd.get('reason') || '').trim(), points: Number(fd.get('points')) || 1 });
      return;
    }

    if (f.id === 'form-reward') {
      await saveReward(f.dataset.day, {
        min_stars: Number(fd.get('min_stars')) || 0,
        emoji: fd.get('emoji'), label: String(fd.get('label')).trim()
      });
      return;
    }

    if (f.id === 'form-child') {
      const ok = await saveChild(id, {
        name: String(fd.get('name')).trim(), emoji: fd.get('emoji'), color: fd.get('color')
      });
      if (ok) closeSheet();
      return;
    }
  });

  $('#sheet-back').addEventListener('click', closeSheet);
  ['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));

  /* Cierre automático de la zona de papás a los 15 min de inactividad */
  setInterval(() => {
    if ((state.view === 'parents' || state.view === 'admin') && Date.now() - lastActivity > 15 * 60 * 1000) logout(true);
  }, 60000);

  /* ================= INICIO ================= */
  async function init() {
    if (CONFIGURED) {
      try {
        const { data } = await sb.auth.getSession();
        state.session = Boolean(data.session);
        if (state.session) {
          await loadIdentity();
          if (state.role === 'kids') state.view = 'kids';
          else if (state.role === 'parent' || state.isAdmin) state.view = 'parents';
          else { await sb.auth.signOut(); state.session = null; toast('Esta cuenta no tiene familia asignada 🔐', true); }
        }
        await loadData();
      } catch (err) {
        console.error(err);
        toast('No se ha podido conectar con Supabase 📡', true);
      }
    }
    render();
    const sp = $('#splash');
    sp.classList.add('hide');
    setTimeout(() => sp.remove(), 500);
  }

  /* estrellitas de fondo */
  (function bgStars() {
    const box = $('#bg-stars');
    const emo = ['⭐', '🌟', '✨', '💫', '⭐'];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.textContent = emo[i % emo.length];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.top = Math.random() * 100 + 'vh';
      s.style.animationDelay = (Math.random() * 8) + 's';
      s.style.animationDuration = (7 + Math.random() * 6) + 's';
      box.appendChild(s);
    }
  })();

  init();
})();
