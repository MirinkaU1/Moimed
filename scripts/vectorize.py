import json, re, tempfile, vtracer
import numpy as np
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

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
QUANT = {"40_yeux": 2}
SHOE_PALETTE = [(10, 9, 8), (40, 37, 35), (110, 102, 93), (232, 222, 207)]
PALETTE = {"20_chaussure_gauche_image": SHOE_PALETTE, "21_chaussure_droite_image": SHOE_PALETTE}
SLEEVE = {"01_bras_gauche_image": "30_tshirt", "02_bras_droit_image": "30_tshirt"}
SKIN_SHADOW = (176, 111, 69, 255)
SHADOW_DEPTH = 9
HEM_BAND = {"30_tshirt": (660, 740), "10_pantalon": (850, 925)}
UPSCALE = {"20_chaussure_gauche_image": 3, "21_chaussure_droite_image": 3}
OPEN = {"01_bras_gauche_image", "02_bras_droit_image", "30_tshirt"}
INKED_SKIN = {"30_tshirt"}
INK = (12, 11, 10)
RESTYLE = {"hoodie": dict(hem=dict(top=846, seam=858, bottom=914, left=368, right=658, outline=11, radius=14, clear=930, sag=6, line=6, rib=15, cuffs=(869, 898))), "short": {}}
TINT = {"cheveux": dict(inset=4), "pupilles": {}, "tshirt": dict(ink=13), "pantalon": dict(ink=20), "hoodie": dict(ink=30, zone="alpha"),
        "short": dict(ink=30), "peau": dict(ink=60, zone="alpha"), "jambes": dict(ink=60, zone="alpha"), "chaussures": dict(ink=20)}


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


def shift(mask, dy, dx):
    out = np.zeros_like(mask)
    h, w = mask.shape
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = mask[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def line_open(mask, length):
    kept = np.zeros_like(mask)
    for dy, dx in ((0, 1), (1, 0), (1, 1), (1, -1)):
        core = mask.copy()
        for step in range(1, length):
            core &= shift(mask, -step * dy, -step * dx)
        grown = core.copy()
        for step in range(1, length):
            grown |= shift(core, step * dy, step * dx)
        kept |= grown
    return kept


def masked(px, mask, rule, k):
    full = px
    if k > 1:
        px = px.resize((px.width // k, px.height // k), Image.Resampling.NEAREST)
    alpha = px.getchannel("A")
    mask = mask.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
    if "inset" in rule:
        region = alpha.filter(ImageFilter.GaussianBlur(rule["inset"])).point(lambda v: 255 if v >= 252 else 0)
    elif "ink" in rule:
        zone = alpha if rule.get("zone") == "alpha" else mask.filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.MinFilter(11))
        r, g, b = px.convert("RGB").split()
        ink = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v <= rule["ink"] else 0)
        ink = binary(line_open(np.array(ink) > 0, 15)).filter(ImageFilter.MaxFilter(3))
        region = ImageChops.subtract(ImageChops.multiply(zone, alpha), ink)
        if rule.get("zone") != "alpha":
            region = region.filter(ImageFilter.MedianFilter(5))
        bright = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v > rule["ink"] else 0)
        region = ImageChops.lighter(region, ImageChops.multiply(ImageChops.multiply(region.filter(ImageFilter.MaxFilter(5)), bright), alpha))
    else:
        region = mask
    if k > 1:
        region = region.resize(full.size, Image.Resampling.NEAREST)
    out = Image.new("RGBA", full.size, (0, 0, 0, 0))
    out.paste(full, mask=ImageChops.multiply(region, full.getchannel("A")))
    return out




def binary(mask):
    return Image.fromarray(np.where(mask, 255, 0).astype(np.uint8))


def restyle(im, outline=11, inner=1, shade=(.78, 1.0, 1.14), hem=None):
    rgba = np.array(im)
    a = original = rgba[..., 3] >= 140
    ink = (rgba[..., :3].max(axis=2) <= 30) & a
    ink = binary(ink).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    ink = (np.array(ink.filter(ImageFilter.MaxFilter(1 + 2 * inner))) > 0) & a
    closed = np.array(binary(a).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))) > 0
    near_background = np.array(binary(~closed).filter(ImageFilter.MaxFilter(2 * outline + 1))) > 0
    silhouette = a & near_background
    ink |= closed & ~a
    a = a | closed
    fabric = a & ~ink & ~silhouette
    smooth = np.array(im.convert("RGB").filter(ImageFilter.MedianFilter(9))).astype(float)
    light = smooth @ [.2126, .7152, .0722]
    base_light = np.median(light[fabric])
    base = np.median(smooth[fabric], axis=0)
    level = np.digitize(light / base_light, [(shade[0] + shade[1]) / 2, (shade[1] + shade[2]) / 2])
    level = np.array(Image.fromarray(level.astype(np.uint8)).filter(ImageFilter.ModeFilter(15)))
    tones = np.array([base * s for s in shade]).clip(0, 255)
    out = np.zeros_like(rgba)
    out[fabric, :3] = tones[level[fabric]]
    out[ink | silhouette, :3] = INK
    out[a, 3] = 255
    result = Image.fromarray(out).copy()
    if hem:
        draw_hem(result, original, tones, **hem)
    return result


