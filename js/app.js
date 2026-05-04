'use strict';

// ============================================================
//  DONNÉES PAR DÉFAUT
// ============================================================
const DEFAULT_DATA = [
  { id:1, reference:"S235JR", designation:"Acier de construction", forme:"Plat", dimensions:"200x10x6000", quantite:15, unite:"barre", prix:85.50, fournisseur:"ArcelorMittal", localisation:"A1-01", statut:"Disponible", dateEntree:"2025-01-10" },
  { id:2, reference:"S355J2", designation:"Acier HLE", forme:"UPN", dimensions:"UPN120x6000", quantite:8, unite:"barre", prix:142.00, fournisseur:"Aperam", localisation:"A1-02", statut:"Disponible", dateEntree:"2025-01-15" },
  { id:3, reference:"304L", designation:"Inox austénitique", forme:"Tôle", dimensions:"1500x3000x3", quantite:4, unite:"tôle", prix:520.00, fournisseur:"Outokumpu", localisation:"B2-01", statut:"Disponible", dateEntree:"2025-01-20" },
  { id:4, reference:"42CrMo4", designation:"Acier allié trempé", forme:"Rond", dimensions:"Ø60x3000", quantite:2, unite:"barre", prix:210.00, fournisseur:"Ovako", localisation:"C1-05", statut:"Faible stock", dateEntree:"2024-12-01" },
  { id:5, reference:"S235JR", designation:"Acier de construction", forme:"Cornière", dimensions:"L50x50x5x6000", quantite:20, unite:"barre", prix:48.00, fournisseur:"ArcelorMittal", localisation:"A2-03", statut:"Disponible", dateEntree:"2025-02-01" },
  { id:6, reference:"316L", designation:"Inox résistant", forme:"Tube", dimensions:"Ø76.1x3x6000", quantite:0, unite:"barre", prix:385.00, fournisseur:"Sandvik", localisation:"B3-02", statut:"Rupture", dateEntree:"2024-11-15" },
  { id:7, reference:"S275JR", designation:"Acier de construction", forme:"IPE", dimensions:"IPE200x6000", quantite:12, unite:"barre", prix:195.00, fournisseur:"Tata Steel", localisation:"A3-01", statut:"Disponible", dateEntree:"2025-01-28" },
  { id:8, reference:"C45E", designation:"Acier mi-dur", forme:"Carré", dimensions:"50x50x3000", quantite:3, unite:"barre", prix:165.00, fournisseur:"voestalpine", localisation:"C2-08", statut:"Faible stock", dateEntree:"2024-12-20" },
];

// ============================================================
//  STATE
// ============================================================
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
  userName: '',   // Prénom de l'utilisateur connecté
};

// ============================================================
//  PERSISTENCE LOCALE
// ============================================================
function saveLocal() {
  try {
    localStorage.setItem('ss_articles', JSON.stringify(state.articles));
    localStorage.setItem('ss_mouvements', JSON.stringify(state.mouvements));
    localStorage.setItem('ss_nextId', String(state.nextId));
    localStorage.setItem('ss_scriptUrl', state.scriptUrl || '');
    localStorage.setItem('ss_userName', state.userName || '');
  } catch(e) {}
}

function loadLocal() {
  try {
    const a = localStorage.getItem('ss_articles');
    const m = localStorage.getItem('ss_mouvements');
    const n = localStorage.getItem('ss_nextId');
    const u = localStorage.getItem('ss_scriptUrl');
    state.articles   = a ? JSON.parse(a) : JSON.parse(JSON.stringify(DEFAULT_DATA));
    state.mouvements = m ? JSON.parse(m) : [];
    state.nextId     = n ? parseInt(n) : 9;
    state.scriptUrl  = u || '';
    state.userName   = localStorage.getItem('ss_userName') || '';
  } catch(e) {
    state.articles = JSON.parse(JSON.stringify(DEFAULT_DATA));
    state.mouvements = [];
    state.nextId = 9;
  }
}

// ============================================================
//  GOOGLE SHEETS SYNC
// ============================================================
function setSyncBadge(status, msg) {
  const b = document.getElementById('syncBadge');
  b.className = 'sync-badge';
  if (status === 'hidden') { b.classList.add('hidden'); return; }
  b.classList.remove('hidden');
  if (status === 'ok')    { b.classList.add('sync-ok');  b.innerHTML = '✅ Synchronisé avec Google Sheets — modif visibles sur tous les appareils'; }
  if (status === 'wait')  { b.classList.add('sync-wait','sync-pulse'); b.innerHTML = '🔄 ' + (msg || 'Synchronisation...'); }
  if (status === 'error') { b.classList.add('sync-error'); b.innerHTML = '❌ ' + (msg || 'Erreur de synchronisation'); }
}

async function sheetRequest(action, payload = {}) {
  if (!state.scriptUrl) return null;
  try {
    const url = state.scriptUrl + '?action=' + action + '&t=' + Date.now();
    const resp = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    return json;
  } catch(e) {
    console.error('Sheet error:', e);
    return null;
  }
}

// Récupérer toutes les données depuis Sheets
async function syncFromSheets() {
  if (!state.scriptUrl || state.syncing) return;
  state.syncing = true;
  setSyncBadge('wait', 'Récupération depuis Google Sheets...');
  try {
    const res = await sheetRequest('getAll');
    if (res && res.ok) {
      if (res.articles && res.articles.length > 0) {
        // Fusion intelligente : Sheets + local, jamais écraser par vide
        const localMap = {};
        state.articles.forEach(a => { localMap[String(a.id)] = a; });

        state.articles = res.articles.map(a => {
          const id    = parseInt(a.id) || a.id;
          const local = localMap[String(id)] || {};
          // Fonction helper : prendre la valeur non-vide en priorité Sheets puis local
          const best = (sheetVal, localVal) => {
            const s = String(sheetVal || '').trim();
            const l = String(localVal || '').trim();
            return s || l || '';
          };
          return {
            ...local,   // base = local (contient lastNote etc)
            ...a,       // écrase avec Sheets (source de vérité pour stock)
            id,
            quantite:   parseFloat(String(a.quantite).replace(',','.').trim()) || 0,
            prix:       parseFloat(a.prix) || 0,
            // Ces champs ne sont JAMAIS écrasés par une valeur vide
            creePar:    best(a.creePar,    local.creePar),
            modifiePar: best(a.modifiePar, local.modifiePar),
            dateModif:  best(a.dateModif,  local.dateModif),
            dateEntree: best(a.dateEntree, local.dateEntree),
            lastNote:   best(a.lastNote,   local.lastNote),
          };
        });
        saveLocal();
        const maxId = Math.max(...state.articles.map(a => parseInt(a.id)||0), 0);
        if (maxId >= state.nextId) state.nextId = maxId + 1;
      }
      if (res.mouvements) {
        state.mouvements = res.mouvements;
      }
      saveLocal();
      render();
      setSyncBadge('ok');
    } else {
      setSyncBadge('error', 'Impossible de lire Google Sheets');
    }
  } catch(e) {
    setSyncBadge('error', 'Erreur réseau');
  }
  state.syncing = false;
}

// Envoyer un article vers Sheets (ajout ou modif)
async function pushArticle(article) {
  if (!state.scriptUrl) return;
  setSyncBadge('wait', 'Sauvegarde dans Google Sheets...');
  const res = await sheetRequest('saveArticle', { article });
  if (res && res.ok) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2,'0');
      const mm = String(now.getMinutes()).padStart(2,'0');
      setSyncBadge('ok', '✅ Synchronisé à ' + hh + ':' + mm + ' — modif visibles sur tous les appareils');
    }
  else setSyncBadge('error', 'Sauvegarde échouée — données locales conservées');
}

// Supprimer un article dans Sheets
async function deleteFromSheets(id) {
  if (!state.scriptUrl) return;
  setSyncBadge('wait', 'Suppression dans Google Sheets...');
  const res = await sheetRequest('deleteArticle', { id });
  if (res && res.ok) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2,'0');
      const mm = String(now.getMinutes()).padStart(2,'0');
      setSyncBadge('ok', '✅ Synchronisé à ' + hh + ':' + mm + ' — modif visibles sur tous les appareils');
    }
  else setSyncBadge('error', 'Suppression échouée dans Sheets');
}

// Enregistrer un mouvement dans Sheets
async function pushMouvement(mvt) {
  if (!state.scriptUrl) return;
  await sheetRequest('saveMouvement', { mouvement: mvt });
}

// Connexion initiale : envoyer les données locales vers Sheets si Sheets est vide
async function initialSync() {
  setSyncBadge('wait', 'Connexion à Google Sheets...');
  const res = await sheetRequest('getAll');
  if (!res) { setSyncBadge('error', 'URL incorrecte ou non autorisée'); return false; }
  if (!res.ok) { setSyncBadge('error', res.error || 'Erreur Sheets'); return false; }

  if (res.articles && res.articles.length > 0) {
    // Sheets a déjà des données → on les prend
    state.articles = res.articles.map(a => ({
      ...a, id: parseInt(a.id)||a.id,
      quantite: parseFloat(String(a.quantite||'0').replace(',','.').trim())||0, prix: parseFloat(String(a.prix||'0').replace(',','.').trim())||0,
    }));
    state.mouvements = res.mouvements || [];
    const maxId = Math.max(...state.articles.map(a => parseInt(a.id)||0), 0);
    if (maxId >= state.nextId) state.nextId = maxId + 1;
    setSyncBadge('ok');
  } else {
    // Sheets est vide → on envoie les données locales
    setSyncBadge('wait', 'Envoi des données vers Google Sheets...');
    const pushRes = await sheetRequest('replaceAll', {
      articles: state.articles,
      mouvements: state.mouvements,
    });
    if (pushRes && pushRes.ok) setSyncBadge('ok');
    else { setSyncBadge('error', 'Envoi échoué'); return false; }
  }
  saveLocal();
  render();
  return true;
}

// ============================================================
//  HELPERS
// ============================================================
function fmt(n) { return Number(n).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}); }


async function saveNoteInline(id) {
  const art = state.articles.find(r => String(r.id) === String(id));
  if (!art) return;
  const input = document.getElementById('inlineNoteInput_' + id);
  if (!input) return;
  const note = input.value.trim();
  // Stocker la note directement dans l'article pour éviter le problème de référence
  art.lastNote = note;
  const mvt = addMouvement('MODIFICATION', art, note);
  saveLocal();
  pushArticle(art);
  pushMouvement(mvt);
  renderTable();
  showToast('✅ Note enregistrée');
}
window.saveNoteInline = saveNoteInline;

async function saveFicheNote(id) {
  const art = state.articles.find(r => String(r.id) === String(id));
  if (!art) return;
  const input = document.getElementById('ficheNoteInput');
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

function getLastNote(articleId) {
  const art = state.articles.find(a => String(a.id) === String(articleId));
  if (!art) return '—';
  // Uniquement depuis le champ lastNote de l'article
  return art.lastNote && art.lastNote.trim() ? art.lastNote : '—';
}

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—'; }
function today() { return new Date().toISOString().split('T')[0]; }
function uid() { return state.nextId++; }

function statutClass(s) {
  if (s === 'Disponible') return 'statut-Disponible';
  if (s === 'Faible stock') return 'statut-Faible';
  return 'statut-Rupture';
}
function qtyClass(q) { return q === 0 ? 'col-qty-zero' : q <= 3 ? 'col-qty-low' : 'col-qty-ok'; }
function qtyColor(q) { return q === 0 ? '#f87171' : q <= 3 ? '#fbbf24' : '#e2e8f0'; }

function showToast(msg, ms=2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), ms);
}

function addMouvement(type, article, note='') {
  const mvt = {
    id: Date.now(),
    date: new Date().toISOString(),
    type, note,
    articleId: String(article.id),
    reference: article.reference,
    designation: article.designation,
    quantite: article.quantite,
    par: state.userName || '',
  };
  state.mouvements.push(mvt);
  return mvt;
}

// ============================================================
//  STATS HEADER
// ============================================================
function renderStats() {
  const a = state.articles;
  const val = a.reduce((s, r) => s + r.quantite * r.prix, 0);
  document.getElementById('headerStats').innerHTML = [
    { label:'ARTICLES', val:a.length, color:'#e2e8f0' },
    { label:'DISPOS', val:a.filter(r=>r.statut==='Disponible').length, color:'#34d399' },
    { label:'FAIBLE', val:a.filter(r=>r.statut==='Faible stock').length, color:'#fbbf24' },
    { label:'RUPTURES', val:a.filter(r=>r.statut==='Rupture').length, color:'#f87171' },
    { label:'VALEUR', val:fmt(val)+' €', color:'#60a5fa' },
  ].map(c => `<div class="stat-chip"><div class="stat-value" style="color:${c.color}">${c.val}</div><div class="stat-label">${c.label}</div></div>`).join('');
}

// ============================================================
//  FILTRE / TRI
// ============================================================
function filteredArticles() {
  let d = [...state.articles];
  const q = state.search.toLowerCase();
  if (q) {
    // Recherche intelligente : chaque mot doit matcher séparément
    // Pour les dimensions (ex: "2mm"), on cherche un mot entier avec séparateur
    const words = q.split(/\s+/).filter(Boolean);
    d = d.filter(r => {
      const fields = [r.reference,r.designation,r.forme,r.dimensions,r.fournisseur,r.localisation,r.statut].join(' ').toLowerCase();
      return words.every(word => {
        // Si le mot commence par un chiffre (ex: "2mm", "12", "200"), chercher avec frontière de mot
        if (/^\d/.test(word)) {
          // Chercher précédé d'un non-chiffre ou début, suivi d'un non-chiffre ou fin
          const re = new RegExp('(^|[^\\d])' + word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '($|[^\\d])');
          return re.test(fields);
        }
        return fields.includes(word);
      });
    });
  }
  if (state.filtreStatut) d = d.filter(r => r.statut === state.filtreStatut);
  if (state.filtreFormes) d = d.filter(r => r.forme === state.filtreFormes);
  d.sort((a,b) => {
    let va=a[state.sortKey], vb=b[state.sortKey];
    let cmp;
    if (typeof va==='number' && typeof vb==='number') {
      cmp = state.sortDir==='asc' ? va-vb : vb-va;
    } else {
      // Tri naturel pour les chaînes contenant des chiffres (ex: 2mm, 3mm, 10mm, 12mm)
      cmp = state.sortDir==='asc'
        ? String(va).localeCompare(String(vb), 'fr', {numeric:true, sensitivity:'base'})
        : String(vb).localeCompare(String(va), 'fr', {numeric:true, sensitivity:'base'});
    }
    // Tri secondaire stable par id pour éviter les mélanges
    if (cmp === 0) return a.id - b.id;
    return cmp;
  });
  return d;
}

