# Design system : Todo

Source de vérité. Les tokens vivent dans `web/style.css` (section 1). Généré avec le skill ui-ux-pro-max (`--design-system --persist`), puis réécrit.

## Direction choisie : Papier éditorial
Le générateur proposait un style de landing page (Flat Design, teal, Plus Jakarta Sans via Google Fonts). Rejeté :
1. Une app de tâches se lit toute la journée : fond chaud, faible fatigue, pas de teal saturé.
2. Hiérarchie par la typographie (titres SF semi-gras serrés), pas par la couleur.
3. Un seul accent terracotta, réservé à : aujourd'hui, focus, ajout, retard, progression terminée.
4. Cartes blanches sans bordure sur fond papier, ombres très diffuses (Things 3, Apple Notes).
5. 100 % hors ligne : aucune police distante, New York / SF système.
Alternative écartée : "Graphite" (gris froid, indigo, tout en sans-serif), trop proche d'un outil d'équipe.

## Couleurs (contrastes mesurés)
| Token | Clair | Sombre | Usage |
|---|---|---|---|
| --bg | #F5F3EE | #121211 | fond (translucide sous Electron/vibrancy) |
| --surface | #FFFFFF | #1C1C1A | cartes, menus |
| --surface-2 | #EDEAE3 | #272725 | survol, piste du segment |
| --fg | #1C1B19 (15,5:1) | #EDEAE3 (15,6:1) | texte |
| --mute | #6B6860 (5,0:1 sur bg) | #9D9A91 (6,1:1) | texte secondaire |
| --ctl | #8E8B82 (3,4:1) | #77746C (3,7:1) | bordure de case |
| --line | #E6E2D9 | #2B2B29 | séparateurs |
| --accent | #B4461F (4,9:1 sur bg) | #EE8A68 (6,9:1) | accent unique |
| --danger | #B3261E | #FF8A80 | suppression |
Le sombre est redessiné (accent éclairci, surfaces élevées plus claires), pas inversé.

## Typographie
Titres et interface : SF (`-apple-system`), titres en poids 600, tracking -.03em. Aucune serif (demande utilisateur).
Échelle : 11 (surtitres, capitales, +.1em) / 13 meta / 15 secondaire / 16 corps (17 sur iPhone) / 21 titre de carte / 30 titre du jour / 36 titre de page. Chiffres tabulaires sur compteurs et dates.


## Espacements, rayons, ombres
Espacements : 4 8 12 16 20 24 32 40. Rayons : 10 (contrôles) / 14 / 22 (cartes) / pilule.
Ombres : `--sh-card` (halo 1px + 2 couches diffuses), `--sh-pop` (menus, feuilles, toasts). Aucune autre.

## Mouvement
Durées : 150 (feedback), 220 (état, apparition), 320 (feuille, progression). Sortie ≈ 70 % de l'entrée.
Courbes : `--ease` cubic-bezier(.2,.8,.2,1) ; `--ease-spring` pour les rebonds légers.
Animations : coche tracée + anneau, apparition de tâche, glissement FLIP au réordonnancement, suppression repliée, changement de jour/vue (glissement 14px + fondu), feuille du bas sur iPhone.
`prefers-reduced-motion` : durées ≈ 0 en CSS, FLIP et suppression animée coupés en JS.

## Composants
- Carte horizon : surtitre, titre serif, compteur `n/N`, barre de progression 2px (accent à 100 %), liste, champ d'ajout.
- Tâche : case 24px (zone tactile 44), texte éditable, actions Déplacer / Supprimer au survol (Déplacer seul sur tactile).
- Bande de la semaine : 7 jours, point accent si tâches ouvertes, jour sélectionné plein, aujourd'hui en accent.
- Segment Horizons / Calendrier : en haut à droite (Mac), pilule flottante en bas avec bouton "aujourd'hui" (iPhone).
- Menu Déplacer : popover (Mac) / feuille du bas avec poignée (iPhone), navigation flèches, case courante cochée.
- En retard : section sous la carte Jour (aujourd'hui seulement), bouton "Tout ramener à aujourd'hui".
- États vides : illustration SVG au trait (soleil sur l'horizon pour le jour, calendrier pour le mois) + 2 lignes.
- Toast avec Annuler (suppression), aide clavier (`<dialog>` natif, touche ?).
- Icônes : SVG maison, trait 1,6, bouts ronds, une seule famille. Aucun emoji.

## Accessibilité (checklist du skill)
Contraste 4,5:1 vérifié (tableau ci-dessus) ; zones tactiles 44px ; focus visible 2px accent ; `aria-label` sur chaque bouton icône avec le texte de la tâche ; `aria-live` pour les annonces ; alternative clavier au glisser-déposer (menu Déplacer, Alt+flèches) ; safe areas iPhone ; `dvh`.
