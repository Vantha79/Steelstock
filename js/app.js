'use strict';

const DEFAULT_DATA = [
  { id: 1, reference: 'S235JR', designation: 'Acier de construction', forme: 'Plat', dimensions: '200x10x6000', quantite: 15, unite: 'barre', prix: 85.50, fournisseur: 'ArcelorMittal', localisation: 'A1-01', statut: 'Disponible', dateEntree: '2025-01-10' },
  { id: 2, reference: 'S355J2', designation: 'Acier HLE', forme: 'UPN', dimensions: 'UPN120x6000', quantite: 8, unite: 'barre', prix: 142.00, fournisseur: 'Aperam', localisation: 'A1-02', statut: 'Disponible', dateEntree: '2025-01-15' },
  { id: 3, reference: '304L', designation: 'Inox austénitique', forme: 'Tôle', dimensions: '1500x3000x3', quantite: 4, unite: 'tôle', prix: 520.00, fournisseur: 'Outokumpu', localisation: 'B2-01', statut: 'Disponible', dateEntree: '2025-01-20' },
  { id: 4, reference: '42CrMo4', designation: 'Acier allié trempé', forme: 'Rond', dimensions: 'Ø60x3000', quantite: 2, unite: 'barre', prix: 210.00, fournisseur: 'Ovako', localisation: 'C1-05', statut: 'Faible stock', dateEntree: '2024-12-01' },
  { id: 5, reference: 'S235JR', designation: 'Acier de construction', forme: 'Cornière', dimensions: 'L50x50x5x6000', quantite: 20, unite: 'barre', prix: 48.00, fournisseur: 'ArcelorMittal', localisation: 'A2-03', statut: 'Disponible', dateEntree: '2025-02-01' },
  { id: 6, reference: '316L', designation: 'Inox résistant', forme: 'Tube', dimensions: 'Ø76.1x3x6000', quantite: 0, unite: 'barre', prix: 385.00, fournisseur: 'Sandvik', localisation: 'B3-02', statut: 'Rupture', dateEntree: '2024-11-15' },
  { id: 7, reference: 'S275JR', designation: 'Acier de construction', forme: 'IPE', dimensions: 'IPE200x6000', quantite: 12, unite: 'barre', prix: 195.00, fournisseur: 'Tata Steel', localisation: 'A3-01', statut: 'Disponible', dateEntree: '2025-01-28' },
  { id: 8, reference: 'C45E', designation: 'Acier mi-dur', forme: 'Carré', dimensions: '50x50x3000', quantite: 3, unite: 'barre', prix: 165.00, fournisseur: 'voestalpine', localisation: 'C2-08', statut: 'Faible stock', dateEntree: '2024-12-20' },
];

let state = {
  articles: [],
  mouvements: [],
  nextId: 9,
  sortKey: 'reference',
  sortDir: 'asc',
  search: '',
  filtreStatut: '',
  filtreFormes: '',
  editingId: null,
  selectedIds: [],
  qrSearch: '',
  scriptUrl: '',
  syncing: false,
  userName: '',
};

function el(id) { return document.getElementById(id); }

function saveLocal() {
  try {
    localStorage.setItem('ss_articles', JSON.stringify(state.articles));
    localStorage.setItem('ss_mouvements', JSON.stringify(state.mouvements));
    localStorage.setItem('ss_nextId', String(state.nextId));
    localStorage.setItem('ss_scriptUrl', state.scriptUrl || '');
    localStorage.setItem('ss_userName', state.userName || '');
  } catch (e) {}
}

function loadLocal() {
  try {
    const a = localStorage.getItem('ss_articles');
    const m = localStorage.getItem('ss_mouvements');
    const n = localStorage.getItem('ss_nextId');
    const u = localStorage.getItem('ss_scriptUrl');
    state.articles = a ? JSON.parse(a) : JSON.parse(JSON.stringify(DEFAULT_DATA));
    state.mouvements = m ? JSON.parse(m) : [];
    state.nextId = n ? parseInt(n, 10) : 9;
    state.scriptUrl = u || '';
    state.userName = localStorage.getItem('ss_userName') || '';
  } catch (e) {
    state.articles = JSON.parse(JSON.stringify(DEFAULT_DATA));
    state.mouvements = [];
    state.nextId = 9;
  }
}

function setSyncBadge(status, msg) {
  const b = el('syncBadge');
  if (!b) return;
  b.className = 'sync-badge';
  if (status === 'hidden') { b.classList.add('hidden'); return; }
  b.classList.remove('hidden');
  if (status === 'ok') {
    b.classList.add('sync-ok');
    b.innerHTML = '✅ Synchronisé avec Google Sheets — modif visibles sur tous les appareils';
  } else if (status === 'wait') {
    b.classList.add('sync-wait', 'sync-pulse');
    b.innerHTML = '🔄 ' + (msg || 'Synchronisation...');
  } else if (status === 'error') {
    b.classList.add('sync-error');
    b.innerHTML = '❌ ' + (msg || 'Erreur de synchronisation');
  }
}

async function sheetRequest(action, payload = {}) {
  if (!state.scriptUrl) return null;
  try {
    const url = state.scriptUrl + '?action=' + encodeURIComponent(action) + '&t=' + Date.now();
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    try { return JSON.parse(text); } catch { return null; }
  } catch (e) {
    console.error('Sheet error:', e);
    return null;
  }
}

