import { useEffect, useState } from 'preact/hooks';
import type { AppState, Controller } from '../app/controller';
import { buildChart } from '../domain/chart';
import type { RecordSample } from '../domain/recorder';
import { remainingTotalSec, totalDurationSec, workoutProfile, type Workout } from '../domain/workout';
import { zoneOf } from '../domain/zones';
import { fmtTime, T } from './texts';

function useAppState(c: Controller): AppState {
  const [s, setS] = useState(c.state());
  useEffect(() => {
    // Zustand nachholen: Änderungen zwischen dem ersten Zeichnen und dem Anmelden dürfen nicht verloren gehen.
    setS(c.state());
    return c.subscribe(() => setS(c.state()));
  }, [c]);
  return s;
}

const statusText = (s: string) => (s === 'verbunden' ? T.verbunden : s === 'verbindet' ? T.verbindet : T.getrennt);

export function App({ c }: { c: Controller }) {
  const s = useAppState(c);
  return (
    <main class={s.screen === 'fahrt' ? 'fahrt-seite' : undefined}>
      {s.error && (
        <div class="meldung fehler" role="alert">
          {s.error} <button onClick={() => c.clearMessages()}>{T.schliessen}</button>
        </div>
      )}
      {s.notice && (
        <div class="meldung hinweis" role="status">
          {s.notice} <button onClick={() => c.clearMessages()}>{T.schliessen}</button>
        </div>
      )}
      {s.busy && <div class="meldung hinweis">{s.busy}</div>}
      {!s.ready ? <p>{T.laedt}</p> : s.screen === 'fahrt' ? <Ride c={c} s={s} /> : s.screen === 'ende' ? <End c={c} s={s} /> : <Start c={c} s={s} />}
    </main>
  );
}

// ---------------- Start ----------------

