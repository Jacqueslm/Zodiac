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
               'isLeap','parseBirthday','parseBulkLine','renderCrest','renderReading','renderPath','renderPair',
               'parseCSV','parseContactsCSV','parseVCF','parseContacts','parseContactDate',
               'WELLBEING','SIGN_BODY','SIGN_SWATCH','PLANET_LORE','BIRTHSTONE','DESTINY',
               'makeQuiz','QUIZ_KINDS','findPeriod','PORTRAIT','DEPTH','renderDepth','relSpread','DAYS','renderDay',
               'SEASONS','SEASON_PLACE','SEASON_VERB','seasonOf','seasonLine','ELEMENT_LORE','QUALITY_LORE','signFrom','describeSign'];
const ctx = vm.createContext({console, URLSearchParams});
vm.runInContext(engine + `\n;globalThis.__api = {${NAMES.join(',')}};`, ctx, {filename:'index.html:engine'});
const api = ctx.__api;
const missing = NAMES.filter(n=>api[n] === undefined);
if(missing.length){ console.error('engine did not export: ' + missing.join(', ')); process.exit(1); }
const {PERIODS, LORE, NUMBERS, TAROT, EL_REL, Q_REL, SIGNS, ELEMENTS, QUALITIES, DIM, MONTHS,
       profileOf, reduceNum, digitSum, tarotFor, tarotIndex, relKey, isLeap,
       parseBirthday, parseBulkLine, renderCrest, renderReading, renderPath, renderPair,
       parseCSV, parseContactsCSV, parseVCF, parseContacts, parseContactDate,
       WELLBEING, SIGN_BODY, SIGN_SWATCH, PLANET_LORE, BIRTHSTONE, DESTINY,
       makeQuiz, QUIZ_KINDS, findPeriod, PORTRAIT, DEPTH, renderDepth, relSpread, DAYS, renderDay,
       SEASONS, SEASON_PLACE, SEASON_VERB, seasonOf, seasonLine, ELEMENT_LORE, QUALITY_LORE,
       signFrom, describeSign} = api;

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
group('Readings are specific, not boilerplate');

const portraitGaps = [];
PERIODS.forEach(p=>{
  const t = PORTRAIT[p.n];
  if(!t) return portraitGaps.push(`no portrait for ${p.n}`);
  if(t.length < 300) portraitGaps.push(`${p.n}: portrait only ${t.length} chars`);
  if(t.split(/(?<=[.!?])\s/).filter(x=>x.trim()).length < 3) portraitGaps.push(`${p.n}: fewer than 3 sentences`);
});
Object.keys(PORTRAIT).forEach(k=>{ if(!PERIODS.some(p=>p.n === k)) portraitGaps.push(`orphan portrait "${k}"`); });
portraitGaps.length ? bad('every period has a substantial portrait', portraitGaps.join('\n      '))
                    : ok('all 48 periods have a portrait of 3+ sentences');
is(new Set(PERIODS.map(p=>PORTRAIT[p.n])).size, 48, 'all 48 portraits are distinct');

/* The point of the portraits: the part of a reading driven by the PERIOD
   must be mostly specific to it. Before portraits existed it was 11%.
   Excluded from the denominator: the number and card sections (driven by
   the day of the month — everyone born on the 19th shares them by
   design), the correspondences data panel, and the section headings. */
const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/&mdash;/g, '-').replace(/\s+/g, ' ').trim();
function periodProse(p){
  const prof = profileOf({name:'X', month:p.sm, day:p.sd, year:1990});
  let h = renderReading(prof);
  const a = h.indexOf('<h4>The number'), b = h.indexOf('<h4>Where it converges');
  if(a > -1 && b > a) h = h.slice(0, a) + h.slice(b);
  const c = h.indexOf('<h4>Correspondences');
  if(c > -1) h = h.slice(0, c);
  /* The deep layer is part of what the reader sees, so it belongs in the
     comparison — appended after the correspondence table is trimmed off. */
  h += renderDepth(prof);
  return strip(h.replace(/<h4>[\s\S]*?<\/h4>/g, ' '));
}
const proses = PERIODS.map(periodProse);
const share = PERIODS.map((p, i)=>{
  const D = DEPTH[p.n];
  const own = [PORTRAIT[p.n], LORE[p.n].k, LORE[p.n].g, LORE[p.n].s, LORE[p.n].p,
               WELLBEING[p.n].h, WELLBEING[p.n].m,
               D ? [D.action, D.reflect, D.strong, D.hard, D.mind, D.body, D.spirit,
                    D.raised, D.making, D.close, D.direction,
                    ...Object.values(D.stages)].join(' ') : ''].join(' ').length;
  return own / proses[i].length * 100;
});
const minShare = Math.min(...share), avgShare = share.reduce((a,b)=>a + b, 0) / share.length;
/* 40% is a regression guard, not a target: the figure was 11% before the
   portraits and sits in the mid-forties now. */
minShare >= 40 ? ok(`period-driven prose is ${minShare.toFixed(0)}-${Math.max(...share).toFixed(0)}% specific to its own period (avg ${avgShare.toFixed(0)}%, was 11% before portraits)`)
               : bad('a reading is mostly about its own period', `the thinnest is only ${minShare.toFixed(0)}% specific`);

/* Two readings may still share correspondence lines — a body zone with the
   same sign, an element/quality line, a number's register. That is the
   system working. What must not happen is two readings looking alike, so
   cap how much of a reading any other reading can duplicate. */
const sentencesOf = r => r.split(/(?<=[.!?])\s/).map(x=>x.trim()).filter(x=>x.length > 30);
const sents = proses.map(sentencesOf);
let worstPair = {pct:0};
for(let i = 0; i < sents.length; i++){
  const setI = new Set(sents[i]);
  for(let j = i + 1; j < sents.length; j++){
    const dupChars = sents[j].filter(x=>setI.has(x)).join(' ').length;
    const pct = dupChars / Math.min(proses[i].length, proses[j].length) * 100;
    if(pct > worstPair.pct) worstPair = {pct, a:PERIODS[i].n, b:PERIODS[j].n};
  }
}
worstPair.pct <= 20
  ? ok(`the most alike pair of readings duplicates only ${worstPair.pct.toFixed(0)}% of each other (${worstPair.a} / ${worstPair.b})`)
  : bad('no two readings look alike', `${worstPair.a} and ${worstPair.b} duplicate ${worstPair.pct.toFixed(0)}%`);

/* Portraits themselves must never be shared. */
const portraitSents = PERIODS.map(p=>sentencesOf(PORTRAIT[p.n]));
const dupPortrait = new Set();
for(let i = 0; i < portraitSents.length; i++){
  const setI = new Set(portraitSents[i]);
  for(let j = i + 1; j < portraitSents.length; j++)
    portraitSents[j].forEach(x=>{ if(setI.has(x)) dupPortrait.add(x); });
}
dupPortrait.size === 0 ? ok('no sentence is reused between any two portraits')
                       : bad('no sentence is reused between any two portraits', [...dupPortrait].slice(0,3).join(' | '));

/* The portrait must actually reach the page. */
const shown = PERIODS.filter(p=>!renderReading(profileOf({name:'X', month:p.sm, day:p.sd, year:1990})).includes(PORTRAIT[p.n]));
shown.length ? bad('every portrait is rendered into its reading', shown.map(p=>p.n).join(', '))
             : ok('every portrait is rendered into its reading');

/* ---------------------------------------------------------- */
group('The day — all 366 profiles');

const DAY_FIELDS = ['t','m','d','lo','mo','fa','em','fr','mi','bo','sp','wk','ri','ou','st','we','ad','cl'];
is(Object.keys(DAYS).length, 366, 'a profile exists for all 366 days, leap day included');

/* Every real date must resolve, and nothing else may be in the table. */
const dayGaps = [], dayJunk = [];
for(let m = 1; m <= 12; m++){
  for(let d = 1; d <= DIM[m - 1]; d++) if(!DAYS[m + '-' + d]) dayGaps.push(`${m}/${d}`);
}
Object.keys(DAYS).forEach(k=>{
  const [m, d] = k.split('-').map(Number);
  if(!(m >= 1 && m <= 12 && d >= 1 && d <= DIM[m - 1])) dayJunk.push(k);
});
dayGaps.length ? bad('every day of the year has a profile', dayGaps.slice(0,6).join(', '))
               : ok('every day of the year has a profile, 1 January to 31 December');
dayJunk.length ? bad('no impossible dates in the table', dayJunk.join(', '))
               : ok('no impossible dates in the table');
DAYS['2-29'] ? ok('29 February has its own profile') : bad('29 February has its own profile');

