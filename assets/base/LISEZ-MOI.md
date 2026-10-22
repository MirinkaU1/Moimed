# Personnage modulaire — vue de face

Ce kit décompose le personnage fourni en 10 calques PNG transparents, tous de 1024 × 1536 pixels, et en un document à calques OpenRaster (`personnage-calques.ora`).

## Fichiers

- `calques/` : tête et cou, deux bras, pantalon, deux chaussures, T-shirt, yeux, sourcils, cheveux.
- `masques/` : peau, pantalon, chaussures, T-shirt, pupilles, sourcils, cheveux. Le blanc sélectionne la surface à colorer ; la transparence protège le reste. Les masques de peau et vêtements épargnent l'essentiel des contours noirs. Ce sont des masques d'aide à la coloration, pas des calques de remplacement.
- `personnage-calques.ora` : les dix calques déjà superposés dans le bon ordre.
- `personnage-assemble.png` : résultat de la superposition sur fond transparent.
- `apercu-calques.png` : aperçu des calques sur damier ; le damier appartient uniquement à cet aperçu.
- `apercu-assemblage.png` : résultat sur un fond uni pour contrôler les contours.
- `manifest.json` : dimensions, ordre des calques, position et point d'ancrage indicatif pour une intégration.
- `reference-originale.png` : image d'origine conservée.

## Utilisation

Ouvrir le fichier `.ora` dans un éditeur compatible OpenRaster, ou importer les PNG comme calques dans un document de 1024 × 1536 pixels. Conserver chaque calque à la position (0, 0), à sa taille d'origine. Ne pas recadrer les fichiers séparément.

Pour remplacer un T-shirt, masquer le calque `T-shirt`, dessiner le nouveau sur un autre calque de même taille en s'aidant de l'ancien comme gabarit, puis exporter ce calque seul sur fond transparent. Procéder de la même façon pour les cheveux, le pantalon, les chaussures ou les yeux.

Pour une recoloration, charger le PNG du dossier `masques` comme sélection ou masque de calque puis appliquer une couleur en conservant les ombres de l'élément. La méthode de fusion dépend du logiciel : un mode Couleur conserve la luminosité et ne suffit donc pas à rendre un T-shirt noir blanc. Dans ce cas, ajuster aussi la luminosité sous le masque. Les pupilles d'origine sont noires et ne possèdent pas d'iris distinct ; pour un œil détaillé, redessiner l'iris sur le calque des yeux.

« Gauche » et « droite » désignent les côtés dans l'image, pas les côtés anatomiques du personnage.

## Limites de cette première découpe

La tête sans cheveux ni traits du visage a été reconstruite sous les yeux et les sourcils amovibles. Les vêtements, bras, yeux et cheveux proviennent de l'image d'origine. La transparence accidentelle à l'intérieur des surfaces a été corrigée. Les limites des surfaces ont été détourées et peuvent demander une petite retouche aux raccords pour des vêtements de coupe très différente.

Le torse, les jambes et les pieds sous les vêtements ne sont pas reconstruits : retirer le T-shirt, le pantalon ou les chaussures laisse donc des zones transparentes. Ce kit permet de remplacer la tenue et de recolorer les surfaces visibles ; pour un débardeur, un short ou des sandales, compléter les parties du corps nouvellement exposées.

Ce kit concerne uniquement la vue de face et la pose immobile. Les sept autres directions et les animations nécessitent leurs propres calques, avec le même gabarit.

## Origine

Image de départ : personnage 2D généré dans cette conversation. Reconstruction de la tête avec l'outil intégré imagegen, puis export et assemblage des calques et masques. Les instructions de génération sont conservées dans `prompts-generation.txt`.
