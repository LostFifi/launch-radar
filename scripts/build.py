import json, os, io, base64, hashlib, subprocess, collections
from PIL import Image
import pathlib, datetime
# Textdateien immer als UTF-8 lesen/schreiben (Windows nimmt sonst cp1252)
# und beim Schreiben LF behalten, damit dist/index.html überall gleich ist.
_open=open
def open(f,mode='r',**k):
    if 'b' not in mode:
        k.setdefault('encoding','utf-8')
        if 'w' in mode: k.setdefault('newline','')
    return _open(f,mode,**k)
ROOT=pathlib.Path(__file__).resolve().parent.parent
b=str(ROOT)+'/'
h=open(b+'src/index.html').read()  # App-Code kommt aus build/ (scripts/bundle.js)
# Datum des Schnappschusses: aus data/raw/fetched_at.txt (fetch_data.sh), sonst Änderungsdatum von upcoming.json
_fa=b+'data/raw/fetched_at.txt'
if os.path.exists(_fa):
    SNAP_DATE=datetime.datetime.strptime(open(_fa).read().strip(),'%Y-%m-%dT%H:%M:%SZ').strftime('%d.%m.%Y')
else:
    SNAP_DATE=datetime.datetime.fromtimestamp(os.path.getmtime(b+'data/raw/upcoming.json')).strftime('%d.%m.%Y')
def pick(o,keys): return {k:o.get(k) for k in keys} if isinstance(o,dict) else None
J=lambda o: json.dumps(o,separators=(',',':'),ensure_ascii=False).replace('</','<\\/')

LAUNCHER_KEYS=['image','serial_number','flights','successful_landings','attempted_landings','first_launch_date','last_launch_date','details','flight_proven','fastest_turnaround','status']
def trim_sc(x):
    sc=x.get('spacecraft') or {}; cf=sc.get('spacecraft_config') or {}; ld=x.get('landing') or {}; loc=ld.get('landing_location') or {}
    return {'destination':x.get('destination'),'duration':x.get('duration'),'turn_around_time':x.get('turn_around_time'),
      'crew':len(x.get('launch_crew') or []),
      'landing':{'attempt':ld.get('attempt'),'success':ld.get('success'),'description':ld.get('description'),'type':pick(ld.get('type'),['name','abbrev']),
                 'landing_location':pick(loc,['name','abbrev'])} if ld else None,
      'spacecraft':{'name':sc.get('name'),'serial_number':sc.get('serial_number'),'flights_count':sc.get('flights_count'),'time_in_space':sc.get('time_in_space'),
        'in_space':sc.get('in_space'),'status':(sc.get('status') or {}).get('name'),'description':sc.get('description'),'fastest_turnaround':sc.get('fastest_turnaround'),
        'image':pick(sc.get('image'),['image_url','thumbnail_url','credit']),
        'spacecraft_config':{'name':cf.get('name'),'type':(cf.get('type') or {}).get('name'),'height':cf.get('height'),'diameter':cf.get('diameter'),
          'crew_capacity':cf.get('crew_capacity'),'payload_capacity':cf.get('payload_capacity'),'payload_return_capacity':cf.get('payload_return_capacity'),
          'human_rated':cf.get('human_rated'),'total_launch_count':cf.get('total_launch_count'),'attempted_landings':cf.get('attempted_landings'),
          'successful_landings':cf.get('successful_landings'),'maiden_flight':cf.get('maiden_flight')}}}
def trim(l):
    r=l.get('rocket') or {}; st=[]
    for s in r.get('launcher_stage') or []:
        ld=s.get('landing') or {}; loc=ld.get('landing_location') or {}
        la=pick(s.get('launcher'),LAUNCHER_KEYS)
        if la and isinstance(la.get('status'),dict): la['status']=la['status'].get('name')
        if la: la['image']=pick((s.get('launcher') or {}).get('image'),['image_url','thumbnail_url','credit'])
        st.append({'launcher':la,'launcher_flight_number':s.get('launcher_flight_number'),'reused':s.get('reused'),
          'landing':{'attempt':ld.get('attempt'),'success':ld.get('success'),'description':ld.get('description'),'downrange_distance':ld.get('downrange_distance'),
             'type':pick(ld.get('type'),['name','abbrev']),'landing_location':pick(loc,['name','abbrev','latitude','longitude'])}})
    m=l.get('mission') or {}
    return {'id':l['id'],'name':l['name'],'net':l['net'],'status':pick(l.get('status'),['name','abbrev']),'webcast_live':False,
      'probability':l.get('probability'),'flightclub_url':l.get('flightclub_url'),'launch_designator':l.get('launch_designator'),
      'launch_service_provider':pick(l.get('launch_service_provider'),['name']),
      'rocket':{'configuration':pick(r.get('configuration'),['name','full_name']),'launcher_stage':st,'spacecraft_stage':[trim_sc(x) for x in (r.get('spacecraft_stage') or [])]},
      'mission':{'name':m.get('name'),'type':m.get('type'),'description':m.get('description'),'orbit':pick(m.get('orbit'),['name','abbrev'])},
      'pad':{'id':l['pad']['id'],'name':l['pad']['name'],'latitude':l['pad']['latitude'],'longitude':l['pad']['longitude'],'location':pick(l['pad'].get('location'),['name'])},
      'vid_urls':[pick(v,['url','publisher','source','priority']) for v in l.get('vid_urls') or []],
      'failreason':l.get('failreason'),'image':pick(l.get('image'),['image_url','thumbnail_url','credit']),
      'mission_patches':[pick(x,['image_url','name']) for x in (l.get('mission_patches') or [])[:1]],
      'updates':[pick(u,['comment','created_on']) for u in (l.get('updates') or [])[:6]],
      'timeline':[{'relative_time':t.get('relative_time'),'type':pick(t.get('type'),['abbrev','description'])} for t in l.get('timeline') or []]}

