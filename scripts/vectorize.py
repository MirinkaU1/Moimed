import glob, os, re, sys, tempfile, vtracer
from PIL import Image, ImageFilter

NAMES = {"00_peau_tete_cou": "tete-cou", "01_bras_gauche_image": "bras-gauche", "02_bras_droit_image": "bras-droit",
         "10_pantalon": "pantalon", "20_chaussure_gauche_image": "chaussure-gauche", "21_chaussure_droite_image": "chaussure-droite",
         "30_tshirt": "tshirt", "40_yeux": "yeux", "50_sourcils": "sourcils", "60_cheveux": "cheveux"}
BASE = dict(filter_speckle=12, color_precision=6, layer_difference=16)
FINE = {"60_cheveux": dict(filter_speckle=8, color_precision=8, layer_difference=5),
        "30_tshirt": dict(filter_speckle=6, color_precision=8, layer_difference=4),
        "40_yeux": dict(filter_speckle=2, color_precision=8, layer_difference=10),
        "20_chaussure_gauche_image": dict(filter_speckle=2, color_precision=8, layer_difference=10),
        "21_chaussure_droite_image": dict(filter_speckle=2, color_precision=8, layer_difference=10)}
QUANT = {"40_yeux": 3, "20_chaussure_gauche_image": 4, "21_chaussure_droite_image": 4}
OPEN = {"01_bras_gauche_image", "02_bras_droit_image"}

src_dir, out_path = sys.argv[1], sys.argv[2]
tmp = tempfile.mkdtemp()
parts = []
for f in sorted(glob.glob(f"{src_dir}/*.png")):
    key = os.path.basename(f)[:-4]
    im = Image.open(f).convert("RGBA")
    a = im.getchannel("A").point(lambda v: 255 if v >= 140 else 0)
    if key in OPEN:
        a = a.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    a = a.filter(ImageFilter.MedianFilter(3 if key in FINE else 5))
    rgb = im.convert("RGB")
    if key in QUANT:
        rgb = (rgb.filter(ImageFilter.MedianFilter(5)) if key == "40_yeux" else rgb).quantize(QUANT[key] + 1, method=Image.Quantize.MEDIANCUT, kmeans=3, dither=Image.Dither.NONE).convert("RGB")
    px = Image.new("RGBA", im.size, (0, 0, 0, 0)); px.paste(rgb, mask=a)
    px.save(f"{tmp}/{key}.png")
    vtracer.convert_image_to_svg_py(f"{tmp}/{key}.png", f"{tmp}/{key}.svg", colormode="color", hierarchical="stacked",
        mode="spline", corner_threshold=60, length_threshold=4.0, splice_threshold=45, path_precision=2,
        **{**BASE, **FINE.get(key, {})})
    body = re.search(r"<svg[^>]*>(.*)</svg>", open(f"{tmp}/{key}.svg").read(), re.S).group(1).strip()
    parts.append(f'<g id="{NAMES[key]}">\n{body}\n</g>')
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1536" width="1024" height="1536">\n<title>Moimed</title>\n'
       + "\n".join(parts) + "\n</svg>\n")
open(out_path, "w").write(svg)
print(len(svg) // 1024, "Ko")
