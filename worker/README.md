# Worker de notification "courses en cours"

Petit relais Cloudflare Worker (gratuit, aucune carte bancaire requise) qui
envoie une notification push à l'autre membre du foyer quand on clique sur
"Je pars faire les courses" ou "Courses terminées" dans l'app. Nécessaire
parce que le navigateur ne peut ni appeler l'API FCM de Google directement
(pas de CORS), ni détenir la clé privée du compte de service Firebase.

## Déploiement (une fois)

```bash
cd worker
npm install -g wrangler   # ou npx wrangler à chaque commande
wrangler login             # ouvre le navigateur pour te connecter (gratuit, sans CB)
wrangler deploy
```

Puis configure le secret (la clé de service Firebase déjà téléchargée pour
GitHub Actions, voir le README principal) :

```bash
wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
```

Colle tout le contenu du fichier JSON téléchargé quand demandé.

`wrangler deploy` affiche l'URL du Worker (genre
`https://courses-app-notify.<ton-compte>.workers.dev`) — mets-la dans
`.env` à la racine du projet :

```
VITE_NOTIFY_WORKER_URL=https://courses-app-notify.xxx.workers.dev
```

Puis `npm run build && firebase deploy --only hosting` à la racine pour que
l'app utilise ce nouveau réglage.

## Sécurité

Le Worker vérifie que l'appelant a un jeton d'identité Firebase valide
(même mécanisme que la connexion à l'app) avant d'envoyer quoi que ce soit —
personne d'autre que vous deux ne peut déclencher de notification.