async function pushArticle(article) {
  if (!state.scriptUrl) return;
  setSyncBadge('wait', 'Sauvegarde dans Google Sheets...');
  const res = await sheetRequest('saveArticle', { article });
  if (res && res.ok) {
    const now = new Date();
    setSyncBadge('ok', '✅ Synchronisé à ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'));
  } else {
    setSyncBadge('error', 'Sauvegarde échouée — données locales conservées');
  }
}

async function deleteFromSheets(id) {
  if (!state.scriptUrl) return;
  setSyncBadge('wait', 'Suppression dans Google Sheets...');
  const res = await sheetRequest('deleteArticle', { id });
  if (res && res.ok) {
    setSyncBadge('ok');
  } else {
    setSyncBadge('error', 'Suppression échouée dans Sheets');
  }
}

async function pushMouvement(mvt) {
  if (!state.scriptUrl) return;
  await sheetRequest('saveMouvement', { mouvement: mvt });
}

async function syncFromSheets() {
  if (!state.scriptUrl || state.syncing) return;
  state.syncing = true;
  setSyncBadge('wait', 'Récupération depuis Google Sheets...');
  try {
    const res = await sheetRequest('getAll');
    if (res && res.ok) {
      if (res.articles && res.articles.length > 0) {
        const localMap = {};
        state.articles.forEach(a => { localMap[String(a.id)] = a; });
        state.articles = res.articles.map(a => {
          const id = parseInt(a.id, 10) || a.id;
          const local = localMap[String(id)] || {};
          const best = (s, l) => String(s || '').trim() || String(l || '').trim() || '';
          return {
            ...local,
            ...a,
            id,
            quantite: parseFloat(String(a.quantite || '0').replace(',', '.').trim()) || 0,
            prix: parseFloat(String(a.prix || '0').replace(',', '.').trim()) || 0,
            creePar: best(a.creePar, local.creePar),
            modifiePar: best(a.modifiePar, local.modifiePar),
            dateModif: best(a.dateModif, local.dateModif),
            dateEntree: best(a.dateEntree, local.dateEntree),
            lastNote: best(a.lastNote, local.lastNote),
          };
        });
        const maxId = Math.max(...state.articles.map(a => parseInt(a.id, 10) || 0), 0);
        if (maxId >= state.nextId) state.nextId = maxId + 1;
      }
      if (res.mouvements) state.mouvements = res.mouvements;
      saveLocal();
      render();
      setSyncBadge('ok');
    } else {
      setSyncBadge('error', 'Impossible de lire Google Sheets');
    }
  } catch (e) {
    setSyncBadge('error', 'Erreur réseau');
  }
  state.syncing = false;
}

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—';
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function uid() {
  return state.nextId++;
}

function statutClass(s) {
  if (s === 'Disponible') return 'statut-Disponible';
  if (s === 'Faible stock') return 'statut-Faible';
  return 'statut-Rupture';
}

function qtyClass(q) {
  return q === 0 ? 'col-qty-zero' : q <= 3 ? 'col-qty-low' : 'col-qty-ok';
}

function qtyColor(q) {
  return q === 0 ? '#f87171' : q <= 3 ? '#fbbf24' : '#e2e8f0';
}

