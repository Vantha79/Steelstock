// ============================================================
//  STEELSTOCK — Google Apps Script
//  Extensions → Apps Script → Effacer tout → Coller → Sauvegarder
//  Puis : Déployer → Nouvelle version → Tout le monde → Déployer
// ============================================================

var SHEET_ARTICLES   = 'Articles';
var SHEET_MOUVEMENTS = 'Mouvements';
var SHEET_LIVRAISONS = 'Livraisons';

var COLS_ARTICLES   = ['id','reference','designation','forme','dimensions',
                       'quantite','unite','prix','fournisseur','localisation',
                       'statut','dateEntree','creePar','modifiePar','dateModif',
                       'lastNote'];
var COLS_MVT        = ['id','date','type','reference','designation','quantite',
                       'note','par'];
var COLS_LIVRAISONS = ['id','date','fournisseur','affaire','statut','notes',
                       'createdAt'];

// ─── POINTS D'ENTRÉE ──────────────────────────────────────────

function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  try {
    var action  = (e.parameter && e.parameter.action) || '';
    var payload = {};

    if (e.postData && e.postData.contents) {
      try { payload = JSON.parse(e.postData.contents); } catch(err) {}
    }

    var result;
    switch(action) {
      // ── Articles ──
      case 'getAll':          result = getAll();                          break;
      case 'saveArticle':     result = saveArticle(payload.article);     break;
      case 'deleteArticle':   result = deleteArticle(payload.id);        break;

      // ── Mouvements ──
      case 'saveMouvement':   result = saveMouvement(payload.mouvement); break;

      // ── Livraisons ── ✅ AJOUTÉ
      case 'getLivraisons':   result = getLivraisons();                  break;
      case 'saveLivraison':   result = saveLivraison(payload);          break;
      case 'deleteLivraison': result = deleteLivraison(payload);        break;

      // ── Global ──
      case 'replaceAll':      result = replaceAll(payload);             break;

      default:
        result = { ok: false, error: 'Action inconnue: ' + action };
    }

    return jsonResponse(result);
  } catch(err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── UTILITAIRES FEUILLE ──────────────────────────────────────

function getOrCreateSheet(name, headers) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#1a1d27')
         .setFontColor('#f97316');
  }
  return sheet;
}

function sheetToObjects(sheet, cols) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0].map(function(h) { return String(h).trim(); });
  var result  = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0] && !data[i][1]) continue;
    var obj = {};
    cols.forEach(function(col) {
      var idx  = headers.indexOf(col);
      obj[col] = idx >= 0
        ? (data[i][idx] !== undefined ? String(data[i][idx]) : '')
        : '';
    });
    result.push(obj);
  }
  return result;
}

// ─── GET ALL (Articles + Mouvements + Livraisons) ─────────────

function getAll() {
  var sheetA = getOrCreateSheet(SHEET_ARTICLES,   COLS_ARTICLES);
  var sheetM = getOrCreateSheet(SHEET_MOUVEMENTS, COLS_MVT);
  var sheetL = getOrCreateSheet(SHEET_LIVRAISONS, COLS_LIVRAISONS); // ✅ AJOUTÉ

  return {
    ok:         true,
    articles:   sheetToObjects(sheetA, COLS_ARTICLES),
    mouvements: sheetToObjects(sheetM, COLS_MVT),
    livraisons: sheetToObjects(sheetL, COLS_LIVRAISONS)  // ✅ AJOUTÉ
  };
}

// ─── ARTICLES ─────────────────────────────────────────────────

function saveArticle(article) {
  if (!article || !article.id) return { ok: false, error: 'Article invalide' };

  var sheet = getOrCreateSheet(SHEET_ARTICLES, COLS_ARTICLES);
  var data  = sheet.getDataRange().getValues();
  var id    = String(article.id);

  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) { rowIndex = i + 1; break; }
  }

  var row = COLS_ARTICLES.map(function(c) {
    return article[c] !== undefined ? article[c] : '';
  });

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return { ok: true };
}

function deleteArticle(id) {
  if (!id) return { ok: false, error: 'ID manquant' };

  var sheet = getOrCreateSheet(SHEET_ARTICLES, COLS_ARTICLES);
  var data  = sheet.getDataRange().getValues();

  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Article introuvable' };
}

