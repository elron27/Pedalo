// Führt Unit- und Browsertests aus und schreibt je Lauf einen Nachweis nach evidence/.
// Jeder Lauf bekommt eine eigene Datei; vorhandene werden nie überschrieben.
import { spawnSync, execSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { reqseq } from './reqseq.mjs';

const sh = (c) => execSync(c, { encoding: 'utf8' }).trim();
const commit = sh('git rev-parse --short HEAD');
const dirty = sh('git status --porcelain -- src tests e2e package.json').length > 0;
const item = dirty ? `${commit}-dirty` : commit;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

mkdirSync('.tmp', { recursive: true });
mkdirSync('evidence', { recursive: true });

let exit = 0;

function enrich(raw, kind) {
  const out = `evidence/${stamp}-${kind}-${item}.xml`;
  if (existsSync(out)) {
    console.error(`Nachweis ${out} existiert schon, es wird nichts überschrieben.`);
    process.exit(1);
  }
  const e = reqseq(['evidence', 'enrich-junit', raw, item, '--output', out]);
  process.stdout.write(e.stdout ?? '');
  process.stderr.write(e.stderr ?? '');
  console.log(`Nachweis: ${out} (Item ${item})`);
  if (e.status) exit = e.status;
}

// 1. Unit-Tests
const rawUnit = '.tmp/junit-unit.xml';
const unit = spawnSync('npx', ['vitest', 'run', '--reporter=default', '--reporter=junit', `--outputFile.junit=${rawUnit}`], { stdio: 'inherit', shell: true });
if (existsSync(rawUnit)) enrich(rawUnit, 'unit');
if (unit.status) exit = unit.status;

// 2. Browsertests (Chrome mit simuliertem Bike und Pulsgurt)
const rawE2e = '.tmp/junit-e2e.xml';
const e2e = spawnSync('npx', ['playwright', 'test'], { stdio: 'inherit', shell: true, env: { ...process.env, PW_JUNIT: rawE2e } });
if (existsSync(rawE2e)) enrich(rawE2e, 'e2e');
if (e2e.status) exit = e2e.status;

process.exit(exit);