function showToast(msg, ms = 2500) {
  const t = el('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), ms);
}

function addMouvement(type, article, note = '') {
  const mvt = {
    id: Date.now(),
    date: new Date().toISOString(),
    type,
    note,
    articleId: String(article.id),
    reference: article.reference,
    designation: article.designation,
    quantite: article.quantite,
    par: state.userName || '',
  };
  state.mouvements.push(mvt);
  return mvt;
}

function getLastNote(articleId) {
  const art = state.articles.find(a => String(a.id) === String(articleId));
  return art && art.lastNote && art.lastNote.trim() ? art.lastNote : '—';
}

async function saveNoteInline(id) {
  const art = state.articles.find(r => String(r.id) === String(id));
  if (!art) return;
  const input = el('inlineNoteInput_' + id);
  if (!input) return;
  const note = input.value.trim();
  art.lastNote = note;
  const mvt = addMouvement('MODIFICATION', art, note);
  saveLocal();
  await pushArticle(art);
  await pushMouvement(mvt);
  renderTable();
  showToast('✅ Note enregistrée');
}
window.saveNoteInline = saveNoteInline;

async function saveFicheNote(id) {
  const art = state.articles.find(r => String(r.id) === String(id));
  if (!art) return;
  const input = el('ficheNoteInput');
  if (!input) return;
  const note = input.value.trim();
  art.lastNote = note;
  saveLocal();
  await pushArticle(art);
  const mvt = addMouvement('MODIFICATION', art, note);
  await pushMouvement(mvt);
  showToast('✅ Note enregistrée');
  openFiche(id);
}
window.saveFicheNote = saveFicheNote;

function showUserModal() {
  const modal = el('userModal');
  if (modal) modal.classList.remove('hidden');
  const input = el('userNameInput');
  if (input) setTimeout(() => input.focus(), 100);
}

function updateUserBadge() {
  const badge = el('userBadge');
  if (!badge) return;
  if (!state.userName) { badge.classList.add('hidden'); return; }
  badge.classList.remove('hidden');
  badge.innerHTML = `<div class="user-avatar">${state.userName.charAt(0).toUpperCase()}</div><span>${state.userName}</span>`;
}

function startApp() {
  updateUserBadge();
  render();
  if (state.scriptUrl) syncFromSheets();
  setInterval(() => { if (state.scriptUrl) syncFromSheets(); }, 30000);
}

function confirmUser() {
  const input = el('userNameInput');
  const err = el('userError');
  if (!input) return;
  const name = input.value.trim();
  if (!name) { if (err) err.style.display = 'block'; return; }
  state.userName = name;
  saveLocal();
  const modal = el('userModal');
  if (modal) modal.classList.add('hidden');
  startApp();
}

function openAdd() {
  state.editingId = null;
  const title = el('modalTitle');
  const form = el('articleForm');
  const overlay = el('modalOverlay');
  if (title) title.textContent = 'NOUVEL ARTICLE';
  if (form) form.reset();
  if (form?.elements?.dateEntree) form.elements.dateEntree.value = today();
  if (overlay) overlay.classList.remove('hidden');
}

function closeModal() {
  const overlay = el('modalOverlay');
  if (overlay) overlay.classList.add('hidden');
  state.editingId = null;
}

function openFiche(id) {
  const art = state.articles.find(r => String(r.id) === String(id));
  if (!art) return;
  const modal = el('ficheModal');
  if (!modal) return;
  modal.dataset.artId = String(art.id);
  modal.classList.remove('hidden');
}
function filteredArticles() {
  let d = [...state.articles];
  const q = state.search.toLowerCase().trim();
  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    d = d.filter(r => {
      const fields = [
        r.reference, r.designation, r.forme, r.dimensions,
        r.fournisseur, r.localisation, r.statut
      ].join(' ').toLowerCase();
      return words.every(word => {
        if (/^\d/.test(word)) {
          const re = new RegExp(`(^|[^\\d])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\d]|$)`, 'i');
          return re.test(fields);
        }
        return fields.includes(word);
      });
    });
  }
  if (state.filtreStatut) d = d.filter(r => r.statut === state.filtreStatut);
  if (state.filtreFormes) d = d.filter(r => r.forme === state.filtreFormes);
  d.sort((a, b) => {
    let va = a[state.sortKey], vb = b[state.sortKey];
    let cmp = 0;
    if (typeof va === 'number' && typeof vb === 'number') {
      cmp = state.sortDir === 'asc' ? va - vb : vb - va;
    } else {
      cmp = state.sortDir === 'asc'
        ? String(va).localeCompare(String(vb), 'fr', { numeric: true, sensitivity: 'base' })
        : String(vb).localeCompare(String(va), 'fr', { numeric: true, sensitivity: 'base' });
    }
    if (cmp === 0) return a.id - b.id;
    return cmp;
  });
  return d;
}

function renderStats() {
  const a = state.articles;
  const val = a.reduce((s, r) => s + (r.quantite * r.prix), 0);
  const host = el('headerStats');
  if (!host) return;
  host.innerHTML = [
    { label: 'ARTICLES', val: a.length, color: '#e2e8f0' },
    { label: 'DISPOS', val: a.filter(r => r.statut === 'Disponible').length, color: '#34d399' },
    { label: 'FAIBLE', val: a.filter(r => r.statut === 'Faible stock').length, color: '#fbbf24' },
    { label: 'RUPTURES', val: a.filter(r => r.statut === 'Rupture').length, color: '#f87171' },
    { label: 'VALEUR', val: fmt(val) + ' €', color: '#60a5fa' },
  ].map(c => `<div class="stat-chip"><div class="stat-value" style="color:${c.color}">${c.val}</div><div class="stat-label">${c.label}</div></div>`).join('');
}

function renderTable() {
  const rows = filteredArticles();
  const body = el('tableBody');
  const count = el('tableCount');
  if (!body) return;

  body.innerHTML = rows.map(r => `
    <tr data-id="${r.id}" ondblclick="openFiche(${r.id})" onclick="selectRow(${r.id}, event)" style="cursor:pointer" class="table-row ${state.selectedIds.includes(r.id) ? 'row-selected' : ''}">
      <td><input type="checkbox" class="row-cb" data-id="${r.id}" ${state.selectedIds.includes(r.id) ? 'checked' : ''} onclick="event.stopPropagation()"></td>
      <td>${r.designation}</td>
      <td style="color:${r.reference.toUpperCase().includes('S355') ? '#f87171' : r.reference.toUpperCase().includes('S235') ? '#60a5fa' : 'inherit'}">${r.reference}</td>
      <td>${r.forme}</td>
      <td style="color:var(--text-muted)">${r.dimensions}</td>
      <td class="${qtyClass(r.quantite)}">${r.quantite}</td>
      <td style="color:var(--text-muted)">${r.localisation}</td>
      <td>${r.fournisseur}</td>
      <td style="color:var(--text-muted)">${fmtDate(r.dateEntree)}</td>
      <td class="col-prix">${fmt(r.prix)}</td>
      <td><span class="statut-badge ${statutClass(r.statut)}">${r.statut}</span></td>
      <td style="color:var(--text-muted)">${r.unite}</td>
      <td style="font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${getLastNote(r.id)}">${getLastNote(r.id)}</td>
      <td style="font-size:11px;color:${r.creePar ? 'var(--orange)' : 'var(--text-muted)'};white-space:nowrap">${r.creePar || ''}</td>
      <td style="font-size:11px;color:${r.modifiePar ? 'var(--orange)' : 'var(--text-muted)'};white-space:nowrap">${r.modifiePar || ''}<br><span style="font-size:9px;color:var(--text-muted)">${fmtDate(r.dateModif)}</span></td>
      <td style="white-space:nowrap">
        <button class="btn-icon" onclick="openEdit(${r.id})">✏️</button>
        <button class="btn-icon" style="color:#f87171" onclick="deleteArticle(${r.id})">🗑️</button>
      </td>
    </tr>
  `).join('');

  if (count) count.textContent = `${rows.length} / ${state.articles.length} articles`;
  renderCards(rows);
  renderDeleteBtn();
  updateSelectAll();
}

