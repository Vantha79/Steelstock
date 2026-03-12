# 🔩 SteelStock — Application de gestion de stock d'aciers

## Gratuit · 100% hors-ligne · Web + Smartphone

---

## 📦 Ce que vous avez reçu

```
steelstock/
├── index.html        ← Application principale
├── manifest.json     ← Configuration PWA (installation)
├── sw.js             ← Service Worker (mode hors-ligne)
├── css/style.css     ← Design
├── js/app.js         ← Logique application
└── icons/            ← Icônes pour l'installation mobile
```

---

## 🚀 Comment utiliser

### Option 1 — Hébergement gratuit (recommandé)

1. Créez un compte gratuit sur **https://netlify.com**
2. Glissez-déposez le dossier `steelstock/` dans Netlify
3. Vous obtenez une URL comme `https://mon-stock.netlify.app`
4. Ouvrez cette URL sur votre téléphone → installez l'app

### Option 2 — GitHub Pages (gratuit)

1. Créez un repo GitHub
2. Uploadez les fichiers
3. Activez Pages → URL gratuite générée

### Option 3 — Serveur local (PC)

```bash
# Python (si installé)
cd steelstock
python3 -m http.server 8080
# → Ouvrir http://localhost:8080
```

---

## 📱 Installation sur smartphone

### Android (Chrome)
1. Ouvrez l'URL dans Chrome
2. Menu ⋮ → "Ajouter à l'écran d'accueil"
   — ou attendez la bannière d'installation automatique
3. L'app apparaît comme une app native !

### iPhone (Safari)
1. Ouvrez l'URL dans Safari
2. Bouton Partager □↑ → "Sur l'écran d'accueil"
3. Confirmez → icône SteelStock sur votre téléphone

---

## ✨ Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| 📦 Stock | Tableau complet, tri, filtres, recherche |
| ✎ Édition | Modifier chaque article |
| ＋ Ajout | Formulaire complet d'ajout |
| ✕ Suppression | Simple ou groupée |
| ↔ Mouvements | Historique de toutes les opérations |
| 📊 Analyses | Graphiques par forme et fournisseur |
| ⚠ Alertes | Faible stock et ruptures en évidence |
| ↓ Export CSV | Exportez vers Excel |
| ⚡ Hors-ligne | Fonctionne sans internet |
| 💾 Sauvegarde | Données conservées dans le navigateur |

---

## 💡 Raccourcis clavier

- `Ctrl+K` — Focuser la recherche
- `Echap` — Fermer la fenêtre

---

## 🔄 Mise à jour des données

Les données sont sauvegardées automatiquement dans votre navigateur (localStorage).
Pour sauvegarder sur plusieurs appareils, utilisez l'export CSV régulièrement.

---

*SteelStock — Application PWA gratuite, aucun abonnement, aucun serveur requis.*
