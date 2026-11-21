// Listet alle Akzeptanzkriterien mit der Referenz, die im Testnamen stehen muss:
//   [SR-xxxxxx/AK-yyyy] Beschreibung
// Optional: node tools/ak-refs.mjs SR-130c03   (nur ein Requirement)
import { reqseq } from './reqseq.mjs';

const filter = process.argv[2];
const r = reqseq(['element', 'list', '--where-type', 'system-requirement', '--json']);
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(1);
}
const { elements } = JSON.parse(r.stdout);
for (const e of elements) {
  if (filter && e.shortId !== filter) continue;
  console.log(`${e.shortId}  ${e.title}  [${e.properties?.['verification-method'] ?? 'Methode offen'}]`);
  for (const ak of e.properties?.['acceptance-criteria'] ?? []) {
    console.log(`  [${e.shortId}/AK-${ak.key}] ${ak.text}`);
  }
}
