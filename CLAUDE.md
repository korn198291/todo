# Projet : Todo (inspiré de Minima List)

## Objectif
To do list ultra simple, gratuite, rapide. Deux cibles :
- Mac : .app / .dmg (Electron + electron-builder, `npm run dist`)
- iPhone : PWA hébergée gratuitement (dossier `web/`)

## État actuel
App dans `web/` (index.html + style.css + app.js, vanilla, localStorage) + `main.js` (Electron, vibrancy macOS, barre de titre masquée).
Design : "Minimal" (une colonne, noir sur blanc cassé, SF système), design system dans `design-system/todo/MASTER.md`. Tâches {id,text,done,t:'day|week|month|quarter|year',k:clé de période}, stockage 'todo.v2' (migration auto depuis 'todo.v1'), l'ordre du tableau = ordre d'affichage. Fonctions : horizons, calendrier, glisser-déposer + réordonnancement, menu Déplacer, "En retard", annulation de suppression, aide clavier (?).
Service worker : cache `todo-v34` (incrémenter à chaque changement de fichiers).
Icônes : `python3 make_icons.py`.

v5 (2 nov 2026) : 4 thèmes + Réglages (`web/style.css` tokens en `light-dark()`, `data-theme` et `data-mode` sur `<html>`, préférences `todo.ui`) ; synchronisation Supabase locale d'abord (`web/sync.js`, config dans `web/config.js`, base `supabase.sql`). Tâche = {id,text,done,t,k,o (ordre, flottant),u (modif ms),d (à envoyer)} ; suppressions = pierres tombales `todo.tombs` ; dernier écrit gagne (u) ; cycle = récupérer, envoyer, récupérer. Fusion testée avec un faux serveur (2 appareils, hors ligne, conflits, jeton expiré).
Déploiement : `.github/workflows/pages.yml` publie `web/` sur GitHub Pages (voir README).

Sous-tâches `s:[{id,text,done}]` et surlignage `c` ('y','p','g','b','v') sur la tâche (synchronisés ; si la base Supabase existe déjà, rejouer les 2 `alter table` de `supabase.sql`). Segment des vues : "Listes" / "Calendrier". Mouvement réduit au nécessaire (fondu 150ms, `scale(.97)` à la pression). Skills d'Emil Kowalski installés dans `~/.claude/skills`.

## À faire
1. Créer le projet Supabase + renseigner `web/config.js`, créer le dépôt GitHub, activer Pages, tester sur un vrai iPhone (guide dans README).
2. Signer l'app Mac si distribution (sinon clic droit > Ouvrir).
3. Idées : objectifs avec progression, notifications.

## Règles
- Réponses en français, concises, sans politesses.
- Pas de tiret cadratin.
- Rester simple : pas de dépendances inutiles.

Planning (time blocking) : 3e vue "Planning". Créneaux `blocks` {id,k:jour,a,e:minutes,u,d}, pierres tombales `todo.btombs`, table Supabase `blocks` ; tâche liée par `b` (id du créneau). Si la base existe déjà : rejouer `alter table ... add column b` et la section Planning de `supabase.sql`. `sync.js` gère maintenant 2 tables (TABLES).