def body_edges(alpha, y):
    xs = np.flatnonzero(alpha[y])
    mid = alpha.shape[1] // 2
    left = xs[xs <= mid]
    right = xs[xs >= mid]
    l = left[-1]
    while l > 0 and alpha[y, l - 1]:
        l -= 1
    r = right[0]
    while r < alpha.shape[1] - 1 and alpha[y, r + 1]:
        r += 1
    return l, r


def draw_hem(im, alpha, tones, top, seam, bottom, left, right, outline, radius, clear, sag, line, rib, cuffs):
    l, r = body_edges(alpha, top)
    px = im.load()
    for y in range(top, clear):
        bl, br = body_edges(alpha, y) if alpha[y, alpha.shape[1] // 2] else (left, right)
        for x in range(bl, br + 1):
            px[x, y] = (0, 0, 0, 0)
    shadow, base = (tuple(int(c) for c in tone) + (255,) for tone in tones[:2])
    band = tuple(int(c) for c in tones[0] * .4 + tones[1] * .6) + (255,)
    groove = tuple(int(c) for c in tones[0] * .8 + tones[1] * .2) + (255,)
    ink = INK + (255,)
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((left, seam, right, bottom), radius=radius, fill=ink)
    draw.rounded_rectangle((left + outline, seam + outline, right - outline, bottom - outline), radius=max(1, radius - outline), fill=band)
    for x in range(left + outline + rib, right - outline - rib // 2, rib):
        draw.line([(x, seam + outline + 4), (x, bottom - outline - 4)], fill=groove, width=3)
    middle, half = (left + right) / 2, (right - left) / 2
    curve = lambda x: seam + sag * (1 - ((x - middle) / half) ** 2)
    xs = list(range(right, left - 1, -4))
    inner = [x for x in xs if left + outline <= x <= right - outline]
    draw.polygon([(x, curve(x) + line) for x in inner] + [(x, curve(x) + line + 5) for x in reversed(inner)], fill=shadow)
    draw.polygon([(l, top), (r, top), (right, seam)] + [(x, curve(x) + line) for x in xs] + [(left, seam)], fill=ink)
    draw.polygon([(l + outline, top), (r - outline, top), (right - outline, seam)] + [(x, curve(x)) for x in inner] + [(left + outline, seam)], fill=base)
    y0, y1 = cuffs
    for y in range(y0, y1):
        bl, br = body_edges(alpha, y) if alpha[y, alpha.shape[1] // 2] else (left, right)
        for x in range(im.width):
            if (x < bl or x > br) and x % rib < 3 and px[x, y][3] and px[x, y][:3] != INK:
                px[x, y] = groove


def grow(alpha, k, size=7):
    small = alpha.resize((alpha.width // k, alpha.height // k), Image.Resampling.NEAREST) if k > 1 else alpha
    grown = small.filter(ImageFilter.MaxFilter(size))
    return grown.resize(alpha.size, Image.Resampling.NEAREST) if k > 1 else grown


def cut(px, alpha):
    out = Image.new("RGBA", px.size, (0, 0, 0, 0))
    out.paste(px, mask=alpha)
    return out


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
for index, (f, layer) in enumerate(zip(files, meta["layers"])):
    key = f.stem
    source = Image.open(f).convert("RGBA")
    if key in RESTYLE:
        source = restyle(source, **RESTYLE[key])
    if key in INKED_SKIN:
        pixels = np.array(source)
        skin = pixels[..., 0].astype(int) - pixels[..., 2] > 25
        pixels[skin, :3] = INK
        source = Image.fromarray(pixels)
    px, k = prepare(source, key, layers)
    group = layer.get("recolor") or next((g for g in meta["groups"] if index in g["indices"]), None)
    tint = None
    if group:
        region = masked(px, Image.open(mask_files[group["mask"]]), TINT[group["mask"]], k)
        inside = region.getchannel("A")
        tint = {"group": group["id"], "reference": median_light(region), "flat": group.get("flat", False),
                "flatInk": group.get("flatInk", [0, 0, 0]),
                "body": trace(cut(px, ImageChops.multiply(grow(inside, k), px.getchannel("A"))), key, tmp, "-teinte"),
                "overlay": trace(cut(px, ImageChops.subtract(px.getchannel("A"), inside)), key, tmp, "-contour")}
    traced.append({"id": NAMES[key], "label": layer["label"], "scale": 1 / k, "body": trace(px, key, tmp), "tint": tint})


def group_svg(layer):
    scale = f' transform="scale({layer["scale"]:.6f})"' if layer["scale"] != 1 else ""
    return f'<g id="{layer["id"]}"{scale}>\n{layer["body"]}\n</g>'


svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1536" width="1024" height="1536">\n<title>Moimed</title>\n'
       + "\n".join(group_svg(layer) for layer in traced[:10]) + "\n</svg>\n")
(ROOT / "documents/Moimed-Vectoriel.svg").write_text(svg)
web = {key: meta[key] for key in ("width", "height", "groups", "preset", "wardrobe", "references")}
web["layers"] = [{**layer, "body": "" if layer["tint"] else layer["body"]} for layer in traced]
(ROOT / "exemple-web/vector-data.js").write_text(f"globalThis.MOIMED_VECTOR = {json.dumps(web, ensure_ascii=False)};\n")
print(len(svg) // 1024, "Ko SVG,", (ROOT / "exemple-web/vector-data.js").stat().st_size // 1024, "Ko atelier")