// ============================================================
//  RENDER TABLE
// ============================================================
function renderTable() {
  const rows = filteredArticles();
  document.getElementById('tableBody').innerHTML = rows.map(r => {
    const sc = statutClass(r.statut);
    const qc = qtyClass(r.quantite);
    const sel = state.selectedIds.includes(r.id);
    return `<tr data-id="${r.id}" 
        ondblclick="openFiche(${r.id})" 
        onclick="selectRow(${r.id}, event)"
        oncontextmenu="event.preventDefault();openFiche(${r.id})"
        style="cursor:pointer;transition:background 0.15s" 
        class="table-row${sel?' row-selected':''}"
        title="Clic pour sélectionner · Double-clic pour la fiche">
      <td><input type="checkbox" class="row-cb" data-id="${r.id}" ${sel?'checked':''} onclick="event.stopPropagation()" /></td>
      <td>${r.designation}</td>
      <td><b style="color:${r.reference&&r.reference.toUpperCase().includes('S355')?'#f87171':r.reference&&r.reference.toUpperCase().includes('S235')?'#60a5fa':'inherit'}">${r.reference}</b></td>
      <td>${r.forme}</td>
      <td style="color:var(--text-muted)">${r.dimensions}</td>
      <td class="${qc}">${r.quantite}</td>
      <td style="color:var(--text-muted)">${r.localisation}</td>
      <td>${r.fournisseur}</td>
      <td style="color:var(--text-muted)">${fmtDate(r.dateEntree)}</td>
      <td class="col-prix">${fmt(r.prix)} €</td>
      <td><span class="statut-badge ${sc}">${r.statut}</span></td>
      <td style="color:var(--text-muted)">${r.unite}</td>
      <td style="color:var(--text-muted);font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${getLastNote(r.id)}">${getLastNote(r.id)}</td>
      <td style="font-size:11px;color:${r.creePar&&r.creePar.trim()?'var(--orange)':'var(--text-muted)'};white-space:nowrap">${r.creePar&&r.creePar.trim()?r.creePar:'<i>ancien</i>'}</td>
      <td style="font-size:11px;color:${r.modifiePar&&r.modifiePar.trim()?'var(--orange)':'var(--text-muted)'};white-space:nowrap">${r.modifiePar&&r.modifiePar.trim()?r.modifiePar+'<br><span style=\"font-size:9px;color:var(--text-muted)\">'+fmtDate(r.dateModif)+'</span>':'—'}</td>
      <td style="white-space:nowrap">
        <button class="btn-icon" onclick="openEdit(${r.id})">✎</button>
        <button class="btn-icon" style="color:#f87171" onclick="deleteArticle(${r.id})">✕</button>
      </td>
    </tr>`;
  }).join('');

  // Tris indicateurs
  document.querySelectorAll('th[data-sort]').forEach(th => {
    const k = th.dataset.sort;
    const labels = {reference:'Qualité acier',designation:'Désignation',forme:'Forme',quantite:'Qté',prix:'Prix €',fournisseur:'Fournisseur',statut:'Statut',localisation:'Localisation',dateEntree:'Date'};
    th.textContent = (labels[k]||k) + (state.sortKey===k ? (state.sortDir==='asc'?' ↑':' ↓') : ' ↕');
    th.classList.toggle('sorted', state.sortKey===k);
  });

  document.getElementById('tableCount').textContent = `${rows.length} / ${state.articles.length} articles`;
  renderCards(rows);
  renderDeleteBtn();
  updateSelectAll();
}