function renderCards(rows) {
  const host = el('mobileCards');
  if (!host) return;
  host.innerHTML = rows.map(r => `
    <div class="stock-card ${r.statut === 'Rupture' ? 'rupture' : r.statut === 'Faible stock' ? 'low' : ''}">
      <div class="stock-card-top">
        <div class="stock-card-designation">${r.designation}</div>
        <div class="stock-card-ref">${r.reference}</div>
        <div class="stock-card-dims">${r.forme} · ${r.dimensions}</div>
        <span class="statut-badge ${statutClass(r.statut)}">${r.statut}</span>
      </div>
      <div class="stock-card-qty" style="color:${qtyColor(r.quantite)}">${r.quantite}</div>
      <div style="font-size:10px;color:var(--text-muted);text-align:right">${r.unite}</div>
      <div class="stock-card-row"><div class="stock-card-field"><b>Loc.</b> ${r.localisation}</div></div>
      <div class="stock-card-row"><div class="stock-card-field"><b>Fourn.</b> ${r.fournisseur}</div></div>
      <div class="stock-card-row"><div class="stock-card-field" style="color:#60a5fa"><b>Prix</b> ${fmt(r.prix)} €</div></div>
      <div class="stock-card-row"><div class="stock-card-field"><b>Date</b> ${fmtDate(r.dateEntree)}</div></div>
      ${getLastNote(r.id) !== '—' ? `<div style="font-size:11px;color:var(--text-muted);padding:6px 0;border-top:1px solid var(--bg3);margin-top:4px">${getLastNote(r.id)}</div>` : ''}
      <div style="display:flex;gap:10px;font-size:10px;color:var(--orange);padding:4px 0;border-top:1px solid var(--bg3);margin-top:4px;flex-wrap:wrap">
        ${r.creePar ? `<span>Créé par <b>${r.creePar}</b></span>` : ''}
        ${r.modifiePar ? `<span>Modifié par <b>${r.modifiePar}</b></span>` : ''}
      </div>
      <div class="stock-card-actions">
        <button class="btn-secondary" onclick="openFiche(${r.id})">Fiche</button>
        <button class="btn-secondary" onclick="openEdit(${r.id})">Modifier</button>
        <button class="btn-danger" onclick="deleteArticle(${r.id})">Supprimer</button>
      </div>
    </div>
  `).join('');
}

function renderAnalyses() {
  const a = state.articles;
  const byForme = {};
  a.forEach(r => {
    const key = String(r.forme || '').trim();
    byForme[key] = (byForme[key] || 0) + (r.quantite || 0);
  });
  const fe = Object.entries(byForme).sort((x, y) => y[1] - x[1]);
  const maxF = Math.max(...fe.map(x => x[1]), 1);
  const hf = el('chartFormes');
  if (hf) {
    hf.innerHTML = fe.length
      ? fe.map(([f, v]) => `<div class="bar-row"><div class="bar-label"><span>${f}</span><strong>${v}</strong></div><div class="bar-track"><div class="bar-fill bar-orange" style="width:${v / maxF * 100}%"></div></div></div>`).join('')
      : `<div class="empty-state">Aucune donnée</div>`;
  }

  const byF = {};
  const fournNorm = {};
  a.forEach(r => {
    const key = String(r.fournisseur || '').trim().toLowerCase();
    const display = String(r.fournisseur || '').trim();
    if (!fournNorm[key]) fournNorm[key] = display;
    byF[key] = (byF[key] || 0) + (r.quantite || 0) * (r.prix || 0);
  });
  const fne = Object.entries(byF).sort((x, y) => y[1] - x[1]);
  const maxV = Math.max(...fne.map(x => x[1]), 1);
  const hf2 = el('chartFourn');
  if (hf2) {
    hf2.innerHTML = fne.length
      ? fne.map(([k, v]) => `<div class="bar-row"><div class="bar-label"><span>${fournNorm[k]}</span><strong>${fmt(v)} €</strong></div><div class="bar-track"><div class="bar-fill bar-blue" style="width:${v / maxV * 100}%"></div></div></div>`).join('')
      : `<div class="empty-state">Aucune donnée</div>`;
  }

  const alertes = a.filter(r => r.statut !== 'Disponible');
  const ha = el('alertes');
  if (ha) {
    ha.innerHTML = alertes.length
      ? `<div class="alert-grid">${alertes.map(r => `<div class="alert-card" style="border-left:3px solid ${qtyColor(r.quantite)}"><div class="alert-info"><div class="ref">${r.reference}</div><div class="sub">${r.designation}</div><div class="sub">${r.localisation} · ${r.fournisseur}</div><span class="statut-badge ${statutClass(r.statut)}" style="margin-top:4px;display:inline-block">${r.statut}</span></div><div class="alert-qty" style="color:${qtyColor(r.quantite)}">${r.quantite}</div></div>`).join('')}</div>`
      : `<div class="empty-state" style="color:#34d399">Aucune alerte, tout le stock est disponible</div>`;
  }
}

