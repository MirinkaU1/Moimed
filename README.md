# Moimed — personnage 2D modulaire

Le projet conserve les calques du personnage d'origine et ajoute un pull à capuche et un short interchangeables, avec leurs masques de couleur et un exemple de réassemblage déjà implémenté.

## Ouvrir dans Photoshop

Ouvrir `documents/Moimed-Personnage.psd`.

Le personnage d'origine apparaît déjà assemblé. Le groupe **01 — Personnage assemblé** contient les dix éléments séparés : tête et cou, deux bras, pantalon, deux chaussures, T-shirt, yeux, sourcils et cheveux. Chaque calque conserve son canevas 1024 × 1536 et sa position (0, 0).

Le groupe **02 — Exemple couleurs** contient un second assemblage déjà personnalisé. Masquer le groupe 01 et afficher le groupe 02 pour le voir. Les groupes 03 (tenues complètes de référence) et 04 (masques de couleur) sont masqués par défaut.

Le groupe **05 — Pull à capuche et short** contient la nouvelle tenue déjà assemblée en dix calques séparés. Masquer le groupe 01 puis afficher le groupe 05 pour la voir. Le pull à capuche, le short, les jambes et les mains sont indépendants. Pour une association avec le T-shirt, conserver les deux bras d'origine ; pour le pull à capuche, utiliser les mains du groupe 05. Les jambes passent derrière le short et les chaussures. Le short et le pantalon passent derrière le haut ; la ceinture du short est remontée pour rester cachée sous le T-shirt.

Pour une nouvelle couleur, afficher le groupe des masques, maintenir Ctrl (Cmd sur Mac) et cliquer sur la vignette du masque voulu pour charger sa transparence comme sélection. Masquer à nouveau le groupe des masques puis travailler sur une copie du calque concerné. Le mode Couleur conserve la luminosité ; éclaircir un T-shirt noir demande aussi d'ajuster sa luminosité. Les contours noirs sont en grande partie protégés par les masques fournis.

## Ouvrir dans Illustrator

Ouvrir `documents/Moimed-Personnage.svg`. Les dix images PNG sont incorporées dans dix groupes superposés. Elles restent séparées et repositionnables, sans fichiers liés manquants.

`documents/Moimed-Hoodie-Short.svg` fournit la nouvelle tenue avec la même décomposition en groupes incorporés.

Ce SVG contient des **éléments bitmap**, pas des contours vectoriels éditables point par point. Il ne s'agit pas d'un fichier `.ai` natif. Une vraie version vectorielle demanderait un travail de tracé.

## Version vectorielle

`documents/Moimed-Vectoriel.svg` contient le personnage d'origine vectorisé à partir des dix calques, avec un groupe par élément. Les contours sont de vrais tracés éditables point par point.

`scripts/vectorize.py` produit ce fichier et `exemple-web/vector-data.js`, qui contient les quatorze calques vectoriels de l'atelier (tenues modulaires comprises) et leurs zones recolorables. Le bas du pull à capuche y est élargi pour couvrir la taille du pantalon et du short. Pour régénérer après `npm run build` : `pip install vtracer pillow`, puis `python3 scripts/vectorize.py`.

## Exemple déjà implémenté

Ouvrir `exemple-web/index.html` par double-clic. Le personnage est affiché en SVG à partir de `vector-data.js`, qui évite de charger des fichiers avec `fetch` depuis un fichier local. `assets-data.js` conserve les calques bitmap et les masques d'origine pour la construction et les tests.

L'exemple propose :

- le choix indépendant du haut (T-shirt ou pull à capuche) et du bas (pantalon ou short), soit quatre associations ;
- l'assemblage des calques vectoriels, avec remplacement automatique des bras par les mains et ajout des jambes selon la tenue ;
- l'affichage ou le masquage de chaque calque ;
- la recoloration de la peau, y compris les jambes et mains, des cheveux, du haut, du bas, des chaussures et des pupilles ;
- un préréglage bleu et un retour à l'original ;
- l'export du résultat en SVG ou en PNG transparent ;
- l'affichage des trois nouvelles tenues comme références complètes.

On peut aussi lancer `Demarrer.cmd`, puis ouvrir `http://127.0.0.1:4173/`. Node.js suffit pour ce serveur local ; aucune installation de dépendance n'est nécessaire pour lancer l'exemple déjà généré.

## Dossiers

| Dossier | Contenu |
|---|---|
| `documents/` | PSD à calques et SVG à images incorporées |
| `assets/base/` | Dix calques, sept masques, document OpenRaster et manifeste d'origine |
| `assets/modulaires/` | Pull à capuche, short, jambes, mains, trois masques, manifeste et sources générées avec leurs prompts |
| `assets/tenues-validees/` | Trois nouvelles images complètes validées et leurs prompts |
| `assets/reference-8-directions.png` | Planche des huit vues, non décomposée en calques |
| `exemple-web/` | Exemple autonome de réassemblage et de couleurs |
| `exports/` | PNG d'origine, exemple personnalisé et tenue pull à capuche + short |
| `scripts/` | Reconstruction des formats, serveur et contrôles |
| `archives/variantes-a-revoir/` | Anciens essais récupérés, dont les raccords avaient été rejetés |

## État réel de la bibliothèque

La bibliothèque modulaire propose le T-shirt, le pull à capuche, le pantalon et le short. Les chemises et pulls bordeaux de `assets/tenues-validees/` restent des images complètes de référence ; ils ne sont pas proposés comme vêtements interchangeables.

Les jambes nécessaires au short ont été ajoutées ; les mains pour les manches longues sont extraites des bras d'origine. Les autres parties cachées sous les vêtements ne sont pas entièrement reconstruites. La bibliothèque concerne uniquement la vue de face et la pose immobile.

## Reconstruire ou intégrer

Les fichiers PNG de `assets/base/calques/` ne doivent pas être recadrés séparément. Le manifeste `assets/base/manifest.json` décrit leur ordre de dessin du fond vers l'avant. Dans un Canvas 2D, dessiner chaque image dans cet ordre avec `drawImage(image, 0, 0)`.

Les nouveaux PNG de `assets/modulaires/calques/` conservent aussi le canevas complet 1024 × 1536 et la position (0, 0). Leur manifeste décrit les surfaces de couleur et les associations. La fonction `outfitIndices` dans `exemple-web/pixels.js` fournit l'ordre complet de chaque association ; `recolor` sur un calque précise son masque et sa luminosité de référence. La peau des jambes suit le même choix de couleur que le visage et les mains.

Après une modification des fichiers source, exécuter `npm install`, puis `npm run build` pour régénérer les PSD, SVG, PNG et données de démonstration. Le script `scripts/prepare-clothes.mjs` adapte les générations conservées dans `assets/modulaires/sources/`, sépare short et jambes, ajuste le col, les poignets et la taille, puis crée les masques. La reconstruction remplace ces exports : conserver les modifications manuelles de Photoshop et des PNG dérivés dans d'autres fichiers. `npm test` vérifie les calques du PSD, ses pixels, les quatre associations, leurs raccords, les masques, les SVG et les liens de l'exemple.

Le PSD est écrit avec [ag-psd](https://github.com/Agamnentzar/ag-psd). Les PNG sont lus avec pngjs. Les dépendances de reconstruction sont enregistrées dans `package-lock.json`.

Les formats sont contrôlés par relecture et comparaison des images. L'exemple web a été vérifié dans Chrome en mode bureau et mobile : quatre associations, couleurs, export PNG, références et réinitialisation. L'ouverture dans Photoshop et Illustrator n'a pas été testée directement dans cette session.
