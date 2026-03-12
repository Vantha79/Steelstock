# 📋 Guide : Connecter Google Sheets en 5 minutes

## Ce que ça fait
Toutes vos modifications (ajout, suppression, modif d'aciers)
seront automatiquement enregistrées dans un Google Sheet.
Tous vos appareils voient le même stock en temps réel.

---

## Étape 1 — Créer le Google Sheet

1. Allez sur **https://sheets.new** (crée un fichier automatiquement)
2. Connectez-vous avec votre compte Google si demandé
3. Le fichier s'appelle "Sans titre" — vous pouvez le renommer "SteelStock"

---

## Étape 2 — Ouvrir Apps Script

1. Dans le menu en haut, cliquez **Extensions**
2. Cliquez **Apps Script**
3. Une nouvelle page s'ouvre avec du code

---

## Étape 3 — Coller le code

1. **Sélectionnez tout** le texte dans la page (Ctrl+A)
2. **Supprimez-le** (touche Suppr)
3. Ouvrez le fichier **google_apps_script.js** (dans le ZIP) avec le Bloc-notes
4. **Sélectionnez tout** (Ctrl+A) et **copiez** (Ctrl+C)
5. Revenez dans Apps Script et **collez** (Ctrl+V)
6. Cliquez l'icône 💾 (ou Ctrl+S) pour sauvegarder
7. Nommez le projet "SteelStock" si demandé

---

## Étape 4 — Déployer

1. Cliquez le bouton **"Déployer"** (en haut à droite)
2. Choisissez **"Nouveau déploiement"**
3. Cliquez l'icône ⚙ à côté de "Type" → choisissez **"Application Web"**
4. Dans "Qui a accès" → choisissez **"Tout le monde"**
5. Cliquez **"Déployer"**
6. Google demande une autorisation → cliquez **"Autoriser l'accès"**
7. Choisissez votre compte Google
8. Si Google affiche "Application non vérifiée" → cliquez **"Paramètres avancés"** puis **"Accéder à SteelStock"**
9. Cliquez **"Autoriser"**

---

## Étape 5 — Copier l'URL

1. Après le déploiement, une fenêtre s'affiche
2. Copiez l'**URL de l'application Web**
   Elle ressemble à :
   `https://script.google.com/macros/s/XXXXXX.../exec`
3. **Gardez cette URL** — vous en avez besoin à l'étape suivante

---

## Étape 6 — Connecter dans SteelStock

1. Ouvrez votre app SteelStock sur Netlify
2. Cliquez la bannière **"⚙ Connecter Google Sheets"**
3. Collez l'URL copiée dans le champ
4. Cliquez **"✅ Connecter et synchroniser"**
5. 🎉 **Synchronisation active !**

---

## ✅ C'est terminé !

Votre stock est maintenant synchronisé sur tous vos appareils.
Vous pouvez aussi consulter et modifier le Google Sheet directement.

---

## ❓ Problème fréquent : "Application non vérifiée"

C'est normal ! Google affiche cet avertissement pour tous les scripts personnels.
→ Cliquez "Paramètres avancés" (petit lien gris en bas)
→ Puis "Accéder à SteelStock (non sécurisé)"
→ C'est votre propre script, il n'y a aucun danger.

---

*SteelStock — Synchronisation gratuite via Google Sheets*