// ─── MOUVEMENTS ───────────────────────────────────────────────

function saveMouvement(mvt) {
  if (!mvt) return { ok: false, error: 'Mouvement invalide' };

  var sheet = getOrCreateSheet(SHEET_MOUVEMENTS, COLS_MVT);
  var row   = COLS_MVT.map(function(c) {
    return mvt[c] !== undefined ? mvt[c] : '';
  });
  sheet.appendRow(row);
  return { ok: true };
}

// ─── LIVRAISONS ───────────────────────────────────────────────

function getLivraisons() {
  var sheet = getOrCreateSheet(SHEET_LIVRAISONS, COLS_LIVRAISONS);
  return {
    ok:         true,                                        // ✅ Cohérent
    livraisons: sheetToObjects(sheet, COLS_LIVRAISONS)
  };
}

function saveLivraison(params) {
  var liv = params.livraison;
  if (!liv || !liv.id) return { ok: false, error: 'Livraison invalide' }; // ✅ Validation

  var sheet = getOrCreateSheet(SHEET_LIVRAISONS, COLS_LIVRAISONS);
  var data  = sheet.getDataRange().getValues();
  var id    = String(liv.id);

  // Chercher ligne existante
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      var row = COLS_LIVRAISONS.map(function(c) { return liv[c] || ''; });
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { ok: true };
    }
  }

  // Nouvelle ligne
  sheet.appendRow(COLS_LIVRAISONS.map(function(c) { return liv[c] || ''; }));
  return { ok: true };
}

function deleteLivraison(params) {
  if (!params || !params.id) return { ok: false, error: 'ID manquant' }; // ✅ Validation

  var sheet = getOrCreateSheet(SHEET_LIVRAISONS, COLS_LIVRAISONS);
  var data  = sheet.getDataRange().getValues();

  for (var i = data.length - 1; i >= 1; i--) {      // ✅ Boucle inversée (sécurité)
    if (String(data[i][0]) === String(params.id)) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: true };
}

// ─── REPLACE ALL (Sauvegarde complète) ────────────────────────

function replaceAll(payload) {
  var articles   = payload.articles   || [];
  var mouvements = payload.mouvements || [];
  var livraisons = payload.livraisons || [];              // ✅ AJOUTÉ

  // ── Articles ──
  var sheetA = getOrCreateSheet(SHEET_ARTICLES, COLS_ARTICLES);
  var lastA  = sheetA.getLastRow();
  if (lastA > 1) sheetA.deleteRows(2, lastA - 1);
  if (articles.length > 0) {
    var rowsA = articles.map(function(a) {
      return COLS_ARTICLES.map(function(c) {
        return a[c] !== undefined ? a[c] : '';
      });
    });
    sheetA.getRange(2, 1, rowsA.length, COLS_ARTICLES.length).setValues(rowsA);
  }

  // ── Mouvements ──
  var sheetM = getOrCreateSheet(SHEET_MOUVEMENTS, COLS_MVT);
  var lastM  = sheetM.getLastRow();
  if (lastM > 1) sheetM.deleteRows(2, lastM - 1);
  if (mouvements.length > 0) {
    var rowsM = mouvements.map(function(m) {
      return COLS_MVT.map(function(c) {
        return m[c] !== undefined ? m[c] : '';
      });
    });
    sheetM.getRange(2, 1, rowsM.length, COLS_MVT.length).setValues(rowsM);
  }

  // ── Livraisons ── ✅ AJOUTÉ
  var sheetL = getOrCreateSheet(SHEET_LIVRAISONS, COLS_LIVRAISONS);
  var lastL  = sheetL.getLastRow();
  if (lastL > 1) sheetL.deleteRows(2, lastL - 1);
  if (livraisons.length > 0) {
    var rowsL = livraisons.map(function(l) {
      return COLS_LIVRAISONS.map(function(c) {
        return l[c] !== undefined ? l[c] : '';
      });
    });
    sheetL.getRange(2, 1, rowsL.length, COLS_LIVRAISONS.length).setValues(rowsL);
  }

  return { ok: true };
}
