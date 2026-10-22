import glob, os, re, sys, tempfile, vtracer
from PIL import Image, ImageFilter

NAMES = {"00_peau_tete_cou": "tete-cou", "01_bras_gauche_image": "bras-gauche", "02_bras_droit_image": "bras-droit",
         "10_pantalon": "pantalon", "20_chaussure_gauche_image": "chaussure-gauche", "21_chaussure_droite_image": "chaussure-droite",
         "30_tshirt": "tshirt", "40_yeux": "yeux", "50_sourcils": "sourcils", "60_cheveux": "cheveux"}
BASE = dict(filter_speckle=12, color_precision=6, layer_difference=16)
FINE = {"60_cheveux": dict(filter_speckle=8, color_precision=8, layer_difference=5),
        "30_tshirt": dict(filter_speckle=6, color_precision=8, layer_difference=4),
        "40_yeux": dict(filter_speckle=2, color_precision=8, layer_difference=10),
        "20_chaussure_gauche_image": dict(filter_speckle=4, color_precision=8, layer_difference=10),
        "21_chaussure_droite_image": dict(filter_speckle=4, color_precision=8, layer_difference=10)}
QUANT = {"40_yeux": 3}
SHOE_PALETTE = [(10, 9, 8), (40, 37, 35), (110, 102, 93), (232, 222, 207)]
PALETTE = {"20_chaussure_gauche_image": SHOE_PALETTE, "21_chaussure_droite_image": SHOE_PALETTE}
SLEEVE = {"01_bras_gauche_image": "30_tshirt", "02_bras_droit_image": "30_tshirt"}
SKIN_SHADOW = (176, 111, 69, 255)
SHADOW_DEPTH = 9
HEM_BAND = {"30_tshirt": (660, 740)}
UPSCALE = {"20_chaussure_gauche_image": 3, "21_chaussure_droite_image": 3}
OPEN = {"01_bras_gauche_image", "02_bras_droit_image", "30_tshirt"}


def main_run(px, width, y):
    runs = []
    for x in range(width):
        if px[x, y][3] >= 140:
            if runs and runs[-1][1] == x - 1:
                runs[-1][1] = x
            else:
                runs.append([x, x])
    return max(runs, key=lambda r: r[1] - r[0])


def rebuild_arm_top(im, sleeve):
    original = im.copy()
    px, sa, w = im.load(), sleeve.load(), im.width
    top = next(y for y in range(im.height) if sum(px[x, y][3] >= 140 for x in range(w)) >= 20)
    ref = top + 36
    (l0, r0), (l1, r1) = main_run(px, w, ref), main_run(px, w, ref + 30)
    mid = (l0 + r0) // 2
    outer_left = mid < w / 2
    slope = (l0 - l1) / 30 if outer_left else (r0 - r1) / 30
    row = im.crop((0, ref, w, ref + 1))
    blank = Image.new("RGBA", (w, 1), (0, 0, 0, 0))
    for y in range(top - 30, ref):
        im.paste(blank, (0, y))
        im.paste(row, (round((ref - y) * slope), y))
    hems = {}
    for x in range(l0 - 20, r0 + 20):
        hem = max((y for y in range(top - 40, ref) if sa[x, y] >= 140), default=None)
        if hem is not None:
            hems[x] = hem
    opx = original.load()
    for x in range(w):
        if x not in hems:
            for y in range(top - 30, ref):
                px[x, y] = opx[x, y]
        elif x > mid if outer_left else x < mid:
            for y in range(top - 30, ref):
                r, g, b, a = opx[x, y]
                px[x, y] = opx[mid, ref] if a >= 140 and r + g + b > 300 else opx[x, y]
    inner = [x for x in hems if l0 + 12 <= x <= r0 - 12]
    n = len(inner)
    mx, my = sum(inner) / n, sum(hems[x] for x in inner) / n
    k = sum((x - mx) * (hems[x] - my) for x in inner) / sum((x - mx) ** 2 for x in inner)
    for x, hem in hems.items():
        bottom = round(my + k * (x - mx)) + SHADOW_DEPTH
        for y in range(top - 30, bottom + 1):
            r, g, b, a = px[x, y]
            if a >= 140 and r + g + b > 300:
                px[x, y] = SKIN_SHADOW


def clean_alpha(im, key):
    a = im.getchannel("A").point(lambda v: 255 if v >= 140 else 0)
    if key in HEM_BAND:
        y0, y1 = HEM_BAND[key]
        band = a.crop((0, y0, a.width, y1)).filter(ImageFilter.MinFilter(13)).filter(ImageFilter.MaxFilter(13))
        a.paste(band.crop((0, 8, a.width, y1 - y0 - 8)), (0, y0 + 8))
    if key in OPEN:
        a = a.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    return a.filter(ImageFilter.MedianFilter(3 if key in FINE else 5))


src_dir, out_path = sys.argv[1], sys.argv[2]
tmp = tempfile.mkdtemp()
parts = []
for f in sorted(glob.glob(f"{src_dir}/*.png")):
    key = os.path.basename(f)[:-4]
    im = Image.open(f).convert("RGBA")
    if key in SLEEVE:
        rebuild_arm_top(im, clean_alpha(Image.open(f"{src_dir}/{SLEEVE[key]}.png").convert("RGBA"), SLEEVE[key]))
    k = UPSCALE.get(key, 1)
    if k > 1:
        im = im.resize((im.width * k, im.height * k), Image.Resampling.LANCZOS)
    a = clean_alpha(im, key)
    rgb = im.convert("RGB")
    if key in QUANT:
        rgb = rgb.filter(ImageFilter.MedianFilter(5)).quantize(QUANT[key] + 1, method=Image.Quantize.MEDIANCUT, kmeans=3, dither=Image.Dither.NONE).convert("RGB")
    if key in PALETTE:
        pal = Image.new("P", (1, 1))
        pal.putpalette([c for rgb_ in PALETTE[key] for c in rgb_] + [0] * (768 - 3 * len(PALETTE[key])))
        rgb = rgb.quantize(palette=pal, dither=Image.Dither.NONE).convert("RGB")
    px = Image.new("RGBA", im.size, (0, 0, 0, 0)); px.paste(rgb, mask=a)
    px.save(f"{tmp}/{key}.png")
    vtracer.convert_image_to_svg_py(f"{tmp}/{key}.png", f"{tmp}/{key}.svg", colormode="color", hierarchical="stacked",
        mode="spline", corner_threshold=60, length_threshold=4.0, splice_threshold=45, path_precision=2,
        **{**BASE, **FINE.get(key, {})})
    body = re.search(r"<svg[^>]*>(.*)</svg>", open(f"{tmp}/{key}.svg").read(), re.S).group(1).strip()
    scale = f' transform="scale({1 / k:.6f})"' if k > 1 else ""
    parts.append(f'<g id="{NAMES[key]}"{scale}>\n{body}\n</g>')
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1536" width="1024" height="1536">\n<title>Moimed</title>\n'
       + "\n".join(parts) + "\n</svg>\n")
open(out_path, "w").write(svg)
print(len(svg) // 1024, "Ko")
