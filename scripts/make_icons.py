# Erzeugt die App-Icons (PNG) aus dem Raketen-Symbol RK_PATH → src/pwa/icons/
# Aufruf: node scripts/py.js scripts/make_icons.py   (nur nötig, wenn sich das Symbol ändert)
import re, os, pathlib
from PIL import Image, ImageDraw, ImageFilter

RK_PATH = "M12 1.5c2.6 2.3 4.1 5.8 4.1 9.8v4.2l2.4 2.9v2.1l-4.6-1.6h-3.8l-4.6 1.6v-2.1l2.4-2.9v-4.2c0-4 1.5-7.5 4.1-9.8z"
OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "pwa" / "icons"
BG, ACC = (11, 15, 23), (78, 161, 255)

def path_points(d, steps=24):
    """Einfacher SVG-Pfad-Parser (M L H V C Z, absolut und relativ) → Punktliste"""
    tok = re.findall(r"[MLHVCZmlhvcz]|-?\d*\.?\d+", d)
    pts, x, y, i, cmd = [], 0.0, 0.0, 0, None
    while i < len(tok):
        if re.match(r"[A-Za-z]", tok[i]): cmd = tok[i]; i += 1
        if cmd in "Zz": continue
        rel = cmd.islower(); C = cmd.upper()
        n = {"M": 2, "L": 2, "H": 1, "V": 1, "C": 6}[C]
        a = [float(v) for v in tok[i:i + n]]; i += n
        if C in "ML":
            x, y = (x + a[0], y + a[1]) if rel else (a[0], a[1]); pts.append((x, y))
        elif C == "H":
            x = x + a[0] if rel else a[0]; pts.append((x, y))
        elif C == "V":
            y = y + a[0] if rel else a[0]; pts.append((x, y))
        else:
            ox, oy = (x, y) if rel else (0, 0)
            p1, p2, p3 = (ox + a[0], oy + a[1]), (ox + a[2], oy + a[3]), (ox + a[4], oy + a[5])
            for s in range(1, steps + 1):
                t = s / steps; u = 1 - t
                pts.append((u**3 * x + 3*u*u*t * p1[0] + 3*u*t*t * p2[0] + t**3 * p3[0],
                            u**3 * y + 3*u*u*t * p1[1] + 3*u*t*t * p2[1] + t**3 * p3[1]))
            x, y = p3
    return pts

def icon(size, maskable=False, ss=4):
    S = size * ss
    im = Image.new("RGBA", (S, S), BG + (255,) if maskable else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if not maskable: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BG + (255,))
    scale = S * (0.62 if maskable else 0.78) / 24        # Maskable: Rakete in der sicheren Zone (Mitte 80 %)
    off = (S - 24 * scale) / 2
    pts = [(off + px * scale, off + py * scale) for px, py in path_points(RK_PATH)]
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).polygon(pts, fill=ACC + (170,))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(S * 0.035)))
    d = ImageDraw.Draw(im)
    d.polygon(pts, fill=(255, 255, 255, 255), outline=ACC + (255,), width=max(1, int(scale * 0.55)))
    cx, cy, r = off + 12 * scale, off + 9.5 * scale, 1.9 * scale
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ACC + (255,))
    return im.resize((size, size), Image.LANCZOS)

OUT.mkdir(parents=True, exist_ok=True)
for sz in (192, 512): icon(sz).save(OUT / f"icon-{sz}.png", optimize=True)
icon(512, maskable=True).save(OUT / "maskable-512.png", optimize=True)
icon(180, maskable=True).convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)   # iOS: ohne Transparenz
icon(96).save(OUT / "badge-96.png", optimize=True)
print("Icons:", ", ".join(sorted(p.name for p in OUT.iterdir())))
