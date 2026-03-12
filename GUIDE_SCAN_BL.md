# 🤖 Guide : Configurer le scan de bon de livraison

## Pourquoi cette étape ?
Le scan de bon de livraison utilise l'IA Claude pour lire vos photos.
Pour que ça fonctionne depuis votre app, il faut une clé API Anthropic
configurée dans votre Google Apps Script.

**Bonne nouvelle : c'est gratuit pour commencer !**
Anthropic offre des crédits gratuits à l'inscription.

---

## Étape 1 — Obtenir une clé API Anthropic (gratuite)

1. Allez sur **https://console.anthropic.com**
2. Créez un compte gratuit
3. Allez dans **"API Keys"** → **"Create Key"**
4. Nommez-la "SteelStock" → **"Create Key"**
5. **Copiez la clé** (elle commence par `sk-ant-...`)
   ⚠️ Elle ne sera affichée qu'une seule fois !

---

## Étape 2 — Enregistrer la clé dans Apps Script

1. Ouvrez votre Google Sheet SteelStock
2. Cliquez **Extensions → Apps Script**
3. Dans le code, trouvez cette ligne :
   ```
   const key = 'VOTRE_CLE_API_ICI';
   ```
4. Remplacez `VOTRE_CLE_API_ICI` par votre clé copiée
5. Cliquez **▶ Exécuter** sur la fonction `setClaudeApiKey`
6. Autorisez si demandé
7. Vérifiez dans les logs : "Clé API enregistrée avec succès"
8. **Remettez** `VOTRE_CLE_API_ICI` à la place de votre clé
   (pour ne pas la laisser visible dans le code)
9. Sauvegardez

---

## Étape 3 — Redéployer Apps Script

Après avoir enregistré la clé, il faut redéployer :

1. Cliquez **Déployer → Gérer les déploiements**
2. Cliquez l'icône ✏️ sur votre déploiement actuel
3. Version : **"Nouvelle version"**
4. Cliquez **Déployer**

---

## Étape 4 — Tester le scan

1. Ouvrez SteelStock sur Netlify
2. Cliquez **📸 Bon de livraison**
3. Prenez une photo d'un bon imprimé
4. Cliquez **🤖 Analyser**
5. ✅ Les articles apparaissent automatiquement !

---

## ❓ Conseils pour une bonne photo

- 📷 **Lumière suffisante** — évitez les ombres sur le bon
- 📄 **Bon bien à plat** — pas de plis ni de reflets
- 🔍 **Cadrez bien** — tout le tableau doit être visible
- 📏 **Pas trop loin** — le texte doit être lisible

---

## 💰 Coût estimé

Chaque analyse de bon coûte environ **0,01 à 0,03 €**.
Avec les crédits gratuits offerts, vous pouvez analyser
plusieurs centaines de bons sans payer.

---

*SteelStock — Import automatique par IA*
