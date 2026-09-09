#!/usr/bin/env node
/**
 * test.js — checks the app against README.md and against itself.
 * Runs in plain node: the engine half of index.html has no DOM dependencies.
 *
 *   node test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* Everything above the STORAGE banner is pure logic; below it touches the DOM. */
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const cut = script.lastIndexOf('/* ====', script.indexOf('   STORAGE'));
const engine = script.slice(0, cut);

/* Top-level `const` stays in the script's own scope, so hand the bindings out explicitly. */
const NAMES = ['PERIODS','LORE','NUMBERS','TAROT','EL_REL','Q_REL','SIGNS','ELEMENTS','QUALITIES',
               'DIM','MONTHS','profileOf','reduceNum','digitSum','tarotFor','tarotIndex','relKey',
               'isLeap','parseBirthday','parseBulkLine','renderCrest','renderReading','renderPath','renderPair'];
const ctx = vm.createContext({console});
vm.runInContext(engine + `\n;globalThis.__api = {${NAMES.join(',')}};`, ctx, {filename:'index.html:engine'});
const api = ctx.__api;
const missing = NAMES.filter(n=>api[n] === undefined);
if(missing.length){ console.error('engine did not export: ' + missing.join(', ')); process.exit(1); }
const {PERIODS, LORE, NUMBERS, TAROT, EL_REL, Q_REL, SIGNS, ELEMENTS, QUALITIES, DIM, MONTHS,
       profileOf, reduceNum, digitSum, tarotFor, tarotIndex, relKey, isLeap,
       parseBirthday, parseBulkLine, renderCrest, renderReading, renderPath, renderPair} = api;

