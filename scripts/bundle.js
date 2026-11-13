// Fügt src/js/*.js (in Namensreihenfolge) und src/css/*.css zusammen → build/app.js, build/app.css
// esbuild prüft dabei die Syntax und meldet Fehler mit Datei + Zeile.
// Die Dateien sind klassische Scripts mit gemeinsamem globalem Bereich (nötig für onclick="…" im HTML),
// deshalb wird nicht als ES-Modul gebündelt und Namen werden nicht gekürzt.
//   node scripts/bundle.js           einmal bauen
//   node scripts/bundle.js --watch   bei jeder Änderung in src/ neu bauen (inkl. build.py)
const fs = require('fs'), path = require('path');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'build');

function bundle() {
  const files = dir => fs.readdirSync(path.join(SRC, dir)).filter(f => f.endsWith('.' + dir)).sort();
  // Jede Datei einzeln prüfen → Fehlermeldung zeigt die richtige Datei und Zeile
  let js = '';
  for (const f of files('js')) {
    const code = fs.readFileSync(path.join(SRC, 'js', f), 'utf8');
    try {
      esbuild.transformSync(code, { loader: 'js', sourcefile: 'src/js/' + f, target: 'es2020', logLevel: 'silent' });
    } catch (e) {
      const m = e.errors && e.errors[0];
      throw new Error(m ? `${m.location.file}:${m.location.line}:${m.location.column}  ${m.text}` : e.message);
    }
    js += `\n// ---- ${f} ----\n` + code;
  }
  const css = files('css').map(f => fs.readFileSync(path.join(SRC, 'css', f), 'utf8')).join('\n');
  const outCss = esbuild.transformSync(css, { loader: 'css', minify: true }).code;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'app.js'), js.replace(/<\/script/gi, '<\\/script'));
  fs.writeFileSync(path.join(OUT, 'app.css'), outCss);
  return files('js').length;
}

if (process.argv.includes('--watch')) {
  const { spawnSync } = require('child_process');
  let timer = null;
  const run = () => {
    try {
      const n = bundle();
      const r = spawnSync(process.execPath, [path.join(__dirname, 'py.js'), path.join(__dirname, 'build.py')], { stdio: 'inherit' });
      console.log(r.status === 0 ? `[${new Date().toLocaleTimeString()}] gebaut (${n} JS-Dateien)` : 'build.py fehlgeschlagen');
    } catch (e) { console.error('Fehler: ' + e.message); }
  };
  run();
  fs.watch(SRC, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(run, 200); });
  console.log('Beobachte src/ … (Ctrl+C zum Beenden)');
} else {
  try { console.log('Gebündelt:', bundle(), 'JS-Dateien'); }
  catch (e) { console.error('Fehler: ' + e.message); process.exit(1); }
}