// ============================================================
//  RENDER CARDS (mobile)
// ============================================================
function renderCards(rows) {
  document.getElementById('mobileCards').innerHTML = rows.map(r => {
    const sc = statutClass(r.statut);
    const cls = r.statut==='Rupture'?'rupture':r.statut==='Faible stock'?'low':'';
    return `<div class="stock-card ${cls}">
      <div class="stock-card-top">
        <div>
          <div class="stock-card-desig">${r.designation}</div>
          <div class="stock-card-ref">${r.reference}</div>
          <div class="stock-card-dims">${r.forme} · ${r.dimensions}</div>
        </div>
        <div>
          <span class="statut-badge ${sc}">${r.statut}</span>
          <div class="stock-card-qty" style="color:${qtyColor(r.quantite)}">${r.quantite}</div>
          <div style="font-size:10px;color:var(--text-muted);text-align:right">${r.unite}</div>
        </div>
      </div>
      <div class="stock-card-row">
        <div class="stock-card-field"><b>Loc. </b>${r.localisation}</div>
        <div class="stock-card-field"><b>Fourn. </b>${r.fournisseur}</div>
        <div class="stock-card-field" style="color:#60a5fa"><b>Prix </b>${fmt(r.prix)} €/${r.unite}</div>
        <div class="stock-card-field"><b>Date </b>${fmtDate(r.dateEntree)}</div>
      </div>
      ${getLastNote(r.id)!=='—' ? '<div style="font-size:11px;color:var(--text-muted);padding:6px 0;border-top:1px solid var(--bg3);margin-top:4px">📝 '+getLastNote(r.id)+'</div>' : ''}
      <div style="display:flex;gap:10px;font-size:10px;color:var(--orange);padding:4px 0;border-top:1px solid var(--bg3);margin-top:4px;flex-wrap:wrap">
        ${r.creePar ? '<span>✦ Créé par <b>'+r.creePar+'</b></span>' : ''}
        ${r.modifiePar ? '<span>· Modifié par <b>'+r.modifiePar+'</b></span>' : ''}
      </div>
      <div class="stock-card-actions">
        <button class="btn-secondary" onclick="openFiche(${r.id})" style="background:var(--bg3)">👁 Fiche</button>
        <button class="btn-secondary" onclick="openEdit(${r.id})">✎ Modifier</button>
        <button class="btn-danger" onclick="deleteArticle(${r.id})">✕ Supprimer</button>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
//  RENDER ANALYSES
// ============================================================
function renderAnalyses() {
  const a = state.articles;
  const byForme = {};
  a.forEach(r => {
    const key = String(r.forme||'').trim();
    byForme[key] = (byForme[key]||0) + r.quantite;
  });
  const fe = Object.entries(byForme).sort((x,y)=>y[1]-x[1]);
  const maxF = Math.max(...fe.map(([,v])=>v),1);
  document.getElementById('chartFormes').innerHTML = fe.map(([f,v])=>
    `<div class="bar-row"><div class="bar-label"><span>${f}</span><strong>${v}</strong></div>
    <div class="bar-track"><div class="bar-fill bar-orange" style="width:${(v/maxF)*100}%"></div></div></div>`
  ).join('') || '<div class="empty-state">Aucune donnée</div>';

  const byF = {};
  const fournNorm = {}; // map normalized key -> display name
  a.forEach(r => {
    const key = String(r.fournisseur||'').trim().toLowerCase();
    const display = String(r.fournisseur||'').trim();
    if (!fournNorm[key]) fournNorm[key] = display;
    byF[key] = (byF[key]||0) + r.quantite*r.prix;
  });
  const fne = Object.entries(byF).sort((x,y)=>y[1]-x[1]);
  const maxV = Math.max(...fne.map(([,v])=>v),1);
  document.getElementById('chartFourn').innerHTML = fne.map(([f,v])=>
    `<div class="bar-row"><div class="bar-label"><span>${fournNorm[f]||f}</span><strong>${fmt(v)} €</strong></div>
    <div class="bar-track"><div class="bar-fill bar-blue" style="width:${(v/maxV)*100}%"></div></div></div>`
  ).join('') || '<div class="empty-state">Aucune donnée</div>';

  const alertes = a.filter(r=>r.statut!=='Disponible');
  document.getElementById('alertes').innerHTML = alertes.length
    ? `<div class="alert-grid">${alertes.map(r=>{
        const sc=statutClass(r.statut);
        const qc=qtyColor(r.quantite);
        return `<div class="alert-card" style="border-left:3px solid ${qc}">
          <div class="alert-info"><div class="ref">${r.reference}</div><div class="sub">${r.designation}</div><div class="sub">${r.localisation} · ${r.fournisseur}</div>
          <span class="statut-badge ${sc}" style="margin-top:4px;display:inline-block">${r.statut}</span></div>
          <div class="alert-qty" style="color:${qc}">${r.quantite}</div></div>`;
      }).join('')}</div>`
    : '<div class="empty-state" style="color:#34d399">✓ Aucune alerte — tout le stock est disponible</div>';
}

// ============================================================
//  RENDER MOUVEMENTS
// ============================================================
function renderMouvements() {
  const mvts = [...state.mouvements].reverse();
  document.getElementById('noMvt').classList.toggle('hidden', mvts.length > 0);
  document.getElementById('mvtBody').innerHTML = mvts.map(m=>
    `<tr>
      <td style="color:var(--text-muted)">${fmtDate(m.date)}</td>
      <td><span class="statut-badge ${m.type==='AJOUT'?'statut-Disponible':m.type==='SUPPRESSION'?'statut-Rupture':'statut-Faible'}">${m.type}</span></td>
      <td><b>${m.reference}</b></td><td>${m.designation}</td>
      <td class="${qtyClass(m.quantite)}">${m.quantite}</td>
      <td style="color:var(--text-muted)">${m.note && String(m.note).trim() ? m.note : '—'}</td>
      <td><span style="background:var(--bg3);border-radius:20px;padding:2px 8px;font-size:10px;color:var(--orange)">${m.par && String(m.par).trim() && m.par!=='Inconnu' ? m.par : '—'}</span></td>
    </tr>`
  ).join('');
}

// ============================================================
//  RENDER ALL
// ============================================================
function render() {
  renderStats();
  renderTable();
  renderAnalyses();
  renderMouvements();
  // Afficher/masquer bannière config
  const hasSyncUrl = !!state.scriptUrl;
  document.getElementById('configBanner').classList.toggle('hidden', hasSyncUrl);
}

// ============================================================
//  CRUD
// ============================================================
async function deleteArticle(id) {
  const art = state.articles.find(r => r.id === id);
  if (!art) return;
  if (!confirm(`Supprimer "${art.reference} — ${art.designation}" ?`)) return;
  state.articles = state.articles.filter(r => r.id !== id);
  state.selectedIds = state.selectedIds.filter(x => x !== id);
  const mvt = addMouvement('SUPPRESSION', art);
  saveLocal();
  render();
  showToast('🗑 Article supprimé');
  await deleteFromSheets(id);
  await pushMouvement(mvt);
}
window.deleteArticle = deleteArticle;

function openEdit(id) {
  // id peut être number ou string selon la source
  const art = state.articles.find(r => String(r.id) === String(id));
  if (!art) return;
  state.editingId = art.id;
  document.getElementById('modalTitle').textContent = 'MODIFIER ARTICLE';
  const form = document.getElementById('articleForm');
  // Remplir chaque champ du formulaire de façon sécurisée
  const champs = ['reference','designation','forme','dimensions','quantite','unite','prix','fournisseur','localisation','statut','dateEntree'];
  champs.forEach(k => {
    const el = form.elements[k];
    if (el) el.value = art[k] !== undefined ? art[k] : '';
  });
  document.getElementById('modalOverlay').classList.remove('hidden');
  // Si le panneau prix marché était ouvert, recalculer automatiquement
  setTimeout(() => {
    // Réinitialiser le panneau marché à chaque ouverture
    document.getElementById('margeRow').style.display = 'none';
    document.getElementById('prixMarcheInfo').textContent = '';
    _prixMarcheBase = null;
  }, 50);
}
window.openEdit = openEdit;

function selectRow(id, event) {
  // Ignorer si on clique sur un bouton ou input
  if (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT' || event.target.closest('button')) return;
  // Toggle sélection
  if (state.selectedIds.includes(id)) {
    state.selectedIds = state.selectedIds.filter(x => x !== id);
  } else {
    state.selectedIds.push(id);
  }
  // Mise à jour visuelle sans re-render complet
  const tr = document.querySelector(`tr[data-id="${id}"]`);
  const cb = document.querySelector(`.row-cb[data-id="${id}"]`);
  if (tr) tr.classList.toggle('row-selected', state.selectedIds.includes(id));
  if (cb) cb.checked = state.selectedIds.includes(id);
  // Mettre à jour barre sélection
  updateSelectionBar();
}
window.selectRow = selectRow;

function updateSelectionBar() {
  const bar  = document.getElementById('selectionBar');
  const btn  = document.getElementById('btnDeleteSelected');
  const count = state.selectedIds.length;
  if (bar) bar.classList.toggle('hidden', count === 0);
  if (btn) {
    btn.classList.toggle('hidden', count === 0);
    if (count) btn.textContent = `✕ Supprimer (${count})`;
  }
  // Mettre à jour selectAll
  const visible = filteredArticles().map(r => r.id);
  const cb = document.getElementById('selectAll');
  if (cb) {
    cb.checked = visible.length > 0 && visible.every(id => state.selectedIds.includes(id));
    cb.indeterminate = visible.some(id => state.selectedIds.includes(id)) && !cb.checked;
  }
  // Mettre à jour label count
  const countEl = document.getElementById('selectionCount');
  if (countEl) countEl.textContent = count > 0 ? `${count} article(s) sélectionné(s)` : '';
}

function openAdd() {
  state.editingId = null;
  document.getElementById('modalTitle').textContent = 'NOUVEL ARTICLE';
  document.getElementById('articleForm').reset();
  document.getElementById('articleForm').dateEntree.value = today();
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  const savedEditingId = state.editingId;
  state.editingId = null;
  // Si la fiche est ouverte pour le même article, la rafraîchir après render
  const ficheModal = document.getElementById('ficheModal');
  if (!ficheModal.classList.contains('hidden')) {
    const artId = ficheModal.dataset.artId;
    if (artId) setTimeout(() => openFiche(parseInt(artId)), 150);
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;

  // Lire tous les champs manuellement pour garantir les bons types
  const noteMvt     = form.elements['noteMvt']?.value || '';
  const reference   = form.elements['reference']?.value.trim() || '';
  const designation = form.elements['designation']?.value.trim() || '';
  const forme       = form.elements['forme']?.value || '';
  const dimensions  = form.elements['dimensions']?.value.trim() || '';
  const quantite    = parseFloat(form.elements['quantite']?.value) || 0;
  const unite       = form.elements['unite']?.value || 'ml';
  // PRIX : toujours lire depuis prixInput (modifié par curseur marché ou saisi manuellement)
  const prix        = parseFloat(document.getElementById('prixInput').value) || 0;
  const fournisseur = form.elements['fournisseur']?.value.trim() || '';
  const localisation= form.elements['localisation']?.value.trim() || '';
  const statut      = form.elements['statut']?.value || 'Disponible';
  const dateEntree  = form.elements['dateEntree']?.value || today();

  let article;
  if (state.editingId) {
    article = state.articles.find(r => r.id === state.editingId);
    if (!article) return;
    // Mettre à jour chaque champ explicitement
    article.reference    = reference;
    article.designation  = designation;
    article.forme        = forme;
    article.dimensions   = dimensions;
    article.quantite     = quantite;
    article.unite        = unite;
    article.prix         = prix;
    article.fournisseur  = fournisseur;
    article.localisation = localisation;
    article.statut       = statut;
    article.modifiePar   = state.userName || '';
    article.dateModif    = new Date().toISOString();
    showToast('✓ Article mis à jour — Prix : ' + prix + ' €');
  } else {
    article = {
      id: uid(), reference, designation, forme, dimensions,
      quantite, unite, prix, fournisseur, localisation, statut,
      dateEntree, creePar: state.userName || '',
      modifiePar: '', dateModif: '', lastNote: '',
    };
    state.articles.push(article);
    showToast('✓ Article ajouté — Prix : ' + prix + ' €');
  }

  if (noteMvt && noteMvt.trim()) {
    article.lastNote = noteMvt.trim();
  }

  const mvt = addMouvement(state.editingId ? 'MODIFICATION' : 'AJOUT', article, noteMvt);
  saveLocal();
  closeModal();
  render();
  await pushArticle(article);
  await pushMouvement(mvt);
}

// ============================================================
//  SELECTION
// ============================================================
function updateSelectAll() {
  const cb = document.getElementById('selectAll');
  if (!cb) return;
  const visible = filteredArticles().map(r=>r.id);
  cb.checked = visible.length>0 && visible.every(id=>state.selectedIds.includes(id));
  cb.indeterminate = visible.some(id=>state.selectedIds.includes(id)) && !cb.checked;
}
function renderDeleteBtn() {
  const btn = document.getElementById('btnDeleteSelected');
  btn.classList.toggle('hidden', state.selectedIds.length===0);
  if (state.selectedIds.length) btn.textContent = `✕ Supprimer (${state.selectedIds.length})`;
}

// ============================================================
//  EXPORT CSV
// ============================================================
function exportCSV(data, filename) {
  const cols = ['reference','designation','forme','dimensions','quantite','unite','prix','fournisseur','localisation','statut','dateEntree'];
  const header = ['Référence','Désignation','Forme','Dimensions','Quantité','Unité','Prix (€)','Fournisseur','Localisation','Statut','Date entrée'];
  const csv = [header.join(';'), ...data.map(r=>cols.map(c=>r[c]).join(';'))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'}));
  a.download = filename; a.click();
}
function exportMvtCSV() {
  const cols = ['date','type','reference','designation','quantite','note'];
  const header = ['Date','Type','Référence','Désignation','Quantité','Note'];
  const csv = [header.join(';'), ...state.mouvements.map(m=>cols.map(c=>c==='date'?fmtDate(m[c]):m[c]).join(';'))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'}));
  a.download = 'mouvements_aciers.csv'; a.click();
}

// ============================================================
//  GOOGLE SHEETS MODAL
// ============================================================
function openSheetModal() {
  document.getElementById('sheetModal').classList.remove('hidden');
  if (state.scriptUrl) document.getElementById('scriptUrlInput').value = state.scriptUrl;
}

async function connectSheets() {
  const url = document.getElementById('scriptUrlInput').value.trim();
  if (!url || !url.startsWith('https://script.google.com')) {
    alert('❌ URL invalide. Elle doit commencer par https://script.google.com');
    return;
  }
  state.scriptUrl = url;
  saveLocal();
  document.getElementById('sheetModal').classList.add('hidden');
  const ok = await initialSync();
  if (ok) showToast('🎉 Google Sheets connecté ! Synchronisation active.', 4000);
}

// ============================================================
//  EVENTS
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  loadLocal();

  // Vérifier si l'app est ouverte via un QR code scanné avec l'iPhone
  const urlParams = new URLSearchParams(window.location.search);
  const articleId = urlParams.get('article');
  if (articleId) {
    // Nettoyer l'URL sans recharger
    window.history.replaceState({}, '', window.location.pathname);
    // Ouvrir la fiche après chargement
    setTimeout(() => {
      const art = state.articles.find(r => String(r.id) === String(articleId));
      if (art) { openFiche(art.id); showToast('✅ Article trouvé : ' + art.reference); }
      else { showToast('❌ Article non trouvé — vérifiez la synchronisation'); }
    }, 800);
  }

  // ---- IDENTIFICATION UTILISATEUR ----
  function showUserModal() {
    document.getElementById('userModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('userNameInput').focus(), 200);
  }

  function updateUserBadge() {
    const badge = document.getElementById('userBadge');
    if (!badge) return;
    if (!state.userName) { badge.classList.add('hidden'); return; }
    badge.classList.remove('hidden');
    const initiale = state.userName.charAt(0).toUpperCase();
    badge.innerHTML = '<div class="user-avatar">' + initiale + '</div> ' + state.userName + ' <span style="color:var(--text-muted);font-size:10px">▾</span>';
    badge.title = 'Cliquer pour changer de prénom';
  }

  function startApp() {
    updateUserBadge();
    render();
    if (state.scriptUrl) {
      syncFromSheets();
      setInterval(syncFromSheets, 30000);
    }
  }

  function confirmUser() {
    const name = document.getElementById('userNameInput').value.trim();
    if (!name) {
      document.getElementById('userError').style.display = 'block';
      return;
    }
    state.userName = name;
    saveLocal();
    document.getElementById('userModal').classList.add('hidden');
    startApp();
  }

  // Attacher les events du modal utilisateur
  document.getElementById('btnConfirmUser').addEventListener('click', confirmUser);
  document.getElementById('userNameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmUser();
    document.getElementById('userError').style.display = 'none';
  });
  document.getElementById('userBadge').addEventListener('click', () => {
    document.getElementById('userNameInput').value = state.userName;
    document.getElementById('userError').style.display = 'none';
    showUserModal();
  });

  // Démarrer ou demander le prénom
  if (!state.userName) {
    showUserModal();
  } else {
    startApp();
  }

  // Tabs
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
    });
  });

  // Recherche & filtres
  document.getElementById('searchInput').addEventListener('input', e => { state.search=e.target.value; renderTable(); });

  // Barre recherche globale header
  const globalSearch = document.getElementById('globalSearchInput');
  if (globalSearch) {
    globalSearch.addEventListener('input', e => {
      state.search = e.target.value;
      const si = document.getElementById('searchInput');
      if (si) si.value = e.target.value;
      renderTable();
      if (e.target.value) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-tab="stock"]').classList.add('active');
        document.getElementById('tab-stock').classList.add('active');
      }
    });
  }

  // Barre recherche QR codes
  const qrSearch = document.getElementById('qrSearchInput');
  if (qrSearch) {
    qrSearch.addEventListener('input', e => {
      state.qrSearch = e.target.value.toLowerCase();
      renderQRTab();
    });
  }
  // Barre recherche Zone
  const planSearch = document.getElementById('planSearch');
  if (planSearch) {
    planSearch.addEventListener('input', e => {
      const q = e.target.value.trim().toUpperCase();
      document.querySelectorAll('.plan-zone').forEach(g => {
        const zone = g.dataset.zone;
        g.style.opacity = (!q || zone.includes(q)) ? '1' : '0.15';
      });
      if (q) {
        const matches = [...document.querySelectorAll('.plan-zone')].filter(g => g.dataset.zone.includes(q));
        if (matches.length === 1) planZoneClick(matches[0].dataset.zone);
      }
    });
  }

  // Barre recherche Article → trouver sa zone et l'allumer
  const planArticleSearch = document.getElementById('planArticleSearch');
  if (planArticleSearch) {
    planArticleSearch.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      // Réinitialiser
      document.querySelectorAll('.plan-zone').forEach(g => { g.style.opacity = '1'; });
      if (!q) return;
      // Trouver les articles qui correspondent
      const matched = state.articles.filter(a =>
        [a.reference, a.designation, a.forme, a.dimensions].join(' ').toLowerCase().includes(q)
      );
      // Extraire leurs zones
      const zones = new Set(matched.map(a => {
        const loc = String(a.localisation || '').trim().toUpperCase();
        return loc.split(/[-_ ]/)[0]; // ex: ZC5-01 → ZC5
      }).filter(Boolean));
      if (zones.size === 0) return;
      // Griser les zones sans articles trouvés
      document.querySelectorAll('.plan-zone').forEach(g => {
        const z = g.dataset.zone;
        const match = [...zones].some(zz => z.toUpperCase() === zz || z.toUpperCase().startsWith(zz));
        g.style.opacity = match ? '1' : '0.1';
      });
      // Si une seule zone → ouvrir popup
      if (zones.size === 1) planZoneClick([...zones][0]);
    });
  }
  document.getElementById('filtreStatut').addEventListener('change', e => { state.filtreStatut=e.target.value; renderTable(); });
  document.getElementById('filtreFormes').addEventListener('change', e => { state.filtreFormes=e.target.value; renderTable(); });

  // Boutons
  document.getElementById('btnAdd').addEventListener('click', openAdd);
  document.getElementById('btnCancel').addEventListener('click', closeModal);

  // ── Livraisons ──
  document.getElementById('btnAddLivraison')?.addEventListener('click', () => openLivraisonForm());
  // btnSaveLivraison handled below
  document.getElementById('btnCancelLivraison')?.addEventListener('click', () => {
    document.getElementById('livraisonForm').classList.add('hidden');
    editingLivraisonId = null;
  });
  document.getElementById('livraisonSearch')?.addEventListener('input', e => renderLivraisons(e.target.value));
  // Bouton prix marché dans le formulaire
  // _prixMarcheBase est déclaré globalement plus bas

  // Recalcule automatiquement le prix depuis les champs du formulaire
  window.autoCalcPrix = function autoCalcPrix() {
    const form = document.getElementById('articleForm');
    const art = {
      reference:  form.elements['reference']?.value  || '',
      forme:      form.elements['forme']?.value       || '',
      dimensions: form.elements['dimensions']?.value  || '',
      quantite:   parseFloat(form.elements['quantite']?.value) || 0,
    };
    // Ne recalculer que si le panneau marché est déjà ouvert
    if (document.getElementById('margeRow').style.display === 'none') return;
    const result = getPrixMarche(art);
    if (result) {
      _prixMarcheBase = result.prix;
      document.getElementById('prixBase').textContent = result.prix.toFixed(2) + ' € / unité';
      applyMarge();
      updatePrixInfo(result);
    }
  };

  function applyMarge() {
    if (_prixMarcheBase === null) return;
    const marge = parseInt(document.getElementById('margeSlider').value) / 100;
    const form  = document.getElementById('articleForm');
    const qte   = parseFloat(form.elements['quantite']?.value) || 0;
    const prixUnitaire = Math.round(_prixMarcheBase * (1 + marge) * 100) / 100;
    // Si qte=0 → on met le prix unitaire (pas 0)
    const prixAffiche  = qte > 0 ? Math.round(prixUnitaire * qte * 100) / 100 : prixUnitaire;
    document.getElementById('prixInput').value = prixAffiche;
    document.getElementById('margeVal').textContent = '+' + Math.round(marge*100) + '%';
    document.getElementById('prixBase').textContent = qte > 0
      ? prixUnitaire.toFixed(2) + ' € / unité × ' + qte
      : prixUnitaire.toFixed(2) + ' € / unité';
  }

  function updatePrixInfo(result) {
    const infoEl = document.getElementById('prixMarcheInfo');
    const qualiteInfo = result.coeffQualite !== 1.00
      ? ` · <span style="color:#60a5fa">${result.nuance} ×${result.coeffQualite}</span>`
      : ` · <span style="color:var(--text-muted)">Standard</span>`;
    const marge = parseInt(document.getElementById('margeSlider').value) / 100;
    const prixAvecMarge = Math.round(result.prix * (1 + marge) * result.qte * 100) / 100;
    const qteInfo = result.qte > 1
      ? ` · <b style="color:#34d399">${result.qte} pcs = ${result.poidsTotal} kg = ${prixAvecMarge} €</b>`
      : ` · ${result.poids} kg`;
    infoEl.innerHTML = `📈 <b>${result.indice}</b> ${result.prixTonneBase}→${result.prixTonne} €/t${qualiteInfo}${qteInfo}`;
    infoEl.style.color = 'var(--orange)';
  }

  document.getElementById('margeSlider').addEventListener('input', () => {
    applyMarge();
    // Mettre à jour aussi le total affiché
    const form = document.getElementById('articleForm');
    const art = {
      reference:  form.elements['reference']?.value  || '',
      forme:      form.elements['forme']?.value       || '',
      dimensions: form.elements['dimensions']?.value  || '',
      quantite:   parseFloat(form.elements['quantite']?.value) || 0,
    };
    const result = getPrixMarche(art);
    if (result) updatePrixInfo(result);
  });

  // Recalcul auto quand on change référence, forme, dimensions ou quantité
  // Hint dynamique sur les dimensions selon la forme choisie
  const DIMS_HINTS = {
    'IPE':'hauteur x long (ex: 200x6000)', 'IPN':'hauteur x long (ex: 200x6000)',
    'HEA':'hauteur x long (ex: 200x6000)', 'HEB':'hauteur x long (ex: 200x6000)',
    'HEM':'hauteur x long (ex: 200x6000)', 'HD':'hauteur x long (ex: 260x6000)',
    'UPN':'hauteur x long (ex: 100x6000)', 'UPE':'hauteur x long (ex: 100x6000)',
    'UPAF':'hauteur x long (ex: 100x6000)',
    'Plat':'larg x ep x long (ex: 100x10x6000)',
    'Tôle':'ep x larg x long (ex: 8x1500x3000)',
    'Tube':'Ø x ep x long (ex: 60x3x6000) | □ c x ep x long (ex: 60x3x6000) | rect l x h x ep x long (ex: 80x40x3x6000)',
    'Rond':'Ø x long (ex: 40x6000)',
    'Carré':'c x long plein (ex: 50x6000) ou c x ep x long creux (ex: 50x3x6000)',
    'Cornière':'c x ep x long (ex: 80x8x6000) ou c1 x c2 x ep x long (ex: 80x60x8x6000)',
  };
  const formeEl = document.querySelector('[name="forme"]');
  const dimsHint = document.getElementById('dimsHint');
  if (formeEl && dimsHint) {
    const updateHint = () => {
      const hint = DIMS_HINTS[formeEl.value] || '';
      dimsHint.textContent = hint ? '→ ' + hint : '';
    };
    formeEl.addEventListener('change', updateHint);
    updateHint();
  }

  ['reference','forme','dimensions','quantite'].forEach(name => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) el.addEventListener('input', autoCalcPrix);
    if (el) el.addEventListener('change', autoCalcPrix);
  });

  document.getElementById('btnPrixMarche').addEventListener('click', () => {
    const form = document.getElementById('articleForm');
    const art = {
      reference:  form.elements['reference']?.value  || '',
      forme:      form.elements['forme']?.value       || '',
      dimensions: form.elements['dimensions']?.value  || '',
      quantite:   parseFloat(form.elements['quantite']?.value) || 0,
    };
    const result = getPrixMarche(art);
    const infoEl   = document.getElementById('prixMarcheInfo');
    const margeRow = document.getElementById('margeRow');
    const prixBase = document.getElementById('prixBase');
    if (result) {
      _prixMarcheBase = result.prix;
      prixBase.textContent = result.prix.toFixed(2) + ' € / unité';
      margeRow.style.display = 'block';
      applyMarge();
      updatePrixInfo(result);
    } else {
      _prixMarcheBase = null;
      margeRow.style.display = 'none';
      infoEl.textContent = "⚠️ Impossible d'estimer — renseignez forme et dimensions (ex: 200x6000)";
      infoEl.style.color = '#f87171';
    }
  });
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => { if(e.target===document.getElementById('modalOverlay')) closeModal(); });
  document.getElementById('articleForm').addEventListener('submit', handleFormSubmit);
  document.getElementById('btnSync').addEventListener('click', () => { state.syncing = false; syncFromSheets(); showToast('🔄 Rechargement depuis Google Sheets...'); });
  document.getElementById('btnOpenSheetModal').addEventListener('click', openSheetModal);
  document.getElementById('btnCloseConfig').addEventListener('click', () => document.getElementById('configBanner').classList.add('hidden'));
  document.getElementById('sheetModalClose').addEventListener('click', () => document.getElementById('sheetModal').classList.add('hidden'));
  document.getElementById('sheetModalCancel').addEventListener('click', () => document.getElementById('sheetModal').classList.add('hidden'));
  document.getElementById('btnConnectSheets').addEventListener('click', connectSheets);

  // Tri colonnes
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      if (state.sortKey===th.dataset.sort) state.sortDir=state.sortDir==='asc'?'desc':'asc';
      else { state.sortKey=th.dataset.sort; state.sortDir='asc'; }
      renderTable();
    });
  });

  // Checkboxes
  document.getElementById('tableBody').addEventListener('change', e => {
    if (e.target.classList.contains('row-cb')) {
      const id = parseInt(e.target.dataset.id);
      if (e.target.checked) state.selectedIds.push(id);
      else state.selectedIds=state.selectedIds.filter(x=>x!==id);
      updateSelectAll(); renderDeleteBtn();
    }
  });
  // SelectAll dans l'en-tête
  document.getElementById('selectAllHeader').addEventListener('change', e => {
    const visible = filteredArticles().map(r => r.id);
    state.selectedIds = e.target.checked
      ? [...new Set([...state.selectedIds, ...visible])]
      : state.selectedIds.filter(id => !visible.includes(id));
    renderTable();
    updateSelectionBar();
  });
  // SelectAll dans la barre de sélection
  document.getElementById('selectAll').addEventListener('change', e => {
    const visible = filteredArticles().map(r => r.id);
    state.selectedIds = e.target.checked
      ? [...new Set([...state.selectedIds, ...visible])]
      : state.selectedIds.filter(id => !visible.includes(id));
    renderTable();
    updateSelectionBar();
  });
  // Annuler sélection
  // Livraisons
  document.getElementById('btnAddLivraison').addEventListener('click', () => {
    _editingLivraisonId = null;
    document.getElementById('livDate').value = '';
    document.getElementById('livFournisseur').value = '';
    document.getElementById('livAffaire').value = '';
    document.getElementById('livStatut').value = 'En attente';
    document.getElementById('livNotes').value = '';
    document.getElementById('livraisonFormTitle').textContent = 'NOUVELLE LIVRAISON';
    document.getElementById('livraisonForm').classList.remove('hidden');
  });
  document.getElementById('btnCancelLivraison').addEventListener('click', () => {
    document.getElementById('livraisonForm').classList.add('hidden');
    _editingLivraisonId = null;
  });
  document.getElementById('btnSaveLivraison').addEventListener('click', async () => {
    const date        = document.getElementById('livDate').value;
    const fournisseur = document.getElementById('livFournisseur').value.trim();
    const affaire     = document.getElementById('livAffaire').value.trim();
    const statut      = document.getElementById('livStatut').value;
    const notes       = document.getElementById('livNotes').value.trim();
    if (!date || !fournisseur || !affaire) {
      showToast('⚠️ Date, fournisseur et affaire sont obligatoires'); return;
    }
    const livraisons = loadLivraisons();
    if (_editingLivraisonId) {
      const idx = livraisons.findIndex(x => x.id === _editingLivraisonId);
      if (idx >= 0) livraisons[idx] = { ...livraisons[idx], date, fournisseur, affaire, statut, notes };
    } else {
      livraisons.push({ id: 'liv_' + Date.now(), date, fournisseur, affaire, statut, notes, createdAt: new Date().toISOString() });
    }
    saveLivraisons(livraisons);
    document.getElementById('livraisonForm').classList.add('hidden');
    const savedId = _editingLivraisonId;
    _editingLivraisonId = null;
    renderLivraisons();
    showToast('✅ Livraison sauvegardée');
    // Sync avec Google Sheets
    const liv = livraisons.find(x => savedId ? String(x.id)===String(savedId) : x.id === livraisons[livraisons.length-1].id);
    if (liv) await pushLivraison(liv);
  });
  document.getElementById('livraisonSearch').addEventListener('input', renderLivraisons);

  document.getElementById('btnClearSelection').addEventListener('click', () => {
    state.selectedIds = [];
    renderTable();
    updateSelectionBar();
  });

  // Suppression groupée
  document.getElementById('btnDeleteSelected').addEventListener('click', async () => {
    if (!confirm(`Supprimer ${state.selectedIds.length} article(s) ?`)) return;
    const toDelete = [...state.selectedIds];
    toDelete.forEach(id => {
      const art=state.articles.find(r=>r.id===id);
      if (art) addMouvement('SUPPRESSION',art,'Suppression groupée');
    });
    state.articles=state.articles.filter(r=>!toDelete.includes(r.id));
    state.selectedIds=[];
    saveLocal(); render();
    showToast('🗑 Articles supprimés');
    for (const id of toDelete) await deleteFromSheets(id);
  });

  // Export
  document.getElementById('btnExportCSV').addEventListener('click', () => { exportCSV(filteredArticles(),'stock_aciers.csv'); showToast('📥 Export CSV téléchargé'); });
  document.getElementById('btnExportMvt').addEventListener('click', () => { exportMvtCSV(); showToast('📥 Export mouvements téléchargé'); });

  // Clavier
  document.addEventListener('keydown', e => {
    if (e.key==='Escape') { closeModal(); document.getElementById('sheetModal').classList.add('hidden'); }
  });

  // ---- QR EVENTS (fusionnés) ----
  // jsQR chargé à la demande lors du scan

  // Tab QR
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'qr') setTimeout(renderQRTab, 50);
      if (btn.dataset.tab === 'plan') setTimeout(renderPlan, 50);
      if (btn.dataset.tab === 'livraison') { setTimeout(renderLivraisons, 50); setTimeout(syncLivraisons, 200); }
      if (btn.dataset.tab === 'livraison') { setTimeout(renderLivraisons, 50); setTimeout(syncLivraisons, 200); }
    });
  });

  const btnScan = document.getElementById('btnScanQR');
  const btnPrint = document.getElementById('btnPrintAll');
  const btnScanClose = document.getElementById('scanModalClose');
  const btnFicheClose = document.getElementById('ficheModalClose');
  const btnQtyMinus = document.getElementById('btnQtyMinus');
  const btnQtyPlus = document.getElementById('btnQtyPlus');
  const btnQtySave = document.getElementById('btnQtySave');

  if (btnScan) btnScan.addEventListener('click', openScanner);

  // Boutons scanner
  const btnScanLive  = document.getElementById('btnScanLive');
  const btnScanPhoto = document.getElementById('btnScanPhoto');
  const scanPhotoInput = document.getElementById('scanPhotoInput');
  if (btnScanLive)    btnScanLive.addEventListener('click', startLiveScanner);
  if (btnScanPhoto)   btnScanPhoto.addEventListener('click', () => scanPhotoInput.click());
  if (scanPhotoInput) scanPhotoInput.addEventListener('change', e => scanFromPhoto(e.target.files[0]));
  if (btnPrint) btnPrint.addEventListener('click', printAll);
  if (btnScanClose) btnScanClose.addEventListener('click', stopScanner);
  if (btnFicheClose) btnFicheClose.addEventListener('click', () => document.getElementById('ficheModal').classList.add('hidden'));
  // Bouton Fermer du bas - délégation d'événement
  document.addEventListener('click', e => {
    if (e.target && e.target.id === 'ficheModalClose2') {
      document.getElementById('ficheModal').classList.add('hidden');
    }
  });

  if (btnQtyMinus) btnQtyMinus.addEventListener('click', () => {
    const inp = document.getElementById('ficheQty');
    inp.value = Math.max(0, parseFloat(inp.value||0) - 1);
  });
  if (btnQtyPlus) btnQtyPlus.addEventListener('click', () => {
    const inp = document.getElementById('ficheQty');
    inp.value = parseFloat(inp.value||0) + 1;
  });
  if (btnQtySave) btnQtySave.addEventListener('click', async () => {
    const id = parseInt(document.getElementById('ficheModal').dataset.artId);
    const newQty = parseFloat(document.getElementById('ficheQty').value) || 0;
    const art = state.articles.find(r => r.id === id);
    if (!art) return;
    const oldQty = art.quantite;
    art.quantite = newQty;
    if (newQty === 0) art.statut = 'Rupture';
    else if (newQty <= 3) art.statut = 'Faible stock';
    else art.statut = 'Disponible';
    const mvt = addMouvement('MODIFICATION', art, 'Qté: ' + oldQty + ' → ' + newQty + ' (scan QR)');
    saveLocal(); render(); renderQRTab();
    document.getElementById('ficheModal').classList.add('hidden');
    showToast('✅ Quantité mise à jour : ' + newQty + ' ' + art.unite);
    await pushArticle(art);
    await pushMouvement(mvt);
  });

  const scanModalEl = document.getElementById('scanModal');
  const ficheModalEl = document.getElementById('ficheModal');
  if (scanModalEl) scanModalEl.addEventListener('click', e => { if(e.target===scanModalEl) stopScanner(); });
  if (ficheModalEl) ficheModalEl.addEventListener('click', e => { if(e.target===ficheModalEl) ficheModalEl.classList.add('hidden'); });
});

// PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt=e;
  document.getElementById('installBanner').classList.remove('hidden');
});
document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt=null;
  document.getElementById('installBanner').classList.add('hidden');
});
document.getElementById('closeBanner').addEventListener('click', () => document.getElementById('installBanner').classList.add('hidden'));

function updateOnlineStatus() { document.getElementById('offlineBadge').classList.toggle('hidden', navigator.onLine); }
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ============================================================
//  QR CODES
// ============================================================

function renderQRTab() {
  const grid = document.getElementById('qrGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const filtered = state.qrSearch
    ? state.articles.filter(a => [a.reference,a.designation,a.forme,a.dimensions].join(' ').toLowerCase().includes(state.qrSearch))
    : state.articles;
  filtered.forEach(art => {
    const card = document.createElement('div');
    card.className = 'qr-card';
    const sc = statutClass(art.statut);

    // QR data = URL directe vers la fiche article
    // L'iPhone peut scanner avec l'app Appareil Photo native !
    const baseUrl = window.location.origin + window.location.pathname;
    const qrData = baseUrl + '?article=' + art.id;

    card.innerHTML = `
      <div class="qr-canvas" id="qr-${art.id}"></div>
      <div class="qr-ref">${art.reference}</div>
      <div class="qr-desig">${art.designation}</div>
      <div class="qr-dims">${art.forme} · ${art.dimensions}</div>
      <div><span class="statut-badge ${sc} qr-statut">${art.statut}</span></div>
      <div style="font-size:12px;color:${art.quantite===0?'#f87171':art.quantite<=3?'#fbbf24':'#34d399'};font-weight:700">${art.quantite} ${art.unite}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${art.localisation}</div>
      <div class="qr-actions">
        <button class="btn-secondary" onclick="openFiche(${art.id})">📋 Fiche</button>
        <button class="btn-secondary" onclick="printOne(${art.id})">🖨 Imprimer</button>
      </div>
    `;
    grid.appendChild(card);

    // Générer le QR code
    try {
      new QRCode(document.getElementById('qr-' + art.id), {
        text: qrData,
        width: 140, height: 140,
        colorDark: '#f97316',
        colorLight: '#272b3a',
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch(e) {
      document.getElementById('qr-' + art.id).innerHTML = '<div style="color:#f87171;font-size:11px">QR indispo</div>';
    }
  });
}

// ============================================================
//  FICHE ARTICLE (après scan ou clic)
// ============================================================
function openFiche(id) {
  const art = state.articles.find(r => r.id == id);
  if (!art) { showToast('❌ Article introuvable'); return; }

  // Historique des mouvements (5 derniers)
  const mvts = state.mouvements.filter(m => m.reference === art.reference).slice(-5).reverse();
  const mvtHtml = mvts.length ? mvts.map(m => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bg3);font-size:11px;gap:8px">
      <span style="color:var(--text-muted);white-space:nowrap">${fmtDate(m.date)}</span>
      <span class="statut-badge ${m.type==='AJOUT'?'statut-Disponible':m.type==='SUPPRESSION'?'statut-Rupture':'statut-Faible'}">${m.type}</span>
      <span style="color:var(--text);flex:1">${m.note||'—'}</span>
      <span style="background:var(--bg3);border-radius:20px;padding:2px 8px;color:var(--orange);white-space:nowrap">${m.par||'—'}</span>
    </div>`).join('') 
    : '<div style="color:var(--text-muted);font-size:12px;padding:8px 0">Aucun mouvement enregistré</div>';

  document.getElementById('ficheTitle').textContent = art.reference + ' — ' + art.designation;
  document.getElementById('ficheContent').innerHTML = `
    <div class="fiche-row"><b>Désignation</b><span>${art.designation}</span></div>
    <div class="fiche-row"><b>Forme</b><span>${art.forme}</span></div>
    <div class="fiche-row"><b>Dimensions</b><span>${art.dimensions}</span></div>
    <div class="fiche-row"><b>Fournisseur</b><span>${art.fournisseur||'—'}</span></div>
    <div class="fiche-row"><b>Localisation</b><span>${art.localisation||'—'}</span></div>
    <div class="fiche-row"><b>Prix unitaire</b><span style="color:#60a5fa">${fmt(art.prix)} €</span></div>
    <div class="fiche-row"><b>Date entrée</b><span>${fmtDate(art.dateEntree)}</span></div>
    <div class="fiche-row"><b>Statut</b><span><span class="statut-badge ${statutClass(art.statut)}">${art.statut}</span></span></div>
    <div class="fiche-row"><b>Créé par</b><span style="color:var(--orange)">${art.creePar||'—'}</span></div>
    <div class="fiche-row"><b>Modifié par</b><span style="color:var(--orange)">${art.modifiePar ? art.modifiePar + ' · ' + fmtDate(art.dateModif) : '—'}</span></div>
    <div style="margin-top:14px">
      <div class="fiche-label" style="margin-bottom:8px;font-size:11px;letter-spacing:1px;color:var(--text-muted)">NOTE MOUVEMENT</div>
      <div style="display:flex;gap:8px">
        <input type="text" id="ficheNoteInput" placeholder="Ajouter une note..." value="${getLastNote(art.id)!=='—'?getLastNote(art.id):''}"
          style="flex:1;padding:8px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:13px" />
        <button class="btn-secondary" onclick="saveFicheNote(${art.id})" style="white-space:nowrap;padding:8px 12px">💾</button>
      </div>
    </div>
    <div style="margin-top:14px">
      <div class="fiche-label" style="margin-bottom:8px;font-size:11px;letter-spacing:1px;color:var(--text-muted)">DERNIERS MOUVEMENTS</div>
      ${mvtHtml}
    </div>
  `;
  document.getElementById('ficheQty').value = art.quantite;
  document.getElementById('ficheModal').dataset.artId = id;
  document.getElementById('ficheModal').classList.remove('hidden');
}
window.openFiche = openFiche;

// ============================================================
//  IMPRESSION
// ============================================================
function printOne(id) {
  const art = state.articles.find(r => r.id == id);
  if (!art) return;
  buildPrintPage([art]);
  setTimeout(() => window.print(), 500);
}
window.printOne = printOne;

function printAll() {
  buildPrintPage(state.articles);
  setTimeout(() => window.print(), 600);
}

function buildPrintPage(articles) {
  const page = document.getElementById('printPage');
  page.innerHTML = '<div class="print-grid" id="printGrid"></div>';
  const grid = document.getElementById('printGrid');

  articles.forEach(art => {
    const label = document.createElement('div');
    label.className = 'print-label';

    // Infos texte
    const refDiv = document.createElement('div');
    refDiv.className = 'p-ref';
    refDiv.textContent = art.reference;

    const desigDiv = document.createElement('div');
    desigDiv.className = 'p-desig';
    desigDiv.textContent = art.designation;

    const dimsDiv = document.createElement('div');
    dimsDiv.className = 'p-dims';
    dimsDiv.textContent = art.forme + ' · ' + art.dimensions;

    // QR code container
    const qrDiv = document.createElement('div');
    qrDiv.style.cssText = 'display:flex;justify-content:center;margin:6px 0';

    const locDiv = document.createElement('div');
    locDiv.className = 'p-loc';
    locDiv.textContent = '📍 ' + art.localisation + ' · Qté: ' + art.quantite + ' ' + art.unite;

    // Assembler dans le bon ordre
    label.appendChild(refDiv);
    label.appendChild(desigDiv);
    label.appendChild(dimsDiv);
    label.appendChild(qrDiv);
    label.appendChild(locDiv);
    grid.appendChild(label);

    // QR code noir pour impression — généré APRÈS ajout au DOM
    try {
      const baseUrl = window.location.origin + window.location.pathname;
      const qrData = baseUrl + '?article=' + art.id;
      new QRCode(qrDiv, {
        text: qrData,
        width: 100, height: 100,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch(e) { console.error('QR print error:', e); }
  });
}

// ============================================================
//  SCANNER QR CODE (caméra)
// ============================================================
let scanStream = null;
let scanAnimFrame = null;

// Charger jsQR depuis plusieurs CDN en cascade
async function loadJsQR() {
  if (window.jsQR) return true;
  const cdns = [
    'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js',
    'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
    'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js',
  ];
  for (const url of cdns) {
    const ok = await new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
    if (ok && window.jsQR) return true;
  }
  return false;
}

function isIOSPWA() {
  return navigator.standalone === true && /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function openScanner() {
  document.getElementById('scanModal').classList.remove('hidden');
  document.getElementById('scanVideo').style.display = 'none';

  // Sur iPhone en PWA : BarcodeDetector ne fonctionne pas
  // On guide l'utilisateur vers l'app Appareil Photo native
  if (isIOS()) {
    document.getElementById('scanChoices').style.display = 'none';
    document.getElementById('scanStatus').innerHTML = `
      <div style="text-align:center;padding:10px">
        <div style="font-size:40px;margin-bottom:12px">📷</div>
        <div style="font-weight:700;color:var(--text);margin-bottom:10px">Scanner sur iPhone</div>
        <div style="font-size:12px;color:var(--text-sub);line-height:2;margin-bottom:16px">
          1. Fermez cette fenêtre<br>
          2. Ouvrez l'<b>app Appareil Photo</b> d'Apple<br>
          3. Pointez vers le QR code SteelStock<br>
          4. Appuyez sur la notification qui apparaît<br>
          5. SteelStock s'ouvre directement sur la fiche ✅
        </div>
        <div style="font-size:11px;color:var(--text-muted);background:var(--bg3);border-radius:6px;padding:10px">
          💡 L'app Appareil Photo lit les QR codes automatiquement — c'est la méthode la plus rapide !
        </div>
      </div>`;
    return;
  }

  // Android et autres : choix normal
  document.getElementById('scanChoices').style.display = 'flex';
  document.getElementById('scanStatus').textContent = 'Choisissez une méthode :';
}

// MODE 1 : Caméra live (Android/Chrome)
async function startLiveScanner() {
  const statusEl = document.getElementById('scanStatus');
  const video    = document.getElementById('scanVideo');
  document.getElementById('scanChoices').style.display = 'none';
  video.style.display = 'block';
  statusEl.textContent = '⏳ Chargement...';

  const ok = await loadJsQR();
  if (!ok) { statusEl.textContent = '❌ Erreur chargement scanner'; return; }

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = scanStream;
    await video.play();
    statusEl.innerHTML = '📷 Pointez vers un QR code — tenez stable en bonne lumière';

    // Méthode 1 : BarcodeDetector natif (Android Chrome — pas besoin de jsQR)
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      video.addEventListener('playing', () => {
        async function detectFrame() {
          if (!scanStream) return;
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0) { stopScanner(); handleQRResult(codes[0].rawValue); return; }
          } catch(e) {}
          scanAnimFrame = requestAnimationFrame(detectFrame);
        }
        detectFrame();
      }, { once: true });
      return;
    }

    // BarcodeDetector absent → message clair
    statusEl.innerHTML = '❌ Scanner live non supporté sur ce navigateur.<br><small>Essayez la méthode <b>Photo</b> ci-dessous.</small>';
    document.getElementById('scanChoices').style.display = 'flex';
    video.style.display = 'none';
    if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }

  } catch(e) {
    statusEl.innerHTML = '❌ Caméra non accessible — essayez la méthode photo ci-dessous';
    document.getElementById('scanChoices').style.display = 'flex';
    video.style.display = 'none';
  }
}