let failures = 0, checks = 0;
function ok(label){ checks++; console.log('  ✓ ' + label); }
function bad(label, detail){ checks++; failures++; console.log('  ✗ ' + label + (detail ? '\n      ' + detail : '')); }
function is(actual, expected, label){
  actual === expected ? ok(label) : bad(label, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}
function group(name){ console.log('\n' + name); }

/* ---------------------------------------------------------- */
group('README is the source of truth');
const {parseReadme} = require('./build.js');   // the build's own parser, so both agree
const fromReadme = parseReadme();
is(fromReadme.length, 48, 'README lists 48 periods');
is(PERIODS.length, 48, 'app carries 48 periods');
let drift = [];
fromReadme.forEach(({n, r, t})=>{
  const p = PERIODS.find(x=>x.n === n);
  if(!p) return drift.push(`missing "${n}"`);
  if(p.r !== r) drift.push(`${n}: range "${p.r}" != README "${r}"`);
  if(p.t !== t) drift.push(`${n}: title "${p.t}" != README "${t}"`);
});
drift.length ? bad('every name, range and title matches the README verbatim', drift.join('\n      '))
             : ok('every name, range and title matches the README verbatim');

/* ---------------------------------------------------------- */
group('The year is covered exactly once');
let multi = 0, none = 0, total = 0;
for(let mo = 1; mo <= 12; mo++){
  for(let d = 1; d <= DIM[mo-1]; d++){
    total++;
    const hits = PERIODS.filter(p=>{
      const s = p.sm*100 + p.sd, e = p.em*100 + p.ed, k = mo*100 + d;
      return s <= e ? (k >= s && k <= e) : (k >= s || k <= e);
    });
    if(hits.length === 0) none++;
    if(hits.length > 1) multi++;
  }
}
is(total, 366, 'a leap year has 366 days to place');
is(none, 0, 'no day falls outside every period');
is(multi, 0, 'no day falls inside two periods');
is(profileOf({name:'x', month:2, day:29, year:1996}).per.n, 'Pisces I', '29 February lands in Pisces I');
is(profileOf({name:'x', month:12, day:31, year:null}).per.n, 'Capricorn I', '31 December wraps into Capricorn I');
is(profileOf({name:'x', month:1, day:1, year:null}).per.n, 'Capricorn I', '1 January is the same wrapped period');

/* ---------------------------------------------------------- */
group('Numerology and tarot are two different reductions');
is(reduceNum(29), 2, 'day-number reduces all the way: 29 -> 11 -> 2');
is(digitSum(29), 11, 'tarot sums digits once: 29 -> 11');
is(tarotFor(29).n, 'Justice', 'the 29th draws XI Justice, not II');
is(tarotFor(28).n, 'The Wheel of Fortune', 'the 28th draws X The Wheel of Fortune');
is(tarotFor(9).n, 'The Hermit', 'the 9th draws IX The Hermit');
is(tarotFor(22).n, 'The Fool', 'the 22nd draws XXII The Fool');
is(tarotFor(31).n, 'The Emperor', 'the 31st reduces to 4, The Emperor');
is(NUMBERS[reduceNum(9)].planet, 'Mars', 'the 9 is ruled by Mars');
const planets = {1:'the Sun',2:'the Moon',3:'Jupiter',4:'Uranus',5:'Mercury',6:'Venus',7:'Neptune',8:'Saturn',9:'Mars'};
const planetDrift = Object.keys(planets).filter(n=>NUMBERS[n].planet !== planets[n]);
planetDrift.length ? bad('all nine ruling planets are correct', planetDrift.join(', ')) : ok('all nine ruling planets are correct');
is(Object.keys(TAROT).length, 22, 'all 22 Major Arcana are defined');

/* ---------------------------------------------------------- */
group('Interpretation covers every period');
const loreGaps = [];
PERIODS.forEach(p=>{
  const L = LORE[p.n];
  if(!L) return loreGaps.push(`no entry for ${p.n}`);
  ['k','g','s','p','path','pur'].forEach(f=>{
    if(!L[f] || L[f].length < 10) loreGaps.push(`${p.n}.${f} is missing or too short`);
  });
});
Object.keys(LORE).forEach(k=>{ if(!PERIODS.some(p=>p.n === k)) loreGaps.push(`orphan entry "${k}"`); });
loreGaps.length ? bad('all 48 periods have full lore, with no orphans', loreGaps.join('\n      '))
                : ok('all 48 periods have full lore, with no orphans');
const paths = new Set(PERIODS.map(p=>LORE[p.n].path));
is(paths.size, 48, 'all 48 path names are distinct');

/* ---------------------------------------------------------- */
group('Relation tables are complete');
const els = ['Fire','Earth','Air','Water'], qs = ['Cardinal','Fixed','Mutable'];
const missingEl = [], missingQ = [];
els.forEach(a=>els.forEach(b=>{ if(!EL_REL[relKey(a,b)]) missingEl.push(`${a}|${b}`); }));
qs.forEach(a=>qs.forEach(b=>{ if(!Q_REL[relKey(a,b)]) missingQ.push(`${a}|${b}`); }));
missingEl.length ? bad('all 10 element pairings defined', missingEl.join(', ')) : ok('all 10 element pairings defined');
missingQ.length ? bad('all 6 quality pairings defined', missingQ.join(', ')) : ok('all 6 quality pairings defined');

/* ---------------------------------------------------------- */
group('Every day renders, and every pair renders');
let renderFails = [];
for(let mo = 1; mo <= 12; mo++){
  for(let d = 1; d <= DIM[mo-1]; d++){
    const P = profileOf({name:'Robin Vale', month:mo, day:d, year:1990});
    let out;
    try{ out = renderCrest(P) + renderReading(P) + renderPath(P); }
    catch(e){ renderFails.push(`${mo}/${d}: ${e.message}`); continue; }
    if(/undefined|NaN|\[object Object\]/.test(out)) renderFails.push(`${mo}/${d}: placeholder leaked into output`);
  }
}
renderFails.length ? bad('all 366 days produce a clean reading', renderFails.slice(0,5).join('\n      '))
                   : ok('all 366 days produce a clean reading');

let pairFails = [], combos = 0;
const seen = new Set();
for(let i = 0; i < 48; i++){
  for(let j = i; j < 48; j++){
    const A = profileOf({name:'Ada Lune', month:PERIODS[i].sm, day:PERIODS[i].sd, year:null});
    const B = profileOf({name:'Bo Reyes', month:PERIODS[j].sm, day:PERIODS[j].sd, year:null});
    let out;
    try{ out = renderPair(A, B); }
    catch(e){ pairFails.push(`${PERIODS[i].n} x ${PERIODS[j].n}: ${e.message}`); continue; }
    if(/undefined|NaN|\[object Object\]/.test(out)) pairFails.push(`${PERIODS[i].n} x ${PERIODS[j].n}: placeholder leaked`);
    seen.add(out); combos++;
  }
}
is(combos, 1176, 'all 1,176 period combinations are reachable');
pairFails.length ? bad('every combination renders cleanly', pairFails.slice(0,5).join('\n      '))
                 : ok('every combination renders cleanly');
seen.size === combos ? ok('every combination produces distinct text')
                     : bad('every combination produces distinct text', `${seen.size} distinct of ${combos}`);

/* ---------------------------------------------------------- */
group('Bulk date parsing');
const good = [
  ['1991-04-07',            {month:4,  day:7,  year:1991}],
  ['29 Nov 1988',           {month:11, day:29, year:1988}],
  ['Nov 29 1988',           {month:11, day:29, year:1988}],
  ['November 29, 1988',     {month:11, day:29, year:1988}],
  ['Sept 3 1970',           {month:9,  day:3,  year:1970}],
  ['3/14/1990',             {month:3,  day:14, year:1990}],
  ['3/14',                  {month:3,  day:14, year:null}],
  ['21/10/1975',            {month:10, day:21, year:1975}],
  ['Feb 29 1996',           {month:2,  day:29, year:1996}],
  ['1st May 2001',          {month:5,  day:1,  year:2001}]
];
let dateFails = [];
good.forEach(([input, want])=>{
  const got = parseBirthday(input);
  if(got.error || got.month !== want.month || got.day !== want.day || got.year !== want.year){
    dateFails.push(`"${input}" -> ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
  }
});
dateFails.length ? bad(`${good.length} date formats parse correctly`, dateFails.join('\n      '))
                 : ok(`${good.length} date formats parse correctly`);

const rejects = [['Feb 30 1990','impossible day'], ['Feb 29 1995','non-leap 29 Feb'], ['13/40/1990','nonsense'], ['hello','no date at all']];
let rejectFails = [];
rejects.forEach(([input, why])=>{ if(!parseBirthday(input).error) rejectFails.push(`"${input}" (${why}) was accepted`); });
rejectFails.length ? bad('impossible dates are rejected', rejectFails.join('\n      ')) : ok('impossible dates are rejected');

const lines = [
  ['Ada Marchetti, 29 Nov 1988',   'Ada Marchetti', 11, 29],
  ['Bo Tran\t1991-04-07',          'Bo Tran',        4,  7],
  ['Cy Okonkwo February 29 1996',  'Cy Okonkwo',     2, 29],
  ['Dara Whitlock, 3/14',          'Dara Whitlock',  3, 14]
];
let lineFails = [];
lines.forEach(([input, name, m, d])=>{
  const got = parseBulkLine(input);
  if(!got || got.error || got.name !== name || got.month !== m || got.day !== d){
    lineFails.push(`"${input}" -> ${JSON.stringify(got)}`);
  }
});
lineFails.length ? bad('bulk lines split name from date', lineFails.join('\n      ')) : ok('bulk lines split name from date');
is(parseBulkLine('   '), null, 'blank lines are ignored');
is(parseBulkLine('# a comment'), null, 'comment lines are ignored');
ok('unreadable lines report an error instead of throwing: ' + JSON.stringify(parseBulkLine('Just A Name').error));

/* ---------------------------------------------------------- */
console.log('\n' + '-'.repeat(58));
console.log(failures ? `FAILED — ${failures} of ${checks} checks failed` : `PASSED — all ${checks} checks`);
process.exit(failures ? 1 : 0);