function Start({ c, s }: { c: Controller; s: AppState }) {
  return (
    <>
      <h1>{T.appName}</h1>
      <p>
        <a href="./anleitung.html" target="_blank" rel="noopener">
          {T.anleitung}
        </a>
      </p>
      {s.unfinished.length > 0 && (
        <section class="karte warnung">
          <h2>{T.nichtBeendet}</h2>
          <p>{T.nichtBeendetInfo}</p>
          {s.unfinished.map((m) => (
            <div class="zeile" key={m.sessionId}>
              <span>
                {new Date(m.startedAt).toLocaleString('de-DE')} · {m.workoutName}
              </span>
              <button onClick={() => c.openSession(m.sessionId)}>{T.wiederherstellen}</button>
              <button class="sekundaer" onClick={() => c.deleteSession(m.sessionId)}>
                {T.verwerfen}
              </button>
            </div>
          ))}
        </section>
      )}
      <RiderSection c={c} s={s} />
      <DeviceSection c={c} s={s} />
      <TrainingSection c={c} s={s} />
      {s.recent.length > 0 && (
        <section class="karte">
          <h2>{T.letzteFahrten}</h2>
          {s.recent.map((m) => (
            <div class="zeile" key={m.sessionId}>
              <span>
                {new Date(m.startedAt).toLocaleString('de-DE')} · {m.workoutName}
              </span>
              <button onClick={() => c.openSession(m.sessionId)}>{T.oeffnen}</button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function RiderSection({ c, s }: { c: Controller; s: AppState }) {
  const [editing, setEditing] = useState<'neu' | 'bearbeiten' | null>(null);
  const [form, setForm] = useState({ name: '', ftp: '', athleteId: '', apiKey: '' });
  const edit = (mode: 'neu' | 'bearbeiten') => {
    const p = mode === 'bearbeiten' ? s.active : null;
    setForm({ name: p?.name ?? '', ftp: p ? String(p.ftp) : '', athleteId: p?.icu?.athleteId ?? '', apiKey: p?.icu?.apiKey ?? '' });
    setEditing(mode);
  };
  return (
    <section class="karte">
      <h2>{T.fahrer}</h2>
      <label>
        {T.fahrer}
        <select
          value={s.active?.id ?? ''}
          onChange={(e) => c.selectProfile((e.currentTarget as HTMLSelectElement).value || null)}
        >
          <option value="">{T.gast}</option>
          {s.profiles.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name} ({p.ftp} W)
            </option>
          ))}
        </select>
      </label>
      {!s.active && (
        <label>
          {T.ftpGast}
          <input
            type="number"
            inputMode="numeric"
            value={s.guestFtp ?? ''}
            onInput={(e) => c.setGuestFtp(Number((e.currentTarget as HTMLInputElement).value) || undefined)}
          />
        </label>
      )}
      <div class="zeile">
        <button class="sekundaer" onClick={() => edit('neu')}>
          {T.neuesProfil}
        </button>
        {s.active && (
          <>
            <button class="sekundaer" onClick={() => edit('bearbeiten')}>
              {T.profilBearbeiten}
            </button>
            <button class="sekundaer" onClick={() => c.removeProfile(s.active!.id)}>
              {T.profilLoeschen}
            </button>
          </>
        )}
      </div>
      {editing && (
        <form
          class="formular"
          onSubmit={(e) => {
            e.preventDefault();
            void c
              .saveProfile({ id: editing === 'bearbeiten' ? s.active?.id : undefined, name: form.name, ftp: Number(form.ftp), athleteId: form.athleteId, apiKey: form.apiKey })
              .then(() => setEditing(null));
          }}
        >
          <label>
            {T.name}
            <input required value={form.name} onInput={(e) => setForm({ ...form, name: (e.currentTarget as HTMLInputElement).value })} />
          </label>
          <label>
            {T.ftpWatt}
            <input required type="number" inputMode="numeric" value={form.ftp} onInput={(e) => setForm({ ...form, ftp: (e.currentTarget as HTMLInputElement).value })} />
          </label>
          <label>
            {T.athletId}
            <input value={form.athleteId} onInput={(e) => setForm({ ...form, athleteId: (e.currentTarget as HTMLInputElement).value })} />
          </label>
          <label>
            {T.apiSchluessel}
            <input type="password" value={form.apiKey} onInput={(e) => setForm({ ...form, apiKey: (e.currentTarget as HTMLInputElement).value })} />
          </label>
          <div class="zeile">
            <button type="submit">{T.speichern}</button>
            <button type="button" class="sekundaer" onClick={() => setEditing(null)}>
              {T.abbrechen}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function DeviceSection({ c, s }: { c: Controller; s: AppState }) {
  return (
    <section class="karte">
      <h2>{T.geraete}</h2>
      <div class="zeile">
        <span>
          {T.bike}: <strong data-status={s.trainer}>{statusText(s.trainer)}</strong>
          {s.trainerName ? ` (${s.trainerName})` : ''}
        </span>
        <button onClick={() => c.pairBike()}>{T.bikeKoppeln}</button>
      </div>
      <div class="zeile">
        <span>
          {T.pulsgurt}: <strong data-status={s.hr}>{statusText(s.hr)}</strong>
        </span>
        <button onClick={() => c.pairStrap()}>{T.gurtKoppeln}</button>
      </div>
      {s.active && s.active.hrStraps.length > 0 && (
        <label>
          {T.gespeicherteGurte}
          <select value={s.active.selectedStrapId ?? ''} onChange={(e) => c.useStrap((e.currentTarget as HTMLSelectElement).value)}>
            {s.active.hrStraps.map((g) => (
              <option value={g.id} key={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}

type Tab = 'frei' | 'icu' | 'bib' | 'hand' | 'ftp';

function TrainingSection({ c, s }: { c: Controller; s: AppState }) {
  const [tab, setTab] = useState<Tab>('frei');
  const tabs: [Tab, string][] = [
    ['frei', T.freiesTraining],
    ['icu', T.intervalsIcu],
    ['bib', T.bibliothek],
    ['hand', T.vonHand],
    ['ftp', T.ftpTests],
  ];
  return (
    <section class="karte">
      <h2>{T.training}</h2>
      <div class="tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} class={tab === k ? 'aktiv' : 'sekundaer'} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'frei' && (
        <div>
          <p>{T.freiBeschreibung}</p>
          <button onClick={() => c.startRide('frei', null)}>{T.startenFrei}</button>
        </div>
      )}
      {tab === 'icu' && <IcuTab c={c} s={s} />}
      {tab === 'bib' && <LibraryTab c={c} s={s} />}
      {tab === 'hand' && <ManualTab c={c} />}
      {tab === 'ftp' && <FtpTab c={c} />}
    </section>
  );
}

function WorkoutSummary({ w }: { w: Workout }) {
  const total = w.blocks.every((b) => b.durationSec !== null) ? w.blocks.reduce((a, b) => a + (b.durationSec ?? 0), 0) : null;
  return (
    <span>
      {w.name} · {w.blocks.length} {T.block} · {total === null ? T.offen : fmtTime(total)}
    </span>
  );
}

function IcuTab({ c, s }: { c: Controller; s: AppState }) {
  if (!s.active) return <p>{T.gastKeinKonto}</p>;
  if (!s.active.icu) return <p>{T.keinKonto}</p>;
  return (
    <div>
      <button onClick={() => c.loadIcu()} disabled={s.icu.loading}>
        {s.icu.loading ? T.laedt : T.trainingenLaden}
      </button>
      {s.icu.error && <p class="fehlertext">{s.icu.error}</p>}
      {s.icu.workouts.map((w) => (
        <div class="zeile" key={w.eventId}>
          <span>
            {w.date} · <WorkoutSummary w={w.workout} />
          </span>
          <button onClick={() => c.startRide('training', w.workout)}>{T.starten}</button>
          <button class="sekundaer" onClick={() => c.addToLibrary(w.workout)}>
            {T.inBibliothek}
          </button>
        </div>
      ))}
      {s.icu.skipped.map((k) => (
        <p class="fehlertext" key={k.date + k.name}>
          {T.nichtDarstellbar}: {k.date} {k.name} – {k.reason}
        </p>
      ))}
    </div>
  );
}

function LibraryTab({ c, s }: { c: Controller; s: AppState }) {
  if (s.library.length === 0) return <p>{T.bibliothekLeer}</p>;
  return (
    <div>
      {s.library.map((e) => (
        <div class="zeile" key={e.id}>
          <WorkoutSummary w={e.workout} />
          <button onClick={() => c.startRide('training', e.workout)}>{T.starten}</button>
          <button class="sekundaer" aria-pressed={e.favorite} onClick={() => c.setFavorite(e.id, !e.favorite)}>
            {e.favorite ? '★' : '☆'} {T.favorit}
          </button>
          <button class="sekundaer" onClick={() => c.removeFromLibrary(e.id)}>
            {T.entfernen}
          </button>
        </div>
      ))}
    </div>
  );
}

function ManualTab({ c }: { c: Controller }) {
  const [name, setName] = useState('');
  const [text, setText] = useState('10:00 120\n5:00 200\n5:00 120');
  return (
    <div class="formular">
      <p>{T.handEingabe}</p>
      <label>
        {T.trainingsname}
        <input value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <textarea rows={6} value={text} onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)} aria-label={T.vonHand} />
      <div class="zeile">
        <button
          onClick={() => {
            const w = c.parseManual(name, text);
            if (w) void c.startRide('training', w);
          }}
        >
          {T.handStarten}
        </button>
        <button
          class="sekundaer"
          onClick={() => {
            const w = c.parseManual(name, text);
            if (w) void c.addToLibrary(w);
          }}
        >
          {T.inBibliothek}
        </button>
      </div>
    </div>
  );
}

function FtpTab({ c }: { c: Controller }) {
  const tests: [Parameters<Controller['startRide']>[0], string, string][] = [
    ['rampe', T.rampentest, T.rampeInfo],
    ['zwanzig', T.zwanzigMinTest, T.zwanzigInfo],
    ['vierdp', T.vierDpTest, T.vierDpInfo],
  ];
  return (
    <div>
      {tests.map(([kind, title, info]) => (
        <div class="zeile" key={kind}>
          <span>
            <strong>{title}</strong>
            <br />
            {info}
          </span>
          <button onClick={() => c.startRide(kind, null)} aria-label={`${title} ${T.testStarten}`}>
            {T.testStarten}
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------- Fahrt ----------------

function Ride({ c, s }: { c: Controller; s: AppState }) {
  const p = s.player;
  const paused = p?.status === 'pause';
  const free = p?.status === 'frei';
  const hasWorkout = Boolean(s.workout);
  const w = s.workout;
  const zone = zoneOf(s.live.heartRate, s.hrZones);
  const remaining = w && p ? remainingTotalSec(w, p.blockIndex, p.blockRemainingSec) : null;
  return (
    <div class="fahrt">
      <div class="kopf">
        <span>{w?.name ?? T.freiesTraining}</span>
        <span class="status">
          {T.bike}: <strong data-status={s.trainer}>{statusText(s.trainer)}</strong> · {T.pulsgurt}: <strong data-status={s.hr}>{statusText(s.hr)}</strong>
        </span>
        <button class="sekundaer" onClick={() => void document.documentElement.requestFullscreen?.()}>
          {T.vollbild}
        </button>
      </div>
      {paused && <div class="banner">{T.imPause}</div>}
      {free && hasWorkout && <div class="banner">{T.imFreienTraining}</div>}
      <div class="werte">
        <Tile label={T.watt} value={s.live.power} sub={p?.targetWatts != null ? `${T.ziel} ${p.targetWatts}` : undefined} id="watt" />
        <Tile label={T.puls} value={s.live.heartRate} id="puls" sub={zone ? `${T.zone} ${zone}` : undefined} cls={zone ? `z${Math.min(zone, 7)}` : undefined} />
        <Tile label={T.trittfrequenz} value={s.live.cadence !== undefined ? Math.round(s.live.cadence) : undefined} id="trittfrequenz" />
        <Tile label={T.blockRestzeit} text={hasWorkout && !free ? (p?.blockRemainingSec === null ? T.offen : fmtTime(p?.blockRemainingSec)) : '–'} id="restzeit" zeit />
        <Tile label={T.restzeitGesamt} text={hasWorkout && !free ? (remaining === null ? T.offen : fmtTime(remaining)) : '–'} id="restzeit-gesamt" zeit />
        <Tile label={T.gesamtzeit} text={fmtTime(p?.totalElapsedSec ?? 0)} id="gesamtzeit" zeit />
      </div>
      <Verlauf records={c.records()} plannedSec={w ? (totalDurationSec(w) ?? undefined) : undefined} />
      {w && p && (
        <div class="vorschau">
          <Profile w={w} elapsedSec={p.totalElapsedSec} blockIndex={p.blockIndex} />
          <p>
            {T.naechsterBlock}: {p.next ? `${p.next.label || T.block} · ${p.next.durationSec === null ? T.offen : fmtTime(p.next.durationSec)} · ${Math.round((p.next.watts * p.intensityPct) / 100)} W` : T.keinNaechster}
          </p>
        </div>
      )}
      <div class="steuerung">
        {paused ? <button onClick={() => c.resume()}>{T.weiter}</button> : <button onClick={() => c.pause()}>{T.pause}</button>}
        {hasWorkout && !free && <button onClick={() => c.skip()}>{T.ueberspringen}</button>}
        {hasWorkout && (
          <span class="intensitaet">
            <button class="sekundaer" onClick={() => c.setIntensity((p?.intensityPct ?? 100) - 5)} aria-label={T.weniger}>
              −
            </button>
            <span>
              {T.intensitaet} {p?.intensityPct ?? 100} %
            </span>
            <button class="sekundaer" onClick={() => c.setIntensity((p?.intensityPct ?? 100) + 5)} aria-label={T.mehr}>
              +
            </button>
          </span>
        )}
        {hasWorkout && (free ? <button class="sekundaer" onClick={() => c.toWorkout()}>{T.zurueckZumTraining}</button> : <button class="sekundaer" onClick={() => c.toFree()}>{T.freiZuschalten}</button>)}
        <button class="gefahr" onClick={() => c.finishRide()}>
          {T.beenden}
        </button>
      </div>
    </div>
  );
}

function Tile({ label, value, text, sub, id, zeit, cls }: { label: string; value?: number | undefined; text?: string; sub?: string; id: string; zeit?: boolean; cls?: string }) {
  return (
    <div class={`${zeit ? 'kachel zeit' : 'kachel'}${cls ? ' ' + cls : ''}`} id={id}>
      <div class="beschriftung">{label}</div>
      <div class="zahl">{text ?? (value === undefined ? '–' : String(value))}</div>
      {sub && <div class="unter">{sub}</div>}
    </div>
  );
}

function Profile({ w, elapsedSec, blockIndex }: { w: Workout; elapsedSec: number; blockIndex: number }) {
  const prof = workoutProfile(w);
  const total = prof.reduce((a, b) => a + b.sec, 0);
  const max = Math.max(...prof.map((b) => b.watts), 1);
  return (
    <svg viewBox="0 0 1000 120" class="profil" role="img" aria-label="Profil">
      {prof.map((b, i) => {
        const x = (b.startSec / total) * 1000;
        const width = Math.max(1, (b.sec / total) * 1000 - 1);
        const h = (b.watts / max) * 110;
        return <rect key={i} x={x} y={118 - h} width={width} height={h} class={i === blockIndex ? 'aktuell' : i < blockIndex ? 'vorbei' : ''} />;
      })}
      <line x1={Math.min(1000, (Math.min(elapsedSec, total) / total) * 1000)} x2={Math.min(1000, (Math.min(elapsedSec, total) / total) * 1000)} y1="0" y2="120" class="marke" />
    </svg>
  );
}

// ---------------- Ende ----------------

function End({ c, s }: { c: Controller; s: AppState }) {
  const r = s.result;
  if (!r) return null;
  const rider = c.rider();
  const dur = r.recording.records.length;
  return (
    <div>
      <h1>{T.fahrtBeendet}</h1>
      <section class="karte">
        <p>
          {r.recording.meta.workoutName} · {new Date(r.recording.meta.startedAt).toLocaleString('de-DE')}
        </p>
        <p>
          {T.dauer}: {fmtTime(dur)} · {T.durchschnittWatt}: {r.avgPower ?? '–'} · {T.durchschnittPuls}: {r.avgHeartRate ?? '–'}
        </p>
        <Verlauf records={r.recording.records} />
        {r.fourDp && (
          <p>
            {T.bestwerte}: 5 s {r.fourDp.best5s ?? '–'} W · 1 min {r.fourDp.best1min ?? '–'} W · 5 min {r.fourDp.best5min ?? '–'} W · 20 min {r.fourDp.best20min ?? '–'} W
          </p>
        )}
        {r.ftpSuggestion !== undefined && (
          <div class="zeile">
            <strong>
              {T.ftpVorschlag}: {r.ftpSuggestion} W
            </strong>
            <button onClick={() => c.applyFtp(r.ftpSuggestion!)}>{T.ftpUebernehmen}</button>
          </div>
        )}
        <div class="zeile">
          <button onClick={() => c.saveFit()}>{T.fitSpeichern}</button>
          {rider.canUpload && <button onClick={() => c.uploadFit()}>{T.hochladen}</button>}
          <button class="sekundaer" onClick={() => c.deleteSession(r.recording.meta.sessionId)}>
            {T.verwerfen}
          </button>
        </div>
        {r.saved && <p>{T.fitGespeichert}</p>}
        {r.uploaded && <p>{T.hochgeladen(r.uploaded)}</p>}
      </section>
      <button onClick={() => c.backToStart()}>{T.zurueck}</button>
    </div>
  );
}

// ---------------- Verlauf ----------------

/** Diagramm wie in intervals.icu: Leistung und Zielleistung (links, Watt), Puls und Trittfrequenz (rechts). */
function Verlauf({ records, plannedSec }: { records: RecordSample[]; plannedSec?: number }) {
  const W = 1000;
  const H = 170;
  const m = buildChart(records, { width: W, height: H, plannedSec });
  const grid = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div class="verlauf" id="verlauf">
      <svg viewBox={`0 0 ${W + 100} ${H + 36}`} role="img" aria-label={T.verlauf}>
        <g transform="translate(50 8)">
          {grid.map((f) => (
            <g key={f}>
              <line x1="0" x2={W} y1={H - f * H} y2={H - f * H} class="gitter" />
              <text x="-6" y={H - f * H + 4} class="achse links" text-anchor="end">
                {Math.round(m.leftMax * f)}
              </text>
              <text x={W + 6} y={H - f * H + 4} class="achse rechts">
                {Math.round(m.rightMin + (m.rightMax - m.rightMin) * f)}
              </text>
            </g>
          ))}
          {m.ticksMin.map((t) => (
            <g key={t}>
              <line x1={((t * 60) / m.domainSec) * W} x2={((t * 60) / m.domainSec) * W} y1="0" y2={H} class="gitter" />
              <text x={((t * 60) / m.domainSec) * W} y={H + 18} class="achse" text-anchor="middle">
                {t} {T.minuteKurz}
              </text>
            </g>
          ))}
          <path d={m.paths.target} class="linie ziel" />
          <path d={m.paths.cadence} class="linie trittfrequenz" />
          <path d={m.paths.heartRate} class="linie puls" />
          <path d={m.paths.power} class="linie leistung" />
        </g>
      </svg>
      <div class="legende">
        <span class="l leistung">{T.legendeLeistung}</span>
        <span class="l ziel">{T.legendeZiel}</span>
        <span class="l puls">{T.legendePuls}</span>
        <span class="l trittfrequenz">{T.legendeTrittfrequenz}</span>
      </div>
    </div>
  );
}