function renderMouvements() {
  const mvts = [...state.mouvements].reverse();
  const body = el('mvtBody');
  const none = el('noMvt');
  if (none) none.classList.toggle('hidden', mvts.length > 0);
  if (!body) return;
  body.innerHTML = mvts.map(m => `
    <tr>
      <td style="color:var(--text-muted)">${fmtDate(m.date)}</td>
      <td><span class="statut-badge ${m.type === 'AJOUT' ? 'statut-Disponible' : m.type === 'SUPPRESSION' ? 'statut-Rupture' : 'statut-Faible'}">${m.type}</span></td>
      <td><b>${m.reference}</b></td>
      <td>${m.designation}</td>
      <td class="${qtyClass(m.quantite)}">${m.quantite}</td>
      <td style="color:var(--text-muted)">${m.note || ''}</td>
      <td><span style="background:var(--bg3);border-radius:20px;padding:2px 8px;font-size:10px;color:var(--orange)">${m.par && String(m.par).trim() ? m.par : 'Inconnu'}</span></td>
    </tr>
  `).join('');
}

function renderDeleteBtn() {
  const btn = el('btnDeleteSelected');
  if (!btn) return;
  btn.classList.toggle('hidden', state.selectedIds.length === 0);
  if (state.selectedIds.length) btn.textContent = `Supprimer ${state.selectedIds.length}`;
}

function updateSelectAll() {
  const cb = el('selectAll');
  if (!cb) return;
  const visible = filteredArticles().map(r => r.id);
  cb.checked = visible.length > 0 && visible.every(id => state.selectedIds.includes(id));
  cb.indeterminate = visible.some(id => state.selectedIds.includes(id)) && !cb.checked;
  const countEl = el('selectionCount');
  if (countEl) countEl.textContent = state.selectedIds.length > 0 ? `${state.selectedIds.length} articles sélectionnés` : '';
}

function render() {
  renderStats();
  renderTable();
  renderAnalyses();
  renderMouvements();
  const hasSyncUrl = !!state.scriptUrl;
  const configBanner = el('configBanner');
  if (configBanner) configBanner.classList.toggle('hidden', hasSyncUrl);
}

async function deleteArticle(id) {
  const art = state.articles.find(r => r.id === id);
  if (!art) return;
  if (!confirm(`Supprimer ${art.reference} ${art.designation} ?`)) return;
  state.articles = state.articles.filter(r => r.id !== id);
  state.selectedIds = state.selectedIds.filter(x => x !== id);
  const mvt = addMouvement('SUPPRESSION', art, 'Suppression');
  saveLocal();
  render();
  showToast('Article supprimé');
  await deleteFromSheets(id);
  await pushMouvement(mvt);
}

function openEdit(id) {
  const art = state.articles.find(r => String(r.id) === String(id));
  if (!art) return;
  state.editingId = art.id;
  const title = el('modalTitle');
  const form = el('articleForm');
  const overlay = el('modalOverlay');
  if (title) title.textContent = 'MODIFIER ARTICLE';
  if (!form) return;
  ['reference','designation','forme','dimensions','quantite','unite','prix','fournisseur','localisation','statut','dateEntree'].forEach(k => {
    if (form.elements[k]) form.elements[k].value = art[k] != null ? art[k] : '';
  });
  if (overlay) overlay.classList.remove('hidden');
}

