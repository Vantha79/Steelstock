// ============================================================
//  STEELSTOCK — Google Apps Script
//  Copiez-collez tout ce fichier dans Google Apps Script
//  Extensions → Apps Script → Effacer tout → Coller → Sauvegarder
//  Puis : Déployer → Nouvelle version → Tout le monde → Déployer
// ============================================================

var SHEET_ARTICLES   = 'Articles';
var SHEET_MOUVEMENTS = 'Mouvements';
var SHEET_LIVRAISONS = 'Livraisons';
var SHEET_BOULONNERIE = 'Boulonnerie';
var COLS_LIVRAISONS  = ['id','date','fournisseur','affaire','statut','notes','createdAt'];
var COLS_BOULONNERIE = ['id','date','affaire','fournisseur','detail','statut','createdAt'];

var COLS_ARTICLES = ['id','reference','designation','forme','dimensions','quantite','unite','prix','fournisseur','localisation','statut','dateEntree','creePar','modifiePar','dateModif','lastNote'];
var COLS_MVT      = ['id','date','type','reference','designation','quantite','note','par'];

function doGet(e) {
  const result = handleRequest(e);
  return ContentService
    .createTextOutput(result.getContent())
    .setMimeType(ContentService.MimeType.JSON);
}
// ─── LIVRAISONS ───────────────────────────────────────────────


function getLivraisons() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('Livraisons');
  if (!sh) return { livraisons: [] };
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { livraisons: [] };
  const headers = data[0];
  const livraisons = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]) : ''; });
    return obj;
  });
  return { livraisons };
}

function saveLivraison(params) {
  const liv = params.livraison;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('Livraisons');
  if (!sh) {
    sh = ss.insertSheet('Livraisons');
    sh.appendRow(COLS_LIVRAISONS);
  }
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  // Chercher ligne existante
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(liv.id)) {
      const row = COLS_LIVRAISONS.map(c => liv[c] || '');
      sh.getRange(i+1, 1, 1, row.length).setValues([row]);
      return { ok: true };
    }
  }
  // Nouvelle ligne
  sh.appendRow(COLS_LIVRAISONS.map(c => liv[c] || ''));
  return { ok: true };
}

function deleteLivraison(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Livraisons');
  if (!sh) return { ok: true };
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.id)) {
      sh.deleteRow(i+1);
      return { ok: true };
    }
  }
  return { ok: true };
}

// ─── BOULONNERIE ───────────────────────────────────────────────
// ============================================================
//  BOULONNERIE
// ============================================================

let _boulonneries = JSON.parse(localStorage.getItem('ss_boulonnerie') || '[]');
let _boulEditId = null;

function saveBoulLocal() {
  localStorage.setItem('ss_boulonnerie', JSON.stringify(_boulonneries));
}