// MODE 2 : Photo du QR code
async function scanFromPhoto(file) {
  if (!file) return;
  const statusEl = document.getElementById('scanStatus');
  statusEl.textContent = '⏳ Analyse de la photo...';
  document.getElementById('scanChoices').style.display = 'none';

  // Charger l'image
  const dataUrl = await new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width  = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // BarcodeDetector natif (Android Chrome & iOS 16+)
  if ('BarcodeDetector' in window) {
    try {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(canvas);
      if (codes.length > 0) {
        stopScanner();
        handleQRResult(codes[0].rawValue);
        return;
      } else {
        statusEl.innerHTML = '❌ QR code non détecté.<br><small>Cadrez bien le QR code, bonne lumière, sans flou.</small>';
        document.getElementById('scanChoices').style.display = 'flex';
        return;
      }
    } catch(e) { console.log('BarcodeDetector error:', e); }
  }

  // Si BarcodeDetector absent → message explicatif
  statusEl.innerHTML = `❌ Scanner non supporté sur ce navigateur.<br>
    <small style="line-height:2">
    📱 <b>iPhone</b> : utilisez l'app <b>Appareil Photo</b> native — pointez vers le QR, c'est automatique !<br>
    🤖 <b>Android</b> : utilisez <b>Chrome</b> (pas Samsung Internet ni Firefox)
    </small>`;
  document.getElementById('scanChoices').style.display = 'flex';
}

