# Courses & Garde-manger

PWA privée pour vous deux : liste de courses partagée en temps réel (saisie
intuitive + scan code-barres + saisie libre) et suivi des dates de péremption
avec alertes cumulables par notification push. 100% gratuit, sans carte
bancaire à enregistrer nulle part.

## Ce qui reste à faire de ton côté

Le code est prêt, mais il faut créer les comptes/services externes (ça ne peut
pas être fait à ta place, ce sont tes comptes). Compte environ 20-30 min la
première fois.

### 1. Créer le projet Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com),
   connecte-toi avec ton compte Google, clique **Ajouter un projet**.
2. Nomme-le (ex. `courses-familiales`), tu peux désactiver Google Analytics
   (pas utile ici).
3. Une fois le projet créé, dans le menu de gauche :
   - **Authentication** → onglet *Sign-in method* → active **E-mail/mot de
     passe**.
   - **Authentication** → onglet *Users* → **Add user**, crée un compte pour
     toi et un pour ta femme (e-mail + mot de passe de ton choix).
   - **Firestore Database** → **Créer une base de données** → mode
     *production* → choisis une région proche (ex. `eur3` / Europe).
   - **Project settings** (roue crantée) → *Cloud Messaging* → section *Web
     configuration* → **Generate key pair** → copie la clé (VAPID).
   - **Project settings** → *General* → *Your apps* → icône **</>** (Web) →
     donne un nom → copie l'objet `firebaseConfig` affiché.

### 2. Configurer le projet en local

Dans `C:\Users\Admin\courses-app` :

```bash
cp .env.example .env
```

Remplis `.env` avec les valeurs copiées à l'étape précédente (`apiKey`,
`authDomain`, etc., et la clé VAPID). Puis :

```bash
npm run dev
```

Ouvre `http://localhost:5173`, connecte-toi avec un des deux comptes créés.

### 3. Déployer en ligne (Firebase Hosting, gratuit)

```bash
npm install -g firebase-tools
firebase login
```

Édite `.firebaserc` et remplace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` par
l'ID de ton projet (visible dans *Project settings* → *General*). Puis :

```bash
npm run build
firebase deploy --only firestore:rules,hosting
```

Ton app est en ligne sur `https://<ton-projet>.web.app` (HTTPS gratuit,
requis pour l'installation PWA et les notifications).

### 4. Mettre en place le job quotidien d'alertes (GitHub Actions, gratuit)

1. Crée un dépôt sur GitHub (public ou privé, peu importe), pousse ce
   projet dedans :
   ```bash
   git init
   git add .
   git commit -m "Première version"
   git remote add origin <url-de-ton-repo>
   git push -u origin main
   ```
2. Dans Firebase console → *Project settings* → onglet **Service accounts**
   → **Generate new private key** → un fichier JSON se télécharge.
3. Sur GitHub, dans ton repo → **Settings** → **Secrets and variables** →
   **Actions** :
   - Onglet *Secrets* → **New repository secret** → nom
     `FIREBASE_SERVICE_ACCOUNT` → colle **tout le contenu** du fichier JSON
     téléchargé.
   - Onglet *Variables* → **New repository variable** → nom `HOUSEHOLD_ID`
     → valeur `foyer` (ou ce que tu as mis dans `VITE_HOUSEHOLD_ID`).
4. Le workflow tourne automatiquement chaque jour à 8h (heure de Paris). Tu
   peux aussi le lancer à la main pour tester : onglet **Actions** du repo →
   *Vérification des dates de péremption* → **Run workflow**.

### 5. Installer l'app sur vos téléphones

Ouvre `https://<ton-projet>.web.app` sur chaque téléphone :

- **Android (Chrome)** : bannière "Ajouter à l'écran d'accueil" automatique,
  ou menu ⋮ → *Installer l'application*.
- **iPhone (Safari)** : bouton Partager (carré avec flèche) → *Sur l'écran
  d'accueil*.

Connecte-toi avec ton compte, puis va dans **Réglages** → **Activer les
notifications** (à faire une fois par appareil).

### 6. Test de bout en bout

1. Ajoute un produit à la liste, coche-le, "🏠 Rentrer au garde-manger",
   mets une date de péremption **demain** avec l'alerte **1 j**.
2. Lance le workflow manuellement (étape 4, *Run workflow*).
3. Tu dois recevoir une notification push sur ton téléphone dans la minute.

## Fonctionnalités

- Liste de courses partagée en temps réel entre vous deux (Firestore).
- Saisie intuitive : autocomplete sur l'historique du foyer + base Open Food
  Facts (des centaines de milliers de produits), ou saisie libre.
- **Scan code-barres** (caméra du téléphone) : reconnaissance via Open Food
  Facts / Open Beauty Facts / Open Products Facts (alimentaire et non
  alimentaire), préremplit nom + catégorie + image.
- Historique des produits les plus ajoutés, code couleur par catégorie.
- Garde-manger : date de péremption, alertes cumulables et modifiables (1
  mois / 15 / 10 / 5 / 3 / 2 / 1 jour avant), plusieurs seuils par produit.
- "✅ Consommé" coupe toutes les alertes du produit. "⏰ Reporter" saute
  l'alerte en cours et reprend au prochain seuil configuré.
- Notifications push même app fermée (Firebase Cloud Messaging).
- Installable comme une vraie app (PWA), fonctionne hors-ligne pour
  l'interface.

## Stack (tout gratuit, sans carte bancaire)

- React + Vite + Tailwind CSS, PWA via `vite-plugin-pwa`.
- Firebase : Firestore (BDD), Auth, Hosting, Cloud Messaging — plan Spark
  (gratuit), aucune Cloud Function utilisée pour éviter d'exiger le plan
  payant Blaze.
- GitHub Actions : job cron quotidien gratuit (script Node +
  `firebase-admin`) qui vérifie les dates et déclenche les notifications.
- Open Food Facts / Open Beauty Facts / Open Products Facts : bases de
  produits publiques et gratuites, sans clé API.
