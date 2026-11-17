# dash4-mobile — consignes

- Une seule app Ionic 9 + Vue 3.5 + Capacitor 8 pour les deux types de compte : gestionnaire et technicien. Interface en français, code en anglais.
- Contenu séparé par type de compte : onglets dans `src/tabs.ts`, écrans avec `meta.accountTypes` / `meta.permissions`. Un technicien ne voit jamais de prix (l'API ne les envoie pas).
- Hors ligne obligatoire : lectures depuis le cache local (`kv`), écritures via `useSyncStore().enqueue()` (file d'attente avec `client_uuid`), jamais d'appel direct à l'API pour une création ou une modification.
- Seules les données que le compte a le droit de voir sont stockées sur le téléphone ; tout est effacé à la déconnexion ou au changement de type de compte.
- Appels API via `api` (`src/services/api.ts`, client de `@dash4/shared`).
- Push direct sur `main` ; tests Vitest pour la logique (file d'attente, navigation, onglets).
