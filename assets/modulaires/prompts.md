# Génération des vêtements

Outil intégré image_gen. Sources conservées sans modification dans sources/.

## Pull à capuche

Use case: precise-object-edit. Asset type: transparent interchangeable 2D game clothing layer.
Input 1 is the exact full character to fit; Input 2 is the existing aligned T-shirt layer as a position guide.
Create ONLY a charcoal grey pullover HOODIE garment on a genuinely transparent 1024 x 1536 canvas. Same hand-drawn cartoon aesthetic, thick almost-black outlines, restrained grain and soft cel shading as the character. Hood lowered behind neck, collar opening empty/transparent, two drawstrings, kangaroo pocket, long sleeves, ribbed cuffs and bottom hem. Neutral gray fabric around RGB 75,75,75 for later recoloring, black outlines around RGB 10. No logos.
CRITICAL FIT: retain the original full canvas and garment scale. Body garment at x370..655 y480..901 with bottom hem covering trousers waistband. Shoulders at x350..675 y490. Hood behind neck begins about y450 and surrounds but does NOT cover the head/chin. Neck opening centered x512 y480. Sleeves follow the character's existing downward arms: left shoulder down to wrist at x298..351 y891, right wrist at x674..727 y891. Cuffs end at y900 to meet existing hands. Cover the existing forearms entirely down to wrists. The chest is centered x512 y650. Keep both arms hanging in the EXACT original pose and position.
Output ONLY the hoodie including hood and sleeves. No head, face, hair, neck skin, hands, legs, trousers, shoes, mannequin, body, background, grid or labels. Every empty region is real alpha transparency. Do not center or enlarge the garment to fill the canvas: preserve the original 1024x1536 full-body coordinate layout with blank space above and below.

## Short et jambes

Use case: precise-object-edit. Asset type: transparent modular 2D character lower body.
Input image is the exact character to fit. Replace the long trousers with a plain neutral mid-gray casual SHORT ending above the knees, together with the newly visible BARE LEGS. Output ONLY the SHORT AND TWO BARE LEGS in their original full-body coordinate position. No torso, arms, hands, head, shoes, socks, or other objects.
Preserve reference cartoon aesthetic exactly: thick near-black smooth outlines, grainy shading, same body proportions and stance, frontal orthographic view. Gray fabric RGB roughly 80,80,80 for recoloring, skin same tan as reference RGB217,155,97. Short has waist and belt loops, side pockets, simple fly, subtle natural folds and two finished hems. No logos, no drawstring.
CANVAS AND FIT ARE CRITICAL: true alpha transparent 1024x1536 full-body canvas. Waist at y885, x380..647, hidden top 20px by either original T-shirt or hoodie. Shorts two legs run to y1095. Left leg center x430, right leg center x600. Bare calves run from below short hems y1080 to ankles y1395. Left ankle spans x375..460 at y1380; right ankle x560..646 at y1380, to fit the original existing sneakers. Keep gap between legs open/transparent. Upper thigh silhouette stays within original trouser outline x365..662. Complete feet are NOT drawn; bare ankles extend under the sneakers' existing upper edges. Clothing silhouette slightly wider at shorts hems than calves.
Everything above y880 and below y1405 is transparent. Do NOT recenter, zoom, crop, shrink body length, or add background/drop shadow/glow. Output is one perfectly aligned shorts-and-legs layer ready for decomposition into separate fabric and skin surfaces.
