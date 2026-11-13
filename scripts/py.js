// Startet Python 3 plattformunabhängig: python3 (macOS/Linux) oder python / py -3 (Windows).
// Aufruf: node scripts/py.js <argumente für python>
const { spawnSync } = require('child_process');

const candidates = [['python3'], ['python'], ['py', '-3']];
const env = { ...process.env, PYTHONUTF8: '1' };

const works = ([cmd, ...pre]) => {
  // Der Windows-Store-Platzhalter "python3" liefert keinen Exit-Code 0 – wird so übersprungen.
  const r = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8', env });
  return r.status === 0 && /Python 3/.test((r.stdout || '') + (r.stderr || ''));
};

const found = candidates.find(works);
if (!found) {
  console.error('Python 3 nicht gefunden. Bitte installieren (Windows: winget install Python.Python.3.12).');
  process.exit(1);
}
const [cmd, ...pre] = found;
const r = spawnSync(cmd, [...pre, ...process.argv.slice(2)], { stdio: 'inherit', env });
process.exit(r.status === null ? 1 : r.status);
