import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync(new URL('../app/custom-fdr/page.tsx', import.meta.url), 'utf8');
const calculate = source.slice(source.indexOf('function calculateFdr'), source.indexOf('async function loadJson'));
const update = source.slice(source.indexOf('  function updateScore'), source.indexOf('  function generate'));
const rows = source.slice(source.indexOf('  const rowsByMode'), source.indexOf('  function updateScore'));
const context = vm.createContext({ assert });
const script = `
const HOME_ADVANTAGE = 0.5;
const MODES = ['overall', 'attack', 'defence'];
const defaultRating = () => ({overall:3,attack:3,defence:3});
let draft = {1:defaultRating()}, dirty = false;
const setDraftScores = fn => draft = fn(draft);
const setDirty = value => dirty = value;
${calculate}
${update}
updateScore(1,4,'overall');
assert.deepEqual(JSON.stringify(draft[1]), JSON.stringify({overall:4,attack:4,defence:4}));
updateScore(1,3.1,'attack');
assert.equal(draft[1].overall,3.6);
assert.equal(draft[1].defence,4);
assert.equal(dirty,true);
assert.equal(calculateFdr(5,1,true),1);
assert.equal(calculateFdr(1,5,false),5);
const teams = [{id:1,name:'A'},{id:2,name:'B'}];
const teamById = new Map(teams.map(t=>[t.id,t]));
const visibleGws = [{id:1},{id:2}];
const fixtures = [{id:1,event:1,team_h:1,team_a:2},{id:2,event:1,team_h:2,team_a:1}];
const scores = {1:{overall:3,attack:5,defence:1},2:{overall:3,attack:1,defence:3}};
const useMemo = fn => fn();
const mode='overall';
for(const sortMode of ['az','za','easy','hard']) {
${rows}
assert.equal(rowsByMode.attack.find(r=>r.team.id===1).byGw[0].games[0].fdr,1.9);
assert.equal(rowsByMode.defence.find(r=>r.team.id===1).byGw[0].games[0].fdr,2.8);
assert.equal(rowsByMode.overall[0].byGw[1].games.length,0);
assert.equal(rowsByMode.attack[0].team.id,sortMode==='za'||sortMode==='hard'?2:1, 'attack '+sortMode);
assert.equal(rowsByMode.defence[0].team.id,sortMode==='za'||sortMode==='hard'?2:1, 'defence '+sortMode);
}
`;
vm.runInContext(ts.transpile(script, { target: ts.ScriptTarget.ES2022 }), context);
console.log('PASS: rating synchronization, rounding, clamps, cross-mode FDR, four sorts, double/blank gameweeks');



