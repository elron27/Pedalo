// Gemeinsamer Aufruf der ReqSeq-CLI. Pfad über REQSEQ überschreibbar.
import { spawnSync } from 'node:child_process';

const cli = process.env.REQSEQ ?? 'C:/Program Files/ReqSeq/bin/reqseq.cmd';

export function reqseq(args, options = {}) {
  const result = spawnSync(`"${cli}"`, args.map((a) => `"${a}"`), { encoding: 'utf8', shell: true, ...options });
  return result;
}