// Ancienne fonction gardée pour compatibilité
function startScanner() { openScanner(); }

function stopScanner() {
  if (scanAnimFrame) { cancelAnimationFrame(scanAnimFrame); scanAnimFrame = null; }
  if (scanStream)    { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  document.getElementById('scanModal').classList.add('hidden');
}

function handleQRResult(data) {
  try {
    let id = null;

    // Format URL : ...?article=123
    if (data.includes('?article=')) {
      id = data.split('?article=')[1];
    }
    // Format JSON (ancien format)
    else if (data.startsWith('{')) {
      const parsed = JSON.parse(data);
      id = parsed.id || parsed.ref;
    }
    // Texte simple = référence ou id
    else {
      id = data.trim();
    }

    const art = state.articles.find(r => String(r.id) === String(id) || r.reference === id);
    if (art) {
      openFiche(art.id);
      showToast('✅ Article trouvé : ' + art.reference);
    } else {
      showToast('❌ QR code non reconnu dans ce stock');
    }
  } catch(e) {
    showToast('❌ QR code invalide');
  }
}

// EVENTS QR fusionnés dans le DOMContentLoaded principal

// ============================================================
//  MARCHÉ DE L'ACIER
// ============================================================

// Prix de référence indicatifs (base mise à jour manuellement)
// Ces valeurs servent de base, l'IA les commente et contextualise
const PRIX_REFERENCE = {
  hrc:   { label: 'Acier plat laminé à chaud (HRC)', val: 520, unit: '€/tonne', prev: 495 },
  rebar: { label: 'Acier long (rond à béton)',         val: 480, unit: '€/tonne', prev: 510 },
  inox:  { label: 'Acier inoxydable 304',              val: 2100, unit: '€/tonne', prev: 2050 },
  scrap: { label: 'Ferraille (indice EU)',              val: 310, unit: '€/tonne', prev: 325 },
};

// Correspondance forme/référence → indice de marché
// Prix en €/tonne → conversion en €/barre ou €/tôle selon dimensions
// Tables de masse linéique réelles (kg/m) par profilé
const MASSE_LINEIQUE = {
  IPE:  { 80:6.0, 100:8.1, 120:10.4, 140:12.9, 160:15.8, 180:18.8, 200:22.4, 220:26.2, 240:30.7, 270:36.1, 300:42.2, 330:49.1, 360:57.1, 400:66.3, 450:77.6, 500:90.7, 550:106, 600:122 },
  IPN:  { 80:5.9, 100:8.3, 120:11.1, 140:14.3, 160:17.9, 180:21.9, 200:26.2, 220:31.1, 240:36.2, 260:41.9, 280:47.9, 300:54.2, 320:61.0, 340:68.0, 360:76.1, 380:84.0, 400:92.4 },
  HEA:  { 100:16.7, 120:19.9, 140:24.7, 160:30.4, 180:35.5, 200:42.3, 220:50.5, 240:60.3, 260:68.2, 280:76.4, 300:88.3, 320:97.6, 340:105, 360:112, 400:125, 450:140, 500:155, 550:166, 600:178, 650:190, 700:204, 800:224, 900:252, 1000:272 },
  HEB:  { 100:20.4, 120:26.7, 140:33.7, 160:42.6, 180:51.2, 200:61.3, 220:71.5, 240:83.2, 260:93.0, 280:103, 300:117, 320:127, 340:134, 360:142, 400:155, 450:171, 500:187, 550:199, 600:212, 650:225, 700:241, 800:262, 900:291, 1000:314 },
  HEM:  { 100:41.8, 120:53.0, 140:63.2, 160:76.2, 180:88.3, 200:103, 220:117, 240:157, 260:172, 280:189, 300:238, 320:245, 340:248, 360:250, 400:256, 450:263, 500:270, 550:278, 600:285, 650:293, 700:301, 800:317, 900:333, 1000:349 },
  UPN:  { 50:3.86, 65:5.59, 80:7.09, 100:10.6, 120:13.4, 140:16.0, 160:18.8, 180:22.0, 200:25.3, 220:29.4, 240:33.2, 260:37.9, 280:41.8, 300:46.2, 320:59.5, 350:60.6, 380:63.1, 400:71.8 },
  UPE:  { 80:7.6, 100:9.8, 120:12.3, 140:14.9, 160:17.8, 180:21.0, 200:24.5, 220:28.3, 240:32.4, 270:37.7, 300:43.4, 330:49.4, 360:57.0, 400:64.2 },
  UPAF: { 80:5.9, 100:8.0, 120:10.4, 140:12.9, 160:15.8, 180:19.0, 200:22.5, 220:26.8, 240:31.2, 270:36.8, 300:43.0, 330:49.5 },
  HD:   { 260:93, 320:127, 360:147, 400:172, 260:93 },
};

function getMasseLineique(forme, hauteur) {
  const f = forme.toUpperCase();
  // Chercher la table correspondante
  for (const [key, table] of Object.entries(MASSE_LINEIQUE)) {
    if (f.includes(key)) {
      // Hauteur exacte ou la plus proche
      if (table[hauteur]) return table[hauteur];
      const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
      // Interpolation entre les deux valeurs encadrantes
      for (let i = 0; i < keys.length - 1; i++) {
        if (hauteur >= keys[i] && hauteur <= keys[i+1]) {
          const ratio = (hauteur - keys[i]) / (keys[i+1] - keys[i]);
          return table[keys[i]] + ratio * (table[keys[i+1]] - table[keys[i]]);
        }
      }
      // Hors plage : extrapolation linéaire
      if (hauteur < keys[0]) return table[keys[0]];
      return table[keys[keys.length-1]];
    }
  }
  return null;
}

// Coefficients qualité acier (multiplicateur sur prix de base)
const COEFF_QUALITE = {
  // Aciers de construction courants
  'S235':  1.00,  // standard, le moins cher
  'S275':  1.05,
  'S355':  1.12,  // haute résistance, +12%
  'S420':  1.20,
  'S460':  1.28,
  // Ancienne désignation française
  'E24':   1.00,  // = S235
  'E28':   1.05,  // = S275
  'E36':   1.12,  // = S355
  // Inox (référencés par nuance)
  '304':   1.00,  // inox de base
  '316':   1.25,  // inox maritime +25%
  '316L':  1.28,
  '310':   1.40,  // inox réfractaire
  '321':   1.35,
  '904L':  2.10,  // super austénitique
  // Aciers spéciaux
  '42CR':  1.45,  // acier allié cémentation
  'XC48':  1.30,
};

function getCoeffQualite(reference) {
  const ref = String(reference).toUpperCase();
  // Chercher la nuance la plus spécifique en premier
  for (const [nuance, coeff] of Object.entries(COEFF_QUALITE).sort((a,b)=>b[0].length-a[0].length)) {
    if (ref.includes(nuance)) return { coeff, nuance };
  }
  return { coeff: 1.00, nuance: 'Standard' };
}

function getPrixMarche(article) {
  const ref   = String(article.reference  || '').toUpperCase();
  const forme = String(article.forme      || '').toUpperCase();
  const dims  = String(article.dimensions || '').toUpperCase();
  const qte   = parseFloat(article.quantite) || 0;

  // Qualité acier
  const { coeff: coeffQualite, nuance } = getCoeffQualite(ref);

  // Déterminer l'indice de marché applicable
  let indiceKey, indiceLabel;
  if (/316L|316|310|321|904|INOX/.test(ref)) {
    indiceKey = 'inox';  indiceLabel = 'Inox ' + nuance;
  } else if (/304/.test(ref)) {
    indiceKey = 'inox';  indiceLabel = 'Inox 304';
  } else if (/TÔLE|PLAT/.test(forme)) {
    indiceKey = 'hrc';   indiceLabel = 'Acier plat HRC';
  } else {
    indiceKey = 'rebar'; indiceLabel = 'Acier long';
  }

  const prixTonneBase = PRIX_REFERENCE[indiceKey].val;
  const prixTonne = Math.round(prixTonneBase * coeffQualite);
  const nums = dims.match(/[\d.]+/g);
  if (!nums || nums.length < 1) return null;

  let poidsBarre = null;
  let detail = '';

  if (/TÔLE/.test(forme) && nums.length >= 3) {
    // Tôle : épaisseur x largeur x longueur (mm)
    const [ep, larg, long] = nums.map(Number);
    poidsBarre = (ep/1000) * (larg/1000) * (long/1000) * 7850;
    detail = `${ep}x${larg}x${long}mm`;

  } else if (/PLAT/.test(forme) && nums.length >= 3) {
    // Plat : largeur x épaisseur x longueur
    const [larg, ep, long] = nums.map(Number);
    poidsBarre = (larg/1000) * (ep/1000) * (long/1000) * 7850;
    detail = `${larg}x${ep}x${long}mm`;

  } else if (/TUBE RECT/i.test(forme) && nums.length >= 3) {
    // Tube rectangle : l x h x ep x long  (ex: 300x100x10x12000)
    const n = nums.map(Number);
    let l, h, ep, long;
    if (n.length >= 4) { [l,h,ep,long] = n; }
    else { [l,h,long] = n; ep = Math.max(2, Math.round(Math.min(l,h)*0.04)); }
    poidsBarre = ((l/1000)*(h/1000) - ((l-2*ep)/1000)*((h-2*ep)/1000)) * (long/1000) * 7850;
    detail = `${l}x${h}x${ep}x${long}mm`;

  } else if (/TUBE CARR/i.test(forme) && nums.length >= 2) {
    // Tube carré : c x ep x long  (ex: 90x3x12000)
    const n = nums.map(Number);
    let c, ep, long;
    if (n.length >= 3) { [c,ep,long] = n; }
    else { [c,long] = n; ep = Math.max(2, Math.round(c*0.04)); }
    poidsBarre = ((c/1000)**2 - ((c-2*ep)/1000)**2) * (long/1000) * 7850;
    detail = `□${c}x${ep}x${long}mm`;

  } else if (/TUBE ROND|TUBE/i.test(forme) && nums.length >= 2) {
    // Tube rond : Ø x ep x long  (ex: 60x3x6000)
    const n = nums.map(Number);
    let dext, ep, long;
    if (n.length >= 3) { [dext,ep,long] = n; }
    else { [dext,long] = n; ep = Math.max(2, Math.round(dext*0.03)); }
    poidsBarre = Math.PI/4 * ((dext/1000)**2 - ((dext-2*ep)/1000)**2) * (long/1000) * 7850;
    detail = `Ø${dext}x${ep}x${long}mm`;

  } else if (/ROND/.test(forme) && nums.length >= 2) {
    // Rond plein : Ø x longueur
    const [d, long] = nums.map(Number);
    poidsBarre = Math.PI/4 * (d/1000)**2 * (long/1000) * 7850;
    detail = `Ø${d}x${long}mm`;

  } else if (/CARR/.test(forme) && nums.length >= 2) {
    // Carré plein : côté x longueur  OU  tube carré : côté x épaisseur x longueur
    let c, ep, long;
    if (nums.length >= 3) {
      [c, ep, long] = nums.map(Number);
      // Tube carré creux
      poidsBarre = ((c/1000)**2 - ((c - 2*ep)/1000)**2) * (long/1000) * 7850;
      detail = `□${c}x${ep}x${long}mm (creux)`;
    } else {
      [c, long] = nums.map(Number);
      poidsBarre = (c/1000)**2 * (long/1000) * 7850;
      detail = `□${c}x${long}mm (plein)`;
    }

  } else if (/CORNI/.test(forme) && nums.length >= 2) {
    // Cornière : c1 x c2 x ep x long  OU  c x ep x long  OU  c x long
    let c1, c2, ep, long;
    if (nums.length >= 4) {
      [c1, c2, ep, long] = nums.map(Number);
    } else if (nums.length === 3) {
      [c1, ep, long] = nums.map(Number); c2 = c1;
    } else {
      [c1, long] = nums.map(Number); c2 = c1; ep = Math.max(5, Math.round(c1 * 0.08));
    }
    // Section réelle d'une cornière L : 2*c*e - e²
    const section = (2*(c1/1000)*(ep/1000) - (ep/1000)**2);
    poidsBarre = section * (long/1000) * 7850;
    detail = `${c1}x${c2}x${ep}x${long}mm`;

  } else {
    // Profilés IPE/HEA/HEB/UPN etc. : hauteur x longueur
    const hauteur = Number(nums[0]);
    const long    = nums.length >= 2 ? Number(nums[nums.length-1]) : 6000;
    const masseLin = getMasseLineique(forme, hauteur);
    if (masseLin) {
      poidsBarre = masseLin * (long/1000);
      detail = `H${hauteur}x${long}mm (${masseLin.toFixed(1)}kg/m)`;
    }
  }

  if (!poidsBarre || poidsBarre <= 0) return null;

  const prixUnitaire = (poidsBarre / 1000) * prixTonne;
  const poidsTotalKg = Math.round(poidsBarre * qte * 10) / 10;
  const prixTotal    = Math.round(prixUnitaire * qte * 100) / 100;

  return {
    prix:        Math.round(prixUnitaire * 100) / 100,  // prix par unité
    prixTotal,                                           // prix × quantité
    poids:       Math.round(poidsBarre * 10) / 10,      // poids unitaire kg
    poidsTotal:  poidsTotalKg,                           // poids total kg
    indice:      indiceLabel,
    prixTonne,
    prixTonneBase,
    coeffQualite,
    nuance,
    qte,
    detail,
  };
}

function renderIndices() {
  Object.entries(PRIX_REFERENCE).forEach(([key, data]) => {
    const valEl   = document.getElementById('idx-' + key);
    const trendEl = document.getElementById('trend-' + key);
    const card    = valEl ? valEl.closest('.indice-card') : null;
    if (!valEl) return;

    valEl.textContent = data.val.toLocaleString('fr-FR');
    const diff = data.val - data.prev;
    const pct  = ((diff / data.prev) * 100).toFixed(1);

    if (card) card.classList.remove('loading', 'up', 'down');

    if (diff > 0) {
      trendEl.innerHTML = `<span class="trend-up">▲ +${pct}% vs mois dernier</span>`;
      if (card) card.classList.add('up');
    } else if (diff < 0) {
      trendEl.innerHTML = `<span class="trend-down">▼ ${pct}% vs mois dernier</span>`;
      if (card) card.classList.add('down');
    } else {
      trendEl.innerHTML = `<span class="trend-flat">→ Stable</span>`;
    }
  });
}

async function loadMarcheActus() {
  const container = document.getElementById('marcheActus');
  const dateEl    = document.getElementById('marcheDate');
  if (!container) return;

  container.innerHTML = '<div class="actu-loading">🔄 Chargement des tendances marché...</div>';

  // Données marché acier — mises à jour manuellement chaque mois
  // Sources : Eurofer, SteelOrbis, Fastmarkets, LME
  const actus = [
    {
      titre: "Acier plat HRC Europe : stabilisation après repli",
      corps: "Les prix du laminé à chaud (HRC) en Europe se stabilisent autour de 500-530 €/tonne début 2026, après un recul de 8% au T4 2025. La demande automobile reste le principal soutien, tandis que la construction marque le pas.",
      sentiment: "neutral",
      source: "SteelOrbis / Eurofer",
      date: "Fév. 2026"
    },
    {
      titre: "Ferraille européenne : baisse des cotations",
      corps: "L'indice ferraille EU recule de 4-5% en février 2026 à environ 300-320 €/tonne. La demande turque en retrait et l'excédent de collecte en Europe de l'Ouest pèsent sur les prix. Reprise attendue au printemps.",
      sentiment: "negative",
      source: "Fastmarkets / LME",
      date: "Fév. 2026"
    },
    {
      titre: "Inox 304 : hausse du surcharge alliage",
      corps: "La remontée du nickel au LME (+6% sur le mois) tire le surcharge alliage des aciers inoxydables 304 vers le haut. Les prix approchent 2 100 €/tonne en Europe. Les distributeurs anticipent de nouvelles hausses en mars.",
      sentiment: "positive",
      source: "Fastmarkets / LME Nickel",
      date: "Fév. 2026"
    },
    {
      titre: "Aciers longs : reprise timide dans la construction",
      corps: "Après un fort ralentissement fin 2025, les commandes d'aciers longs (IPE, HEA, rond à béton) reprennent légèrement grâce aux projets d'infrastructure publique en France et Allemagne. Les prix restent sous pression à ~480 €/tonne.",
      sentiment: "positive",
      source: "CELSA / Arcelor Longs",
      date: "Fév. 2026"
    },
    {
      titre: "Mesures anti-dumping : nouvelles protections EU",
      corps: "La Commission européenne a renforcé en janvier 2026 les droits de sauvegarde sur les produits plats importés d'Asie. Ces mesures pourraient soutenir les prix locaux de +20 à +40 €/tonne sur le S1 2026.",
      sentiment: "positive",
      source: "Commission Européenne",
      date: "Jan. 2026"
    },
    {
      titre: "Tubes et profilés : marché attentiste",
      corps: "Le marché des tubes acier reste attentiste en ce début d'année. Les stocks distributeurs sont encore élevés après les achats préventifs de fin 2025. Les prix se maintiennent entre 550 et 600 €/tonne pour les tubes mécaniques courants.",
      sentiment: "neutral",
      source: "Eurotube / SteelOrbis",
      date: "Fév. 2026"
    }
  ];

  container.innerHTML = actus.map(a => `
    <div class="actu-item ${a.sentiment}">
      <div class="actu-title">${a.titre}</div>
      <div class="actu-body">${a.corps}</div>
      <div style="display:flex;justify-content:space-between;margin-top:6px">
        <span class="actu-source">📰 ${a.source}</span>
        <span class="actu-date">${a.date}</span>
      </div>
    </div>
  `).join('');

  if (dateEl) dateEl.textContent = 'Données indicatives sources publiques — ' + new Date().toLocaleDateString('fr-FR');
}

function renderComparaison() {
  const el = document.getElementById('marcheCompar');
  if (!el) return;

  // Mapping entre formes/références du stock et catégories marché
  const mapping = {
    'Plat': 520, 'UPN': 490, 'UPE': 490, 'UPAF': 490,
    'HEA': 490, 'HEB': 490, 'HEM': 490, 'HD': 490,
    'IPE': 490, 'IPN': 490,
    'Rond': 480, 'Carré': 490, 'Cornière': 490, 'Tôle': 520, 'Tube': 550,
  };
  const inoxRefs = ['304L','316L','310S','321','904L'];

  // Prix au kg depuis prix à la tonne
  const rows = state.articles.map(art => {
    let prixMarche = mapping[art.forme] || 500;
    if (inoxRefs.some(r => art.reference.includes(r))) prixMarche = 2100;

    // Convertir en prix par unité estimée (barre ~6m ~50kg en moyenne)
    const prixMarcheKg = prixMarche / 1000;
    const prixStockKg  = art.prix / 50; // estimation

    const diff = ((art.prix - (prixMarche * 0.05)) / (prixMarche * 0.05) * 100);
    let badge, label;
    if (art.prix === 0) { badge = 'badge-low'; label = 'Non renseigné'; }
    else if (diff > 20)  { badge = 'badge-high'; label = '↑ Au-dessus marché'; }
    else if (diff < -20) { badge = 'badge-low';  label = '↓ En dessous marché'; }
    else                 { badge = 'badge-ok';   label = '✓ Dans la norme'; }

    return `<tr>
      <td><b>${art.reference}</b></td>
      <td>${art.forme}</td>
      <td style="color:#60a5fa">${fmt(art.prix)} €/${art.unite}</td>
      <td style="color:var(--text-muted)">~${prixMarche.toLocaleString('fr-FR')} €/t</td>
      <td><span class="${badge}">${label}</span></td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <table class="compar-table">
      <thead><tr>
        <th>RÉFÉRENCE</th><th>FORME</th>
        <th>VOTRE PRIX</th><th>PRIX MARCHÉ</th><th>ÉVALUATION</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">Aucun article dans le stock</td></tr>'}</tbody>
    </table>
    <div style="font-size:10px;color:var(--text-muted);margin-top:8px">* Prix marché en €/tonne — votre prix en €/unité. Comparaison indicative.</div>
  `;
}

// Init onglet marché
function initMarcheTab() {
  renderIndices();
  renderComparaison();
  loadMarcheActus();
}

// Event onglet marché

// ============================================================
//  PLAN DE L'USINE
// ============================================================

function renderPlan() {
  const zones = {};
  // Regrouper les articles par zone
  state.articles.forEach(art => {
    const loc = String(art.localisation || '').trim().toUpperCase();
    if (!loc) return;
    // Extraire la zone principale (ex: "ZA-01" → "ZA", "Z1-02" → "Z1")
    const match = loc.match(/^(Z[A-Z0-9]+)/i);
    const zone = match ? match[1].toUpperCase() : loc.split('-')[0].toUpperCase();
    if (!zones[zone]) zones[zone] = { articles: [], rupture: false };
    zones[zone].articles.push(art);
    if (art.statut === 'Rupture') zones[zone].rupture = true;
  });

  // Colorier chaque zone sur le plan
  document.querySelectorAll('.plan-zone').forEach(g => {
    const zone = g.dataset.zone;
    const rect = g.querySelector('.zone-rect');
    const countEl = g.querySelector('.zone-count');
    const labelEl = g.querySelector('.zone-label');
    const data = zones[zone];

    if (data && data.articles.length > 0) {
      if (data.rupture) {
        rect.setAttribute('fill', 'rgba(248,113,113,0.25)');
        rect.setAttribute('stroke', '#f87171');
        if (labelEl) labelEl.setAttribute('fill', '#f87171');
      } else {
        rect.setAttribute('fill', 'rgba(249,115,22,0.22)');
        rect.setAttribute('stroke', '#f97316');
        if (labelEl) labelEl.setAttribute('fill', '#f97316');
      }
      if (countEl) countEl.textContent = data.articles.length + ' article' + (data.articles.length > 1 ? 's' : '');
    } else {
      rect.setAttribute('fill', '#1e2436');
      rect.setAttribute('stroke', '#475569');
      if (labelEl) labelEl.setAttribute('fill', '#94a3b8');
      if (countEl) countEl.textContent = '';
    }
    // Curseur pointer
    g.style.cursor = 'pointer';
  });
}

function planZoneClick(zone) {
  const loc = zone.toUpperCase();
  // Trouver tous les articles dans cette zone
  const arts = state.articles.filter(art => {
    const artLoc = String(art.localisation || '').trim().toUpperCase();
    return artLoc === loc || artLoc.startsWith(loc + '-') || artLoc.startsWith(loc);
  });

  const popup  = document.getElementById('planPopup');
  const overlay = document.getElementById('planOverlay');
  const title  = document.getElementById('planPopupTitle');
  const content = document.getElementById('planPopupContent');

  title.textContent = 'ZONE ' + zone;

  if (arts.length === 0) {
    content.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px">Aucun article dans cette zone</div>';
  } else {
    content.innerHTML = arts.map(art => `
      <div onclick="document.getElementById('planPopup').classList.add('hidden');document.getElementById('planOverlay').classList.add('hidden');openFiche(${art.id})"
        style="padding:10px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:4px;transition:background 0.15s"
        onmouseover="this.style.background='rgba(249,115,22,0.1)'" onmouseout="this.style.background=''">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b style="color:var(--orange)">${art.reference}</b>
          <span class="statut-badge ${statutClass(art.statut)}">${art.statut}</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${art.designation}</div>
        <div style="font-size:11px;color:var(--text-muted)">${art.forme} · ${art.dimensions}</div>
        <div style="font-size:12px;margin-top:3px">
          <span style="color:${art.quantite===0?'#f87171':art.quantite<=3?'#fbbf24':'#34d399'};font-weight:700">${art.quantite} ${art.unite}</span>
          <span style="color:var(--text-muted);margin-left:8px">📍 ${art.localisation}</span>
        </div>
      </div>
    `).join('');
  }

  popup.classList.remove('hidden');
  overlay.classList.remove('hidden');
}
window.planZoneClick = planZoneClick;


// ============================================================
//  LIVRAISONS
// ============================================================
const LIVRAISON_KEY = 'steelstock_livraisons';

function loadLivraisons() {
  try { return JSON.parse(localStorage.getItem(LIVRAISON_KEY) || '[]'); }
  catch { return []; }
}

function saveLivraisons(data) {
  localStorage.setItem(LIVRAISON_KEY, JSON.stringify(data));
}

function renderLivraisons(filter = '') {
  let livs = loadLivraisons();
  if (filter) {
    const q = filter.toLowerCase();
    livs = livs.filter(l =>
      [l.fournisseur, l.affaire, l.note, l.statut].join(' ').toLowerCase().includes(q)
    );
  }
  livs.sort((a, b) => new Date(a.date) - new Date(b.date));

  const tbody = document.getElementById('livraisonTableBody');
  if (!tbody) return;

  if (livs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">Aucune livraison enregistrée</td></tr>';
    return;
  }

  const statutColor = {
    'En attente': '#fbbf24',
    'Confirmée':  '#60a5fa',
    'Livrée':     '#4ade80',
    'Annulée':    '#f87171',
  };

  const today = new Date(); today.setHours(0,0,0,0);

  tbody.innerHTML = livs.map(l => {
    const d = new Date(l.date);
    const diff = Math.ceil((d - today) / (1000*60*60*24));
    let dateStyle = '';
    let badge = '';
    if (l.statut !== 'Livrée' && l.statut !== 'Annulée') {
      if (diff < 0)       { dateStyle = 'color:#f87171;font-weight:700'; badge = ' <span style="font-size:9px;background:#7f1d1d;color:#f87171;padding:1px 4px;border-radius:3px">EN RETARD</span>'; }
      else if (diff === 0){ dateStyle = "color:#fbbf24;font-weight:700"; badge = " <span style=\"font-size:9px;background:#78350f;color:#fbbf24;padding:1px 4px;border-radius:3px\">AUJ</span>"; }
      else if (diff <= 3) { dateStyle = 'color:#fb923c;font-weight:700'; badge = ` <span style="font-size:9px;background:#7c2d12;color:#fb923c;padding:1px 4px;border-radius:3px">J-${diff}</span>`; }
    }
    const color = statutColor[l.statut] || '#94a3b8';
    return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onmouseover="this.style.background='rgba(249,115,22,0.05)'" onmouseout="this.style.background=''">
      <td style="padding:10px 12px;${dateStyle}">${formatDate(l.date)}${badge}</td>
      <td style="padding:10px 12px;font-weight:600;color:var(--text)">${l.fournisseur}</td>
      <td style="padding:10px 12px;color:var(--text)">${l.affaire}</td>
      <td style="padding:10px 12px"><span style="background:${color}22;color:${color};border:1px solid ${color};border-radius:12px;padding:2px 10px;font-size:11px">${l.statut}</span></td>
      <td style="padding:10px 12px;color:var(--text-muted);font-size:12px">${l.note || '—'}</td>
      <td style="padding:10px 12px;text-align:center;white-space:nowrap">
        <button class="btn-secondary" onclick="editLivraison('${l.id}')" style="padding:4px 10px;font-size:11px;margin-right:4px">✎</button>
        <button class="btn-danger"    onclick="deleteLivraison('${l.id}')" style="padding:4px 10px;font-size:11px">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y,m,d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

let editingLivraisonId = null;

function openLivraisonForm(id = null) {
  editingLivraisonId = id;
  const form = document.getElementById('livraisonForm');
  const title = document.getElementById('livraisonFormTitle');
  form.classList.remove('hidden');
  if (id) {
    const liv = loadLivraisons().find(l => l.id === id);
    if (liv) {
      document.getElementById('liv-date').value = liv.date;
      document.getElementById('liv-fournisseur').value = liv.fournisseur;
      document.getElementById('liv-affaire').value = liv.affaire;
      document.getElementById('liv-statut').value = liv.statut;
      document.getElementById('liv-note').value = liv.note || '';
      title.textContent = 'MODIFIER LA LIVRAISON';
    }
  } else {
    document.getElementById('liv-date').value = '';
    document.getElementById('liv-fournisseur').value = '';
    document.getElementById('liv-affaire').value = '';
    document.getElementById('liv-statut').value = 'En attente';
    document.getElementById('liv-note').value = '';
    title.textContent = 'NOUVELLE LIVRAISON';
  }
  document.getElementById('liv-date').focus();
}

function saveLivraisonForm() {
  const date        = document.getElementById('liv-date').value;
  const fournisseur = document.getElementById('liv-fournisseur').value.trim();
  const affaire     = document.getElementById('liv-affaire').value.trim();
  const statut      = document.getElementById('liv-statut').value;
  const note        = document.getElementById('liv-note').value.trim();

  if (!date || !fournisseur || !affaire) {
    showToast('⚠️ Date, fournisseur et affaire sont obligatoires'); return;
  }

  let livs = loadLivraisons();
  if (editingLivraisonId) {
    const idx = livs.findIndex(l => l.id === editingLivraisonId);
    if (idx >= 0) livs[idx] = { ...livs[idx], date, fournisseur, affaire, statut, note };
  } else {
    livs.push({ id: 'liv_' + Date.now(), date, fournisseur, affaire, statut, note, creePar: state.userName || '', dateCreation: new Date().toISOString() });
  }
  saveLivraisons(livs);
  document.getElementById('livraisonForm').classList.add('hidden');
  editingLivraisonId = null;
  renderLivraisons(document.getElementById('livraisonSearch')?.value || '');
  showToast('✅ Livraison sauvegardée');
}

function deleteLivraison(id) {
  if (!confirm('Supprimer cette livraison ?')) return;
  let livs = loadLivraisons().filter(l => l.id !== id);
  saveLivraisons(livs);
  renderLivraisons();
  showToast('🗑 Livraison supprimée');
}

function editLivraison(id) { openLivraisonForm(id); }
window.editLivraison   = editLivraison;
window.deleteLivraison = deleteLivraison;


// ============================================================
//  LIVRAISONS
// ============================================================
function loadLivraisons() {
  const raw = localStorage.getItem('steelstock_livraisons');
  return raw ? JSON.parse(raw) : [];
}
function saveLivraisons(livraisons) {
  localStorage.setItem('steelstock_livraisons', JSON.stringify(livraisons));
}
async function pushLivraison(livraison) {
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveLivraison', livraison })
    });
  } catch(e) { console.warn('pushLivraison error:', e); }
}
async function pushDeleteLivraison(id) {
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteLivraison', id })
    });
  } catch(e) { console.warn('pushDeleteLivraison error:', e); }
}

