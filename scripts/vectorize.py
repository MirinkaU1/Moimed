import json, re, tempfile, vtracer
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

NAMES = {"00_peau_tete_cou": "tete-cou", "01_bras_gauche_image": "bras-gauche", "02_bras_droit_image": "bras-droit",
         "10_pantalon": "pantalon", "20_chaussure_gauche_image": "chaussure-gauche", "21_chaussure_droite_image": "chaussure-droite",
         "30_tshirt": "tshirt", "40_yeux": "yeux", "50_sourcils": "sourcils", "60_cheveux": "cheveux",
         "hoodie": "pull-capuche", "short": "short", "jambes": "jambes", "mains": "mains"}
BASE = dict(filter_speckle=12, color_precision=6, layer_difference=16)
FINE = {"60_cheveux": dict(filter_speckle=8, color_precision=8, layer_difference=5),
        "30_tshirt": dict(filter_speckle=6, color_precision=8, layer_difference=4),
        "hoodie": dict(filter_speckle=6, color_precision=8, layer_difference=4),
        "short": dict(filter_speckle=6, color_precision=8, layer_difference=4),
        "40_yeux": dict(filter_speckle=2, color_precision=8, layer_difference=10),
        "20_chaussure_gauche_image": dict(filter_speckle=4, color_precision=8, layer_difference=10),
        "21_chaussure_droite_image": dict(filter_speckle=4, color_precision=8, layer_difference=10)}
QUANT = {"40_yeux": 3}
SHOE_PALETTE = [(10, 9, 8), (40, 37, 35), (110, 102, 93), (232, 222, 207)]
PALETTE = {"20_chaussure_gauche_image": SHOE_PALETTE, "21_chaussure_droite_image": SHOE_PALETTE}
SLEEVE = {"01_bras_gauche_image": "30_tshirt", "02_bras_droit_image": "30_tshirt"}
SKIN_SHADOW = (176, 111, 69, 255)
SHADOW_DEPTH = 9
HEM_BAND = {"30_tshirt": (660, 740), "10_pantalon": (850, 925)}
UPSCALE = {"20_chaussure_gauche_image": 3, "21_chaussure_droite_image": 3}
OPEN = {"01_bras_gauche_image", "02_bras_droit_image", "30_tshirt"}
UNDER = {"hoodie": {"10_pantalon": ("pantalon-sous-pull", "Pantalon sous le pull", 885, 930)}}
TINT = {"cheveux": dict(erode=19), "pupilles": {}, "tshirt": dict(ink=13), "pantalon": dict(ink=20), "hoodie": dict(ink=30),
        "short": dict(ink=30), "peau": dict(ink=60), "jambes": dict(ink=60), "chaussures": dict(ink=20)}


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


ROOT = Path(__file__).resolve().parent.parent
BROWSER_DATA = "globalThis.MOIMED_ASSETS = "


def prepare(im, key, layers):
    if key in SLEEVE:
        rebuild_arm_top(im, clean_alpha(Image.open(layers[SLEEVE[key]]).convert("RGBA"), SLEEVE[key]))
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
    px = Image.new("RGBA", im.size, (0, 0, 0, 0))
    px.paste(rgb, mask=a)
    return px, k


def trace(px, key, tmp, suffix=""):
    png, svg = f"{tmp}/{key}{suffix}.png", f"{tmp}/{key}{suffix}.svg"
    px.save(png)
    vtracer.convert_image_to_svg_py(png, svg, colormode="color", hierarchical="stacked", mode="spline",
        corner_threshold=60, length_threshold=4.0, splice_threshold=45, path_precision=2,
        **{**BASE, **FINE.get(key, {})})
    return re.search(r"<svg[^>]*>(.*)</svg>", open(svg).read(), re.S).group(1).strip()


def masked(px, mask, rule, k):
    full = px
    if k > 1:
        px = px.resize((px.width // k, px.height // k), Image.Resampling.NEAREST)
    alpha = px.getchannel("A")
    mask = mask.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
    if "erode" in rule:
        region = alpha.filter(ImageFilter.MinFilter(rule["erode"])).filter(ImageFilter.MedianFilter(9))
    elif "ink" in rule:
        zone = mask.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.MinFilter(11))
        r, g, b = px.convert("RGB").split()
        ink = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v <= rule["ink"] else 0)
        ink = ink.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(7))
        region = ImageChops.subtract(ImageChops.multiply(zone, alpha), ink).filter(ImageFilter.MedianFilter(5))
    else:
        region = mask
    if k > 1:
        region = region.resize(full.size, Image.Resampling.NEAREST)
    out = Image.new("RGBA", full.size, (0, 0, 0, 0))
    out.paste(full, mask=ImageChops.multiply(region, full.getchannel("A")))
    return out


