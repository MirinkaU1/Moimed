# Moimed — personnage 2D modulaire

Le projet conserve les calques du personnage d'origine, les nouvelles tenues validées et un exemple de réassemblage déjà implémenté. La base et ses masques restent disponibles pendant la préparation des nouveaux vêtements.

## Ouvrir dans Photoshop

Ouvrir `documents/Moimed-Personnage.psd`.

Le personnage d'origine apparaît déjà assemblé. Le groupe **01 — Personnage assemblé** contient les dix éléments séparés : tête et cou, deux bras, pantalon, deux chaussures, T-shirt, yeux, sourcils et cheveux. Chaque calque conserve son canevas 1024 × 1536 et sa position (0, 0).

Le groupe **02 — Exemple couleurs** contient un second assemblage déjà personnalisé. Masquer le groupe 01 et afficher le groupe 02 pour le voir. Les groupes 03 (tenues complètes de référence) et 04 (masques de couleur) sont masqués par défaut.

Pour une nouvelle couleur, afficher le groupe des masques, maintenir Ctrl (Cmd sur Mac) et cliquer sur la vignette du masque voulu pour charger sa transparence comme sélection. Masquer à nouveau le groupe des masques puis travailler sur une copie du calque concerné. Le mode Couleur conserve la luminosité ; éclaircir un T-shirt noir demande aussi d'ajuster sa luminosité. Les contours noirs sont en grande partie protégés par les masques fournis.

## Ouvrir dans Illustrator

Ouvrir `documents/Moimed-Personnage.svg`. Les dix images PNG sont incorporées dans dix groupes superposés. Elles restent séparées et repositionnables, sans fichiers liés manquants.

Ce SVG contient des **éléments bitmap**, pas des contours vectoriels éditables point par point. Il ne s'agit pas d'un fichier `.ai` natif. Une vraie version vectorielle demanderait un travail de tracé.

## Exemple déjà implémenté

Ouvrir `exemple-web/index.html` par double-clic. Les calques et masques sont incorporés dans `assets-data.js`, ce qui évite de charger un manifeste avec `fetch` depuis un fichier local.

L'exemple propose :

- l'assemblage des dix vrais PNG transparents ;
- l'affichage ou le masquage de chaque calque ;
- la recoloration de la peau, des cheveux, du T-shirt, du pantalon, des chaussures et des pupilles ;
- un préréglage bleu et un retour à l'original ;
- l'export du résultat en PNG transparent ;
- l'affichage des trois nouvelles tenues comme références complètes.

On peut aussi lancer `Demarrer.cmd`, puis ouvrir `http://127.0.0.1:4173/`. Node.js suffit pour ce serveur local ; aucune installation de dépendance n'est nécessaire pour lancer l'exemple déjà généré.

## Dossiers

| Dossier | Contenu |
|---|---|
| `documents/` | PSD à calques et SVG à images incorporées |
| `assets/base/` | Dix calques, sept masques, document OpenRaster et manifeste d'origine |
| `assets/tenues-validees/` | Trois nouvelles images complètes validées et leurs prompts |
| `assets/reference-8-directions.png` | Planche des huit vues, non décomposée en calques |
| `exemple-web/` | Exemple autonome de réassemblage et de couleurs |
| `exports/` | PNG assemblé et exemple personnalisé |
| `scripts/` | Reconstruction des formats, serveur et contrôles |
| `archives/variantes-a-revoir/` | Anciens essais récupérés, dont les raccords avaient été rejetés |

## État réel de la bibliothèque

La base modulaire est celle du personnage d'origine en T-shirt. Les nouvelles chemises et les nouveaux pulls sont des images complètes : leur décomposition et leur compatibilité avec les autres vêtements restent à préparer. Ils ne sont donc pas proposés comme vêtements interchangeables dans l'exemple.

Les parties du corps cachées sous les vêtements ne sont pas entièrement reconstruites. Une coupe plus ouverte, des shorts, des sandales ou une animation demandent de compléter ces parties. La base modulaire concerne uniquement la vue de face et la pose immobile.

## Reconstruire ou intégrer

Les fichiers PNG de `assets/base/calques/` ne doivent pas être recadrés séparément. Le manifeste `assets/base/manifest.json` décrit leur ordre de dessin du fond vers l'avant. Dans un Canvas 2D, dessiner chaque image dans cet ordre avec `drawImage(image, 0, 0)`.

Après une modification des fichiers source, exécuter `npm install`, puis `npm run build` pour régénérer le PSD, le SVG et les données de démonstration. La reconstruction remplace ces exports : conserver les modifications manuelles de Photoshop dans un autre fichier PSD. `npm test` vérifie les calques du PSD, ses pixels, son assemblage, les masques, le SVG et les liens de l'exemple.

Le PSD est écrit avec [ag-psd](https://github.com/Agamnentzar/ag-psd). Les PNG sont lus avec pngjs. Les dépendances de reconstruction sont enregistrées dans `package-lock.json`.

Les formats sont contrôlés par relecture et comparaison des images ; l'ouverture dans les applications Photoshop et Illustrator n'a pas été testée directement dans cette session.