function afficherBoul(q) {
  _boulonneries = JSON.parse(localStorage.getItem('ss_boulonnerie') || '[]');
  const el = document.getElementById('listeBoul');
  if (!el) return;

  let arr = [..._boulonneries];
  if (q) {
    const s = q.toLowerCase();
    arr = arr.filter(b =>
      [b.date, b.affaire, b.fournisseur, b.detail, b.statut, b.notes]
        .join(' ').toLowerCase().includes(s)
    );
  }
  arr.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (!arr.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Aucune entrée — cliquez sur + Nouvelle entrée</div>';
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const colors = { 'En attente': '#fbbf24', 'Confirmée': '#34d399', 'Livrée': '#60a5fa', 'Annulée': '#f87171' };

  el.innerHTML = arr.map(b => {
    const rawDate = normaliserDate(b.date || '');
    const isToday = rawDate === today;
    const isPast  = rawDate < today;
    const c = colors[b.statut] || '#94a3b8';
    const dateAff = rawDate
      ? new Date(rawDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

    return `<div style="background:var(--bg2);border:1px solid ${isToday ? 'var(--orange)' : 'var(--border)'};border-radius:8px;padding:14px;${isPast && b.statut !== 'Livrée' && b.statut !== 'Annulée' ? 'opacity:0.65' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;color:${isToday ? 'var(--orange)' : 'var(--text)'};font-size:15px">${dateAff}${isToday ? ' 📅' : ''}</div>
          <div style="color:var(--orange);font-weight:600;margin-top:2px">${b.affaire || '—'}</div>
          <div style="color:var(--text-muted);font-size:13px">${b.fournisseur || '—'}</div>
          ${b.detail ? `<div style="color:var(--text);font-size:12px;margin-top:4px">🔩 ${b.detail}</div>` : ''}
          ${b.notes  ? `<div style="color:var(--text-muted);font-size:11px;margin-top:4px">${b.notes}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <span style="background:${c}22;color:${c};border:1px solid ${c};padding:3px 10px;border-radius:20px;font-size:11px;white-space:nowrap">${b.statut || '—'}</span>
          <div style="display:flex;gap:6px">
            <button onclick="modifBoul('${b.id}')" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px">✎ Modifier</button>
            <button onclick="suppBoul('${b.id}')" style="background:none;border:1px solid #f87171;color:#f87171;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px">✕</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}
window.afficherBoul = afficherBoul;

function filtrerBoul(q) { afficherBoul(q); }
window.filtrerBoul = filtrerBoul;

function ouvrirFormBoul(clear) {
  _boulEditId = null;
  const f = document.getElementById('formBoul');
  if (!f) return;
  document.getElementById('boulD').value = new Date().toISOString().split('T')[0];
  document.getElementById('boulAffaire').value = '';
  document.getElementById('boulFourn').value = '';
  document.getElementById('boulDetail').value = '';
  document.getElementById('boulStatut').value = 'En attente';
  document.getElementById('boulNotes').value = '';
  document.getElementById('titreBoul').textContent = 'NOUVELLE ENTRÉE';
  f.style.display = 'block';
  f.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.ouvrirFormBoul = ouvrirFormBoul;

function fermerFormBoul() {
  const f = document.getElementById('formBoul');
  if (f) f.style.display = 'none';
  _boulEditId = null;
}
window.fermerFormBoul = fermerFormBoul;

function sauvegarderBoul() {
  const date       = document.getElementById('boulD').value;
  const affaire    = document.getElementById('boulAffaire').value.trim();
  const fournisseur= document.getElementById('boulFourn').value.trim();
  const detail     = document.getElementById('boulDetail').value.trim();
  const statut     = document.getElementById('boulStatut').value;
  const notes      = document.getElementById('boulNotes').value.trim();

  if (!date)     { alert('Veuillez saisir une date'); return; }
  if (!affaire)  { alert('Veuillez saisir une affaire'); return; }

  let savedBoul;
  if (_boulEditId) {
    const idx = _boulonneries.findIndex(x => x.id === _boulEditId);
    if (idx >= 0) {
      _boulonneries[idx] = { ..._boulonneries[idx], date, affaire, fournisseur, detail, statut, notes };
      savedBoul = _boulonneries[idx];
    }
  } else {
    savedBoul = {
      id: 'boul_' + Date.now(),
      date, affaire, fournisseur, detail, statut, notes,
      createdAt: new Date().toISOString(),
    };
    _boulonneries.push(savedBoul);
  }

  saveBoulLocal();
  fermerFormBoul();
  afficherBoul();
  showToast('✅ Entrée boulonnerie sauvegardée');

  if (savedBoul && state.scriptUrl) {
    sheetRequest('saveBoulonnerie', { boulonnerie: savedBoul });
  }
}
window.sauvegarderBoul = sauvegarderBoul;

function modifBoul(id) {
  const b = _boulonneries.find(x => x.id === id);
  if (!b) return;
  _boulEditId = id;
  document.getElementById('boulD').value        = normaliserDate(b.date || '');
  document.getElementById('boulAffaire').value  = b.affaire || '';
  document.getElementById('boulFourn').value    = b.fournisseur || '';
  document.getElementById('boulDetail').value   = b.detail || '';
  document.getElementById('boulStatut').value   = b.statut || 'En attente';
  document.getElementById('boulNotes').value    = b.notes || '';
  document.getElementById('titreBoul').textContent = 'MODIFIER L\'ENTRÉE';
  const f = document.getElementById('formBoul');
  if (f) { f.style.display = 'block'; f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
window.modifBoul = modifBoul;

function suppBoul(id) {
  if (!confirm('Supprimer cette entrée boulonnerie ?')) return;
  _boulonneries = _boulonneries.filter(x => x.id !== id);
  saveBoulLocal();
  afficherBoul();
  showToast('🗑 Entrée supprimée');
  if (state.scriptUrl) sheetRequest('deleteBoulonnerie', { id });
}
window.suppBoul = suppBoul;

async function syncBoulFromSheet() {
  const ind = document.getElementById('boulSyncIndicator');
  if (ind) ind.style.display = 'inline';
  afficherBoul();
  const data = await sheetRequest('getAll', {});
  if (data && data.boulonnerie && Array.isArray(data.boulonnerie)) {
    const boul = data.boulonnerie
      .filter(b => b.id)
      .map(b => ({
        ...b,
        // Correction décalage UTC : normaliser la date comme pour les livraisons
        date: normaliserDate(b.date || ''),
      }));
    localStorage.setItem('ss_boulonnerie', JSON.stringify(boul));
    _boulonneries = boul;
    afficherBoul();
    showToast('🔄 Boulonnerie synchronisée (' + boul.length + ' entrée(s))');
  }
  if (ind) ind.style.display = 'none';
}
window.syncBoulFromSheet = syncBoulFromSheet;

function exportBoulCSV() {
  const arr = JSON.parse(localStorage.getItem('ss_boulonnerie') || '[]');
  if (!arr.length) { showToast('Aucune donnée à exporter'); return; }
  const cols = ['date', 'affaire', 'fournisseur', 'detail', 'statut', 'notes'];
  const headers = ['Date', 'Affaire', 'Fournisseur', 'Détail', 'Statut', 'Notes'];
  const csv = [
    headers.join(';'),
    ...arr.map(b => cols.map(c => b[c] || '').join(';'))
  ].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = 'boulonnerie.csv';
  a.click();
  showToast('📥 Export CSV boulonnerie téléchargé');
}
window.exportBoulCSV = exportBoulCSV;
function getBoulonnerie() {
  const sh = getOrCreateSheet(SHEET_BOULONNERIE, COLS_BOULONNERIE);
  return { ok: true, boulonnerie: sheetToObjects(sh, COLS_BOULONNERIE) };
}

function saveBoulonnerie(params) {
  const b = params.boulonnerie;
  if (!b || !b.id) return { ok: false, error: 'Entrée invalide' };
  const sh = getOrCreateSheet(SHEET_BOULONNERIE, COLS_BOULONNERIE);
  const data = sh.getDataRange().getValues();
  const row = COLS_BOULONNERIE.map(function(c){ return b[c] !== undefined ? b[c] : ''; });
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(b.id)) {
      sh.getRange(i+1, 1, 1, row.length).setValues([row]);
      return { ok: true };
    }
  }
  sh.appendRow(row);
  return { ok: true };
}

function deleteBoulonnerie(params) {
  if (!params.id) return { ok: false, error: 'ID manquant' };
  const sh = getOrCreateSheet(SHEET_BOULONNERIE, COLS_BOULONNERIE);
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(params.id)) {
      sh.deleteRow(i+1);
      return { ok: true };
    }
  }
  return { ok: true };
}

function doPost(e) {
  const result = handleRequest(e);
  return ContentService
    .createTextOutput(result.getContent())
    .setMimeType(ContentService.MimeType.JSON);
}

function handleRequest(e) {
  try {
    var action = (e.parameter && e.parameter.action) || '';
    var payload = {};
    if (e.postData && e.postData.contents) {
      try { payload = JSON.parse(e.postData.contents); } catch(err) {}
    }
    var result;
    switch(action) {
      case 'getAll':           result = getAll();                             break;
      case 'saveArticle':      result = saveArticle(payload.article);        break;
      case 'deleteArticle':    result = deleteArticle(payload.id);           break;
      case 'saveMouvement':    result = saveMouvement(payload.mouvement);    break;
      case 'replaceAll':       result = replaceAll(payload);                 break;
      case 'saveLivraison':    result = saveLivraison(payload);              break;
      case 'deleteLivraison':  result = deleteLivraison(payload);            break;
      case 'getBoulonnerie':   result = getBoulonnerie();                    break;
      case 'saveBoulonnerie':  result = saveBoulonnerie(payload);            break;
      case 'deleteBoulonnerie':result = deleteBoulonnerie(payload);          break;
      default:                 result = { ok:false, error:'Action inconnue: '+action };
    }
    return jsonResponse(result);
  } catch(err) {
    return jsonResponse({ ok:false, error: err.toString() });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#1a1d27').setFontColor('#f97316');
  }
  return sheet;
}

function getAll() {
  var sheetA = getOrCreateSheet(SHEET_ARTICLES, COLS_ARTICLES);
  var sheetM = getOrCreateSheet(SHEET_MOUVEMENTS, COLS_MVT);
  var sheetL = getOrCreateSheet(SHEET_LIVRAISONS, COLS_LIVRAISONS);
  var sheetB = getOrCreateSheet(SHEET_BOULONNERIE, COLS_BOULONNERIE);
  return { ok:true, articles:sheetToObjects(sheetA, COLS_ARTICLES), mouvements:sheetToObjects(sheetM, COLS_MVT), livraisons:sheetToObjects(sheetL, COLS_LIVRAISONS), boulonnerie:sheetToObjects(sheetB, COLS_BOULONNERIE) };
}

function sheetToObjects(sheet, cols) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function(h){ return String(h).trim(); });
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0] && !data[i][1]) continue;
    var obj = {};
    cols.forEach(function(col) {
      var idx = headers.indexOf(col);
      obj[col] = idx >= 0 ? (data[i][idx] !== undefined ? data[i][idx] : '') : '';
    });
    result.push(obj);
  }
  return result;
}