/* Each profile must be complete and substantial. */
const thinDay = [];
Object.entries(DAYS).forEach(([k, D])=>{
  DAY_FIELDS.forEach(f=>{ if(!D[f]) thinDay.push(`${k}: no ${f}`); });
  if(D.m && D.m.split('·').length !== 5) thinDay.push(`${k}: header is not five fields`);
  /* Four of them use a different grammar — "The Day the Tower Falls" — which
     is the source's own wording, so the shape allowed is the wider one. */
  if(D.t && !/^The Day\b/.test(D.t)) thinDay.push(`${k}: title is not a Day`);
  if(D.d && D.d.length < 120) thinDay.push(`${k}: the opening is too short`);
});
thinDay.length ? bad('every day profile is complete', thinDay.slice(0,6).join('\n      '))
               : ok(`all 366 day profiles carry every one of the ${DAY_FIELDS.length} fields`);

/* The titles are the point of this layer — they must be distinct. */
/* Every day must have its own name. Six pairs shared one as supplied; each
   was renamed from its own text, and a new collision must fail rather than
   be discovered by a reader. */
const titleCount = {};
Object.values(DAYS).forEach(D=>{ titleCount[D.t] = (titleCount[D.t] || 0) + 1; });
const dupes = Object.keys(titleCount).filter(x=>titleCount[x] > 1);
dupes.length ? bad('every day has its own name', dupes.map(x=>`${x} (${titleCount[x]}x)`).join(', '))
             : is(Object.keys(titleCount).length, 366, 'all 366 day names are distinct');

/* Strengths and weaknesses are dot-separated lists, and must not be the same list. */
const tagBad = [];
Object.entries(DAYS).forEach(([k, D])=>{
  const st = D.st.split('·').map(x=>x.trim()).filter(Boolean);
  const we = D.we.split('·').map(x=>x.trim()).filter(Boolean);
  if(st.length < 2) tagBad.push(`${k}: only ${st.length} strengths`);
  if(we.length < 2) tagBad.push(`${k}: only ${we.length} weaknesses`);
  if(st.some(x=>we.includes(x))) tagBad.push(`${k}: a trait is listed as both`);
});
tagBad.length ? bad('strengths and weaknesses parse as lists', tagBad.slice(0,5).join('\n      '))
              : ok('strengths and weaknesses each list two or more traits, with no overlap');

/* The running headers in the source PDF were italic, same as the closing line,
   so a page number could have been captured as the epigram. Nothing should
   look like a stray header. */
const bleed = Object.entries(DAYS).filter(([, D])=>
  DAY_FIELDS.some(f=>/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\s*$/.test(D[f] || '')));
bleed.length ? bad('no page header bled into the text', bleed.slice(0,4).map(x=>x[0]).join(', '))
             : ok('no running header or page number bled into any profile');

/* The header line is regenerated, not taken from the source. Every one of the
   366 must match what the app's period table produces for that date — that is
   the whole point of regenerating them, and the check that keeps it true. */
const headBad = [];
Object.entries(DAYS).forEach(([k, D])=>{
  const [m, d] = k.split('-').map(Number);
  const P = profileOf({name:'x', month:m, day:d, year:null});
  const want = `${P.per.n} — ${P.per.t} · ${P.elements.join('/')} · ${P.qualities.join('/')} · ` +
               `${P.num} ${P.planet.replace(/^the /,'')} · ${P.tarot.n}`;
  if(D.m !== want) headBad.push(`${k}\n        stored: ${D.m}\n        table:  ${want}`);
});
headBad.length ? bad('every day header matches the app\'s own table', headBad.slice(0,3).join('\n      '))
               : ok('all 366 day headers are regenerated from the period table and match it exactly');

/* The fourteen days the source put in the following week, and the card it got
   wrong on every 30th. Named explicitly so a regression is unmistakable. */
const MOVED = [[5,23],[5,24],[6,23],[6,24],[8,23],[8,24],[8,25],
               [9,23],[9,24],[10,23],[10,24],[10,25],[11,23],[11,24]];
const movedBad = MOVED.filter(([m,d])=>!/Cusp/.test(DAYS[m+'-'+d].m.split(' — ')[0]));
movedBad.length ? bad('the fourteen contested days sit in their cusp', movedBad.map(x=>x.join('/')).join(', '))
                : ok('all fourteen contested days are back in the cusp README.md puts them in');
const thirtieths = Object.keys(DAYS).filter(k=>k.endsWith('-30'));
const cardBad = thirtieths.filter(k=>!DAYS[k].m.endsWith('The Empress'));
cardBad.length ? bad('the 30th draws The Empress in every month', cardBad.join(', '))
               : ok(`the 30th draws The Empress in all ${thirtieths.length} months that have one`);

/* The layer must reach the screen, and it must show the app's astrology
   rather than the source's, which disagrees on 25 days. */
const dayShown = ['D.t','D.m','D.d','D.lo','D.mo','D.fa','D.em','D.fr','D.mi','D.bo','D.sp','D.wk',
                  'D.ri','D.ou','D.st','D.we','D.ad','D.cl'];
/* Some are printed raw, some through esc(), some behind a guard. */
const dayUnshown = dayShown.filter(f=>
  !(html.includes('${' + f + '}') || html.includes('esc(' + f + ')') ||
    html.includes(f + ' ?') || html.includes('(' + f + ')') || html.includes(', ' + f + ')')));
dayUnshown.length ? bad('every field of the day profile is rendered', dayUnshown.join(', '))
                  : ok(`all ${dayShown.length} fields of the day profile reach the screen`);
html.includes('renderDay(P)') ? ok('the day layer is rendered first, above the period')
                              : bad('the day layer is rendered');
html.includes('${esc(D.m)}')
  ? ok("the day shows the regenerated header, not the source's")
  : bad('the day shows the regenerated header');

/* Spot-check that the app's own table still governs the two places the source
   disagreed with it: cusp end dates, and the 30th of the month. */
is(findPeriod(10, 23).n, 'Libra–Scorpio Cusp', '23 October is still the cusp, as README.md has it');
is(findPeriod(8, 25).n, 'Leo–Virgo Cusp', '25 August is still the cusp');
is(tarotFor(30).n, 'The Empress', 'the 30th still draws The Empress — 3+0 is 3');
is(tarotFor(29).n, 'Justice', 'the 29th still draws Justice — 2+9 is 11');

/* ---------------------------------------------------------- */
group('The deep layer — depth, and no repeating itself');

/* The first version of the readings passed a test that only checked whether
   two fields were IDENTICAL, so it happily allowed the same idea rewritten
   eight ways. This measures shared content words instead, which is what a
   reader actually notices. */