function selectRow(id, event) {
  if (!event || !event.target) return;
  if (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT' || event.target.closest('button')) return;
  const exists = state.selectedIds.includes(id);
  state.selectedIds = exists ? state.selectedIds.filter(x => x !== id) : [...state.selectedIds, id];
  const tr = document.querySelector(`tr[data-id="${id}"]`);
  const cb = document.querySelector(`.row-cb[data-id="${id}"]`);
  if (tr) tr.classList.toggle('row-selected', !exists);
  if (cb) cb.checked = !exists;
  updateSelectionBar();
}

function updateSelectionBar() {
  const bar = el('selectionBar');
  const btn = el('btnDeleteSelected');
  const count = state.selectedIds.length;
  if (bar) bar.classList.toggle('hidden', count === 0);
  if (btn) btn.classList.toggle('hidden', count === 0);
  const visible = filteredArticles().map(r => r.id);
  const cb = el('selectAll');
  if (cb) {
    cb.checked = visible.length > 0 && visible.every(id => state.selectedIds.includes(id));
    cb.indeterminate = visible.some(id => state.selectedIds.includes(id)) && !cb.checked;
  }
  const countEl = el('selectionCount');
  if (countEl) countEl.textContent = count > 0 ? `${count} articles sélectionnés` : '';
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  if (!form) return;

  const referenceEl = form.elements.reference;
  const designationEl = form.elements.designation;
  const formeEl = form.elements.forme;
  const dimensionsEl = form.elements.dimensions;
  const quantiteEl = form.elements.quantite;
  const uniteEl = form.elements.unite;
  const prixEl = el('prixInput');
  const fournisseurEl = form.elements.fournisseur;
  const localisationEl = form.elements.localisation;
  const statutEl = form.elements.statut;
  const dateEntreeEl = form.elements.dateEntree;
  const noteMvtEl = form.elements.noteMvt;

  if (!referenceEl || !designationEl || !formeEl || !dimensionsEl || !quantiteEl || !uniteEl || !prixEl || !fournisseurEl || !localisationEl || !statutEl || !dateEntreeEl) return;

  const reference = referenceEl.value.trim();
  const designation = designationEl.value.trim();
  const forme = formeEl.value;
  const dimensions = dimensionsEl.value.trim();
  const quantite = parseFloat(quantiteEl.value || 0);
  const unite = uniteEl.value;
  const prix = parseFloat(prixEl.value || 0);
  const fournisseur = fournisseurEl.value.trim();
  const localisation = localisationEl.value.trim();
  const statut = statutEl.value;
  const dateEntree = dateEntreeEl.value || today();
  const noteMvt = noteMvtEl ? noteMvtEl.value.trim() : '';

  let article;
  if (state.editingId) {
    article = state.articles.find(r => r.id === state.editingId);
    if (!article) return;
    Object.assign(article, { reference, designation, forme, dimensions, quantite, unite, prix, fournisseur, localisation, statut, modifiePar: state.userName, dateModif: new Date().toISOString() });
    showToast('Article mis à jour');
  } else {
    article = { id: uid(), reference, designation, forme, dimensions, quantite, unite, prix, fournisseur, localisation, statut, dateEntree, creePar: state.userName, modifiePar: '', dateModif: '', lastNote: '' };
    state.articles.push(article);
    showToast('Article ajouté');
  }

  if (noteMvt) article.lastNote = noteMvt;
  const mvt = addMouvement(state.editingId ? 'MODIFICATION' : 'AJOUT', article, noteMvt);
  saveLocal();
  closeModal();
  render();
  await pushArticle(article);
  await pushMouvement(mvt);
}

function openSheetModal() {
  const modal = el('sheetModal');
  const input = el('scriptUrlInput');
  if (modal) modal.classList.remove('hidden');
  if (input) input.value = state.scriptUrl || '';
}

async function connectSheets() {
  const input = el('scriptUrlInput');
  if (!input) return;
  const url = input.value.trim();
  if (!url.startsWith('https://script.google.com')) {
    alert('URL invalide. Elle doit commencer par https://script.google.com');
    return;
  }
  state.scriptUrl = url;
  saveLocal();
  const modal = el('sheetModal');
  if (modal) modal.classList.add('hidden');
  const ok = await initialSync();
  if (ok) showToast('Google Sheets connecté ! Synchronisation active.', 4000);
}

document.addEventListener('DOMContentLoaded', async () => {
  loadLocal();
  const articleId = new URLSearchParams(window.location.search).get('article');
  if (articleId) {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => {
      const art = state.articles.find(r => String(r.id) === String(articleId));
      if (art) openFiche(art.id);
    }, 500);
  }

  const userModal = el('userModal');
  if (!state.userName) {
    if (userModal) userModal.classList.remove('hidden');
  } else {
    startApp();
  }

  const btnConfirmUser = el('btnConfirmUser');
  if (btnConfirmUser) btnConfirmUser.addEventListener('click', confirmUser);

  const userNameInput = el('userNameInput');
  if (userNameInput) userNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmUser(); });

  const userBadge = el('userBadge');
  if (userBadge) userBadge.addEventListener('click', () => {
    const input = el('userNameInput');
    if (input) input.value = state.userName || '';
    if (userModal) userModal.classList.remove('hidden');
  });

  const form = el('articleForm');
  if (form) form.addEventListener('submit', handleFormSubmit);

  const btnAdd = el('btnAdd');
  if (btnAdd) btnAdd.addEventListener('click', openAdd);

  const modalClose = el('modalClose');
  if (modalClose) modalClose.addEventListener('click', closeModal);

  const overlay = el('modalOverlay');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  const btnOpenSheetModal = el('btnOpenSheetModal');
  if (btnOpenSheetModal) btnOpenSheetModal.addEventListener('click', openSheetModal);

  const btnConnectSheets = el('btnConnectSheets');
  if (btnConnectSheets) btnConnectSheets.addEventListener('click', connectSheets);

  const btnSync = el('btnSync');
  if (btnSync) btnSync.addEventListener('click', async () => { state.syncing = false; await syncFromSheets(); showToast('Rechargement depuis Google Sheets...'); });

  const searchInput = el('searchInput');
  if (searchInput) searchInput.addEventListener('input', e => { state.search = e.target.value; renderTable(); });

  const globalSearch = el('globalSearchInput');
  if (globalSearch) globalSearch.addEventListener('input', e => { state.search = e.target.value; const si = el('searchInput'); if (si) si.value = e.target.value; renderTable(); });

  const filtreStatut = el('filtreStatut');
  if (filtreStatut) filtreStatut.addEventListener('change', e => { state.filtreStatut = e.target.value; renderTable(); });

  const filtreFormes = el('filtreFormes');
  if (filtreFormes) filtreFormes.addEventListener('change', e => { state.filtreFormes = e.target.value; renderTable(); });

  const selectAll = el('selectAll');
  if (selectAll) selectAll.addEventListener('change', e => {
    const visible = filteredArticles().map(r => r.id);
    state.selectedIds = e.target.checked ? [...new Set([...state.selectedIds, ...visible])] : state.selectedIds.filter(id => !visible.includes(id));
    renderTable();
    updateSelectionBar();
  });

  const selectAllHeader = el('selectAllHeader');
  if (selectAllHeader) selectAllHeader.addEventListener('change', e => {
    const visible = filteredArticles().map(r => r.id);
    state.selectedIds = e.target.checked ? [...new Set([...state.selectedIds, ...visible])] : state.selectedIds.filter(id => !visible.includes(id));
    renderTable();
    updateSelectionBar();
  });

  const btnDeleteSelected = el('btnDeleteSelected');
  if (btnDeleteSelected) btnDeleteSelected.addEventListener('click', async () => {
    if (!confirm(`Supprimer ${state.selectedIds.length} articles ?`)) return;
    const toDelete = [...state.selectedIds];
    toDelete.forEach(id => {
      const art = state.articles.find(r => r.id === id);
      if (art) addMouvement('SUPPRESSION', art, 'Suppression groupe');
    });
    state.articles = state.articles.filter(r => !toDelete.includes(r.id));
    state.selectedIds = [];
    saveLocal();
    render();
    showToast('Articles supprimés');
    for (const id of toDelete) await deleteFromSheets(id);
  });

  render();
  if (state.scriptUrl) syncFromSheets();
});
function openFiche(id) {
  const art = state.articles.find(r => String(r.id) === String(id));
  if (!art) return;
  const modal = document.getElementById('ficheModal');
  if (!modal) return;
  modal.dataset.artId = String(art.id);
  const title = document.getElementById('ficheTitle');
  if (title) title.textContent = `${art.reference} — ${art.designation}`;
  const qty = document.getElementById('ficheQty');
  if (qty) qty.value = String(art.quantite ?? 0);
  modal.classList.remove('hidden');
}