function saveArticle(article) {
  if (!article || !article.id) return { ok:false, error:'Article invalide' };
  var sheet = getOrCreateSheet(SHEET_ARTICLES, COLS_ARTICLES);
  var data = sheet.getDataRange().getValues();
  var id = String(article.id);
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) { rowIndex = i+1; break; }
  }
  var row = COLS_ARTICLES.map(function(c){ return article[c] !== undefined ? article[c] : ''; });
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { ok:true };
}

function deleteArticle(id) {
  if (!id) return { ok:false, error:'ID manquant' };
  var sheet = getOrCreateSheet(SHEET_ARTICLES, COLS_ARTICLES);
  var data = sheet.getDataRange().getValues();
  for (var i = data.length-1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) { sheet.deleteRow(i+1); return { ok:true }; }
  }
  return { ok:false, error:'Article introuvable' };
}

function saveMouvement(mvt) {
  if (!mvt) return { ok:false };
  var sheet = getOrCreateSheet(SHEET_MOUVEMENTS, COLS_MVT);
  var row = COLS_MVT.map(function(c){ return mvt[c] !== undefined ? mvt[c] : ''; });
  sheet.appendRow(row);
  return { ok:true };
}

function replaceAll(payload) {
  var articles = payload.articles || [];
  var mouvements = payload.mouvements || [];

  var sheetA = getOrCreateSheet(SHEET_ARTICLES, COLS_ARTICLES);
  var lastA = sheetA.getLastRow();
  if (lastA > 1) sheetA.deleteRows(2, lastA-1);
  if (articles.length > 0) {
    var rowsA = articles.map(function(a){ return COLS_ARTICLES.map(function(c){ return a[c]!==undefined?a[c]:''; }); });
    sheetA.getRange(2, 1, rowsA.length, COLS_ARTICLES.length).setValues(rowsA);
  }

  var sheetM = getOrCreateSheet(SHEET_MOUVEMENTS, COLS_MVT);
  var lastM = sheetM.getLastRow();
  if (lastM > 1) sheetM.deleteRows(2, lastM-1);
  if (mouvements.length > 0) {
    var rowsM = mouvements.map(function(m){ return COLS_MVT.map(function(c){ return m[c]!==undefined?m[c]:''; }); });
    sheetM.getRange(2, 1, rowsM.length, COLS_MVT.length).setValues(rowsM);
  }
  return { ok:true };
}

