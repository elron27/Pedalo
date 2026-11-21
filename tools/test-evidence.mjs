// Führt die Tests aus und schreibt das Ergebnis als Nachweis nach evidence/<Zeit>-<Item>.xml.
// Jeder Lauf bekommt eine eigene Datei; vorhandene werden nie überschrieben.
import { spawnSync, execSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { reqseq } from './reqseq.mjs';

const sh = (c) => execSync(c, { encoding: 'utf8' }).trim();
const commit = sh('git rev-parse --short HEAD');
const dirty = sh('git status --porcelain -- src tests package.json').length > 0;
const item = dirty ? `${commit}-dirty` : commit;

mkdirSync('.tmp', { recursive: true });
mkdirSync('evidence', { recursive: true });
const raw = '.tmp/junit.xml';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = `evidence/${stamp}-${item}.xml`;
if (existsSync(out)) {
  console.error(`Nachweis ${out} existiert schon, es wird nichts überschrieben.`);
  process.exit(1);
}

const t = spawnSync('npx', ['vitest', 'run', '--reporter=default', '--reporter=junit', `--outputFile.junit=${raw}`], { stdio: 'inherit', shell: true });
if (!existsSync(raw)) process.exit(t.status ?? 1);

const e = reqseq(['evidence', 'enrich-junit', raw, item, '--output', out]);
process.stdout.write(e.stdout ?? '');
process.stderr.write(e.stderr ?? '');
console.log(`Nachweis: ${out} (Item ${item})`);
process.exit(t.status || e.status || 0);
