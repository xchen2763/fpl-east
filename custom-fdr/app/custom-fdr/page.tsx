'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

type Team = { id: number; name: string; short_name: string; code: number };
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
type Language = 'en' | 'zh';
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
const MAX_GAMEWEEKS = 8;
const FDR_COLORS = ['#006b3c', '#00ff87', '#e7e7e7', '#ff1751', '#80072d'];
const TEAM_NAMES_ZH: Record<string, string> = {
  Arsenal: '阿森纳',
  'Aston Villa': '阿斯顿维拉',
  Bournemouth: '伯恩茅斯',
  Brentford: '布伦特福德',
  Brighton: '布莱顿',
  Chelsea: '切尔西',
  'Coventry City': '考文垂',
  'Crystal Palace': '水晶宫',
  Everton: '埃弗顿',
  Fulham: '富勒姆',
  'Hull City': '赫尔城',
  'Ipswich Town': '伊普斯维奇',
  Leeds: '利兹联',
  Liverpool: '利物浦',
  'Man City': '曼城',
  'Man Utd': '曼联',
  Newcastle: '纽卡斯尔联',
  "Nott'm Forest": '诺丁汉森林',
  Spurs: '托特纳姆热刺',
  Sunderland: '桑德兰',
};
const COPY = {
  en: {
    title: 'FPL Custom FDR',
    subtitle: 'Presented by FPLEast',
    language: 'Language',
    teamRatings: 'Team ratings',
    ratingHelp: 'Rate every team from 1.0 to 5.0. Higher rating indicates stronger team.',
    resetRatings: 'Reset all ratings to 3.0',
    ratingChanged: 'Ratings changed — generate to apply',
    generate: 'Generate FDR table',
    start: 'Start',
    gameweeks: 'Gameweeks',
    order: 'Order',
    saveImage: 'Save image',
    loading: 'Loading official fixtures…',
    loadError: 'Fixture data could not be loaded.',
    team: 'Team',
    teamRatingsImage: 'TEAM RATINGS',
    teamImage: 'TEAM',
    blankGameweek: 'Blank Gameweek',
    easy: 'Easy',
    hard: 'Hard',
    privacyPolicy: 'Privacy Policy',
    lastUpdated: 'Last updated: 9 October 2026',
    privacyIntro: 'FPLEast respects your privacy. This site does not require an account and FPLEast does not collect, store, sell, or share the team ratings you enter.',
    ratingsPrivacyTitle: 'Team ratings and downloads',
    ratingsPrivacy: 'Your ratings are processed in your browser and are not uploaded to FPLEast. Any FDR image you save is also generated locally in your browser and downloaded directly to your device.',
    fixturePrivacyTitle: 'Fixture data',
    fixturePrivacy: 'This site requests team and fixture data from the Fantasy Premier League API. When that request is made, the data provider may receive basic technical information such as your IP address and browser details under its own privacy practices. If the live data is unavailable, the site uses a bundled fallback copy.',
    hostingPrivacyTitle: 'Hosting and technical logs',
    hostingPrivacy: 'The hosting provider may process limited technical data, such as IP addresses, browser information, and request logs, to deliver, secure, and maintain the site.',
    cookiesPrivacyTitle: 'Cookies and analytics',
    cookiesPrivacy: 'FPLEast does not currently use advertising cookies, analytics cookies, or tracking tools. The hosting provider may use technologies that are strictly necessary to operate and secure the service.',
    changesPrivacyTitle: 'Changes to this policy',
    changesPrivacy: 'This policy may be updated if the site adds new features or changes how data is handled. The latest version will always be available through this Privacy Policy link.',
    disclaimer: 'This site is not affiliated with or endorsed by Premier League or Fantasy Premier League.',
    sort: { az: 'Team A–Z', za: 'Team Z–A', easy: 'Easiest first', hard: 'Hardest first' } as Record<SortMode, string>,
  },
  zh: {
    title: 'FPL自定义赛程难度评级(FDR)',
    subtitle: 'FPLEast(想把自己放进冰箱)',
    language: '语言',
    teamRatings: '球队评分',
    ratingHelp: '请为每支球队评定 1.0 至 5.0 分。评分越高，表示球队越强。',
    resetRatings: '将所有球队评分重置为 3.0',
    ratingChanged: '评分已更改 — 点击生成后应用',
    generate: '生成 FDR 表',
    start: '起始轮次',
    gameweeks: '轮次数',
    order: '排序方式',
    saveImage: '保存图片',
    loading: '正在加载官方赛程…',
    loadError: '无法加载赛程数据。',
    team: '球队',
    teamRatingsImage: '球队评分',
    teamImage: '球队',
    blankGameweek: '空白比赛轮',
    easy: '容易',
    hard: '困难',
    privacyPolicy: '隐私政策',
    lastUpdated: '最后更新：2026年10月9日',
    privacyIntro: 'FPLEast 尊重您的隐私。本网站无需注册账户，FPLEast 不会收集、存储、出售或分享您输入的球队评分。',
    ratingsPrivacyTitle: '球队评分与图片下载',
    ratingsPrivacy: '您的评分仅在浏览器中处理，不会上传至 FPLEast。您保存的 FDR 图片同样在浏览器本地生成，并直接下载到您的设备。',
    fixturePrivacyTitle: '赛程数据',
    fixturePrivacy: '本网站会从 Fantasy Premier League API 请求球队和赛程数据。发出请求时，数据提供方可能根据其自身隐私政策接收您的 IP 地址、浏览器信息等基本技术信息。若实时数据不可用，网站将使用随站点提供的备用数据。',
    hostingPrivacyTitle: '托管与技术日志',
    hostingPrivacy: '网站托管服务提供商可能处理有限的技术数据，例如 IP 地址、浏览器信息和请求日志，以提供、保护和维护本网站。',
    cookiesPrivacyTitle: 'Cookie 与分析工具',
    cookiesPrivacy: 'FPLEast 目前不使用广告 Cookie、分析 Cookie 或追踪工具。托管服务提供商可能使用运行和保护服务所必需的技术。',
    changesPrivacyTitle: '隐私政策变更',
    changesPrivacy: '如果网站新增功能或改变数据处理方式，本政策可能更新。最新版本将始终通过本隐私政策链接提供。',
    disclaimer: '本网站与 Premier League 或 Fantasy Premier League 无隶属关系，亦未获得其认可。',
    sort: { az: '按英文名 A–Z', za: '按英文名 Z–A', easy: '赛程由易到难', hard: '赛程由难到易' } as Record<SortMode, string>,
  },
};