up=[trim(l) for l in json.load(open(b+'data/raw/upcoming.json'))['results']]
past=[trim(l) for l in json.load(open(b+'data/raw/previous.json'))['results']]

# ---- Vorschaubilder einbetten (Cache) ----
snapf=b+'data/img_snap.json'; snapimg=json.load(open(snapf)) if os.path.exists(snapf) else {}
for u in [(l.get('image') or {}).get('thumbnail_url') for l in up+past]+[((s.get('spacecraft') or {}).get('image') or {}).get('thumbnail_url') for l in up+past for s in l['rocket']['spacecraft_stage']]+[((s.get('launcher') or {}).get('image') or {}).get('thumbnail_url') for l in up+past for s in l['rocket']['launcher_stage']]:
    if not u or u in snapimg: continue
    os.makedirs(b+'data/img_cache',exist_ok=True); f=b+'data/img_cache/'+hashlib.md5(u.encode()).hexdigest()
    r=subprocess.run(['curl','-s','-m','30','-o',f,'-w','%{http_code}',u],capture_output=True,text=True)
    if r.stdout!='200': continue
    try:
        im=Image.open(f).convert('RGB'); im.thumbnail((520,520)); bb=io.BytesIO(); im.save(bb,'JPEG',quality=66)
        snapimg[u]='data:image/jpeg;base64,'+base64.b64encode(bb.getvalue()).decode()
    except Exception as e: print('img err',e)
json.dump(snapimg,open(snapf,'w'))

# ---- Raketen-Datenbank ----
rk=[]
for f in sorted(x for x in os.listdir(b+'data/raw') if x.startswith('cfg')):
    for c in json.load(open(b+'data/raw/'+f))['results']:
        if c.get('is_placeholder'): continue
        man=c.get('manufacturer') or {}
        cty=(man.get('country') or [{}]) if isinstance(man.get('country'),list) else [man.get('country') or {}]
        desc=(c.get('description') or '').strip()
        rk.append({'id':c['id'],'n':c['name'],'v':c.get('variant') or '','fam':', '.join(x.get('name','') for x in (c.get('families') or [])),
          'man':man.get('name') or '','mab':man.get('abbrev') or '','cty':(cty[0] or {}).get('alpha_2_code') or '',
          'act':bool(c.get('active')),'reu':bool(c.get('reusable')),
          'leo':c.get('leo_capacity'),'gto':c.get('gto_capacity'),'sso':c.get('sso_capacity'),'thr':c.get('to_thrust'),
          'len':c.get('length'),'dia':c.get('diameter'),'mass':c.get('launch_mass'),'cost':c.get('launch_cost'),
          'tot':c.get('total_launch_count') or 0,'suc':c.get('successful_launches') or 0,'fail':c.get('failed_launches') or 0,
          'pend':c.get('pending_launches') or 0,'al':c.get('attempted_landings') or 0,'sl':c.get('successful_landings') or 0,
          'csl':c.get('consecutive_successful_landings'),'first':c.get('maiden_flight'),
          'img':((c.get('image') or {}).get('thumbnail_url') if isinstance(c.get('image'),dict) else None),
          'wiki':c.get('wiki_url'),'d':desc[:420]+('…' if len(desc)>420 else '')})
print('Raketen',len(rk))