async function pushLivraison(livraison) {
  if (!state.scriptUrl) return;
  await sheetRequest('saveLivraison', { livraison });
}

async function deleteLivraisonFromSheets(id) {
  if (!state.scriptUrl) return;
  await sheetRequest('deleteLivraison', { id });
}

async function syncLivraisons() {
  if (!state.scriptUrl) return;
  try {
    const res = await sheetRequest('getLivraisons', {});
    if (res && res.livraisons) {
      saveLivraisons(res.livraisons);
      renderLivraisons();
    }
  } catch(e) {}
}

let _editingLivraisonId = null;

function renderLivraisons() {
  const livraisons = loadLivraisons();
  const search = document.getElementById('livraisonSearch')?.value?.toLowerCase() || '';
  const tbody = document.getElementById('livraisonTableBody');
  if (!tbody) return;

  const filtered = livraisons.filter(l =>
    !search || [l.fournisseur, l.affaire, l.notes, l.statut].join(' ').toLowerCase().includes(search)
  ).sort((a,b) => new Date(a.date) - new Date(b.date));

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">Aucune livraison trouvée</td></tr>';
    return;
  }

  const statutColors = {
    'En attente': '#fbbf24',
    'Confirmée':  '#34d399',
    'Livrée':     '#60a5fa',
    'Annulée':    '#f87171',
  };

  // Trier : futures en premier, passées en gris
  const today = new Date(); today.setHours(0,0,0,0);

  tbody.innerHTML = filtered.map(l => {
    const d = new Date(l.date);
    const isPast = d < today;
    const isToday = d.getTime() === today.getTime();
    const isSoon = !isPast && (d - today) / 86400000 <= 7;
    const rowStyle = isPast ? 'opacity:0.5' : isToday ? 'background:rgba(249,115,22,0.1)' : isSoon ? 'background:rgba(251,191,36,0.07)' : '';
    const color = statutColors[l.statut] || '#94a3b8';
    const dateStr = new Date(l.date + 'T12:00:00').toLocaleDateString('fr-FR', {weekday:'short',day:'2-digit',month:'short',year:'numeric'});
    return `<tr style="border-bottom:1px solid var(--border);cursor:pointer;${rowStyle}">
      <td style="padding:10px 12px;font-weight:${isToday?'700':'400'};color:${isToday?'var(--orange)':isPast?'var(--text-muted)':'var(--text)'}">${dateStr}${isToday?' 📅':isSoon?' ⚠️':''}</td>
      <td style="padding:10px 12px;color:var(--text)">${l.fournisseur}</td>
      <td style="padding:10px 12px;color:var(--orange);font-weight:600">${l.affaire}</td>
      <td style="padding:10px 12px"><span style="background:${color}22;color:${color};border:1px solid ${color};padding:2px 8px;border-radius:20px;font-size:11px">${l.statut}</span></td>
      <td style="padding:10px 12px;color:var(--text-muted);font-size:12px">${l.notes||'—'}</td>
      <td style="padding:10px 12px;text-align:center;display:flex;gap:6px;justify-content:center">
        <button onclick="editLivraison('${l.id}')" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px">✎</button>
        <button onclick="deleteLivraison('${l.id}')" style="background:none;border:1px solid #f87171;color:#f87171;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function editLivraison(id) {
  const livraisons = loadLivraisons();
  const l = livraisons.find(x => String(x.id) === String(id));
  if (!l) { showToast('Livraison introuvable'); return; }
  _editingLivraisonId = String(id);
  document.getElementById('livDate').value = l.date || '';
  document.getElementById('livFournisseur').value = l.fournisseur || '';
  document.getElementById('livAffaire').value = l.affaire || '';
  document.getElementById('livStatut').value = l.statut || 'En attente';
  document.getElementById('livNotes').value = l.notes || '';
  document.getElementById('livraisonFormTitle').textContent = 'MODIFIER LA LIVRAISON';
  document.getElementById('livraisonForm').classList.remove('hidden');
  document.getElementById('livraisonForm').scrollIntoView({behavior:'smooth'});
}
window.editLivraison = editLivraison;

async function deleteLivraison(id) {
  if (!confirm('Supprimer cette livraison ?')) return;
  const livraisons = loadLivraisons().filter(x => String(x.id) !== String(id));
  saveLivraisons(livraisons);
  renderLivraisons();
  await deleteLivraisonFromSheets(id);
}
window.deleteLivraison = deleteLivraison;

let _prixMarcheBase = null; // prix brut marché sans marge (global)

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'marche') initMarcheTab();
    });
  });
  const btnRefresh = document.getElementById('btnRefreshMarche');
  if (btnRefresh) btnRefresh.addEventListener('click', () => {
    loadMarcheActus();
    renderComparaison();
    showToast('🔄 Actualisation du marché...');
  });
});

// ============================================================
//  BON DE LIVRAISON — SCAN IA
// ============================================================

let blImageBase64 = null;
let blMimeType = null;
let blDetectedArticles = [];

function openBLModal() {
  document.getElementById('blModal').classList.remove('hidden');
  resetBLModal();
}

function closeBLModal() {
  document.getElementById('blModal').classList.add('hidden');
  blImageBase64 = null;
  blDetectedArticles = [];
}

function resetBLModal() {
  document.getElementById('blStep1').classList.remove('hidden');
  document.getElementById('blStep2').classList.add('hidden');
  document.getElementById('blPreview').classList.add('hidden');
  document.getElementById('blUploadZone').classList.remove('hidden');
  document.getElementById('blResults').classList.add('hidden');
  document.getElementById('blAnalyzing').classList.remove('hidden');
  document.getElementById('blError').classList.add('hidden');
  blImageBase64 = null;
}

function handleBLFile(file) {
  if (!file) return;
  blMimeType = file.type || 'image/jpeg';
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    blImageBase64 = dataUrl.split(',')[1];
    document.getElementById('blPreviewImg').src = dataUrl;
    document.getElementById('blUploadZone').classList.add('hidden');
    document.getElementById('blPreview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function analyzeBL() {
  if (!blImageBase64) return;

  document.getElementById('blStep1').classList.add('hidden');
  document.getElementById('blStep2').classList.remove('hidden');
  document.getElementById('blAnalyzing').classList.remove('hidden');
  document.getElementById('blResults').classList.add('hidden');
  document.getElementById('blError').classList.add('hidden');

  try {
    const formesList = 'Plat, UPN, UPE, UPAF, HEA, HEB, HEM, HD, IPE, IPN, Rond, Carré, Cornière, Tôle, Tube';
    
    const prompt = `Tu es un expert en acier et en lecture de bons de livraison.
Analyse cette image de bon de livraison et extrais tous les articles d'acier présents.

Pour chaque article, retourne un objet JSON avec ces champs :
- reference : qualité/nuance d'acier (ex: S235JR, S355J2, 304L, 316L...)
- designation : description complète
- forme : parmi cette liste uniquement: ${formesList}
- dimensions : dimensions exactes (ex: 200x10x6000, IPE200, UPN120...)
- quantite : nombre (chiffre uniquement)
- unite : barre, tôle, pièce, ml, kg ou m²
- prix : prix unitaire si visible, sinon 0
- fournisseur : nom du fournisseur si visible, sinon vide
- statut : "Disponible"

Retourne UNIQUEMENT un JSON valide, sans texte avant ou après :
{
  "articles": [...],
  "note": "remarque éventuelle sur le bon (fournisseur, date livraison, n° commande...)"
}

Si tu ne vois pas de bon de livraison ou d'articles d'acier, retourne:
{"articles": [], "note": "Aucun article d'acier détecté dans l'image"}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: blImageBase64
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.content[0].text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(text);

    blDetectedArticles = (result.articles || []).map((a, i) => ({ ...a, _tmpId: i }));

    if (blDetectedArticles.length === 0) {
      throw new Error(result.note || 'Aucun article détecté. Essayez avec une photo plus nette.');
    }

    document.getElementById('blResultCount').textContent = blDetectedArticles.length;
    document.getElementById('blNote').textContent = result.note ? '📋 ' + result.note : '';

    renderBLArticles();

    document.getElementById('blAnalyzing').classList.add('hidden');
    document.getElementById('blResults').classList.remove('hidden');

  } catch(e) {
    console.error('BL error:', e);
    document.getElementById('blAnalyzing').classList.add('hidden');
    document.getElementById('blError').classList.remove('hidden');
    document.getElementById('blErrorMsg').textContent = 
      e.message.includes('fetch') ? 'Erreur réseau — vérifiez votre connexion internet.' :
      e.message || 'Impossible d\'analyser le bon. Essayez avec une photo plus nette et bien éclairée.';
  }
}