function teamName(team: Team | undefined, language: Language) {
  if (!team) return '';
  return language === 'zh' ? TEAM_NAMES_ZH[team.name] ?? team.name : team.name;
}

function gameweekLabel(gameweek: number, language: Language, spaced = false) {
  if (language === 'zh') return `第${gameweek}轮`;
  return `GW${spaced ? ' ' : ''}${gameweek}`;
}

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

function crestPath(team: Team) {
  return `/crests/${team.code}.png`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
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

export default function CustomFdrPage() {
  const [language, setLanguage] = useState<Language>('en');
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
  const copy = COPY[language];

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = `${COPY[language].title} | FPLEast`;
  }, [language]);

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

  async function saveImage() {
    const crestEntries = await Promise.all(
      teams.map(async (team) => [team.id, await loadImage(crestPath(team))] as const),
    );
    const teamCrests = new Map(crestEntries);
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
    const canvasFont = language === 'zh' ? '"Microsoft YaHei", "Noto Sans SC", Arial, sans-serif' : 'Arial, sans-serif';
    ctx.fillStyle = '#ffffff'; ctx.font = `900 ${language === 'zh' ? 24 : 27}px ${canvasFont}`; ctx.fillText(copy.title, 24, 31);
    ctx.fillStyle = '#00ff87'; ctx.font = `700 11px ${canvasFont}`; ctx.fillText(copy.subtitle, 24, 54);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff'; ctx.font = `600 13px ${canvasFont}`;
    const firstGw = visibleGws[0]?.id ?? startGw;
    const lastVisibleGw = visibleGws.at(-1)?.id ?? startGw;
    ctx.fillText(language === 'zh' ? `第${firstGw}–${lastVisibleGw}轮` : `GW${firstGw}–GW${lastVisibleGw}`, logicalWidth - 24, 43);
    ctx.textAlign = 'left'; ctx.fillStyle = '#31283a'; ctx.font = `800 14px ${canvasFont}`;
    ctx.fillText(copy.teamRatingsImage, 24, 106); ctx.fillText(copy.teamImage, ratingsWidth + 14, 106);
    visibleGws.forEach((event, index) => {
      ctx.textAlign = 'center'; ctx.fillText(gameweekLabel(event.id, language), ratingsWidth + teamWidth + index * gwWidth + gwWidth / 2, 106);
    });
    rows.forEach(({ team, byGw }, rowIndex) => {
      const ratingTeam = ratingTeams[rowIndex];
      const y = headerHeight + rowIndex * rowHeight;
      ctx.textAlign = 'left'; ctx.fillStyle = rowIndex % 2 ? '#f0edf2' : '#ffffff';
      ctx.fillRect(12, y, ratingsWidth - 24, rowHeight - 2);
      ctx.fillRect(ratingsWidth, y, teamWidth, rowHeight - 2);
      ctx.fillStyle = '#211529'; ctx.font = `700 13px ${canvasFont}`; ctx.fillText(teamName(ratingTeam, language), 24, y + 28);
      ctx.textAlign = 'right'; ctx.font = `800 14px ${canvasFont}`; ctx.fillText((scores[ratingTeam.id] ?? 3).toFixed(1), ratingsWidth - 24, y + 28);
      const crest = teamCrests.get(team.id);
      if (crest) ctx.drawImage(crest, ratingsWidth + 14, y + 7, 30, 30);
      ctx.textAlign = 'left'; ctx.font = `800 13px ${canvasFont}`; ctx.fillText(teamName(team, language), ratingsWidth + 54, y + 28);
      byGw.forEach(({ games }, gwIndex) => {
        const x = ratingsWidth + teamWidth + gwIndex * gwWidth;
        if (games.length === 0) {
          ctx.fillStyle = '#e7e7e7'; ctx.fillRect(x, y, gwWidth - 2, rowHeight - 2);
          ctx.fillStyle = '#4a4650'; ctx.textAlign = 'center'; ctx.font = `700 16px ${canvasFont}`; ctx.fillText('-', x + gwWidth / 2, y + 28);
          return;
        }
        const partHeight = (rowHeight - 2) / games.length;
        games.forEach((game, gameIndex) => {
          const background = fdrColor(game.fdr);
          ctx.fillStyle = background; ctx.fillRect(x, y + gameIndex * partHeight, gwWidth - 2, partHeight - (gameIndex < games.length - 1 ? 1 : 0));
          ctx.fillStyle = readableText(background); ctx.textAlign = 'center';
          ctx.font = `700 ${games.length > 1 ? (language === 'zh' ? 10 : 11) : (language === 'zh' ? 12 : 13)}px ${canvasFont}`;
          const opponent = language === 'zh' ? teamName(game.opponent, language) : game.opponent?.short_name;
          const venue = language === 'zh' ? (game.isHome ? '主' : '客') : (game.isHome ? 'H' : 'A');
          ctx.fillText(`${opponent}${language === 'zh' ? '' : ' '}(${venue}) ${game.fdr.toFixed(1)}`, x + gwWidth / 2, y + gameIndex * partHeight + partHeight / 2 + 4);
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
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4">
          <div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">{copy.title}</h1><p className="mt-1 text-xs font-bold tracking-[0.12em] text-[#00ff87]">{copy.subtitle}</p></div>
          <label className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs font-bold uppercase tracking-wider text-white/70 sm:inline">{copy.language}</span>
            <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
              <SelectTrigger className="h-9 min-w-28 border-white/25 bg-white/10 text-white hover:bg-white/15"><SelectValue>{language === 'zh' ? '中文' : 'English'}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="zh">中文</SelectItem></SelectContent>
            </Select>
          </label>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1800px] gap-5 p-4 sm:p-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:p-8">
        <aside className="rounded-2xl border bg-card shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="sticky top-0 z-10 border-b bg-card/95 p-5 backdrop-blur">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">{copy.teamRatings}</h2><p className="mt-1 text-sm text-muted-foreground">{copy.ratingHelp}</p></div><Button variant="ghost" size="icon" onClick={reset} aria-label={copy.resetRatings}><RefreshCcw /></Button></div>
          </div>
          <div className="space-y-4 p-5">
            {teams.map((team) => <div key={team.id} className="grid grid-cols-[108px_minmax(0,1fr)_42px] items-center gap-3">
              <label htmlFor={`rating-${team.id}`} className="truncate text-sm font-semibold" title={teamName(team, language)}>{teamName(team, language)}</label>
              <Slider id={`rating-${team.id}`} min={1} max={5} step={0.1} value={[draftScores[team.id] ?? 3]} onValueChange={(value) => updateScore(team.id, Number(Array.isArray(value) ? value[0] : value))} aria-label={language === 'zh' ? `${teamName(team, language)}评分` : `${team.name} rating`} />
              <output className="rounded-md bg-secondary px-1.5 py-1 text-center font-mono text-sm font-bold">{(draftScores[team.id] ?? 3).toFixed(1)}</output>
            </div>)}
          </div>
          <div className="sticky bottom-0 border-t bg-card/95 p-4 backdrop-blur">
            {dirty && <p className="mb-2 text-center text-xs font-semibold text-[#e0004d]">{copy.ratingChanged}</p>}
            <Button className="h-11 w-full bg-[#37003c] font-bold text-white hover:bg-[#54005c]" onClick={generate} disabled={status !== 'ready'}><Sparkles data-icon="inline-start" />{copy.generate}</Button>
          </div>
        </aside>
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 shadow-sm">
            <label className="space-y-1.5"><span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.start}</span><Select value={String(startGw)} onValueChange={(value) => setStartGw(Number(value))}><SelectTrigger className="h-10 min-w-28"><SelectValue>{gameweekLabel(startGw, language, true)}</SelectValue></SelectTrigger><SelectContent>{events.map((event) => <SelectItem key={event.id} value={String(event.id)}>{gameweekLabel(event.id, language, true)}</SelectItem>)}</SelectContent></Select></label>
            <label className="space-y-1.5"><span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.gameweeks}</span><Select value={String(gwCount)} onValueChange={(value) => setGwCount(Math.min(MAX_GAMEWEEKS, Math.max(1, Number(value))))}><SelectTrigger className="h-10 min-w-28"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: MAX_GAMEWEEKS }, (_, index) => index + 1).map((count) => <SelectItem key={count} value={String(count)}>{count}</SelectItem>)}</SelectContent></Select></label>
            <label className="space-y-1.5"><span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.order}</span><Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}><SelectTrigger className="h-10 min-w-48"><SelectValue>{copy.sort[sortMode]}</SelectValue></SelectTrigger><SelectContent><SelectItem value="az">{copy.sort.az}</SelectItem><SelectItem value="za">{copy.sort.za}</SelectItem><SelectItem value="easy">{copy.sort.easy}</SelectItem><SelectItem value="hard">{copy.sort.hard}</SelectItem></SelectContent></Select></label>
            <Button variant="outline" className="ml-auto h-10" onClick={saveImage} disabled={status !== 'ready'}><Download data-icon="inline-start" />{copy.saveImage}</Button>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            {status === 'loading' && <div className="grid min-h-96 place-items-center text-muted-foreground">{copy.loading}</div>}
            {status === 'error' && <div className="grid min-h-96 place-items-center text-[#e0004d]">{copy.loadError}</div>}
            {status === 'ready' && <div className="overflow-auto"><table className="w-full min-w-max border-separate border-spacing-0 text-sm"><thead><tr><th className="sticky left-0 top-0 z-30 min-w-40 border-b border-r bg-[#f5f3f7] px-4 py-3 text-left font-extrabold">{copy.team}</th>{visibleGws.map((event) => <th key={event.id} className="sticky top-0 z-20 min-w-40 border-b border-r bg-[#f5f3f7] px-3 py-3 text-center font-extrabold">{gameweekLabel(event.id, language)}</th>)}</tr></thead><tbody>
              {rows.map(({ team, byGw }) => <tr key={team.id}><th className="sticky left-0 z-10 border-b border-r bg-card px-4 py-2.5 text-left font-bold"><span className="inline-flex items-center gap-3"><img src={crestPath(team)} alt={language === 'zh' ? `${teamName(team, language)}队徽` : `${team.name} crest`} className="size-8 object-contain" />{teamName(team, language)}</span></th>{byGw.map(({ event, games }) => <td key={event.id} className="h-[52px] min-w-40 border-b border-r p-0 text-center font-bold">{games.length === 0 ? <div className="grid h-full min-h-[52px] place-items-center bg-[#e7e7e7] text-lg text-[#4a4650]" title={copy.blankGameweek}>-</div> : <div className="flex h-full min-h-[52px] flex-col">{games.map((game) => { const background = fdrColor(game.fdr); const opponent = language === 'zh' ? teamName(game.opponent, language) : game.opponent?.short_name; const venue = language === 'zh' ? (game.isHome ? '主' : '客') : (game.isHome ? 'H' : 'A'); return <div key={game.fixture.id} className={`grid min-h-[26px] flex-1 place-items-center border-b border-white/80 px-2 last:border-b-0 ${language === 'zh' ? 'text-[13px]' : ''}`} style={{ backgroundColor: background, color: readableText(background) }}>{opponent}{language === 'zh' ? '' : ' '}({venue}) {game.fdr.toFixed(1)}</div>; })}</div>}</td>)}</tr>)}
            </tbody></table></div>}
          </div>
          <div className="mt-4 flex flex-col gap-3 text-xs text-muted-foreground xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2 font-semibold"><span className="mr-1">{copy.easy}</span>{FDR_COLORS.map((color, index) => <span key={color} className="grid size-8 place-items-center rounded-md" style={{ backgroundColor: color, color: readableText(color) }}>{index + 1}</span>)}<span className="ml-1">{copy.hard}</span></div>
            <div className="flex max-w-2xl flex-col items-start gap-1 xl:items-end xl:text-right">
              <Dialog>
                <DialogTrigger className="font-semibold text-foreground underline decoration-foreground/35 underline-offset-4 transition-colors hover:text-[#37003c]">{copy.privacyPolicy}</DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-extrabold">{copy.privacyPolicy}</DialogTitle>
                    <DialogDescription>{copy.lastUpdated}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 leading-relaxed text-muted-foreground">
                    <p>{copy.privacyIntro}</p>
                    <section className="space-y-1">
                      <h3 className="font-bold text-foreground">{copy.ratingsPrivacyTitle}</h3>
                      <p>{copy.ratingsPrivacy}</p>
                    </section>
                    <section className="space-y-1">
                      <h3 className="font-bold text-foreground">{copy.fixturePrivacyTitle}</h3>
                      <p>{copy.fixturePrivacy}</p>
                    </section>
                    <section className="space-y-1">
                      <h3 className="font-bold text-foreground">{copy.hostingPrivacyTitle}</h3>
                      <p>{copy.hostingPrivacy}</p>
                    </section>
                    <section className="space-y-1">
                      <h3 className="font-bold text-foreground">{copy.cookiesPrivacyTitle}</h3>
                      <p>{copy.cookiesPrivacy}</p>
                    </section>
                    <section className="space-y-1">
                      <h3 className="font-bold text-foreground">{copy.changesPrivacyTitle}</h3>
                      <p>{copy.changesPrivacy}</p>
                    </section>
                  </div>
                </DialogContent>
              </Dialog>
              <p>{copy.disclaimer}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
