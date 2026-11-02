# Todo

To do list style Timestripe, design minimal (voir `design-system/todo/MASTER.md`). Données en local d'abord (localStorage `todo.v2`), l'app marche hors ligne ; synchronisation Mac et iPhone en option (Supabase).
- Listes : jour, semaine, mois, trimestre, année (chaque tâche appartient à une période), progression par carte
- Bande de la semaine + vue calendrier mensuel, clair et sombre automatiques
- Section "En retard" dans la carte Jour, avec "Tout ramener à aujourd'hui"
- Déplacer : glisser-déposer (sur un jour, une carte, ou entre deux tâches pour réordonner) ou menu Déplacer (Mac et iPhone)
- Réglages (bouton à droite en haut, `⌘,`) : 4 thèmes (Neutre, Sauge, Encre, Minuit), apparence auto, clair ou sombre, connexion à la synchronisation
- Raccourcis Mac : `⌘N` ou `n` nouvelle tâche, flèches gauche/droite = jour précédent/suivant, `t` = aujourd'hui, `⌥ ↑/↓` réordonner, `?` aide

## Structure
- `web/index.html`, `web/style.css`, `web/app.js` : l'app (partagée Mac + iPhone)
- `web/sync.js`, `web/config.js` : synchronisation Supabase (sans bibliothèque), `supabase.sql` : la base
- `.github/workflows/pages.yml` : publie `web/` sur GitHub Pages à chaque push
- `main.js` : coque Electron (Mac)
- `make_icons.py` : régénère les icônes dans `web/` (`python3 make_icons.py`)
- `design-system/todo/MASTER.md` : design system

## Mac (.dmg), à lancer sur le Mac
```
cd ~/Documents/Soona/Claude/tdl
npm install
npm start        # tester
npm run dist     # génère dist/Todo-1.0.0-arm64.dmg (ou x64 selon ton Mac)
```
App non signée : au premier lancement, clic droit sur Todo > Ouvrir.
Si macOS dit "endommagée" : `xattr -cr /Applications/Todo.app`

## Synchronisation Mac et iPhone (Supabase, gratuit)
Local d'abord : chaque appareil garde ses données et fonctionne hors ligne. La sync envoie puis récupère les changements (au lancement, au retour sur l'app, après chaque modification, toutes les 60 s). En cas de conflit, la modification la plus récente gagne. Les horloges des appareils doivent être à l'heure (réglage automatique par défaut).

1. supabase.com > New project (région Europe). Garde le mot de passe de la base, on n'en a pas besoin ici.
2. SQL Editor > New query > colle tout `supabase.sql` > Run.
3. Authentication > Sign In / Providers > Email : désactive **Confirm email** (compte perso, évite l'étape mail).
4. Project Settings > API : copie **Project URL** et la clé **anon public** dans `web/config.js`.
   Ne mets JAMAIS la clé `service_role` dans l'app. La clé anon est publique par conception, la sécurité vient des règles RLS du SQL.
5. Reconstruis et redéploie (voir plus bas), puis dans l'app : Réglages > **Créer le compte** (email + mot de passe). Sur l'autre appareil : **Se connecter** avec les mêmes identifiants.
6. Une fois ton compte créé : Authentication > Sign In / Providers > désactive **Allow new users to sign up** pour que personne d'autre ne puisse créer de compte sur ton projet.

Notes : un projet Supabase gratuit se met en pause après 7 jours sans activité (données conservées, bouton "Restore" dans le tableau de bord). Les tâches supprimées gardent une trace 30 jours pour se propager.

## iPhone (PWA gratuite sur GitHub Pages)
Nécessite iOS 17.5 ou plus récent (thèmes basés sur `light-dark()`).
1. github.com > New repository `todo` (public : le code est visible, pas tes tâches).
2. Dans le Terminal :
```
cd ~/Documents/Soona/Claude/tdl
git init && git add . && git commit -m "Todo"
git branch -M main
git remote add origin https://github.com/TON_PSEUDO/todo.git
git push -u origin main
```
3. Sur GitHub : Settings > Pages > Source : **GitHub Actions**. Onglet Actions : attends le vert (1 minute). L'adresse est `https://TON_PSEUDO.github.io/todo/`.
4. iPhone, dans **Safari** : ouvre l'adresse > Partager > **Sur l'écran d'accueil**.
5. Mises à jour : `git add . && git commit -m "maj" && git push`, puis ferme et rouvre l'app sur l'iPhone.

Le `.dmg` embarque aussi `config.js` : renseigne-le avant `npm run dist` pour que le Mac puisse se connecter.
