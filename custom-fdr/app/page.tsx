'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

type Team = { id: number; name: string; short_name: string };
type Event = {
  id: number;
  name: string;
  deadline_time: string | null;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
};
type Fixture = { id: number; event: number | null; team_h: number; team_a: number };
type SortMode = 'az' | 'za' | 'easy' | 'hard';
type ModelContext = {
  registerTool: (tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: object;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute: (input: unknown) => unknown;
  }, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

const HOME_ADVANTAGE = 0.5;
const FDR_COLORS = ['#006b3c', '#00ff87', '#e7e7e7', '#ff1751', '#80072d'];
const SORT_LABELS: Record<SortMode, string> = {
  az: 'Team A–Z',
  za: 'Team Z–A',
  easy: 'Easiest first',
  hard: 'Hardest first',
};

function mixHex(a: string, b: string, t: number) {
  const read = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const [ar, ag, ab] = read(a);
  const [br, bg, bb] = read(b);
  const values = [ar, ag, ab].map((value, i) => Math.round(value + ([br, bg, bb][i] - value) * t));
  return `#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function fdrColor(value: number) {
  const bounded = Math.max(1, Math.min(5, value));
  if (bounded === 5) return FDR_COLORS[4];
  const index = Math.floor(bounded) - 1;
  return mixHex(FDR_COLORS[index], FDR_COLORS[index + 1], bounded - Math.floor(bounded));
}

function readableText(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.48 ? '#fff' : '#111018';
}

function calculateFdr(teamScore: number, opponentScore: number, isHome: boolean) {
  const venue = isHome ? -1 : 1;
  const raw = 3 + (2 / (4 + HOME_ADVANTAGE)) * (opponentScore - teamScore + HOME_ADVANTAGE * venue);
  return Math.round(Math.max(1, Math.min(5, raw)) * 10) / 10;
}

async function loadJson<T>(remote: string, fallback: string): Promise<T> {
  try {
    const response = await fetch(remote, { cache: 'no-store' });
    if (!response.ok) throw new Error('Remote data unavailable');
    return await response.json();
  } catch {
    const response = await fetch(fallback);
    if (!response.ok) throw new Error('Fixture data unavailable');
    return await response.json();
  }
}

function getDefaultStartGw(events: Event[], now = Date.now()) {
  const nextDeadline = events
    .map((event) => ({ event, deadline: Date.parse(event.deadline_time ?? '') }))
    .filter(({ deadline }) => Number.isFinite(deadline) && deadline > now)
    .sort((a, b) => a.deadline - b.deadline)[0]?.event;

  return nextDeadline?.id
    ?? events.find((event) => event.is_next)?.id
    ?? events.find((event) => !event.finished)?.id
    ?? events.find((event) => event.is_current)?.id
    ?? events.at(-1)?.id
    ?? 1;
}

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [draftScores, setDraftScores] = useState<Record<number, number>>({});
  const [scores, setScores] = useState<Record<number, number>>({});
  const [startGw, setStartGw] = useState(1);
  const [gwCount, setGwCount] = useState(5);
  const [sortMode, setSortMode] = useState<SortMode>('az');
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    Promise.all([
      loadJson<{ teams: Team[]; events: Event[] }>('https://fantasy.premierleague.com/api/bootstrap-static/', '/data/bootstrap-static.json'),
      loadJson<Fixture[]>('https://fantasy.premierleague.com/api/fixtures/', '/data/fixtures.json'),
    ]).then(([bootstrap, fixtureData]) => {
      const ordered = [...bootstrap.teams].sort((a, b) => a.name.localeCompare(b.name));
      const defaults = Object.fromEntries(ordered.map((team) => [team.id, 3]));
      const next = getDefaultStartGw(bootstrap.events);
      setTeams(ordered); setEvents(bootstrap.events); setFixtures(fixtureData);
      setDraftScores(defaults); setScores(defaults); setStartGw(next); setStatus('ready');
    }).catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool || teams.length === 0) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'set_team_ratings',
      title: 'Set team ratings',
      description: 'Apply one or more 1.0–5.0 team ratings to the visible Custom FDR table.',
      inputSchema: {
        type: 'object',
        properties: {
          ratings: {
            type: 'object',
            additionalProperties: { type: 'number', minimum: 1, maximum: 5, multipleOf: 0.1 },
            description: 'Ratings keyed by official three-letter team code, such as ARS or MCI.',
          },
        },
        required: ['ratings'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const candidate = input as { ratings?: Record<string, number> };
        if (!candidate?.ratings || typeof candidate.ratings !== 'object') throw new Error('ratings is required');
        const changes: Record<number, number> = {};
        for (const [code, value] of Object.entries(candidate.ratings)) {
          const team = teams.find((item) => item.short_name === code.toUpperCase());
          if (!team || typeof value !== 'number' || value < 1 || value > 5 || Math.round(value * 10) !== value * 10) {
            throw new Error(`Invalid rating for ${code}`);
          }
          changes[team.id] = value;
        }
        setDraftScores((current) => ({ ...current, ...changes }));
        setScores((current) => ({ ...current, ...changes }));
        setDirty(false);
        return { applied: Object.keys(changes).length };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [teams]);

  const visibleGws = useMemo(() => events.filter((event) => event.id >= startGw).slice(0, gwCount), [events, startGw, gwCount]);
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const rows = useMemo(() => {
    const mapped = teams.map((team) => {
      const byGw = visibleGws.map((event) => {
        const games = fixtures.filter((fixture) => fixture.event === event.id && (fixture.team_h === team.id || fixture.team_a === team.id)).map((fixture) => {
          const isHome = fixture.team_h === team.id;
          const opponentId = isHome ? fixture.team_a : fixture.team_h;
          const opponent = teamById.get(opponentId);
          return { fixture, opponent, isHome, fdr: calculateFdr(scores[team.id] ?? 3, scores[opponentId] ?? 3, isHome) };
        });
        return { event, games };
      });
      const easeScore = byGw.flatMap((gw) => gw.games).reduce((sum, game) => sum + 6 - game.fdr, 0);
      return { team, byGw, easeScore };
    });
    return mapped.sort((a, b) => {
      if (sortMode === 'az') return a.team.name.localeCompare(b.team.name);
      if (sortMode === 'za') return b.team.name.localeCompare(a.team.name);
      const difference = sortMode === 'easy' ? b.easeScore - a.easeScore : a.easeScore - b.easeScore;
      return difference || a.team.name.localeCompare(b.team.name);
    });
  }, [teams, visibleGws, fixtures, teamById, scores, sortMode]);

  function updateScore(teamId: number, value: number) {
    if (!Number.isFinite(value)) return;
    const normalizedValue = Math.round(Math.min(5, Math.max(1, value)) * 10) / 10;
    setDraftScores((current) => ({ ...current, [teamId]: normalizedValue }));
    setDirty(true);
  }
  function generate() { setScores({ ...draftScores }); setDirty(false); }
  function reset() {
    setDraftScores(Object.fromEntries(teams.map((team) => [team.id, 3])));
    setDirty(true);
  }

  function saveImage() {
    const ratingTeams = [...teams].sort((a, b) => {
      if (sortMode === 'az') return a.name.localeCompare(b.name);
      if (sortMode === 'za') return b.name.localeCompare(a.name);
      const aScore = scores[a.id] ?? 3;
      const bScore = scores[b.id] ?? 3;
      const difference = sortMode === 'easy' ? bScore - aScore : aScore - bScore;
      return difference || a.name.localeCompare(b.name);
    });
    const scale = 2;
    const ratingsWidth = 340;
    const teamWidth = 170;
    const gwWidth = 180;
    const rowHeight = 46;
    const headerHeight = 128;
    const logicalWidth = ratingsWidth + teamWidth + visibleGws.length * gwWidth + 24;
    const logicalHeight = headerHeight + rows.length * rowHeight + 16;
    const canvas = document.createElement('canvas');
    canvas.width = logicalWidth * scale;
    canvas.height = logicalHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#f7f5f8'; ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    ctx.fillStyle = '#10051f'; ctx.fillRect(0, 0, logicalWidth, 72);
    ctx.fillStyle = '#00ff87'; ctx.font = '700 12px Arial'; ctx.fillText('FANTASY PREMIER LEAGUE', 24, 24);
    ctx.fillStyle = '#ffffff'; ctx.font = '900 27px Arial'; ctx.fillText('Custom FDR', 24, 55);
    ctx.textAlign = 'right'; ctx.font = '600 13px Arial';
    ctx.fillText(`GW${visibleGws[0]?.id ?? startGw}–GW${visibleGws.at(-1)?.id ?? startGw}`, logicalWidth - 24, 44);
    ctx.textAlign = 'left'; ctx.fillStyle = '#31283a'; ctx.font = '800 14px Arial';
    ctx.fillText('TEAM RATINGS', 24, 106); ctx.fillText('TEAM', ratingsWidth + 14, 106);
    visibleGws.forEach((event, index) => {
      ctx.textAlign = 'center'; ctx.fillText(`GW${event.id}`, ratingsWidth + teamWidth + index * gwWidth + gwWidth / 2, 106);
    });
    rows.forEach(({ team, byGw }, rowIndex) => {
      const ratingTeam = ratingTeams[rowIndex];
      const y = headerHeight + rowIndex * rowHeight;
      ctx.textAlign = 'left'; ctx.fillStyle = rowIndex % 2 ? '#f0edf2' : '#ffffff';
      ctx.fillRect(12, y, ratingsWidth - 24, rowHeight - 2);
      ctx.fillRect(ratingsWidth, y, teamWidth, rowHeight - 2);
      ctx.fillStyle = '#211529'; ctx.font = '700 13px Arial'; ctx.fillText(ratingTeam.name, 24, y + 28);
      ctx.textAlign = 'right'; ctx.font = '800 14px Arial'; ctx.fillText((scores[ratingTeam.id] ?? 3).toFixed(1), ratingsWidth - 24, y + 28);
      ctx.textAlign = 'left'; ctx.font = '800 13px Arial'; ctx.fillText(`${team.short_name}  ${team.name}`, ratingsWidth + 14, y + 28);
      byGw.forEach(({ games }, gwIndex) => {
        const x = ratingsWidth + teamWidth + gwIndex * gwWidth;
        if (games.length === 0) {
          ctx.fillStyle = '#e7e7e7'; ctx.fillRect(x, y, gwWidth - 2, rowHeight - 2);
          ctx.fillStyle = '#4a4650'; ctx.textAlign = 'center'; ctx.font = '700 16px Arial'; ctx.fillText('-', x + gwWidth / 2, y + 28);
          return;
        }
        const partHeight = (rowHeight - 2) / games.length;
        games.forEach((game, gameIndex) => {
          const background = fdrColor(game.fdr);
          ctx.fillStyle = background; ctx.fillRect(x, y + gameIndex * partHeight, gwWidth - 2, partHeight - (gameIndex < games.length - 1 ? 1 : 0));
          ctx.fillStyle = readableText(background); ctx.textAlign = 'center'; ctx.font = games.length > 1 ? '700 11px Arial' : '700 13px Arial';
          ctx.fillText(`${game.opponent?.short_name} (${game.isHome ? 'H' : 'A'}) ${game.fdr.toFixed(1)}`, x + gwWidth / 2, y + gameIndex * partHeight + partHeight / 2 + 4);
        });
      });
    });
    const link = document.createElement('a');
    const lastGw = visibleGws.at(-1)?.id ?? startGw;
    link.download = `custom-fdr-gw${String(startGw).padStart(2, '0')}-gw${String(lastGw).padStart(2, '0')}.png`;
    link.href = canvas.toDataURL('image/png'); link.click();
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/10 bg-[#10051f] px-4 py-4 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1800px] items-center gap-4">
          <div><p className="mb-1 text-xs font-bold uppercase tracking-[0.24em] text-[#00ff87]">Fantasy Premier League</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Custom FDR</h1></div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1800px] gap-5 p-4 sm:p-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:p-8">
        <aside className="rounded-2xl border bg-card shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="sticky top-0 z-10 border-b bg-card/95 p-5 backdrop-blur">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Team ratings</h2><p className="mt-1 text-sm text-muted-foreground">Rate every team from 1.0 to 5.0. Higher rating indicates stronger team.</p></div><Button variant="ghost" size="icon" onClick={reset} aria-label="Reset all ratings to 3.0"><RefreshCcw /></Button></div>
          </div>
          <div className="space-y-4 p-5">
            {teams.map((team) => <div key={team.id} className="grid grid-cols-[108px_minmax(0,1fr)_42px] items-center gap-3">
              <label htmlFor={`rating-${team.id}`} className="truncate text-sm font-semibold" title={team.name}>{team.name}</label>
              <Slider id={`rating-${team.id}`} min={1} max={5} step={0.1} value={[draftScores[team.id] ?? 3]} onValueChange={(value) => updateScore(team.id, Number(Array.isArray(value) ? value[0] : value))} aria-label={`${team.name} rating`} />
              <output className="rounded-md bg-secondary px-1.5 py-1 text-center font-mono text-sm font-bold">{(draftScores[team.id] ?? 3).toFixed(1)}</output>
            </div>)}
          </div>
          <div className="sticky bottom-0 border-t bg-card/95 p-4 backdrop-blur">
            {dirty && <p className="mb-2 text-center text-xs font-semibold text-[#e0004d]">Ratings changed — generate to apply</p>}
            <Button className="h-11 w-full bg-[#37003c] font-bold text-white hover:bg-[#54005c]" onClick={generate} disabled={status !== 'ready'}><Sparkles data-icon="inline-start" />Generate FDR table</Button>
          </div>
        </aside>
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 shadow-sm">
            <label className="space-y-1.5"><span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Start</span><Select value={String(startGw)} onValueChange={(value) => setStartGw(Number(value))}><SelectTrigger className="h-10 min-w-28"><SelectValue>{`GW ${startGw}`}</SelectValue></SelectTrigger><SelectContent>{events.map((event) => <SelectItem key={event.id} value={String(event.id)}>GW {event.id}</SelectItem>)}</SelectContent></Select></label>
            <label className="space-y-1.5"><span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Gameweeks</span><Select value={String(gwCount)} onValueChange={(value) => setGwCount(Number(value))}><SelectTrigger className="h-10 min-w-28"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <SelectItem key={count} value={String(count)}>{count}</SelectItem>)}</SelectContent></Select></label>
            <label className="space-y-1.5"><span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Order</span><Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}><SelectTrigger className="h-10 min-w-48"><SelectValue>{SORT_LABELS[sortMode]}</SelectValue></SelectTrigger><SelectContent><SelectItem value="az">Team A–Z</SelectItem><SelectItem value="za">Team Z–A</SelectItem><SelectItem value="easy">Easiest first</SelectItem><SelectItem value="hard">Hardest first</SelectItem></SelectContent></Select></label>
            <Button variant="outline" className="ml-auto h-10" onClick={saveImage} disabled={status !== 'ready'}><Download data-icon="inline-start" />Save image</Button>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            {status === 'loading' && <div className="grid min-h-96 place-items-center text-muted-foreground">Loading official fixtures…</div>}
            {status === 'error' && <div className="grid min-h-96 place-items-center text-[#e0004d]">Fixture data could not be loaded.</div>}
            {status === 'ready' && <div className="overflow-auto"><table className="w-full min-w-max border-separate border-spacing-0 text-sm"><thead><tr><th className="sticky left-0 top-0 z-30 min-w-40 border-b border-r bg-[#f5f3f7] px-4 py-3 text-left font-extrabold">Team</th>{visibleGws.map((event) => <th key={event.id} className="sticky top-0 z-20 min-w-40 border-b border-r bg-[#f5f3f7] px-3 py-3 text-center font-extrabold">GW{event.id}</th>)}</tr></thead><tbody>
              {rows.map(({ team, byGw }) => <tr key={team.id}><th className="sticky left-0 z-10 border-b border-r bg-card px-4 py-2.5 text-left font-bold"><span className="mr-2 inline-grid size-8 place-items-center rounded-full bg-[#37003c] text-xs font-black text-white">{team.short_name}</span>{team.name}</th>{byGw.map(({ event, games }) => <td key={event.id} className="h-[52px] min-w-40 border-b border-r p-0 text-center font-bold">{games.length === 0 ? <div className="grid h-full min-h-[52px] place-items-center bg-[#e7e7e7] text-lg text-[#4a4650]" title="Blank Gameweek">-</div> : <div className="flex h-full min-h-[52px] flex-col">{games.map((game) => { const background = fdrColor(game.fdr); return <div key={game.fixture.id} className="grid min-h-[26px] flex-1 place-items-center border-b border-white/80 px-2 last:border-b-0" style={{ backgroundColor: background, color: readableText(background) }}>{game.opponent?.short_name} ({game.isHome ? 'H' : 'A'}) {game.fdr.toFixed(1)}</div>; })}</div>}</td>)}</tr>)}
            </tbody></table></div>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground"><span className="mr-1">Easy</span>{FDR_COLORS.map((color, index) => <span key={color} className="grid size-8 place-items-center rounded-md" style={{ backgroundColor: color, color: readableText(color) }}>{index + 1}</span>)}<span className="ml-1">Hard</span></div>
        </section>
      </div>
    </main>
  );
}
