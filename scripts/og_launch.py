# Vorschaubild (1200×630) pro Start für geteilte Links: Foto der Mission + Name, Rakete, Startzeit.
#   node scripts/py.js scripts/og_launch.py   (nach build.py, vor seo_pages.js – läuft in npm run build)
# Schreibt dist/og/<id6>.jpg und dist/og/index.json (Liste der erzeugten Bilder).
# Fotos werden in data/img_cache/og/ zwischengespeichert; fehlt eines (offline, Fehler), dient das allgemeine Bild als Hintergrund.
import json, os, hashlib, urllib.request, datetime, pathlib, io
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'; OUT = DIST / 'og'; CACHE = ROOT / 'data' / 'img_cache' / 'og'
OUT.mkdir(parents=True, exist_ok=True); CACHE.mkdir(parents=True, exist_ok=True)
W, H = 1200, 630

def font(bold, size):
    names = (['segoeuib.ttf', 'arialbd.ttf', 'DejaVuSans-Bold.ttf'] if bold else ['segoeui.ttf', 'arial.ttf', 'DejaVuSans.ttf'])
    dirs = ['C:/Windows/Fonts', '/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/truetype/liberation', '/Library/Fonts', '/System/Library/Fonts/Supplemental']
    for n in names:
        for d in dirs:
            p = os.path.join(d, n)
            if os.path.exists(p): return ImageFont.truetype(p, size)
    for d in ['/usr/share/fonts/truetype/liberation']:
        p = os.path.join(d, 'LiberationSans-Bold.ttf' if bold else 'LiberationSans-Regular.ttf')
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)

def photo(url):
    if not url: return None
    f = CACHE / (hashlib.sha1(url.encode()).hexdigest()[:16] + '.jpg')
    if not f.exists():
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'LaunchRadar-build/1.0'})
            data = urllib.request.urlopen(req, timeout=12).read()
            im = Image.open(io.BytesIO(data)).convert('RGB'); im.thumbnail((1600, 1600)); im.save(f, 'JPEG', quality=85)
        except Exception as e:
            print('  Foto fehlt:', url[:80], type(e).__name__); return None
    try: return Image.open(f).convert('RGB')
    except Exception: return None

def cover(im):
    s = max(W / im.width, H / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - W) // 2, max(0, (im.height - H) // 3)
    return im.crop((x, y, x + W, y + H))

def wrap(d, text, f, maxw, lines=2):
    out, cur = [], ''
    for w in text.split():
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) <= maxw or not cur: cur = t
        else: out.append(cur); cur = w
    out.append(cur)
    if len(out) > lines:
        out = out[:lines]; last = out[-1]
        while d.textlength(last + '…', font=f) > maxw and ' ' in last: last = last.rsplit(' ', 1)[0]
        out[-1] = last + '…'
    return out

GENERIC = Image.open(DIST / 'og-image.png').convert('RGB') if (DIST / 'og-image.png').exists() else Image.new('RGB', (W, H), '#0b0f17')
F_ROCK, F_T1, F_T2, F_INFO, F_BRAND, F_PILL = font(True, 30), font(True, 64), font(True, 52), font(False, 32), font(True, 30), font(True, 22)

def card(l):
    name = l['name']; short = (name.split('|')[1] if '|' in name else name).strip()
    rocket = ((l.get('rocket') or {}).get('configuration') or {}).get('name') or name.split('|')[0].strip()
    img = (l.get('image') or {}) if isinstance(l.get('image'), dict) else {}
    ph = photo(img.get('image_url') or img.get('thumbnail_url') or (l.get('image') if isinstance(l.get('image'), str) else None))
    bg = cover(ph) if ph else GENERIC.copy()
    if ph: bg = bg.filter(ImageFilter.GaussianBlur(1))
    # Verlauf von links (dunkel) nach rechts (Foto sichtbar)
    grad = Image.new('L', (W, 1))
    for x in range(W): grad.putpixel((x, 0), int(245 - max(0, x - 520) / (W - 520) * 175) if x > 520 else 245)
    bg = Image.composite(Image.new('RGB', (W, H), '#0b0f17'), bg, grad.resize((W, H)))
    d = ImageDraw.Draw(bg)
    x = 64; y = 70
    d.text((x, y), 'Launch', font=F_BRAND, fill='#e6ebf5'); d.text((x + d.textlength('Launch', font=F_BRAND), y), 'Radar', font=F_BRAND, fill='#4ea1ff')
    y = 170
    d.text((x, y), rocket.upper(), font=F_ROCK, fill='#4ea1ff'); y += 50
    fT = F_T1 if d.textlength(short, font=F_T1) <= 680 else F_T2
    for ln in wrap(d, short, fT, 680):
        d.text((x, y), ln, font=fT, fill='#ffffff'); y += fT.size + 12
    net = datetime.datetime.fromisoformat(l['net'].replace('Z', '+00:00'))
    y += 14
    d.text((x, y), net.strftime('%a %d %b %Y · %H:%M UTC'), font=F_INFO, fill='#c9d3e6'); y += 46
    pad = ((l.get('pad') or {}).get('location') or {}).get('name') or ''
    if pad: d.text((x, y), wrap(d, pad, F_INFO, 680, 1)[0], font=F_INFO, fill='#8a96ad')
    # Knopf unten
    lab = 'Track live  ›  launch-radar.com'; tw = d.textlength(lab, font=F_PILL)
    d.rounded_rectangle((x, H - 100, x + tw + 44, H - 52), radius=14, fill='#4ea1ff')
    d.text((x + 22, H - 90), lab, font=F_PILL, fill='#04101f')
    return bg

def load(f):
    try: return json.load(open(DIST / 'data' / f, encoding='utf-8'))['results']
    except Exception: return []
now = datetime.datetime.now(datetime.timezone.utc)
up, past = load('upcoming.json'), load('previous.json')
seen, made = set(), []
for l in up + past[:30]:
    if l['id'] in seen: continue
    seen.add(l['id']); i6 = l['id'][:6]
    try:
        card(l).save(OUT / (i6 + '.jpg'), 'JPEG', quality=84, optimize=True); made.append(i6)
    except Exception as e:
        print('  Vorschaubild fehlgeschlagen:', l.get('name'), e)
json.dump(made, open(OUT / 'index.json', 'w'))
print(f'Vorschaubilder: {len(made)}')