def tuck_under(im, top, y0, y1):
    px, tp = im.load(), top.load()
    hems = {}
    for x in range(im.width):
        hem = max((y for y in range(y0, y1) if tp[x, y][3] >= 140), default=None)
        if hem is not None and hem > y0 + 5:
            hems[x] = hem
    present = sorted(hems)
    for x in range(im.width):
        nearest = min(present, key=lambda c: abs(c - x))
        for y in range(y0 - 40, hems[nearest]):
            if tp[x, y][3] < 140:
                px[x, y] = (0, 0, 0, 0)
    return im


def median_light(image):
    histogram = image.convert("L").histogram(mask=image.getchannel("A"))
    half, total = sum(histogram) / 2, 0
    for light, count in enumerate(histogram):
        total += count
        if total >= half:
            return max(light, 1)


meta = json.loads(open(ROOT / "exemple-web/assets-data.js").read()[len(BROWSER_DATA):].rstrip().rstrip(";"))
roots = {"assets/base": ROOT / "assets/base", "assets/modulaires": ROOT / "assets/modulaires"}
mask_files = {**{p.stem: p for p in (ROOT / "assets/base/masques").glob("*.png")},
              **{p.stem: p for p in (ROOT / "assets/modulaires/masques").glob("*.png")}}
files = [roots[layer.get("assetRoot", "assets/base")] / layer["file"] for layer in meta["layers"]]
layers = {f.stem: f for f in files}
tmp = tempfile.mkdtemp()
traced = []
TINT_MASK = {}
for index, (f, layer) in enumerate(zip(files, meta["layers"])):
    key = f.stem
    px, k = prepare(Image.open(f).convert("RGBA"), key, layers)
    group = layer.get("recolor") or next((g for g in meta["groups"] if index in g["indices"]), None)
    if group:
        TINT_MASK[key] = group["mask"]
    tint = None
    if group:
        region = masked(px, Image.open(mask_files[group["mask"]]), TINT[group["mask"]], k)
        tint = {"group": group["id"], "reference": median_light(region), "flat": group.get("flat", False),
                "flatInk": group.get("flatInk", [0, 0, 0]), "body": trace(region, key, tmp, "-teinte")}
    traced.append({"id": NAMES[key], "label": layer["label"], "scale": 1 / k, "body": trace(px, key, tmp), "tint": tint})
variants = {}
for top_id, under in UNDER.items():
    top = Image.open(layers[top_id]).convert("RGBA")
    for key, (variant_id, label, y0, y1) in under.items():
        index = list(layers).index(key)
        px, k = prepare(tuck_under(Image.open(layers[key]).convert("RGBA"), top, y0, y1), key, layers)
        tint = dict(traced[index]["tint"])
        tint["body"] = trace(masked(px, Image.open(mask_files[TINT_MASK[key]]), TINT[TINT_MASK[key]], k), key, tmp, "-sous-teinte")
        variants.setdefault(top_id, {})[index] = len(traced)
        traced.append({"id": variant_id, "label": label, "scale": 1 / k, "body": trace(px, key, tmp, "-sous"), "tint": tint})


def group_svg(layer):
    scale = f' transform="scale({layer["scale"]:.6f})"' if layer["scale"] != 1 else ""
    return f'<g id="{layer["id"]}"{scale}>\n{layer["body"]}\n</g>'


svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1536" width="1024" height="1536">\n<title>Moimed</title>\n'
       + "\n".join(group_svg(layer) for layer in traced[:10]) + "\n</svg>\n")
(ROOT / "documents/Moimed-Vectoriel.svg").write_text(svg)
web = {key: meta[key] for key in ("width", "height", "groups", "preset", "wardrobe", "references")}
web["layers"] = traced
web["variants"] = variants
(ROOT / "exemple-web/vector-data.js").write_text(f"globalThis.MOIMED_VECTOR = {json.dumps(web, ensure_ascii=False)};\n")
print(len(svg) // 1024, "Ko SVG,", (ROOT / "exemple-web/vector-data.js").stat().st_size // 1024, "Ko atelier")