function closeFiche() {
  const modal = document.getElementById('ficheModal');
  if (modal) modal.classList.add('hidden');
}

function openSheetModal() {
  const modal = document.getElementById('sheetModal');
  const input = document.getElementById('scriptUrlInput');
  if (modal) modal.classList.remove('hidden');
  if (input) input.value = state.scriptUrl || '';
}

async function connectSheets() {
  const input = document.getElementById('scriptUrlInput');
  if (!input) return;
  const url = input.value.trim();
  if (!url.startsWith('https://script.google.com')) {
    alert('URL invalide. Elle doit commencer par https://script.google.com');
    return;
  }
  state.scriptUrl = url;
  saveLocal();
  const modal = document.getElementById('sheetModal');
  if (modal) modal.classList.add('hidden');
  const ok = await initialSync();
  if (ok) showToast('Google Sheets connecté ! Synchronisation active.', 4000);
}

function deleteArticle(id) {
  const art = state.articles.find(r => r.id === id);
  if (!art) return;
  if (!confirm(`Supprimer ${art.reference} ${art.designation} ?`)) return;

  const mvt = addMouvement('SUPPRESSION', art, 'Suppression');
  state.articles = state.articles.filter(r => r.id !== id);
  state.selectedIds = state.selectedIds.filter(x => x !== id);
  saveLocal();
  render();
  showToast('Article supprimé');
  deleteFromSheets(id);
  pushMouvement(mvt);
}

function updateSelectionBar() {
  const bar = document.getElementById('selectionBar');
  const btn = document.getElementById('btnDeleteSelected');
  const count = state.selectedIds.length;

  if (bar) bar.classList.toggle('hidden', count === 0);
  if (btn) btn.classList.toggle('hidden', count === 0);

  const visible = filteredArticles().map(r => r.id);
  const cb = document.getElementById('selectAll');
  if (cb) {
    cb.checked = visible.length > 0 && visible.every(id => state.selectedIds.includes(id));
    cb.indeterminate = visible.some(id => state.selectedIds.includes(id)) && !cb.checked;
  }

  const countEl = document.getElementById('selectionCount');
  if (countEl) countEl.textContent = count > 0 ? `${count} articles sélectionnés` : '';
}

function openAdd() {
  state.editingId = null;
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('articleForm');
  const overlay = document.getElementById('modalOverlay');

  if (title) title.textContent = 'NOUVEL ARTICLE';
  if (form) form.reset();
  if (form?.elements?.dateEntree) form.elements.dateEntree.value = today();
  if (overlay) overlay.classList.remove('hidden');
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.add('hidden');
  state.editingId = null;
}