function renderBLArticles() {
  const formes = ['Plat','UPN','UPE','UPAF','HEA','HEB','HEM','HD','IPE','IPN','Rond','Carré','Cornière','Tôle','Tube'];
  const unites = ['barre','tôle','pièce','ml','kg','m²'];

  document.getElementById('blArticlesList').innerHTML = blDetectedArticles.map((a, i) => {
    // Vérifier si article existe déjà
    const exists = state.articles.some(r => 
      r.reference.toLowerCase() === (a.reference||'').toLowerCase() &&
      r.dimensions === a.dimensions
    );
    const badge = exists 
      ? '<span class="bl-exists-badge">↑ Existe (qté sera ajoutée)</span>'
      : '<span class="bl-new-badge">✦ Nouvel article</span>';

    const formesOptions = formes.map(f => `<option value="${f}" ${f===a.forme?'selected':''}>${f}</option>`).join('');
    const unitesOptions = unites.map(u => `<option value="${u}" ${u===a.unite?'selected':''}>${u}</option>`).join('');

    return `<div class="bl-article-row" data-idx="${i}">
      <div class="bl-field" style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;color:var(--orange)">#${i+1} — ${a.reference||'?'}</span>
        ${badge}
        <button class="bl-remove" onclick="removeBLArticle(${i})" title="Supprimer">✕</button>
      </div>
      <div class="bl-field">
        <label>Qualité acier</label>
        <input type="text" value="${a.reference||''}" onchange="updateBLArticle(${i},'reference',this.value)" />
      </div>
      <div class="bl-field">
        <label>Désignation</label>
        <input type="text" value="${a.designation||''}" onchange="updateBLArticle(${i},'designation',this.value)" />
      </div>
      <div class="bl-field">
        <label>Forme</label>
        <select onchange="updateBLArticle(${i},'forme',this.value)">${formesOptions}</select>
      </div>
      <div class="bl-field">
        <label>Dimensions</label>
        <input type="text" value="${a.dimensions||''}" onchange="updateBLArticle(${i},'dimensions',this.value)" />
      </div>
      <div class="bl-field">
        <label>Quantité</label>
        <input type="number" value="${a.quantite||0}" min="0" step="0.01" onchange="updateBLArticle(${i},'quantite',parseFloat(this.value)||0)" />
      </div>
      <div class="bl-field">
        <label>Unité</label>
        <select onchange="updateBLArticle(${i},'unite',this.value)">${unitesOptions}</select>
      </div>
      <div class="bl-field">
        <label>Prix €</label>
        <input type="number" value="${a.prix||0}" min="0" step="0.01" onchange="updateBLArticle(${i},'prix',parseFloat(this.value)||0)" />
      </div>
      <div class="bl-field">
        <label>Fournisseur</label>
        <input type="text" value="${a.fournisseur||''}" onchange="updateBLArticle(${i},'fournisseur',this.value)" />
      </div>
    </div>`;
  }).join('');
}