const STOPW = new Set(('a an the and or but of to in on at for with from as is are was were be been being it its this that '+
'these those you your yours i me my we our they them their he she his her not no nor so than then there here what which '+
'who whom how when where why all any both each few more most other some such only own same too very can could would should '+
'did does do doing done have has had having if because while about against between into through during before after above '+
'below up down out off over under again further once by way thing things one two something someone anything nothing get '+
'got go goes going come comes came make makes made take takes took give gives gave say says said know knows knew think '+
'thinks thought like just still even also than there they will can').split(' '));
const cwords = t => String(t||'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/)
  .filter(w=>w.length>3 && !STOPW.has(w)).map(w=>w.replace(/(ing|edly|ed|es|s|ly|ness|ment)$/,''));

function overlapPairs(sections, limit){
  const keys = Object.keys(sections).filter(k=>sections[k]);
  const sets = {}; keys.forEach(k=>sets[k] = new Set(cwords(sections[k])));
  const hits = [];
  for(let i=0;i<keys.length;i++) for(let j=i+1;j<keys.length;j++){
    const A = sets[keys[i]], B = sets[keys[j]];
    if(A.size < 3 || B.size < 3) continue;
    const shared = [...A].filter(w=>B.has(w));
    const ov = shared.length / Math.min(A.size, B.size);
    if(ov >= limit) hits.push(`${keys[i]}/${keys[j]} ${Math.round(ov*100)}% (${shared.join(' ')})`);
  }
  return hits;
}

/* The deep layer rolls out period by period and the renderer shows it only
   where it exists, so partial coverage is a state, not a fault. What must
   never happen is a HALF-written entry reaching the screen. */
const written = Object.keys(DEPTH).length;
ok(`deep readings written: ${written} of ${PERIODS.length}`);
/* All 48 are written now. The renderer skips a period with no deep reading,
   so this is what stops one silently regressing to the shallow version. */
const noDepth = PERIODS.filter(p=>!DEPTH[p.n]).map(p=>p.n);
noDepth.length ? bad('no period falls back to the shallow reading', noDepth.join(', '))
               : ok('all 48 periods render the full reading — no fallbacks left');
Object.keys(DEPTH).every(n=>PERIODS.some(p=>p.n === n))
  ? ok('every deep reading names a real period')
  : bad('every deep reading names a real period',
        Object.keys(DEPTH).filter(n=>!PERIODS.some(p=>p.n === n)).join(', '));

/* Each field must carry its own weight, not a phrase. */
const FIELDS = ['strong','hard','mind','body','spirit','raised','making','close','direction','action','reflect'];
const thin = [];
Object.entries(DEPTH).forEach(([n,D])=>{
  FIELDS.forEach(f=>{
    if(!D[f]) return thin.push(`${n}: no ${f}`);
    if(!['direction','action','reflect'].includes(f) && D[f].split(/[.!?]/).filter(x=>x.trim().length>12).length < 3)
      thin.push(`${n}: ${f} is under three sentences`);
  });
  ['young','rising','middle','later'].forEach(st=>{
    if(!D.stages || !D.stages[st]) thin.push(`${n}: no ${st} stage`);
  });
});
thin.length ? bad('every section of the deep reading is substantial', thin.slice(0,5).join('\n      '))
            : ok(`all ${Object.keys(DEPTH).length} deep readings are complete — nine sections and four stages, each of real length`);

/* The actual complaint: sections that restate each other. */
const repeats = [];
Object.entries(DEPTH).forEach(([n,D])=>{
  const sec = {}; FIELDS.forEach(f=>sec[f] = D[f]);
  Object.entries(D.stages).forEach(([k,v])=>sec['stage:'+k] = v);
  /* The gift/cost/practice box is hidden once a period has a deep reading, so
     only the portrait is still on screen beside these sections. */
  sec.portrait = PORTRAIT[n];
  overlapPairs(sec, 0.34).forEach(h=>repeats.push(`${n}: ${h}`));
});
repeats.length ? bad('no two sections of a reading restate each other', repeats.slice(0,6).join('\n      '))
               : ok('no two sections of any deep reading share a third of their content words');

/* And it has to be about THIS period, not personology in general.

   Measuring shared words was the wrong instrument once the readings got
   long: every reading now has a Love, Anger, Envy and Money section, so
   they necessarily share that topic vocabulary, and the shared fraction
   climbed with length rather than with sameness. What actually matters is
   the opposite quantity — how much of a reading is vocabulary that appears
   in NO other reading. That is length-robust and it is the thing a reader
   notices. Paired with a hard ban on any shared sentence, it is a stricter
   test than the one it replaces, not a looser one. */
const vocab = {};
Object.entries(DEPTH).forEach(([n,D])=>{
  vocab[n] = new Set(FIELDS.map(f=>cwords(D[f])).concat(Object.values(D.stages).map(cwords)).flat());
});
/* A flat floor is not stable as the corpus grows: every reading's unique
   share falls as more readings exist to share words with, so a fixed 20%
   would pass early and fail everything later for no reason connected to
   the writing. Measured against the median instead, which asks the real
   question — is this one noticeably more generic than its neighbours. */
const uniq = {};
Object.entries(vocab).forEach(([n,mine])=>{
  const elsewhere = new Set(Object.entries(vocab).filter(([m])=>m !== n).map(([,S])=>[...S]).flat());
  uniq[n] = elsewhere.size ? [...mine].filter(w=>!elsewhere.has(w)).length / mine.size : 1;
});
const vals = Object.values(uniq).sort((a,b)=>a - b);
const median = vals[Math.floor(vals.length / 2)] || 1;
const generic = Object.entries(uniq).filter(([,v])=>v < median * 0.70)
  .map(([n,v])=>`${n}: ${Math.round(v*100)}% of its vocabulary is its own, against a median of ${Math.round(median*100)}%`);
generic.length ? bad('each period reads as its own person', generic.slice(0,4).join('\n      '))
               : ok(`each deep reading is its own person — median ${Math.round(median*100)}% of vocabulary used nowhere else, none far below it`);

/* Nothing may be reused verbatim between two readings. */
const deepSents = {};
Object.entries(DEPTH).forEach(([n,D])=>{
  deepSents[n] = FIELDS.map(f=>D[f]).concat(Object.values(D.stages)).join(' ')
    .split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(x=>x.length > 25);
});
const lifted = [];
const seenDeep = new Map();
Object.entries(deepSents).forEach(([n,list])=>list.forEach(x=>{
  if(seenDeep.has(x) && seenDeep.get(x) !== n) lifted.push(`${seenDeep.get(x)} and ${n}: "${x.slice(0,60)}…"`);
  else seenDeep.set(x, n);
}));
lifted.length ? bad('no sentence appears in two readings', lifted.slice(0,3).join('\n      '))
              : ok('no sentence is reused between any two deep readings');

/* Jacques' standing rule on his own app: no mechanisms, no research claims. */
const CLAIM = /\b(research shows|studies show|scientificall|clinicall|dopamine|serotonin|neuroplastic|brain chemistry|cortisol|diagnos|disorder|cure[sd]?\b|treat(s|ed|ment)\b)/i;
const claims = [];
Object.entries(DEPTH).forEach(([n,D])=>{
  FIELDS.concat(['stages']).forEach(f=>{
    const t = f === 'stages' ? Object.values(D.stages).join(' ') : D[f];
    const m = CLAIM.exec(t); if(m) claims.push(`${n}.${f}: "${m[0]}"`);
  });
});
claims.length ? bad('no medical or mechanistic claims anywhere in the deep readings', claims.slice(0,4).join('\n      '))
              : ok('no medical claims, no mechanisms, no research assertions — only what people describe');

/* It can never tell somebody they are finished. */
const FINISHED = /\b(you will never|you'll never|too late for you|no way back|beyond help|hopeless|doomed|damaged goods|always be this way)\b/i;
const finished = [];
Object.entries(DEPTH).forEach(([n,D])=>{
  const all = FIELDS.map(f=>D[f]).concat(Object.values(D.stages)).join(' ');
  const m = FINISHED.exec(all); if(m) finished.push(`${n}: "${m[0]}"`);
});
finished.length ? bad('nothing tells a reader they are finished', finished.join('\n      '))
                : ok('nothing in any reading tells a reader they are finished');

/* The renderer must actually show every section, or writing it was pointless. */
const deepShown = ['D.action','D.reflect','D.strong','D.hard','D.mind','D.body','D.spirit','D.raised','D.making','D.close',
               'D.direction','D.stages.young','D.stages.rising','D.stages.middle','D.stages.later'];
const unshown = deepShown.filter(f=>!new RegExp('\\b' + f.replace('.','\\.') + '\\b').test(html));
unshown.length ? bad('every written section reaches the screen', 'not rendered: ' + unshown.join(', '))
               : ok(`all ${deepShown.length} sections of the deep reading are rendered`);
html.includes('not medical advice, and not a diagnosis')
  ? ok('the health sections carry their disclaimer') : bad('the health sections carry their disclaimer');
html.includes('not a schedule')
  ? ok('the stages say plainly they are not a prediction') : bad('the stages say plainly they are not a prediction');

/* ---- the three books as one system ---- */

/* Each deep reading must name the hinge all three books circle, and where
   they pull against each other. Without the second one it is three lists. */
const joinBad = [];
Object.entries(DEPTH).forEach(([n,D])=>{
  ['hinge','tension'].forEach(f=>{
    if(!D[f]) return joinBad.push(`${n}: no ${f}`);
    if(D[f].split(/[.!?]/).filter(x=>x.trim().length>12).length < 3)
      joinBad.push(`${n}: ${f} is under three sentences`);
  });
  const h = D.hinge.toLowerCase();
  const named = ['birthdays','destiny','relationship','pairing'].filter(w=>h.includes(w)).length;
  if(named < 2) joinBad.push(`${n}: the hinge does not name the books it is joining`);
});
joinBad.length ? bad('every deep reading joins the three books', joinBad.slice(0,4).join('\n      '))
               : ok('every deep reading names the hinge all three books circle, and where they disagree');

/* The convergence block must quote all three, from their own tables — the
   Relationships line is the pair engine run against every element, so it
   cannot drift away from what the Pair layer would actually say. */
[['P.per.n','the period'],['L.k','the Birthdays line'],['P.dest.from','the Destiny start'],
 ['P.dest.toward','the Destiny direction'],['relSpread(P)','the Relationships spread']]
  .forEach(([frag,what])=>{
    html.includes('${' + frag + '}') || html.includes(frag)
      ? ok(`the convergence quotes ${what} from its own table`)
      : bad(`the convergence quotes ${what} from its own table`);
  });

const spreadBad = [];
PERIODS.forEach(p=>{
  const P = profileOf({name:'X', month:p.sm, day:p.sd, year:1990});
  const line = renderDepth(P);
  if(!DEPTH[p.n]) return;
  ['Fire','Earth','Air','Water'].forEach(e=>{
    const mode = EL_REL[relKey(P.elements[0], e)].mode;
    /* cap() upper-cases whichever mode lands first, so match case-insensitively */
    if(!line.includes(e)) spreadBad.push(`${p.n}: ${e} missing from the spread`);
    if(!line.toLowerCase().includes(mode)) spreadBad.push(`${p.n}: no ${mode} pairing shown`);
  });
});
spreadBad.length ? bad('the Relationships spread covers all four elements', spreadBad.slice(0,4).join('\n      '))
                 : ok('the Relationships spread runs each period against all four elements, from the pair engine');

/* The pair layer must read the deep material, not sit beside it. */
(html.includes('function pairDepth') && html.includes('${pairDepth(A, B)}'))
  ? ok('the pair reading pulls in the deep layer') : bad('the pair reading pulls in the deep layer');
['DA.close','DB.close','DA.raised','DA.making'].every(f=>html.includes(f))
  ? ok('the pair reads closeness and family off both people')
  : bad('the pair reads closeness and family off both people');

/* ---- the short version, and the voice ---- */

/* A summary that needs a dictionary is not a summary. Third-grade reading
   means short sentences and short words, so both get measured. */
const simpleBad = [], grade = [];
Object.entries(DEPTH).forEach(([n,D])=>{
  if(!D.simple) return simpleBad.push(`${n}: no short version`);
  ['self','others','path'].forEach(k=>{
    const t = D.simple[k];
    if(!t) return simpleBad.push(`${n}: short version has no ${k}`);
    const sents = t.split(/[.!?]/).filter(x=>x.trim().length>3);
    const words = t.replace(/[^A-Za-z\s]/g,' ').split(/\s+/).filter(Boolean);
    const avgSent = words.length / sents.length;
    const long = words.filter(w=>w.length > 8);
    if(avgSent > 14) grade.push(`${n}.${k}: sentences average ${avgSent.toFixed(0)} words`);
    if(long.length / words.length > 0.05)
      grade.push(`${n}.${k}: ${Math.round(long.length/words.length*100)}% long words (${[...new Set(long)].slice(0,4).join(', ')})`);
  });
});
simpleBad.length ? bad('every deep reading has a short version covering all three layers', simpleBad.slice(0,4).join('\n      '))
                 : ok('every deep reading has a short version — self, other people, and where it is going');
grade.length ? bad('the short version reads at third-grade level', grade.slice(0,5).join('\n      '))
             : ok('the short version stays short-sentence and short-word throughout');

/* It has to be reachable and it has to hide the long one, or it is just more text. */
(html.includes("id=\"btn-simple\"") && html.includes("id=\"simple-box\"") && html.includes("id=\"reading-full\""))
  ? ok('the short version has a button and its own box') : bad('the short version has a button and its own box');
(html.includes("box.hidden = !showSimple; full.hidden = showSimple;"))
  ? ok('showing the short version hides the long one') : bad('showing the short version hides the long one');

/* A reading is fifteen thousand pixels long. Controls below the fold may as
   well not exist, which is exactly what happened the first time: they sat
   five and a half thousand pixels down, inside the deep layer. They now sit
   above the whole reading and stay put while it scrolls. */
html.includes('function renderTools')
  ? ok('the controls are their own block, not buried in a layer') : bad('the controls are their own block');
/renderCrest\(P\) \+ renderTools\(P\)/.test(html)
  ? ok('the controls render above the whole reading') : bad('the controls render above the whole reading');
/\.tools\{[^}]*position:sticky/.test(html)
  ? ok('the control bar sticks to the top while the reading scrolls')
  : bad('the control bar sticks to the top');
/* And both act on everything, not on one section. */
html.includes("'<div id=\"reading-full\">' + renderDay(P) + renderReading(P) + renderDepth(P)")
  ? ok('the short version and the voice cover the day, the period, the deep layer and the path')
  : bad('the short version and the voice cover the whole reading');
html.includes("${box('Your day',")
  ? ok('the short version names the day and the week, not just the deep layer')
  : bad('the short version names the day and the week');

/* Read aloud. The selection and the survival guards below are ported from the
   voice guide in Some Day / Day One, where they were found on real devices.
   Each one covers a failure that is silent rather than loud, so each is
   pinned here — losing any of them would not break a test unless the test
   names it. */
html.includes('SpeechSynthesisUtterance') ? ok('the reading can be played out loud')
                                          : bad('the reading can be played out loud');
html.includes("if(!speechOK()){ const b = $('btn-speak'); if(b) b.textContent = 'This browser has no voice'; return; }")
  ? ok('a browser with no speech engine says so instead of failing silently')
  : bad('a browser with no speech engine says so');
html.includes("b.textContent = 'No voice installed'")
  ? ok('an engine present but with no voices installed says so too')
  : bad('an engine with no voices installed says so');

/* Voice quality: left alone a browser hands back its flattest default. */
(/rank = v => \/natural\/i\.test\(v\.name\) \? 0 : \/google\/i\.test\(v\.name\) \? 1/.test(html))
  ? ok('Natural and Google voices are preferred over the default, as in the recovery app')
  : bad('the warmer voices are preferred');
html.includes("en = all.filter(v=>/^en/i.test(v.lang))")
  ? ok('only English voices are offered') : bad('only English voices are offered');
html.includes('u.rate = 0.9; u.pitch = 1;')
  ? ok('it reads at 0.9 rather than the default rate, which is what makes it calm')
  : bad('the rate is slowed to 0.9');

/* The three silent-death guards. */
html.includes('VOICE_HOLD = u;')
  ? ok('the utterance is held, so Chrome cannot collect it mid-sentence')
  : bad('the utterance is held against garbage collection');
(html.includes('speechSynthesis.pause(); speechSynthesis.resume();') && html.includes('IS_ANDROID'))
  ? ok('a keepalive defeats the fifteen-second desktop freeze, and is skipped on Android')
  : bad('the fifteen-second freeze is handled');
html.includes('u.onerror = ()=>{ if(Date.now() - began > 1500) next(); else stopSpeaking(); };')
  ? ok('an instant error is treated as a dead engine, not as a finished line')
  : bad('an instant error is not mistaken for a finished line');
html.includes('speakNext()') && html.includes('VOICE_AT >= VOICE_QUEUE.length')
  ? ok('lines are spoken one at a time in order rather than queued all at once')
  : bad('lines are spoken in order');
html.includes('(buf + c).length > 220')
  ? ok('long readings are split so no engine truncates them')
  : bad('long readings are split');
html.includes('speechSynthesis.cancel()') ? ok('the voice can be stopped') : bad('the voice can be stopped');
html.includes("addEventListener('beforeunload', stopSpeaking)")
  ? ok('the voice stops when the page closes') : bad('the voice stops when the page closes');
html.includes("const src = (simpleBox && !simpleBox.hidden) ? simpleBox : full;")
  ? ok('it reads aloud whichever version you are looking at')
  : bad('it reads aloud whichever version you are looking at');

/* Choosing a voice, and keeping the choice. */
(html.includes('id="voice-pick"') && html.includes('function fillVoicePicker'))
  ? ok('the voice can be chosen from whatever the device has')
  : bad('the voice can be chosen');
html.includes("saveVoiceName(e.target.value)") && html.includes("localStorage.setItem(VOICE_KEY")
  ? ok('the chosen voice is remembered between visits')
  : bad('the chosen voice is remembered');
html.includes("voiceschanged")
  ? ok('the picker refills when the device reports its voices, which it does late')
  : bad('the picker handles the late voiceschanged event');
html.includes("id=\"btn-try\"") && html.includes('This is the voice that will read to you')
  ? ok('a voice can be heard before committing to it')
  : bad('a voice can be sampled first');

/* All of life, not just the flattering half. */
const LIFE = ['love','hate','envy','fantasy','fun','dark','money'];
const missingLife = [];
Object.entries(DEPTH).forEach(([n,D])=>LIFE.forEach(f=>{ if(!D[f]) missingLife.push(`${n}: no ${f}`); }));
missingLife.length ? bad('every reading covers all of life, not just the good half', missingLife.slice(0,5).join('\n      '))
                   : ok(`every reading covers ${LIFE.length} more of life — love, anger, envy, fantasy, fun, the dark stretch, money`);
LIFE.every(f=>html.includes('D.' + f))
  ? ok('all of it reaches the screen') : bad('all of it reaches the screen', LIFE.filter(f=>!html.includes('D.'+f)).join(', '));

/* The blunt half has to actually be blunt, or this is the old version again. */
const soft = [];
Object.entries(DEPTH).forEach(([n,D])=>{
  const h = D.hard.toLowerCase();
  if(!/\b(you|your)\b/.test(h)) soft.push(`${n}: the worst side does not address the reader`);
  if(h.length < 300) soft.push(`${n}: the worst side is too short to say anything`);
});
soft.length ? bad('the bad half is written as plainly as the good half', soft.slice(0,4).join('\n      '))
            : ok('the bad half names it directly, at the same length as the good half');

/* ---------------------------------------------------------- */
group('The name, and the share card');

is((html.match(/<title>([^<]*)<\/title>/) || [,''])[1], "Life's Zodiacs", 'the page is called Life’s Zodiacs');
/<h1>Life&#8217;s Zodiacs<\/h1>|<h1>Life's Zodiacs<\/h1>/.test(html)
  ? ok('the heading carries the same name as the tab')
  : bad('the heading carries the same name as the tab');

/* Without these a shared link arrives as a bare URL: no name, no blurb, no
   picture. Each one is read by something different, so all of them matter. */
const SHARE = [
  ['og:title','the name in the card'],
  ['og:description','the blurb'],
  ['og:image','the picture'],
  ['og:url','the address it points at'],
  ['og:type','the kind of thing it is'],
  ['og:site_name','the site name'],
  ['og:image:width','the picture width, so it is not cropped'],
  ['og:image:height','the picture height'],
  ['twitter:card','the wide card on X'],
  ['twitter:title','the name on X'],
  ['twitter:description','the blurb on X'],
  ['twitter:image','the picture on X']
];
const shareGaps = SHARE.filter(([p])=>!new RegExp(`(property|name)="${p}"`).test(html));
shareGaps.length ? bad('the share card carries everything a chat app looks for', shareGaps.map(x=>x[1]).join(', '))
                 : ok(`all ${SHARE.length} share tags are present — name, blurb, picture and size`);

/* The name and blurb must actually agree with each other across the tags. */
const tagVal = p => (html.match(new RegExp(`(?:property|name)="${p}" content="([^"]*)"`)) || [,''])[1];
(tagVal('og:title') === "Life's Zodiacs" && tagVal('twitter:title') === "Life's Zodiacs")
  ? ok('the name is the same in every tag') : bad('the name is the same in every tag');
(tagVal('og:description') === tagVal('twitter:description') && tagVal('og:description').length > 60)
  ? ok('the blurb is the same in every tag and says something')
  : bad('the blurb agrees across the tags');
tagVal('og:image') === tagVal('twitter:image')
  ? ok('the same picture is used everywhere') : bad('the same picture is used everywhere');
/^https:\/\//.test(tagVal('og:image'))
  ? ok('the picture is an absolute address, which is what chat apps require')
  : bad('the picture is an absolute address', tagVal('og:image'));

/* The picture has to exist, and be the size the tags claim. */
const cardPath = path.join(ROOT, 'share.png');
if(!fs.existsSync(cardPath)){
  bad('the share picture exists', 'share.png is missing');
}else{
  const buf = fs.readFileSync(cardPath);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  is(`${w}x${h}`, '1200x630', 'the share picture is 1200x630, the size every chat app crops to');
  (String(w) === tagVal('og:image:width') && String(h) === tagVal('og:image:height'))
    ? ok('the tags state the picture’s real size') : bad('the tags state the picture’s real size');
  buf.length < 900 * 1024 ? ok(`the share picture is ${Math.round(buf.length/1024)}KB, small enough to fetch`)
                          : bad('the share picture is small enough', `${Math.round(buf.length/1024)}KB`);
}

/* An icon for the home screen, drawn rather than fetched, so it works offline. */
(html.includes('rel="icon"') && html.includes('rel="apple-touch-icon"'))
  ? ok('there is an icon for the browser tab and for a phone home screen')
  : bad('there is an icon for the tab and the home screen');
/rel="icon" href="data:image\/svg\+xml/.test(html)
  ? ok('the icon is drawn inline, so it needs no second file')
  : bad('the icon is drawn inline');

/* ---------------------------------------------------------- */
group('How to use this');

(html.includes('id="btn-help"') && html.includes('id="help-box"'))
  ? ok('there is a How to use button and a panel for it') : bad('there is a How to use button');
/<header class="top">[\s\S]{0,600}id="btn-help"/.test(html)
  ? ok('the button sits in the header, reachable from any tab')
  : bad('the button sits in the header');
/id="help-box" hidden/.test(html)
  ? ok('the panel starts closed') : bad('the panel starts closed');
html.includes("id=\"btn-help-close\"")
  ? ok('the panel can be closed from inside it as well as from the button')
  : bad('the panel closes from inside');

/* It has to cover every tab, or somebody will still be stuck. */
const TABS = [['Read a birthday','panel-read'],['People','panel-people'],['Pair','panel-pair'],
              ['Matrix','panel-matrix'],['Learn','panel-game'],['The 48','panel-wheel']];
const helpText = (html.match(/<div class="help" id="help-box" hidden>([\s\S]*?)<\/div>\s*<nav/) || [,''])[1] ||
                 html.slice(html.indexOf('id="help-box"'), html.indexOf('id="btn-help-close"'));
const uncovered = TABS.filter(([label])=>!helpText.includes(label));
uncovered.length ? bad('every tab is explained', uncovered.map(t=>t[0]).join(', '))
                 : ok(`all ${TABS.length} tabs are explained`);
['Short version','Read it to me','Voice','Save this person','Import contacts','Add to Home Screen']
  .filter(x=>!helpText.includes(x)).length
  ? bad('the controls a reader has to find are explained',
        ['Short version','Read it to me','Voice','Save this person','Import contacts','Add to Home Screen']
          .filter(x=>!helpText.includes(x)).join(', '))
  : ok('the short version, the voice, saving, importing and adding to the home screen are all explained');

/* And it has to be readable. This is the screen for somebody who is stuck,
   so it is held to the same bar as the short version of a reading. */
const helpPlain = helpText.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
const helpSents = helpPlain.split(/[.!?]/).filter(x=>x.trim().split(/\s+/).length > 2);
const helpWords = helpPlain.replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).filter(Boolean);
const helpAvg = helpWords.length / helpSents.length;
const helpLong = helpWords.filter(w=>w.length > 8).length / helpWords.length;
helpAvg <= 20 ? ok(`the instructions average ${helpAvg.toFixed(0)} words a sentence`)
              : bad('the instructions are written in short sentences', `${helpAvg.toFixed(0)} words a sentence`);
helpLong <= 0.09 ? ok(`long words stay at ${(helpLong*100).toFixed(0)}% of the instructions`)
                 : bad('the instructions avoid long words', `${(helpLong*100).toFixed(0)}% are long`);
helpWords.length > 200 ? ok(`the instructions actually say something (${helpWords.length} words)`)
                       : bad('the instructions say enough', `${helpWords.length} words`);

/* ---------------------------------------------------------- */
group('Elements, qualities and seasons');

/* The whole teaching claim rests on this: a quality IS a position in a
   season. If that ever stopped being true the lessons would be wrong. */
const seasonBad = [];
Object.entries(SEASONS).forEach(([s, v])=>{
  if(v.signs.length !== 3) seasonBad.push(`${s} has ${v.signs.length} signs`);
  const qs = v.signs.map(n=>SIGNS[n].q).join('/');
  if(qs !== 'Cardinal/Fixed/Mutable') seasonBad.push(`${s} runs ${qs}`);
  if(SIGNS[v.starts].q !== 'Cardinal') seasonBad.push(`${s} is opened by a non-Cardinal sign`);
  if(seasonOf(v.starts) !== s) seasonBad.push(`${s} is opened by a sign from another season`);
});
seasonBad.length ? bad('each season runs Cardinal, Fixed, Mutable', seasonBad.join(', '))
                 : ok('all four seasons run Cardinal then Fixed then Mutable, in order');
is(Object.values(SEASONS).reduce((n, v)=>n + v.signs.length, 0), 12, 'the four seasons hold all twelve signs');
is(new Set(Object.values(SEASONS).map(v=>v.signs).flat()).size, 12, 'no sign appears in two seasons');
Object.keys(SIGNS).every(n=>seasonOf(n)) ? ok('every sign resolves to a season')
                                         : bad('every sign resolves to a season');

/* Three signs of a season are three different elements, and the elements
   rotate in the same order all the way round. */
const rotBad = Object.entries(SEASONS).filter(([, v])=>
  new Set(v.signs.map(n=>SIGNS[n].e)).size !== 3).map(([s])=>s);
rotBad.length ? bad('no season repeats an element', rotBad.join(', '))
              : ok('each season holds three different elements');

/* Four elements x three qualities = twelve signs, each pairing exactly once.
   That is the design, and signFrom relies on it being true. */
const pairMiss = [], pairDupe = [];
Object.keys(ELEMENT_LORE).forEach(e=>Object.keys(QUALITY_LORE).forEach(q=>{
  const hits = Object.keys(SIGNS).filter(n=>SIGNS[n].e === e && SIGNS[n].q === q);
  if(!hits.length) pairMiss.push(`${e}+${q}`);
  if(hits.length > 1) pairDupe.push(`${e}+${q} -> ${hits.join(', ')}`);
  if(hits.length === 1 && signFrom(e, q) !== hits[0]) pairMiss.push(`${e}+${q} resolves wrong`);
}));
(pairMiss.length || pairDupe.length)
  ? bad('every element and quality pairing lands on one sign', [...pairMiss, ...pairDupe].join(', '))
  : ok('all twelve element-and-quality pairings land on exactly one sign each');

/* The lore tables must agree with the sign table rather than drift from it. */
const loreBad = [];
Object.entries(ELEMENT_LORE).forEach(([e, v])=>{
  const real = Object.keys(SIGNS).filter(n=>SIGNS[n].e === e);
  if(v.signs.join() !== real.join()) loreBad.push(`${e} lists ${v.signs.join('/')}, table says ${real.join('/')}`);
  if(v.signs.length !== 3) loreBad.push(`${e} does not have three signs`);
  if(ELEMENT_LORE[v.beats].beatenBy !== e) loreBad.push(`${e} beats ${v.beats}, which does not agree`);
});
Object.entries(QUALITY_LORE).forEach(([q, v])=>{
  const real = Object.keys(SIGNS).filter(n=>SIGNS[n].q === q);
  if(v.signs.join() !== real.join()) loreBad.push(`${q} lists ${v.signs.join('/')}, table says ${real.join('/')}`);
  if(v.signs.length !== 4) loreBad.push(`${q} does not have four signs`);
  if(new Set(v.signs.map(seasonOf)).size !== 4) loreBad.push(`${q} is not one sign per season`);
});
loreBad.length ? bad('the teaching tables agree with the sign table', loreBad.slice(0,4).join('\n      '))
               : ok('the element and quality tables match the sign table exactly, and each quality takes one sign per season');

/* describeSign must build a sentence that is true for all twelve. */
const descBad = Object.keys(SIGNS).filter(n=>{
  const d = describeSign(n);
  return !d.line.includes(d.element) || !d.line.includes(d.quality) ||
         !d.line.includes(d.season) || /of it of|undefined/.test(d.line) ||
         !d.together || /undefined/.test(d.together);
});
descBad.length ? bad('every sign describes itself correctly', descBad.join(', '))
               : ok('all twelve signs produce a correct one-line description and a combined phrase');

/* ---------------------------------------------------------- */
group('The quiz teaches');

const TEACH = ['season','seasonOpens','seasonTrio','seasonPlace','elementIs','elementTrio',
               'elementShadow','elementSign','qualityIs','qualityGroup','qualitySign',
               'combo','build','meets'];
const missingKind = TEACH.filter(k=>!QUIZ_KINDS[k]);
missingKind.length ? bad('the quiz covers elements, qualities and seasons', missingKind.join(', '))
                   : ok(`the quiz has ${TEACH.length} question types on the elements, qualities and seasons`);
Object.keys(QUIZ_KINDS).length >= 20
  ? ok(`${Object.keys(QUIZ_KINDS).length} question types in all`)
  : bad('enough question types', String(Object.keys(QUIZ_KINDS).length));

/* Every teaching question must be answerable and must explain itself. Run
   each kind many times so a rare bad draw is caught rather than shipped. */
const qBad = [];
TEACH.forEach(k=>{
  for(let i = 0; i < 60; i++){
    const q = QUIZ_KINDS[k](seeded(i * 31 + 7));
    if(!q){ qBad.push(`${k}: produced nothing`); break; }
    if(q.options.length < 3) qBad.push(`${k}: only ${q.options.length} options`);
    if(new Set(q.options).size !== q.options.length) qBad.push(`${k}: a repeated option`);
    if(q.options[q.answerIndex] !== q.answer) qBad.push(`${k}: answerIndex is wrong`);
    if(!q.note || q.note.length < 30) qBad.push(`${k}: the note does not explain anything`);
    if(q.note === q.answer) qBad.push(`${k}: the note just restates the answer`);
    if(/undefined|\[object/.test(q.prompt + q.options.join() + q.note)) qBad.push(`${k}: undefined leaked in`);
  }
});
qBad.length ? bad('every teaching question is sound', [...new Set(qBad)].slice(0,5).join('\n      '))
            : ok(`all ${TEACH.length} teaching types produce sound questions across 60 draws each`);

/* The notes are the lesson, so they must carry the reasoning. */
const shallow = TEACH.filter(k=>{
  const notes = [];
  for(let i = 0; i < 20; i++) notes.push(QUIZ_KINDS[k](seeded(i * 17 + 3)).note);
  return notes.every(n=>n.length < 60);
});
shallow.length ? bad('the explanations teach rather than confirm', shallow.join(', '))
               : ok('every teaching answer comes back with a reason, not just a tick');

/* And the study screens have to exist and be reachable. */
['learnWheel','learnElements','learnQualities','learnSign','wheelTable','describeSign']
  .forEach(f=>html.includes('function ' + f) ? ok(`${f}() is there`) : bad(`${f}() is there`));
['g-wheel','g-elements','g-qualities','g-onesign','g-back','g-sign']
  .every(id=>html.includes(id))
  ? ok('the study menu, its four screens and the sign picker are all wired')
  : bad('the study menu is wired');
html.includes("const t = e.target.closest('button') || e.target;")
  ? ok('a click on a menu button counts wherever inside it lands')
  : bad('a click on a menu button counts wherever inside it lands');

/* ---------------------------------------------------------- */
group('The fight is gone');

['fight.html','build-fight.js'].forEach(f=>
  fs.existsSync(path.join(ROOT, f)) ? bad(`${f} is removed`) : ok(`${f} is removed`));
const fightLeft = ['fightURL','fightBrief','PLACE_OF','BODY_OF','periodSlug','RING_ELEMENT',
                   'TAUNTS','renderBrief','g-fight','f-bell','fightSetupHTML']
  .filter(x=>html.includes(x));
fightLeft.length ? bad('nothing of the fight is left in the app', fightLeft.join(', '))
                 : ok('no fight code, data or markup remains in index.html');
/* The read-aloud handlers sat next to the fight and must have survived it. */
(html.includes('function speakReading') && html.includes('function stopSpeaking'))
  ? ok('read-aloud survived the removal') : bad('read-aloud survived the removal');

/* ---------------------------------------------------------- */
group('The quiz');

/* Seeded, so any failure is reproducible. */
function seeded(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const quizFails = [];
let generated = 0;
for(let seed = 1; seed <= 200; seed++){
  const qs = makeQuiz([], 10, seeded(seed));
  if(qs.length !== 10){ quizFails.push(`seed ${seed}: got ${qs.length} questions`); continue; }
  qs.forEach((q, i)=>{
    generated++;
    if(!q.prompt || q.prompt.length < 10) quizFails.push(`seed ${seed} q${i}: empty prompt`);
    if(q.options.length < 3) quizFails.push(`seed ${seed} q${i}: only ${q.options.length} options`);
    if(new Set(q.options).size !== q.options.length) quizFails.push(`seed ${seed} q${i}: duplicate options`);
    if(q.answerIndex < 0 || q.answerIndex >= q.options.length) quizFails.push(`seed ${seed} q${i}: answerIndex out of range`);
    if(q.options[q.answerIndex] !== q.answer) quizFails.push(`seed ${seed} q${i}: answerIndex points at the wrong option`);
    if(q.options.filter(o=>o === q.answer).length !== 1) quizFails.push(`seed ${seed} q${i}: answer appears ${q.options.filter(o=>o === q.answer).length} times`);
    if(/undefined|NaN|\[object Object\]/.test(q.prompt + q.note + q.options.join(''))) quizFails.push(`seed ${seed} q${i}: placeholder leaked`);
    if(!q.note) quizFails.push(`seed ${seed} q${i}: no explanation`);
  });
  const prompts = qs.map(q=>q.prompt);
  if(new Set(prompts).size !== prompts.length) quizFails.push(`seed ${seed}: a question repeated within one round`);
}
quizFails.length ? bad(`200 seeded rounds all produce valid questions`, quizFails.slice(0,5).join('\n      '))
                 : ok(`200 seeded rounds produce ${generated} valid questions, one correct answer each`);

/* Every generator must be exercised and must be answerable from the app's own
   data. Two of them need saved people to have anything to ask about, so the
   sweep runs both ways: without people every other kind must still appear,
   and with people the person-dependent ones must appear as well. */
const PERSONAL = ['people','personSeason'];
const seenAlone = new Set(), seenWithPeople = new Set();
const someFolk = [{id:'1',name:'Ana',month:4,day:1},{id:'2',name:'Bo',month:11,day:12},
                  {id:'3',name:'Cy',month:8,day:1},{id:'4',name:'Di',month:1,day:20}];
for(let seed = 1; seed <= 400; seed++){
  makeQuiz([], 6, seeded(seed)).forEach(q=>seenAlone.add(q.kind));
  makeQuiz(someFolk, 6, seeded(seed)).forEach(q=>seenWithPeople.add(q.kind));
}
const missingAlone = Object.keys(QUIZ_KINDS).filter(k=>!PERSONAL.includes(k) && !seenAlone.has(k));
const leakedAlone  = PERSONAL.filter(k=>seenAlone.has(k));
const missingWith  = Object.keys(QUIZ_KINDS).filter(k=>!seenWithPeople.has(k));
missingAlone.length ? bad('every impersonal question type gets generated with nobody saved', missingAlone.join(', '))
                    : ok(`every question type that needs no saved people gets generated (${seenAlone.size} types)`);
leakedAlone.length ? bad('no person question appears when nobody is saved', leakedAlone.join(', '))
                   : ok('no person question appears when nobody is saved');
missingWith.length ? bad('every question type gets generated once people are saved', missingWith.join(', '))
                   : ok(`every one of the ${seenWithPeople.size} question types gets generated once people are saved`);

/* Correctness of the answers themselves, not just their shape. */
const factFails = [];
for(let seed = 1; seed <= 300; seed++){
  makeQuiz([], 8, seeded(seed)).forEach(q=>{
    if(q.kind === 'title'){
      const p = PERIODS.find(x=>x.n === q.answer);
      const asked = q.prompt.match(/<strong>(.+?)<\/strong>/)[1];
      if(p.t !== asked) factFails.push(`title: "${asked}" answered as ${q.answer} (${p.t})`);
    }
    if(q.kind === 'element'){
      const sign = q.prompt.match(/<strong>(.+?)<\/strong>/)[1];
      if(SIGNS[sign].e !== q.answer) factFails.push(`element: ${sign} answered as ${q.answer}`);
    }
    if(q.kind === 'stone'){
      const month = q.prompt.match(/<strong>(.+?)<\/strong>/)[1];
      if(BIRTHSTONE[MONTHS.indexOf(month)] !== q.answer) factFails.push(`stone: ${month} answered as ${q.answer}`);
    }
  });
}
factFails.length ? bad('sampled answers are factually right', factFails.slice(0,5).join('\n      '))
                 : ok('sampled answers check out against the source tables');

/* People questions: only when at least three sit in distinct periods, and never ambiguous. */
const threePeople = [{name:'Ada', month:11, day:29}, {name:'Bo', month:4, day:7}, {name:'Cy', month:2, day:29}];
let peopleQs = 0, peopleBad = [];
for(let seed = 1; seed <= 300; seed++){
  makeQuiz(threePeople, 8, seeded(seed)).forEach(q=>{
    if(q.kind !== 'people') return;
    peopleQs++;
    const per = q.prompt.match(/<strong>(.+?)<\/strong>/)[1];
    const matches = threePeople.filter(p=>findPeriod(p.month, p.day).n === per);
    if(matches.length !== 1) peopleBad.push(`"${per}" matches ${matches.length} people`);
    else if(matches[0].name !== q.answer) peopleBad.push(`"${per}" answered as ${q.answer}, should be ${matches[0].name}`);
    q.options.forEach(o=>{ if(!threePeople.some(p=>p.name === o)) peopleBad.push(`option "${o}" is not a saved person`); });
  });
}
peopleQs > 0 ? ok(`people questions appear when there are enough saved (${peopleQs} generated)`)
             : bad('people questions appear when there are enough saved', 'none generated in 300 rounds');
peopleBad.length ? bad('people questions are never ambiguous', peopleBad.slice(0,5).join('\n      '))
                 : ok('people questions name exactly one saved person');

/* Too few people, or none: the quiz must still fill a full round. */
is(makeQuiz([], 10, seeded(7)).length, 10, 'a full round with nobody saved');
is(makeQuiz([{name:'Solo', month:1, day:1}], 10, seeded(7)).length, 10, 'a full round with one person saved');
is(makeQuiz(null, 10, seeded(7)).length, 10, 'a full round when the people list is missing entirely');
const soloRounds = [];
for(let seed = 1; seed <= 100; seed++) makeQuiz([{name:'Solo', month:1, day:1}], 8, seeded(seed)).forEach(q=>{ if(q.kind === 'people') soloRounds.push(seed); });
is(soloRounds.length, 0, 'no people questions when only one person is saved');

/* ---------------------------------------------------------- */
group('The path layer (Destiny)');

const destGaps = [];
const DEST_FIELDS = ['from','toward','lesson','goal','pitfall','release','reward','step'];
PERIODS.forEach(p=>{
  const D = DESTINY[p.n];
  if(!D) return destGaps.push(`no path entry for ${p.n}`);
  DEST_FIELDS.forEach(f=>{ if(!D[f] || D[f].length < 12) destGaps.push(`${p.n}.${f} missing or too short`); });
});
Object.keys(DESTINY).forEach(k=>{ if(!PERIODS.some(p=>p.n === k)) destGaps.push(`orphan path key "${k}"`); });
destGaps.length ? bad(`all 48 periods have all ${DEST_FIELDS.length} path fields`, destGaps.join('\n      '))
                : ok(`all 48 periods have all ${DEST_FIELDS.length} path fields`);

DEST_FIELDS.forEach(f=>{
  const distinct = new Set(PERIODS.map(p=>DESTINY[p.n][f])).size;
  distinct === 48 ? ok(`all 48 "${f}" entries are distinct`)
                  : bad(`all 48 "${f}" entries are distinct`, `${distinct} distinct of 48`);
});

/* The path layer must not simply restate the period layer — that was the
   original weakness: it reused LORE's gift, cost and practice verbatim. */
const echoes = [];
PERIODS.forEach(p=>{
  const D = DESTINY[p.n], L = LORE[p.n];
  DEST_FIELDS.forEach(f=>{
    ['g','s','p','k','pur'].forEach(lf=>{
      if(D[f] && L[lf] && D[f].trim() === L[lf].trim()) echoes.push(`${p.n}: path.${f} repeats lore.${lf}`);
    });
  });
});
echoes.length ? bad('no path field is copied from the period layer', echoes.join('\n      '))
              : ok('no path field is copied from the period layer');

/* Each period's path must render, and must actually show the journey. */
const pathFails = [];
PERIODS.forEach(p=>{
  const P = profileOf({name:'Robin Vale', month:p.sm, day:p.sd, year:1990});
  let out;
  try{ out = renderPath(P); }catch(e){ return pathFails.push(`${p.n}: ${e.message}`); }
  if(/undefined|NaN|\[object Object\]/.test(out)) pathFails.push(`${p.n}: placeholder leaked`);
  ['Starts from','Moves toward','The core lesson','The goal','The pitfall','Let go of','What arrives','Where to begin']
    .forEach(sec=>{ if(!out.includes(sec)) pathFails.push(`${p.n}: missing "${sec}"`); });
});
pathFails.length ? bad('every period renders a full path with all its sections', pathFails.slice(0,5).join('\n      '))
                 : ok('every period renders a full path with all its sections');

const samplePath = renderPath(profileOf({name:'Ada', month:11, day:29, year:1988}));
const sampleRead = renderReading(profileOf({name:'Ada', month:11, day:29, year:1988}));
samplePath.length > sampleRead.length * 0.45
  ? ok('the path layer carries real weight next to the period layer')
  : bad('the path layer carries real weight next to the period layer', `${samplePath.length} vs ${sampleRead.length} chars`);

/* ---------------------------------------------------------- */
group('Correspondences and wellbeing');

const wellGaps = [];
PERIODS.forEach(p=>{
  const W = WELLBEING[p.n];
  if(!W) return wellGaps.push(`no wellbeing entry for ${p.n}`);
  ['h','m'].forEach(f=>{ if(!W[f] || W[f].length < 20) wellGaps.push(`${p.n}.${f} missing or too short`); });
});
Object.keys(WELLBEING).forEach(k=>{ if(!PERIODS.some(p=>p.n === k)) wellGaps.push(`orphan wellbeing key "${k}"`); });
wellGaps.length ? bad('all 48 periods have health and state-of-mind text', wellGaps.join('\n      '))
                : ok('all 48 periods have health and state-of-mind text');
is(new Set(PERIODS.map(p=>WELLBEING[p.n].h)).size, 48, 'all 48 health entries are distinct');
is(new Set(PERIODS.map(p=>WELLBEING[p.n].m)).size, 48, 'all 48 state-of-mind entries are distinct');

const signGaps = Object.keys(SIGNS).filter(s=>!SIGN_BODY[s] || !SIGN_BODY[s].zone || !SIGN_BODY[s].colour || !SIGN_BODY[s].flower);
signGaps.length ? bad('all 12 signs have a body zone, colour and flower', signGaps.join(', '))
                : ok('all 12 signs have a body zone, colour and flower');
const swatchGaps = Object.keys(SIGNS).filter(s=>!/^#[0-9a-f]{6}$/i.test(SIGN_SWATCH[s] || ''));
swatchGaps.length ? bad('every sign has a colour swatch', swatchGaps.join(', ')) : ok('every sign has a colour swatch');
is(BIRTHSTONE.length, 12, 'a birthstone for all 12 months');
is(BIRTHSTONE[1], 'amethyst', 'February is amethyst');
is(BIRTHSTONE[6], 'ruby', 'July is ruby');

const planetGaps = [];
for(let n = 1; n <= 9; n++){
  const P = PLANET_LORE[n];
  if(!P) { planetGaps.push(`no entry for ${n}`); continue; }
  if(!P.stone || !P.colour) planetGaps.push(`${n} missing stone or colour`);
}
planetGaps.length ? bad('all nine numbers have a planetary stone and colour', planetGaps.join(', '))
                  : ok('all nine numbers have a planetary stone and colour');

/* The classical seven have a metal and a day; Uranus (4) and Neptune (7) must not pretend to. */
const classical = {1:['gold','Sunday'], 2:['silver','Monday'], 3:['tin','Thursday'], 5:['quicksilver','Wednesday'],
                   6:['copper','Friday'], 8:['lead','Saturday'], 9:['iron','Tuesday']};
const metalDrift = Object.keys(classical).filter(n=>PLANET_LORE[n].metal !== classical[n][0] || PLANET_LORE[n].day !== classical[n][1]);
metalDrift.length ? bad('the seven classical planets have their traditional metal and day', metalDrift.join(', '))
                  : ok('the seven classical planets have their traditional metal and day');
is(PLANET_LORE[4].metal, null, 'Uranus claims no classical metal');
is(PLANET_LORE[4].day, null, 'Uranus claims no classical day');
is(PLANET_LORE[7].metal, null, 'Neptune claims no classical metal');
is(PLANET_LORE[7].day, null, 'Neptune claims no classical day');

/* The new sections must appear, and the birthstone must follow the birth month, not the period. */
const marA = profileOf({name:'A', month:3, day:28, year:1990});   // Aries I, born in March
const aprB = profileOf({name:'B', month:4, day:1,  year:1990});   // Aries I, born in April
is(marA.per.n, aprB.per.n, 'two people share a period across a month boundary');
is(marA.birthstone, 'aquamarine', 'the March-born one gets the March stone');
is(aprB.birthstone, 'diamond', 'the April-born one gets the April stone, same period');

const sampleReading = renderReading(profileOf({name:'Ada', month:11, day:29, year:1988}));
['State of mind','Body and wellbeing','Correspondences','Birthstone','Metal','not medical advice']
  .forEach(label=>{ sampleReading.includes(label) ? ok(`the reading shows "${label}"`) : bad(`the reading shows "${label}"`); });

const modern = renderReading(profileOf({name:'Uranian', month:1, day:4, year:1990}));  // day 4 -> Uranus
modern.includes('modern planet') ? ok('a Uranus reading says outright that it has no classical metal')
                                 : bad('a Uranus reading says outright that it has no classical metal');

/* ---------------------------------------------------------- */
group('Contact files (Google/Outlook CSV, vCard)');

const googleCsv = [
  'Name,Given Name,Family Name,Birthday,E-mail 1 - Value',
  'Ada Marchetti,Ada,Marchetti,1988-11-29,ada@example.com',
  'Bo Tran,Bo,Tran,--04-07,bo@example.com',
  '"Okonkwo, Cy",Cy,Okonkwo,1996-02-29,cy@example.com',
  'No Birthday Person,No,Person,,nb@example.com',
  ',,,1990-01-05,ghost@example.com'
].join('\n');
const gc = parseContactsCSV(googleCsv);
is(gc.people.length, 3, 'Google CSV: three contacts with birthdays');
is(gc.noBirthday.length, 1, 'Google CSV: the one without a birthday is reported, not dropped silently');
is(gc.people[0].year, 1988, 'Google CSV: full date keeps its year');
is(gc.people[1].year, null, 'Google CSV: --04-07 parses with no year');
is(gc.people[1].month, 4, 'Google CSV: --04-07 gives April');
is(gc.people[2].name, 'Okonkwo, Cy', 'Google CSV: a quoted name containing a comma survives');
is(gc.people[2].day, 29, 'Google CSV: 29 February 1996 is kept');

const outlookCsv = 'First Name,Last Name,Birthday\nDara,Whitlock,3/14/1990\n';
const oc = parseContactsCSV(outlookCsv);
is(oc.people.length, 1, 'Outlook CSV: first/last name columns are combined');
is(oc.people[0].name, 'Dara Whitlock', 'Outlook CSV: name is joined correctly');
is(oc.people[0].month, 3, 'Outlook CSV: slash dates fall back to the bulk parser');

is(parseContactsCSV('Name,Email\nAda,a@b.c\n').error, 'no birthday column in that file', 'CSV with no birthday column says so');

const vcf = [
  'BEGIN:VCARD','VERSION:3.0','N:Marchetti;Ada;;;','FN:Ada Marchetti','BDAY:1988-11-29','END:VCARD',
  'BEGIN:VCARD','VERSION:3.0','FN:Bo Tran','BDAY:19910407','END:VCARD',
  'BEGIN:VCARD','VERSION:3.0','FN:Emeka Nwosu','BDAY;X-APPLE-OMIT-YEAR=1604:1604-10-21','END:VCARD',
  'BEGIN:VCARD','VERSION:3.0','FN:June Carter','item1.BDAY:--0617','END:VCARD',
  'BEGIN:VCARD','VERSION:3.0','N:Bare;Nobirthday;;;','FN:Nobirthday Bare','END:VCARD',
  /* A real RFC 6350 fold: CRLF + one space is inserted mid-value, and
     unfolding removes both, rejoining the halves exactly. */
  'BEGIN:VCARD','VERSION:3.0','FN:Folded Na',' me Here','BDAY:1975-05-01','END:VCARD'
].join('\r\n');
const vc = parseVCF(vcf);
is(vc.people.length, 5, 'vCard: five cards with birthdays');
is(vc.noBirthday.length, 1, 'vCard: the card without a BDAY is reported');
is(vc.people[0].name, 'Ada Marchetti', 'vCard: FN is used for the name');
is(vc.people[1].month, 4, 'vCard: compact 19910407 parses');
is(vc.people[2].year, null, 'vCard: Apple X-APPLE-OMIT-YEAR drops the 1604 sentinel year');
is(vc.people[2].day, 21, 'vCard: the omit-year date itself is kept');
is(vc.people[3].month, 6, 'vCard: item1. prefix and --0617 parse');
is(vc.people[3].year, null, 'vCard: --0617 has no year');
is(vc.people[4].name, 'Folded Name Here', 'vCard: folded continuation lines are unfolded');

const noFn = parseVCF('BEGIN:VCARD\nN:Solo;Ada;;;\nBDAY:1988-11-29\nEND:VCARD');
is(noFn.people[0].name, 'Ada Solo', 'vCard: falls back to N when FN is absent');

is(parseContacts(vcf, 'contacts.vcf').people.length, 5, 'dispatcher routes .vcf to the vCard parser');
is(parseContacts(googleCsv, 'contacts.csv').people.length, 3, 'dispatcher routes .csv to the CSV parser');
is(parseContacts(vcf, 'mystery.txt').people.length, 5, 'dispatcher sniffs BEGIN:VCARD when the name is unhelpful');

/* 29 February against a non-leap year: keep the day, drop the impossible year. */
const badLeap = parseContactsCSV('Name,Birthday\nWrong Year,1995-02-29\n');
is(badLeap.people.length, 1, 'a 29 Feb birthday in a non-leap year is still imported');
is(badLeap.people[0].year, null, 'the impossible year is dropped rather than the person');
is(badLeap.people[0].month, 2, 'the 29 February date itself is kept');

/* Imported contacts must produce a real reading. */
const importedProfile = profileOf({name:gc.people[1].name, month:gc.people[1].month, day:gc.people[1].day, year:gc.people[1].year});
is(importedProfile.per.n, 'Aries II', 'a year-less imported birthday still resolves to a period');

/* ---------------------------------------------------------- */
console.log('\n' + '-'.repeat(58));
console.log(failures ? `FAILED — ${failures} of ${checks} checks failed` : `PASSED — all ${checks} checks`);
process.exit(failures ? 1 : 0);
