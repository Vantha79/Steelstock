'use strict';

// ============================================================
//  DONNÉES PAR DÉFAUT
// ============================================================
const DEFAULT_DATA = [
  { id:1, reference:"S235JR", designation:"Acier de construction", forme:"Plat", dimensions:"200x10x6000", quantite:15, unite:"barre", prix:85.50, fournisseur:"ArcelorMittal", localisation:"A1-01", statut:"Disponible", dateEntree:"2025-01-10" },
  { id:2, reference:"S355J2", designation:"Acier HLE", forme:"UPN", dimensions:"UPN120x6000", quantite:8, unite:"barre", prix:142.00, fournisseur:"Aperam", localisation:"A1-02", statut:"Disponible", dateEntree:"2025-01-15" },
  // ... (autres données par défaut)
];

// ============================================================
//  STATE - AJOUT LIVRAISONS
// ============================================================
let state = {
  articles: [],
  mouvements: [],
  livraisons: [],  // ← NOUVEAU : intégration livraisons
  nextId: 9,
  sortKey: 'reference',
  sortDir: 'asc',
  search: '',
  filtreStatut: '',
  filtreFormes: '',
  editingId: null,
  editingLivraisonId: null,  // ← Variable globale → state
  selectedIds: [],
  qrSearch: '',
  scriptUrl: '',
  syncing: false,
  userName: '',
};

// ============================================================
//  PERSISTENCE LOCALE - INCLUT LIVRAISONS
// ============================================================
function saveLocal() {
  try {
    localStorage.setItem('ss_articles', JSON.stringify(state.articles));
    localStorage.setItem('ss_mouvements', JSON.stringify(state.mouvements));
    localStorage.setItem('ss_livraisons', JSON.stringify(state.livraisons));  // ← AJOUTÉ
    localStorage.setItem('ss_nextId', String(state.nextId));
    localStorage.setItem('ss_scriptUrl', state.scriptUrl || '');
    localStorage.setItem('ss_userName', state.userName || '');
  } catch(e) {}
}

function loadLocal() {
  try {
    const a = localStorage.getItem('ss_articles');
    const m = localStorage.getItem('ss_mouvements');
    const l = localStorage.getItem('ss_livraisons');  // ← AJOUTÉ
    const n = localStorage.getItem('ss_nextId');
    const u = localStorage.getItem('ss_scriptUrl');
    state.articles   = a ? JSON.parse(a) : JSON.parse(JSON.stringify(DEFAULT_DATA));
    state.mouvements = m ? JSON.parse(m) : [];
    state.livraisons = l ? JSON.parse(l) : [];  // ← AJOUTÉ
    state.nextId     = n ? parseInt(n) : 9;
    state.scriptUrl  = u || '';
    state.userName   = localStorage.getItem('ss_userName') || '';
  } catch(e) {
    state.articles = JSON.parse(JSON.stringify(DEFAULT_DATA));
    state.mouvements = [];
    state.livraisons = [];  // ← AJOUTÉ
    state.nextId = 9;
  }
}

// ============================================================
//  GOOGLE SHEETS SYNC - INCLUT LIVRAISONS
// ============================================================
async function sheetRequest(action, payload = {}) {
  if (!state.scriptUrl) return null;
  try {
    const url = state.scriptUrl + '?action=' + action + '&t=' + Date.now();
    const resp = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
    return await resp.json();
  } catch(e) {
    console.error('Sheet error:', e);
    return null;
  }
}

async function syncFromSheets() {
  if (!state.scriptUrl || state.syncing) return;
  state.syncing = true;
  setSyncBadge('wait', 'Récupération depuis Google Sheets...');
  try {
    const res = await sheetRequest('getAll');
    if (res && res.ok) {
      // Articles + mouvements (code existant)
      if (res.articles && res.articles.length > 0) {
        // Fusion intelligente...
        state.articles = res.articles.map(a => { /* code fusion existant */ });
      }
      if (res.mouvements) state.mouvements = res.mouvements;

      // ← NOUVEAU : Livraisons
      if (res.livraisons) {
        state.livraisons = res.livraisons.map(liv => ({
          ...liv,
          id: parseInt(liv.id) || liv.id,
          quantite: parseFloat(liv.quantite || 0)
        }));
      }

      saveLocal();
      render();
      renderLivraisons();  // ← AJOUTÉ
      setSyncBadge('ok');
    } else {
      setSyncBadge('error', 'Impossible de lire Google Sheets');
    }
  } catch(e) {
    setSyncBadge('error', 'Erreur réseau');
  }
  state.syncing = false;
}

// ← NOUVEAU : Push livraison vers Sheets
async function pushLivraison(livraison) {
  if (!state.scriptUrl) return;
  const res = await sheetRequest('saveLivraison', { livraison });
  if (res && res.ok) setSyncBadge('ok');
  else setSyncBadge('error', 'Sync livraison échouée');
}

// ============================================================
//  LIVRAISONS - INTÉGRÉES À STATE
// ============================================================
function loadLivraisons() {
  return state.livraisons;
}

function saveLivraisons(livs) {
  state.livraisons = livs;
  saveLocal();
  // Sync Sheets si connecté
  if (state.scriptUrl && livs.length) {
    pushLivraison(livs[livs.length - 1]);
  }
}

function renderLivraisons() {
  const livs = state.livraisons;
  // Votre code render existant, ex:
  document.getElementById('livraisonsBody').innerHTML = livs.map(liv => `
    <tr>
      <td>${fmtDate(liv.date)}</td>
      <td>${liv.fournisseur}</td>
      <td>${liv.affaire}</td>
      <td>${liv.statut}</td>
      <td>${liv.notes}</td>
      <td><button onclick="editLivraison(${liv.id})">✎</button></td>
    </tr>
  `).join('');
}

// Fonction save livraison (exemple adapté)
function sauvegarderLiv() {
  const date = document.getElementById('liv-date').value;
  const fournisseur = document.getElementById('liv-fournisseur').value.trim();
  const affaire = document.getElementById('liv-affaire').value.trim();
  const statut = document.getElementById('liv-statut').value;
  const notes = document.getElementById('liv-note').value.trim();

  if (!date || !fournisseur || !affaire) {
    showToast('Date, fournisseur et affaire obligatoires');
    return;
  }

  const livraisons = state.livraisons;
  if (state.editingLivraisonId) {
    const idx = livraisons.findIndex(x => x.id == state.editingLivraisonId);
    if (idx >= 0) livraisons[idx] = { ...livraisons[idx], date, fournisseur, affaire, statut, notes };
  } else {
    livraisons.push({
      id: 'liv' + Date.now(),
      date, fournisseur, affaire, statut, notes,
      createdAt: new Date().toISOString()
    });
  }

  saveLivraisons(livraisons);  // ← Utilise state + sync
  document.getElementById('livraisonForm').classList.add('hidden');
  state.editingLivraisonId = null;
  renderLivraisons();
  showToast('Livraison sauvegardée ✅');
}

// Dans tabs event (onglet livraison) :
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    // ...
    if (btn.dataset.tab === 'livraison') {
      setTimeout(() => {
        renderLivraisons();
        if (state.scriptUrl) syncFromSheets();  // ← Sync auto
      }, 200);
    }
  });
});

// ============================================================
//  RESTE DU CODE INCHANGÉ (CRUD, Render, etc.)
// ============================================================
// ... (copiez-collez le reste de votre code existant : render(), handleFormSubmit(), etc.)

// Au chargement :
document.addEventListener('DOMContentLoaded', async () => {
  loadLocal();  // Charge maintenant articles + livraisons
  // ... reste inchangé
});
