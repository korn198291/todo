# Design system : Todo

Source de vérité. Les tokens vivent dans `web/style.css` (section 1).

## Direction : Minimal
Principe : retirer, ne garder que la hiérarchie. Appliqué avec les skills emil-design-eng, apple-design et remove-animations.
- Une colonne (680px). Le jour en tête, les horizons dessous, séparés par un filet. Pas de carte, pas de panneau.
- Couleurs : fond #FBFBFA, texte #111, secondaire #6B6B66 (5,2:1) ; sombre #0E0E0E / #F2F2F0. L'accent est le texte lui-même. Seule teinte : terracotta pour "en retard".
- Typo : SF système. Titres 600 avec tracking -0.03 à -0.04em, chiffres tabulaires, jour en 34px.
- Mouvement : fondu 150ms au changement de vue, coche tracée 200ms, apparition de tâche 200ms (-4px), FLIP au réordonnancement, feuille iPhone. `scale(.97)` à la pression, jamais d'ease-in.
- Progression : trait de 2px. Calendrier : grille au filet, jour sélectionné en fond neutre, aujourd'hui en pastille pleine.

## Espacements, rayons, ombres
Espacements : 4 8 12 16 20 24 32 40 48. Rayons : 10 (contrôles) / 14 / 22 / pilule.
Ombres : halo semi-transparent (`--sh-card`, `--sh-pop`) plutôt qu'une bordure pleine.

## Thèmes
Neutre (défaut), Sauge, Encre, Minuit. Chaque thème ne redéfinit que les couleurs (`light-dark()`), le mode (auto, clair, sombre) vient de `color-scheme`.

## Composants
- Horizon : surtitre, titre, compteur `n/N`, trait de progression 2px, liste, champ d'ajout. Le jour est en tête, les autres horizons dessous.
- Tâche : case 24px (zone tactile 44), texte éditable, actions Déplacer / Supprimer au survol (Déplacer seul sur tactile).
- Bande de la semaine : 7 jours, point si tâches ouvertes, jour sélectionné en pastille pleine, aujourd'hui en gras.
- Segment Listes / Calendrier : en haut à droite (Mac), pilule flottante en bas avec bouton "aujourd'hui" (iPhone).
- Menu Déplacer : popover (Mac) / feuille du bas avec poignée (iPhone), navigation flèches, case courante cochée.
- En retard : section sous la carte Jour (aujourd'hui seulement), bouton "Tout ramener à aujourd'hui".
- États vides : illustration SVG au trait discrète + 2 lignes.
- Toast avec Annuler (suppression), aide clavier (`<dialog>` natif, touche ?).
- Icônes : SVG maison, trait 1,6, bouts ronds, une seule famille. Aucun emoji.

## Accessibilité (checklist du skill)
Contraste 4,5:1 vérifié (tableau ci-dessus) ; zones tactiles 44px ; focus visible 2px accent ; `aria-label` sur chaque bouton icône avec le texte de la tâche ; `aria-live` pour les annonces ; alternative clavier au glisser-déposer (menu Déplacer, Alt+flèches) ; safe areas iPhone ; `dvh`.

- Sous-tâches : liste sous la tâche, Entrée enchaîne, vide = supprimée.
- Surlignage : 5 couleurs translucides (jaune, rose, vert, bleu, violet) en feutre sur le texte, choisies dans le menu de la tâche.
