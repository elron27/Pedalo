// Training als Abfolge von Blöcken. Quelle ist intervals.icu (workout_doc), von Hand oder aus der Bibliothek.

export interface Block {
  label: string;
  /** Dauer in Sekunden; null = offener Block (läuft, bis der Fahrer überspringt). */
  durationSec: number | null;
  /** Zielleistung in Watt, so wie im Training angegeben. */
  watts: number;
}

export interface Workout {
  name: string;
  blocks: Block[];
}

export class WorkoutParseError extends Error {}

/** Teil des intervals.icu-Dokuments (siehe docs/m0-ergebnisse.md). */
export interface IcuStep {
  text?: string;
  duration?: number;
  reps?: number;
  steps?: IcuStep[];
  power?: { units?: string; value?: number; start?: number; end?: number; target?: string };
  hr?: unknown;
  ramp?: boolean;
}
export interface IcuWorkoutDoc {
  steps?: IcuStep[];
}

function expand(steps: IcuStep[], icuFtp: number | undefined, out: Block[]): void {
  for (const s of steps) {
    if (s.reps !== undefined && s.steps) {
      if (!Number.isInteger(s.reps) || s.reps < 1) throw new WorkoutParseError(`Ungültige Wiederholungszahl: ${s.reps}`);
      for (let i = 0; i < s.reps; i++) expand(s.steps, icuFtp, out);
      continue;
    }
    const p = s.power;
    if (!p) throw new WorkoutParseError('Block ohne Leistungsangabe (z. B. Pulsziel) wird nicht unterstützt.');
    if (s.ramp || p.start !== undefined || p.end !== undefined) {
      throw new WorkoutParseError('Rampen werden noch nicht unterstützt.');
    }
    if (typeof p.value !== 'number' || !(p.value >= 0)) throw new WorkoutParseError('Block ohne gültigen Leistungswert.');
    let watts: number;
    if (p.units === 'w') watts = p.value;
    else if (p.units === '%ftp') {
      if (!icuFtp) throw new WorkoutParseError('Block in % FTP, aber der Termin nennt keinen FTP.');
      watts = Math.round((p.value / 100) * icuFtp);
    } else throw new WorkoutParseError(`Leistungseinheit nicht unterstützt: ${p.units ?? 'unbekannt'}`);
    const d = s.duration;
    out.push({ label: s.text ?? '', durationSec: typeof d === 'number' && d > 0 ? d : null, watts });
  }
}

/** Wandelt ein intervals.icu-Training in Blöcke um. Wirft WorkoutParseError, wenn etwas nicht darstellbar ist. */
export function workoutFromIntervalsDoc(name: string, doc: IcuWorkoutDoc, opts: { icuFtp?: number } = {}): Workout {
  const blocks: Block[] = [];
  expand(doc.steps ?? [], opts.icuFtp, blocks);
  if (blocks.length === 0) throw new WorkoutParseError('Training ohne Leistungsblöcke.');
  return { name, blocks };
}

/** Gesamtdauer in Sekunden; null, wenn ein offener Block enthalten ist. */
export function totalDurationSec(w: Workout): number | null {
  let sum = 0;
  for (const b of w.blocks) {
    if (b.durationSec === null) return null;
    sum += b.durationSec;
  }
  return sum;
}

/** Anzeigeprofil: Breite je Block (Sekunden; offener Block bekommt openBlockSec) und Höhe in Watt. */
export function workoutProfile(w: Workout, openBlockSec = 300): { startSec: number; sec: number; watts: number; open: boolean }[] {
  let t = 0;
  return w.blocks.map((b) => {
    const sec = b.durationSec ?? openBlockSec;
    const seg = { startSec: t, sec, watts: b.watts, open: b.durationSec === null };
    t += sec;
    return seg;
  });
}

/**
 * Handeingabe: je Zeile "Dauer Watt", z. B. "10:00 150" oder "5 200" (Minuten) oder "offen 120".
 * Leere Zeilen werden übersprungen. Fehler nennen die Zeilennummer.
 */
export function parseManualBlocks(name: string, text: string): Workout {
  const blocks: Block[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const m = /^(offen|\d+(?::[0-5]\d)?)\s+(\d{1,4})\s*w?$/i.exec(line);
    if (!m) throw new WorkoutParseError(`Zeile ${i + 1}: "${line}" ist nicht lesbar. Erwartet: "Dauer Watt", z. B. "10:00 150".`);
    const dur = m[1]!;
    let durationSec: number | null;
    if (dur.toLowerCase() === 'offen') durationSec = null;
    else if (dur.includes(':')) {
      const [mm, ss] = dur.split(':').map(Number) as [number, number];
      durationSec = mm * 60 + ss;
    } else durationSec = Number(dur) * 60;
    if (durationSec !== null && durationSec <= 0) throw new WorkoutParseError(`Zeile ${i + 1}: Dauer muss größer als 0 sein.`);
    blocks.push({ label: '', durationSec, watts: Number(m[2]) });
  });
  if (blocks.length === 0) throw new WorkoutParseError('Keine Blöcke eingegeben.');
  return { name, blocks };
}
