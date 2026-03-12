# 🔥 Guide : Configurer Firebase pour la synchronisation

## Pourquoi Firebase ?
Firebase est un service **gratuit de Google** qui permet à votre stock
d'être **synchronisé en temps réel** entre tous vos appareils.
Quand vous supprimez un acier sur votre téléphone → il disparaît aussi
sur l'ordinateur (et inversement) en quelques secondes.

---

## Étape 1 — Créer un compte Firebase (gratuit)

1. Allez sur **https://firebase.google.com**
2. Cliquez **"Commencer"** (ou "Get started")
3. Connectez-vous avec votre compte Google
   (ou créez-en un gratuit si vous n'en avez pas)

---

## Étape 2 — Créer un projet

1. Cliquez **"Ajouter un projet"**
2. Nom du projet : tapez `steelstock`
3. Désactivez Google Analytics (pas utile) → cliquez **Continuer**
4. Attendez 30 secondes → cliquez **Continuer**

---

## Étape 3 — Créer la base de données

1. Dans le menu gauche, cliquez **"Firestore Database"**
2. Cliquez **"Créer une base de données"**
3. Choisissez **"Mode test"** (permet l'accès pendant 30 jours)
4. Choisissez la région **"europe-west"** → cliquez **Activer**

> 💡 Après 30 jours, vous devrez modifier les règles.
> Je vous fournis les règles exactes à la fin de ce guide.

---

## Étape 4 — Récupérer la configuration

1. Cliquez l'icône ⚙ (engrenage) en haut à gauche → **"Paramètres du projet"**
2. Faites défiler vers le bas jusqu'à **"Vos applications"**
3. Cliquez l'icône **</>** (Web)
4. Nom de l'app : tapez `steelstock` → cliquez **Enregistrer l'app**
5. Vous voyez un bloc de code. Copiez **tout le contenu** entre `{` et `}`
   qui ressemble à ceci :

```
{
  apiKey: "AIzaSy...",
  authDomain: "steelstock-xxxxx.firebaseapp.com",
  projectId: "steelstock-xxxxx",
  storageBucket: "steelstock-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
}
```

---

## Étape 5 — Coller la configuration dans l'app

1. Ouvrez votre application SteelStock dans le navigateur
2. Une bannière orange apparaît en haut :
   **"Synchronisation non configurée"**
3. Cliquez **⚙ Configurer Firebase**
4. Collez la configuration copiée → cliquez **💾 Sauvegarder**
5. La page se recharge et affiche :
   **✅ Synchronisé — modifications visibles sur tous vos appareils**

---

## Étape 6 — Faire la même chose sur vos autres appareils

Répétez l'Étape 5 sur chaque téléphone/ordinateur.
Les données seront **immédiatement synchronisées** entre tous !

---

## ⏰ Après 30 jours — Règles de sécurité

Dans Firebase Console → Firestore → Onglet **Règles**,
remplacez le contenu par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Cliquez **Publier**. Cela maintient l'accès libre.

> ⚠️ Ces règles sont ouvertes. Pour une utilisation professionnelle
> avec données confidentielles, consultez un développeur.

---

## ❓ Problèmes fréquents

**"Connexion Firebase échouée"**
→ Vérifiez que vous avez bien copié TOUT le bloc `{ }` incluant toutes les lignes

**"Erreur de lecture"**
→ Vérifiez que Firestore est bien créé (Étape 3)

**Les données n'apparaissent pas**
→ Attendez 10 secondes, Firebase peut mettre un peu de temps au premier démarrage

---

*SteelStock — Synchronisation gratuite via Firebase*