function selectRow(id, event) {
  if (!event || !event.target) return;
  if (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT' || event.target.closest('button')) return;

  const exists = state.selectedIds.includes(id);
  state.selectedIds = exists ? state.selectedIds.filter(x => x !== id) : [...state.selectedIds, id];

  const tr = document.querySelector(`tr[data-id="${id}"]`);
  const cb = document.querySelector(`.row-cb[data-id="${id}"]`);
  if (tr) tr.classList.toggle('row-selected', !exists);
  if (cb) cb.checked = !exists;

  updateSelectionBar();
}

function renderDeleteBtn() {
  const btn = document.getElementById('btnDeleteSelected');
  if (!btn) return;
  btn.classList.toggle('hidden', state.selectedIds.length === 0);
  if (state.selectedIds.length) btn.textContent = `Supprimer ${state.selectedIds.length}`;
}

function handleGlobalKeys(e) {
  if (e.key === 'Escape') {
    closeModal();
    closeFiche();
    const sheetModal = document.getElementById('sheetModal');
    if (sheetModal) sheetModal.classList.add('hidden');
  }
}

document.addEventListener('keydown', handleGlobalKeys);

document.addEventListener('DOMContentLoaded', async () => {
  loadLocal();

  const params = new URLSearchParams(window.location.search);
  const articleId = params.get('article');
  if (articleId) {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => {
      const art = state.articles.find(r => String(r.id) === String(articleId));
      if (art) openFiche(art.id);
    }, 500);
  }

  const userModal = document.getElementById('userModal');
  if (!state.userName) {
    if (userModal) userModal.classList.remove('hidden');
  } else {
    startApp();
  }

  const btnConfirmUser = document.getElementById('btnConfirmUser');
  if (btnConfirmUser) btnConfirmUser.addEventListener('click', confirmUser);

  const userNameInput = document.getElementById('userNameInput');
  if (userNameInput) userNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmUser();
  });

  const userBadge = document.getElementById('userBadge');
  if (userBadge) userBadge.addEventListener('click', () => {
    const input = document.getElementById('userNameInput');
    if (input) input.value = state.userName || '';
    if (userModal) userModal.classList.remove('hidden');
  });

  const form = document.getElementById('articleForm');
  if (form) form.addEventListener('submit', handleFormSubmit);

  const btnAdd = document.getElementById('btnAdd');
  if (btnAdd) btnAdd.addEventListener('click', openAdd);

  const modalClose = document.getElementById('modalClose');
  if (modalClose) modalClose.addEventListener('click', closeModal);

  const modalOverlay = document.getElementById('modalOverlay');
  if (modalOverlay) modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });

  const ficheModalClose = document.getElementById('ficheModalClose');
  if (ficheModalClose) ficheModalClose.addEventListener('click', closeFiche);

  const sheetModalClose = document.getElementById('sheetModalClose');
  if (sheetModalClose) sheetModalClose.addEventListener('click', () => {
    const modal = document.getElementById('sheetModal');
    if (modal) modal.classList.add('hidden');
  });

  const btnOpenSheetModal = document.getElementById('btnOpenSheetModal');
  if (btnOpenSheetModal) btnOpenSheetModal.addEventListener('click', openSheetModal);

  const btnConnectSheets = document.getElementById('btnConnectSheets');
  if (btnConnectSheets) btnConnectSheets.addEventListener('click', connectSheets);

  const btnSync = document.getElementById('btnSync');
  if (btnSync) btnSync.addEventListener('click', async () => {
    state.syncing = false;
    await syncFromSheets();
    showToast('Rechargement depuis Google Sheets...');
  });

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.addEventListener('input', e => {
    state.search = e.target.value;
    renderTable();
  });

  const globalSearch = document.getElementById('globalSearchInput');
  if (globalSearch) globalSearch.addEventListener('input', e => {
    state.search = e.target.value;
    const si = document.getElementById('searchInput');
    if (si) si.value = e.target.value;
    renderTable();
  });

  const filtreStatut = document.getElementById('filtreStatut');
  if (filtreStatut) filtreStatut.addEventListener('change', e => {
    state.filtreStatut = e.target.value;
    renderTable();
  });

  const filtreFormes = document.getElementById('filtreFormes');
  if (filtreFormes) filtreFormes.addEventListener('change', e => {
    state.filtreFormes = e.target.value;
    renderTable();
  });

  const selectAll = document.getElementById('selectAll');
  if (selectAll) selectAll.addEventListener('change', e => {
    const visible = filteredArticles().map(r => r.id);
    state.selectedIds = e.target.checked
      ? [...new Set([...state.selectedIds, ...visible])]
      : state.selectedIds.filter(id => !visible.includes(id));
    renderTable();
    updateSelectionBar();
  });

  const selectAllHeader = document.getElementById('selectAllHeader');
  if (selectAllHeader) selectAllHeader.addEventListener('change', e => {
    const visible = filteredArticles().map(r => r.id);
    state.selectedIds = e.target.checked
      ? [...new Set([...state.selectedIds, ...visible])]
      : state.selectedIds.filter(id => !visible.includes(id));
    renderTable();
    updateSelectionBar();
  });

  const btnDeleteSelected = document.getElementById('btnDeleteSelected');
  if (btnDeleteSelected) btnDeleteSelected.addEventListener('click', async () => {
    if (!confirm(`Supprimer ${state.selectedIds.length} articles ?`)) return;
    const toDelete = [...state.selectedIds];
    toDelete.forEach(id => {
      const art = state.articles.find(r => r.id === id);
      if (art) addMouvement('SUPPRESSION', art, 'Suppression groupe');
    });
    state.articles = state.articles.filter(r => !toDelete.includes(r.id));
    state.selectedIds = [];
    saveLocal();
    render();
    showToast('Articles supprimés');
    for (const id of toDelete) await deleteFromSheets(id);
  });

  render();
  if (state.scriptUrl) syncFromSheets();
});