function updateBLArticle(idx, field, value) {
  if (blDetectedArticles[idx]) blDetectedArticles[idx][field] = value;
}

function removeBLArticle(idx) {
  blDetectedArticles.splice(idx, 1);
  document.getElementById('blResultCount').textContent = blDetectedArticles.length;
  renderBLArticles();
}
window.removeBLArticle = removeBLArticle;
window.updateBLArticle = updateBLArticle;

async function importBLArticles() {
  if (!blDetectedArticles.length) return;
  let added = 0, updated = 0;

  for (const a of blDetectedArticles) {
    // Chercher si article existe déjà (même référence + dimensions)
    const existing = state.articles.find(r =>
      r.reference.toLowerCase() === (a.reference||'').toLowerCase() &&
      r.dimensions === a.dimensions
    );

    if (existing) {
      // Ajouter la quantité
      const oldQty = existing.quantite;
      existing.quantite += parseFloat(a.quantite) || 0;
      if (existing.quantite > 3) existing.statut = 'Disponible';
      const mvt = addMouvement('MODIFICATION', existing, 'Réception BL : +' + a.quantite + ' ' + a.unite);
      await pushArticle(existing);
      await pushMouvement(mvt);
      updated++;
    } else {
      // Nouvel article
      const article = {
        id: uid(),
        reference:   a.reference || '',
        designation: a.designation || '',
        forme:       a.forme || 'Plat',
        dimensions:  a.dimensions || '',
        quantite:    parseFloat(a.quantite) || 0,
        unite:       a.unite || 'barre',
        prix:        parseFloat(a.prix) || 0,
        fournisseur: a.fournisseur || '',
        localisation:'',
        statut:      'Disponible',
        dateEntree:  today(),
      };
      state.articles.push(article);
      const mvt = addMouvement('AJOUT', article, 'Import bon de livraison');
      await pushArticle(article);
      await pushMouvement(mvt);
      added++;
    }
  }

  saveLocal();
  render();
  closeBLModal();
  showToast(`✅ Import terminé : ${added} ajouté(s), ${updated} mis à jour`, 4000);
}

// Events BL
document.addEventListener('DOMContentLoaded', () => {
  const btnScanBL   = document.getElementById('btnScanBL');
  const blModalEl   = document.getElementById('blModal');
  const btnBLClose  = document.getElementById('blModalClose');
  const btnBLCamera = document.getElementById('btnBLCamera');
  const btnBLFile   = document.getElementById('btnBLFile');
  const blFileInput = document.getElementById('blFileInput');
  const btnBLRetake = document.getElementById('btnBLRetake');
  const btnBLAnalyze= document.getElementById('btnBLAnalyze');
  const btnBLBack   = document.getElementById('btnBLBack');
  const btnBLImport = document.getElementById('btnBLImport');
  const btnBLRetry  = document.getElementById('btnBLRetry');

  if (btnScanBL)    btnScanBL.addEventListener('click', openBLModal);
  if (btnBLClose)   btnBLClose.addEventListener('click', closeBLModal);
  if (blModalEl)    blModalEl.addEventListener('click', e => { if(e.target===blModalEl) closeBLModal(); });

  if (btnBLCamera)  btnBLCamera.addEventListener('click', () => {
    blFileInput.setAttribute('capture','environment');
    blFileInput.click();
  });
  if (btnBLFile)    btnBLFile.addEventListener('click', () => {
    blFileInput.removeAttribute('capture');
    blFileInput.click();
  });
  if (blFileInput)  blFileInput.addEventListener('change', e => handleBLFile(e.target.files[0]));

  if (btnBLRetake)  btnBLRetake.addEventListener('click', () => {
    document.getElementById('blPreview').classList.add('hidden');
    document.getElementById('blUploadZone').classList.remove('hidden');
    blImageBase64 = null;
  });
  if (btnBLAnalyze) btnBLAnalyze.addEventListener('click', analyzeBL);
  if (btnBLBack)    btnBLBack.addEventListener('click', () => {
    document.getElementById('blStep2').classList.add('hidden');
    document.getElementById('blStep1').classList.remove('hidden');
    document.getElementById('blPreview').classList.remove('hidden');
    document.getElementById('blUploadZone').classList.add('hidden');
  });
  if (btnBLImport)  btnBLImport.addEventListener('click', importBLArticles);
  if (btnBLRetry)   btnBLRetry.addEventListener('click', resetBLModal);
});

// ============================================================
//  IMPORT EXCEL / CSV
// ============================================================

let importedRows = [];

function openImportModal() {
  document.getElementById('importModal').classList.remove('hidden');
  resetImportModal();
}

function closeImportModal() {
  document.getElementById('importModal').classList.add('hidden');
  importedRows = [];
}

function resetImportModal() {
  document.getElementById('importStep1').classList.remove('hidden');
  document.getElementById('importStep2').classList.add('hidden');
  document.getElementById('importFileInput').value = '';
  importedRows = [];
}

// Télécharger le modèle CSV
function downloadTemplate() {
  const header = 'designation;qualite_acier;forme;dimensions;quantite;unite;prix;fournisseur;localisation;statut';
  const example = [
    'Acier de construction;S235JR;Plat;200x10x6000;10;barre;85.50;ArcelorMittal;A1-01;Disponible',
    'Acier HLE;S355J2;UPN;UPN120x6000;5;barre;142.00;Aperam;A1-02;Disponible',
    'Inox austénitique;304L;Tôle;1500x3000x3;3;tôle;520.00;Outokumpu;B2-01;Disponible',
  ];
  const csv = [header, ...example].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = 'modele_import_steelstock.csv';
  a.click();
  showToast('📥 Modèle téléchargé — ouvrez-le dans Excel');
}

// Lire le fichier importé
function handleImportFile(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => parseCSV(e.target.result);
    reader.readAsText(file, 'UTF-8');
  } else if (ext === 'xlsx' || ext === 'xls') {
    // Utiliser SheetJS via CDN
    if (!window.XLSX) {
      showToast('⏳ Chargement de la bibliothèque Excel...');
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload = () => {
        const reader = new FileReader();
        reader.onload = e => parseXLSX(e.target.result);
        reader.readAsArrayBuffer(file);
      };
      document.head.appendChild(script);
    } else {
      const reader = new FileReader();
      reader.onload = e => parseXLSX(e.target.result);
      reader.readAsArrayBuffer(file);
    }
  } else {
    showToast('❌ Format non supporté. Utilisez .xlsx, .xls ou .csv');
  }
}

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { showToast('❌ Fichier vide ou invalide'); return; }
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    if (vals.length < 2) continue;
    const row = mapRow(headers, vals);
    if (row) rows.push(row);
  }
  showImportPreview(rows);
}

function parseXLSX(buffer) {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (data.length < 2) { showToast('❌ Fichier vide'); return; }
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const rows = [];
    for (let i = 1; i < data.length; i++) {
      const vals = data[i].map(v => String(v).trim());
      if (vals.every(v => !v)) continue;
      const row = mapRow(headers, vals);
      if (row) rows.push(row);
    }
    showImportPreview(rows);
  } catch(e) {
    showToast('❌ Erreur lecture Excel : ' + e.message);
  }
}

function mapRow(headers, vals) {
  const get = (...keys) => {
    for (const k of keys) {
      const idx = headers.findIndex(h => h.includes(k));
      if (idx >= 0) return String(vals[idx] || '').trim();
    }
    return '';
  };

  // ---- FORMAT SMART PORTAL ----
  // Colonnes: Quantité | Type | Sous type | Commentaire achat | Longueur
  const isSmartPortal = headers.some(h => h.includes('sous type') || h.includes('sous_type')) ||
                        (headers.includes('type') && headers.some(h => h.includes('longueur')));

  if (isSmartPortal) {
    const quantite  = parseFloat(get('quantité','quantite','qty')) || 0;
    const type      = get('type').replace(/\s+/g, '').toUpperCase(); // ex: "IPE"
    const sousType  = get('sous type','sous_type','soustype').replace(/\s+/g, ''); // ex: "180"
    const longueur  = get('longueur','length').replace(/\s+/g, ''); // ex: "09100" = 9100mm
    const commentaire = get('commentaire','comment');

    // Ignorer les lignes FRAIS/FACTURATION
    if (type === 'FRAIS' || type === 'FACTURATION' || type === '' || sousType === 'FACTURATION') return null;

    // Construire les dimensions : IPE180 x 9100mm
    const longueurMm = longueur ? parseInt(longueur) : 0;
    const longueurStr = longueurMm ? (longueurMm + 'mm') : '';
    const dimensions = sousType + (longueurStr ? 'x' + longueurStr : '');

    // Détecter la forme
    const formes = ['Plat','UPN','UPE','UPAF','HEA','HEB','HEM','HD','IPE','IPN','Rond','Carré','Cornière','Tôle','Tube'];
    const forme = formes.find(f => type.toUpperCase().includes(f.toUpperCase())) || type || 'Plat';

    // Désignation : Type + Sous type
    const designation = forme + ' ' + sousType;

    return {
      designation,
      reference:    '',           // Pas dans le fichier Smart Portal
      forme,
      dimensions,
      quantite,
      unite:        'barre',
      prix:         0,
      fournisseur:  '',
      localisation: '',
      statut:       'Disponible',
    };
  }

  // ---- FORMAT GÉNÉRIQUE ----
  const byPos = (i) => String(vals[i] || '').trim();
  return {
    designation:  get('designation','désignation','libelle','desc') || byPos(0),
    reference:    get('qualite','qualité','reference','référence','nuance') || byPos(1),
    forme:        get('forme','profil','type') || byPos(2),
    dimensions:   get('dimension','dims','section') || byPos(3),
    quantite:     parseFloat(get('quantite','quantité','qte','qty') || byPos(4)) || 0,
    unite:        get('unite','unité','unit') || byPos(5) || 'barre',
    prix:         parseFloat(get('prix','price','pu') || byPos(6)) || 0,
    fournisseur:  get('fournisseur','supplier') || byPos(7) || '',
    localisation: get('localisation','location') || byPos(8) || '',
    statut:       get('statut','status') || byPos(9) || 'Disponible',
  };
}

function showImportPreview(rows) {
  if (!rows.length) { showToast('❌ Aucun article trouvé dans le fichier'); return; }
  importedRows = rows;

  document.getElementById('importCount').textContent = rows.length;
  document.getElementById('importPreviewBody').innerHTML = rows.map(r => {
    const sc = statutClass(r.statut || 'Disponible');
    return `<tr style="border-bottom:1px solid var(--bg3)">
      <td style="padding:7px 8px;color:var(--text)">${r.designation}</td>
      <td style="padding:7px 8px;color:var(--orange);font-weight:700">${r.reference}</td>
      <td style="padding:7px 8px;color:var(--text-sub)">${r.forme}</td>
      <td style="padding:7px 8px;color:var(--text-muted)">${r.dimensions}</td>
      <td style="padding:7px 8px;font-weight:700">${r.quantite} ${r.unite}</td>
      <td style="padding:7px 8px;color:#60a5fa">${r.prix ? fmt(r.prix)+' €' : '—'}</td>
      <td style="padding:7px 8px"><span class="statut-badge ${sc}">${r.statut||'Disponible'}</span></td>
    </tr>`;
  }).join('');

  document.getElementById('importStep1').classList.add('hidden');
  document.getElementById('importStep2').classList.remove('hidden');
}

async function confirmImport() {
  if (!importedRows.length) return;
  let added = 0, updated = 0;

  for (const r of importedRows) {
    // Vérifier si article existe déjà
    const existing = state.articles.find(a =>
      a.reference.toLowerCase() === (r.reference||'').toLowerCase() &&
      a.dimensions === r.dimensions
    );

    if (existing) {
      const oldQty = existing.quantite;
      existing.quantite += r.quantite;
      if (existing.quantite > 3) existing.statut = 'Disponible';
      const mvt = addMouvement('MODIFICATION', existing, 'Import fichier : +' + r.quantite + ' ' + r.unite);
      await pushArticle(existing);
      await pushMouvement(mvt);
      updated++;
    } else {
      const article = {
        id:           uid(),
        reference:    r.reference || '',
        designation:  r.designation || '',
        forme:        r.forme || 'Plat',
        dimensions:   r.dimensions || '',
        quantite:     r.quantite || 0,
        unite:        r.unite || 'barre',
        prix:         r.prix || 0,
        fournisseur:  r.fournisseur || '',
        localisation: r.localisation || '',
        statut:       r.statut || 'Disponible',
        dateEntree:   today(),
      };
      state.articles.push(article);
      const mvt = addMouvement('AJOUT', article, 'Import fichier Excel/CSV');
      await pushArticle(article);
      await pushMouvement(mvt);
      added++;
    }
  }

  saveLocal();
  render();
  closeImportModal();
  showToast('✅ Import terminé : ' + added + ' ajouté(s), ' + updated + ' mis à jour', 4000);
}

// Events import
document.addEventListener('DOMContentLoaded', () => {
  const btnImportXLS    = document.getElementById('btnImportXLS');
  const importModalEl   = document.getElementById('importModal');
  const btnImportClose  = document.getElementById('importModalClose');
  const btnDownloadTpl  = document.getElementById('btnDownloadTemplate');
  const btnImportChoose = document.getElementById('btnImportChoose');
  const importFileInput = document.getElementById('importFileInput');
  const importUpload    = document.getElementById('importUploadZone');
  const btnImportBack   = document.getElementById('btnImportBack');
  const btnImportConfirm= document.getElementById('btnImportConfirm');

  if (btnImportXLS)     btnImportXLS.addEventListener('click', openImportModal);
  if (btnImportClose)   btnImportClose.addEventListener('click', closeImportModal);
  if (importModalEl)    importModalEl.addEventListener('click', e => { if(e.target===importModalEl) closeImportModal(); });
  if (btnDownloadTpl)   btnDownloadTpl.addEventListener('click', downloadTemplate);
  if (btnImportChoose)  btnImportChoose.addEventListener('click', () => importFileInput.click());
  if (importFileInput)  importFileInput.addEventListener('change', e => handleImportFile(e.target.files[0]));
  if (btnImportBack)    btnImportBack.addEventListener('click', resetImportModal);
  if (btnImportConfirm) btnImportConfirm.addEventListener('click', confirmImport);

  // Drag & drop
  if (importUpload) {
    importUpload.addEventListener('dragover', e => { e.preventDefault(); importUpload.style.borderColor='var(--orange)'; });
    importUpload.addEventListener('dragleave', () => importUpload.style.borderColor='');
    importUpload.addEventListener('drop', e => {
      e.preventDefault();
      importUpload.style.borderColor='';
      const file = e.dataTransfer.files[0];
      if (file) handleImportFile(file);
    });
  }
});