# ---- Statistik 2026 ----
ys=[x for f in sorted(os.listdir(b+'data/raw')) if f.startswith('y_') for x in json.load(open(b+'data/raw/'+f))['results']]
CN={'United States of America':'USA',"People's Republic of China":'China','Russian Federation':'Russland','New Zealand':'Neuseeland',
    'India':'Indien','Japan':'Japan','France':'Frankreich','Kazakhstan':'Kasachstan','Iran, Islamic Republic of':'Iran',
    'Korea, Republic of':'Südkorea',"Korea, Democratic People's Republic of":'Nordkorea','Israel':'Israel','Australia':'Australien','Norway':'Norwegen','Sweden':'Schweden','United Kingdom of Great Britain and Northern Ireland':'Grossbritannien','French Guiana':'Frankreich (Kourou)'}
def top(cnt,n):
    it=cnt.most_common(); head=it[:n]; rest=sum(v for _,v in it[n:])
    return head+([('Andere',rest)] if rest else [])
prov=collections.Counter(x['launch_service_provider']['name'] for x in ys)
cty=collections.Counter(CN.get((x['pad'].get('country') or {}).get('name'),(x['pad'].get('country') or {}).get('name') or '?') for x in ys)
rock=collections.Counter(x['rocket']['configuration']['full_name'] or x['rocket']['configuration']['name'] for x in ys)
stat=collections.Counter(x['status']['abbrev'] for x in ys)
month=collections.Counter(int(x['net'][5:7]) for x in ys)
STATS={'year':2026,'asof':SNAP_DATE,'cut':max(x['net'] for x in ys),'provAll':dict(prov),'ctyAll':dict(cty),'rockAll':dict(rock),'total':len(ys),'status':dict(stat),
       'prov':top(prov,8),'cty':top(cty,7),'rock':top(rock,10),'month':[month.get(i,0) for i in range(1,13)]}
print('Stats',STATS['total'],STATS['status'])

tle=J({g:open(b+'data/tle/'+g+'.txt').read() for g in ['stations','starlink','gnss']})
rd=lambda p: open(b+'node_modules/'+p).read().replace('</script','<\\/script')
for k,f in [('/*APP_CSS*/','build/app.css'),('/*APP_JS*/','build/app.js')]:
    if not os.path.exists(b+f): raise SystemExit(f+' fehlt – zuerst "npm run build" (bündelt src/js) ausführen')
    h=h.replace(k,open(b+f).read())
rep={'/*LEAFLET_CSS*/':open(b+'node_modules/leaflet/dist/leaflet.css').read(),
     '/*LEAFLET_JS*/':rd('leaflet/dist/leaflet.js'),
     '/*D3_JS*/':rd('d3-array/dist/d3-array.min.js')+"\n"+rd('d3-geo/dist/d3-geo.min.js'),
     '/*SAT_JS*/':rd('satellite.js/dist/satellite.min.js'),
     '/*WORLD*/':open(b+'data/world.json').read(),'/*SNAP*/':J(up),'/*PAST*/':J(past),'/*ROCKETS*/':J(rk),'/*STATS*/':J(STATS),
     '/*TLE*/':tle,'/*IMG*/':J(snapimg),'/*SNAPTS*/':SNAP_DATE}
h=h.replace('/*RCUT*/',json.dumps(STATS['cut']))
# Zwei Varianten:
#  dist/index.html               online (GitHub Pages): Reserve-Bahndaten + Vorschaubilder als eigene Dateien data/*.json → ~2,4 MB weniger
#  dist/launchradar-offline.html alles eingebettet (Claude-Vorschau, als Datei öffnen, ohne Server)
os.makedirs(b+'dist/data',exist_ok=True)
full=h; online=h
for k,v in rep.items():
    full=full.replace(k,v)
    online=online.replace(k,'null' if k in ('/*TLE*/','/*IMG*/') else v)
open(b+'dist/data/tle.json','w').write(tle); open(b+'dist/data/img.json','w').write(J(snapimg))
open(b+'dist/launchradar-offline.html','w').write(full)
h=online; open(b+'dist/index.html','w').write(h); print(len(h)//1024,'KB online,',len(full)//1024,'KB offline-Datei')

# ---- PWA: Manifest, Icons, Service Worker (Version = Hash der App → Browser lädt neue Version) ----
import shutil
os.makedirs(b+'dist/icons',exist_ok=True)
shutil.copyfile(b+'src/pwa/manifest.webmanifest',b+'dist/manifest.webmanifest')
for f in os.listdir(b+'src/pwa/icons'): shutil.copyfile(b+'src/pwa/icons/'+f,b+'dist/icons/'+f)
sw=open(b+'src/pwa/sw.js').read(); ver=hashlib.md5((h+sw).encode()).hexdigest()[:10]
open(b+'dist/sw.js','w').write(sw.replace('/*SW_VERSION*/',ver))
print('PWA', ver)
