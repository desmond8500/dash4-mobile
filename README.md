# Dash4 — application mobile

Application **Ionic 9 + Vue 3.5 + Capacitor 8** de l'ERP Dash4. Une seule application pour les deux types de compte :

- **gestionnaire** : clients, demandes, projets, devis, stock, tâches (au fil des livraisons) ;
- **technicien** : tâches affectées, informations de chantier, rapports, demandes d'accès — jamais de prix.

Elle fonctionne **hors ligne** et se synchronise au retour du réseau.

## Ce qui est en place (socle)

- Connexion, session gardée sur le téléphone : l'application s'ouvre sans réseau
- Onglets et écrans selon le type de compte et les permissions (`src/tabs.ts`, `src/router/guard.ts`)
- Hors ligne : cache local et **file d'attente** des actions dans IndexedDB (`src/offline/`), chaque action avec un `client_uuid` anti-doublon, envoi automatique au retour du réseau, au retour au premier plan et toutes les minutes
- Bandeau « Hors ligne », écran de synchronisation (en attente, refusées, dernier envoi)
- Effacement des données locales à la déconnexion, au changement de compte ou de type de compte

## Développement

```bash
cp .env.example .env    # VITE_API_URL=http://localhost:8000/api
npm install
npm run dev             # http://localhost:8100
npm test
npm run build
```

L'API autorise `http://localhost:8100` par défaut (`FRONTEND_URLS`).

## Version web (Netlify)

Comme dash4-web : importer le dépôt sur Netlify (réglages dans `netlify.toml`), variable `VITE_API_URL = https://api.dash4.yonkou.info/api`, domaine `mobile.dash4.yonkou.info`.
Sur un téléphone, « Ajouter à l'écran d'accueil » donne une application plein écran.

## Applications Android / iOS (plus tard)

```bash
npm run build
npx cap add android     # puis npx cap add ios (sur un Mac)
npx cap sync
npx cap open android    # ouvre Android Studio
```

Committer ensuite les dossiers `android/` et `ios/` générés.
Avant la publication sur les stores : remplacer le stockage du jeton (Capacitor Preferences) par un stockage chiffré (Keychain / Keystore).
