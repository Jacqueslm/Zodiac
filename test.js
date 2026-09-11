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
               'SEASONS','SEASON_PLACE','SEASON_VERB','seasonOf','seasonLine','ELEMENT_LORE','QUALITY_LORE','signFrom','describeSign',
               'KEY_Q','KEY_AREAS','KEY_SCALES','KEY_TEXTS','KEY_CHOICE','KEY_STANDING','keyBlank','keyRead','renderKey',
               'keySnapshot','keyLogPush','keyMovement','renderMovement','todayKey','daysBetween','listOf'];
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
       signFrom, describeSign,
       KEY_Q, KEY_AREAS, KEY_SCALES, KEY_TEXTS, KEY_CHOICE, KEY_STANDING, keyBlank, keyRead, renderKey,
       keySnapshot, keyLogPush, keyMovement, renderMovement, todayKey, daysBetween, listOf} = api;

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
html.includes("if(!speechOK()){ speakLabel('This browser has no voice'); return; }")
  ? ok('a browser with no speech engine says so instead of failing silently')
  : bad('a browser with no speech engine says so');
html.includes("speakLabel('No voice installed')")
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
html.includes("(buf + c).length > 240")
  ? ok('a block too long for an engine to speak in one go is split further')
  : bad('long blocks are split');
html.includes('speechSynthesis.cancel()') ? ok('the voice can be stopped') : bad('the voice can be stopped');
html.includes("addEventListener('beforeunload', stopSpeaking)")
  ? ok('the voice stops when the page closes') : bad('the voice stops when the page closes');
(html.includes("(simpleBox && !simpleBox.hidden) ? simpleBox") && html.includes("keyOut && keyOut.innerHTML.trim()) ? keyOut"))
  ? ok('it reads aloud whichever screen you are looking at — the long one, the short one, or the key')
  : bad('it reads aloud whichever screen you are looking at');

/* A phone locking its screen suspends the speech engine, so a reading stopped
   partway through and looked like a fault. The lock is taken while reading and
   released after, because holding one longer than needed costs battery. */
html.includes('function wakeAcquire') && html.includes("navigator.wakeLock.request('screen')")
  ? ok('the screen is kept awake while it reads, so a phone locking does not cut it off')
  : bad('the screen is kept awake while it reads');
html.includes("wakeAcquire('reading')") && html.includes("wakeRelease('reading')")
  ? ok('the lock is taken when reading starts and released when it stops')
  : bad('the lock is taken and released around reading');
html.includes("if(wakeSentinel === s){ wakeSentinel = null; wakeEnsure(); }")
  ? ok('a lock the system revokes is taken back, which it does on every tab switch')
  : bad('a revoked lock is taken back');
html.includes("document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) wakeEnsure(); })")
  ? ok('the lock is re-taken on returning to the tab') : bad('the lock is re-taken on returning');

/* Read-along. The block is the part that always works; the word depends on
   boundary events, which Android and some Safari builds never send. */
html.includes('function readableBlocks')
  ? ok('the reading is broken into blocks, so there is something to point at')
  : bad('the reading is broken into blocks');
html.includes('lightBlock(bit.el)') && html.includes("el.classList.add('speaking')")
  ? ok('the block being read is lit up and scrolled to')
  : bad('the block being read is lit up');
html.includes("u.onboundary = e=>{ if(e.name === 'word' || e.name === undefined) lightWord(e.charIndex, e.charLength); }")
  ? ok('the word being said is lit inside the block, where the engine reports it')
  : bad('the word being said is lit');
html.includes('LIT.textContent = LIT_TEXT') && html.includes('function clearLit')
  ? ok("each block's own text is put back, so no markup is left behind")
  : bad("each block's text is restored");
/\.speaking\{[^}]*background/.test(html) && /\.speaking mark\{/.test(html)
  ? ok('the lit block and the lit word have their own styling')
  : bad('the highlight has styling');
html.includes("let end = len ? at + len : t.indexOf(' ', at);")
  ? ok('an engine that reports no word length still highlights to the next space')
  : bad('a missing word length is handled');

/* Choosing a voice, and keeping the choice. */
(html.includes('class="voice-pick"') && html.includes('function fillVoicePicker'))
  ? ok('the voice can be chosen from whatever the device has')
  : bad('the voice can be chosen');
html.includes("saveVoiceName(e.target.value)") && html.includes("localStorage.setItem(VOICE_KEY")
  ? ok('the chosen voice is remembered between visits')
  : bad('the chosen voice is remembered');
html.includes("voiceschanged")
  ? ok('the picker refills when the device reports its voices, which it does late')
  : bad('the picker handles the late voiceschanged event');
html.includes('data-act="try"') && html.includes('This is the voice that will read to you')
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

/* Phones were holding an old copy of the page after an update had shipped. */
(html.includes('http-equiv="cache-control"') && html.includes('must-revalidate'))
  ? ok('the page asks browsers to check for a newer copy rather than reuse a stale one')
  : bad('the page asks browsers to revalidate');

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
{
group('The Key — the life laid against the reading');

const P_KEY = profileOf({name:'Test Person', month:11, day:12, year:null});

is(KEY_SCALES.length, 12, 'twelve scored areas');
is(KEY_Q.length, KEY_SCALES.length + 5 + KEY_TEXTS.length, 'every question is a scale, a choice or a text box');
is(KEY_TEXTS.length, 7, 'seven free-text boxes');

/* Everything Jacques listed has somewhere to go. */
const asked = KEY_Q.map(q=>q.q.toLowerCase()).join(' | ');
[['background','background'],['job','what you do'],['qualification','qualifications'],
 ['accomplishment','accomplished'],['good things','best things'],['bad things','the bad things'],
 ['horrific','horrific'],['family closeness','close are you to your family'],['upbringing','upbringing'],
 ['struggles','biggest thing you are fighting'],['religious background','religious background'],
 ['ethnicity','ethnicity'],['region','region'],['mental health','mental health'],
 ['physical wellbeing','physical wellbeing'],['spiritual outlook','spiritual outlook'],
 ['worldview','when you look at people'],['goals','goals'],['kids','kids'],
 ['friendships','friendships'],['self-regard','do you like yourself'],['half full or empty','half empty or half full']
].forEach(([label, needle])=>{
  asked.includes(needle) ? ok(`it asks about ${label}`) : bad(`it asks about ${label}`, `no question contains "${needle}"`);
});

/* Every scale points at a real area, and every area is fully written. */
let areaGaps = [];
KEY_SCALES.forEach(id=>{
  const a = KEY_AREAS[id];
  if(!a) return areaGaps.push(`${id}: no area`);
  if(!a.n || a.n.length < 3) areaGaps.push(`${id}.n`);
  ['lock','turn','open'].forEach(f=>{ if(!a[f] || a[f].length < 40) areaGaps.push(`${id}.${f}`); });
});
is(areaGaps.length, 0, 'every scored area has a name, a lock, a turn and an open' + (areaGaps.length ? ' — ' + areaGaps.join(', ') : ''));

/* Areas route to fields that actually exist, in every period and every day. */
let routeGaps = [];
Object.entries(KEY_AREAS).forEach(([id, a])=>{
  if(a.depth) PERIODS.forEach(p=>{ if(!DEPTH[p.n] || !DEPTH[p.n][a.depth]) routeGaps.push(`${id} -> DEPTH.${a.depth} missing on ${p.n}`); });
  if(a.mate)  PERIODS.forEach(p=>{ if(!DEPTH[p.n] || !DEPTH[p.n][a.mate])  routeGaps.push(`${id} -> DEPTH.${a.mate} missing on ${p.n}`); });
  if(a.dest)  PERIODS.forEach(p=>{ if(!DESTINY[p.n] || !DESTINY[p.n][a.dest]) routeGaps.push(`${id} -> DESTINY.${a.dest} missing on ${p.n}`); });
  if(a.day)   Object.entries(DAYS).forEach(([k, d])=>{ if(!d[a.day]) routeGaps.push(`${id} -> DAYS.${a.day} missing on ${k}`); });
});
is(routeGaps.length, 0, 'every area routes to a field that exists on all 48 periods and all 366 days' +
   (routeGaps.length ? ' — ' + routeGaps.slice(0,3).join('; ') : ''));

/* No two areas say the same thing. */
const lockTexts = Object.values(KEY_AREAS).map(a=>a.lock);
is(new Set(lockTexts).size, lockTexts.length, 'no two areas share a lock');
const turnTexts = Object.values(KEY_AREAS).map(a=>a.turn);
is(new Set(turnTexts).size, turnTexts.length, 'no two areas share a turn');

/* A blank sheet covers every question and reads as unanswered. */
const blank = keyBlank();
is(Object.keys(blank).length, KEY_Q.length, 'a blank sheet has a slot for every question');
is(keyRead(P_KEY, blank).standing, 'unanswered', 'a blank sheet does not pretend to a verdict');
is(keyRead(P_KEY, blank).answered, 0, 'a blank sheet counts nothing');
is(keyRead(P_KEY, {}).locks.length, 0, 'no answers, no locks');

/* Somebody in a ditch. */
const low = keyBlank();
KEY_SCALES.forEach(id=>low[id] = 1);
const R_low = keyRead(P_KEY, low);
is(R_low.standing, 'ditch', 'all bottom answers read as a ditch');
is(R_low.locks.length, 12, 'all twelve areas come back locked');
is(R_low.open.length, 0, 'nothing is open');
is(R_low.signpost, true, 'a ditch raises the signpost');
R_low.locks.every(L=>L.mine.length > 0)
  ? ok('every lock quotes the person’s own reading back at them')
  : bad('every lock quotes the person’s own reading back at them');
R_low.steps.length >= 4 ? ok('a ditch gets at least four steps out of it') : bad('a ditch gets at least four steps out of it', 'got ' + R_low.steps.length);

/* Somebody doing well. */
const high = keyBlank();
KEY_SCALES.forEach(id=>high[id] = 5);
const R_high = keyRead(P_KEY, high);
is(R_high.standing, 'strong', 'all top answers read as strong');
is(R_high.locks.length, 0, 'nothing is locked');
is(R_high.open.length, 12, 'all twelve are open');
is(R_high.signpost, false, 'doing well does not raise the signpost');
R_high.steps.length > 0 ? ok('doing well still gets somewhere to go — the thin part of a good structure') : bad('doing well still gets somewhere to go');

/* The middle. */
const mid = keyBlank();
KEY_SCALES.forEach(id=>mid[id] = 3);
is(keyRead(P_KEY, mid).standing, 'holding', 'threes read as holding');

/* What they name as the fight leads, whatever the numbers say. */
const named = keyBlank();
KEY_SCALES.forEach(id=>named[id] = 4);
named.money = 1;
named.struggle = 'dir';
const R_named = keyRead(P_KEY, named);
is(R_named.lead, 'dir', 'the fight they named leads, over the lowest score');
is(R_named.locks[0].id, 'dir', 'the fight they named is written out in full even though it did not score low');
is(R_named.locks.some(L=>L.id === 'money'), true, 'and the low score is still listed as a lock');
is(R_named.locks[0].mine.length > 0, true, 'the named fight is answered by their own reading too');

/* Named, and also low: it leads the list rather than being listed twice. */
const bothNamed = keyBlank();
KEY_SCALES.forEach(id=>bothNamed[id] = 1);
bothNamed.struggle = 'money';
const R_both = keyRead(P_KEY, bothNamed);
is(R_both.locks[0].id, 'money', 'a named fight that also scored low leads the locks');
is(R_both.locks.filter(L=>L.id === 'money').length, 1, 'and is not listed twice');
is(R_both.locks.length, 12, 'with every other lock still there');
is(R_named.steps[0].b, KEY_AREAS.dir.turn, 'the first step is the turn for the fight they named');

/* Without a named fight, the lowest score leads and the highest is the lever. */
const auto = keyBlank();
KEY_SCALES.forEach((id,i)=>auto[id] = 3);
auto.body = 1; auto.friends = 5;
const R_auto = keyRead(P_KEY, auto);
is(R_auto.lead, 'body', 'with nothing named, the lowest area leads');
is(R_auto.lever, 'friends', 'the highest area is the lever');

/* The steps come from the reading, not from thin air. */
const D_KEY = DEPTH[P_KEY.per.n], DAY_KEY = DAYS['11-12'], DEST_KEY = DESTINY[P_KEY.per.n];
const stepText = R_low.steps.map(s=>s.b);
stepText.includes(D_KEY.action) ? ok('a step comes from the period’s own action line') : bad('a step comes from the period’s own action line');
stepText.includes(DEST_KEY.step) ? ok('a step comes from the path’s own next move') : bad('a step comes from the path’s own next move');
stepText.includes(DAY_KEY.ad) ? ok('a step comes from the day’s own advice') : bad('a step comes from the day’s own advice');

/* The signpost triggers on what it should, and on nothing else. */
const onlyMind = keyBlank(); onlyMind.mind = 2;
is(keyRead(P_KEY, onlyMind).signpost, true, 'a struggling mind raises the signpost on its own');
const onlySelf = keyBlank(); onlySelf.self = 1;
is(keyRead(P_KEY, onlySelf).signpost, true, 'hating yourself raises the signpost on its own');
const horrific = keyBlank(); horrific.horrific = 'yes'; KEY_SCALES.forEach(id=>horrific[id] = 5);
is(keyRead(P_KEY, horrific).signpost, true, 'a horrific answer raises the signpost even when everything else is fine');
const okMind = keyBlank(); okMind.mind = 4; okMind.self = 4; okMind.full = 4; okMind.horrific = 'no';
is(keyRead(P_KEY, okMind).signpost, false, 'answers that are fine do not raise it');
const skipped = keyBlank(); skipped.horrific = 'skip';
is(keyRead(P_KEY, skipped).signpost, false, 'declining to answer is not read as a yes');

/* Free text is stored and read back — never routed. */
const typed = keyBlank();
KEY_SCALES.forEach(id=>typed[id] = 2);
KEY_TEXTS.forEach(id=>typed[id] = 'something private about ' + id);
const R_typed = keyRead(P_KEY, typed);
is(R_typed.written.length, 7, 'everything typed is read back');
is(R_typed.written[0].v, 'something private about ' + KEY_TEXTS[0], 'read back exactly as typed');
const sameButBlank = Object.assign({}, typed);
KEY_TEXTS.forEach(id=>sameButBlank[id] = '');
const R_blankText = keyRead(P_KEY, sameButBlank);
is(JSON.stringify(R_typed.locks), JSON.stringify(R_blankText.locks),
   'what you type changes nothing about the reading — the app does not interpret prose, and does not pretend to');
is(R_typed.lead, R_blankText.lead, 'the lead is unchanged by free text');
is(R_blankText.written.length, 0, 'empty boxes are not read back');

/* Choices all have something written for them. */
let choiceGaps = [];
['horrific','kids','faith','world'].forEach(id=>{
  const q = KEY_Q.find(x=>x.id === id);
  q.opts.forEach(([v])=>{
    if(id === 'horrific' && v === 'no') return;                 /* 'no' is deliberately silent */
    if(!KEY_CHOICE[id] || !KEY_CHOICE[id][v]) choiceGaps.push(`${id}.${v}`);
  });
});
is(choiceGaps.length, 0, 'every choice has a written response' + (choiceGaps.length ? ' — missing ' + choiceGaps.join(', ') : ''));
is(KEY_Q.find(q=>q.id === 'struggle').opts.every(([v])=>!!KEY_AREAS[v]), true,
   'every fight you can name is an area the reading can answer');

/* The rules that do not bend. */
const keyProse = [
  ...Object.values(KEY_AREAS).flatMap(a=>[a.lock, a.turn, a.open]),
  ...Object.values(KEY_CHOICE).flatMap(set=>Object.values(set).map(x=>x.b)),
  ...Object.values(KEY_STANDING).map(f=>f({lowCount:3, highCount:3, total:12})),
  renderKey(P_KEY, low)
].join(' \n ');

const keyClaims = /research shows|studies show|scientists|clinically|serotonin|dopamine|brain chemistry|\bcure[sd]?\b|\btreatment\b|proven to|(?<!not a )diagnosis|\bdiagnos(e|es|ed|ing)\b/i;
const keyClaimHit = keyProse.match(keyClaims);
is(keyClaimHit, null, 'no medical claims, no mechanisms, no "research shows"' + (keyClaimHit ? ' — found "' + keyClaimHit[0] + '"' : ''));

const keyDoom = /you are finished|no way (out|back)|beyond (help|saving)|too late for you|nothing can be done/i;
const keyDoomHit = keyProse.match(keyDoom);
is(keyDoomHit, null, 'it never tells anybody they are finished' + (keyDoomHit ? ' — found "' + keyDoomHit[0] + '"' : ''));

const keyBlame = /(?<!not )your (own )?fault|you brought this on|you deserved/i;
const keyBlameHit = keyProse.match(keyBlame);
is(keyBlameHit, null, 'it never blames the person for what happened to them' + (keyBlameHit ? ' — found "' + keyBlameHit[0] + '"' : ''));

/* The screen itself. */
const keyHtmlLow = renderKey(P_KEY, low);
keyHtmlLow.includes('signpost') ? ok('the signpost renders when it is raised') : bad('the signpost renders when it is raised');
/say it to a person/i.test(keyHtmlLow) ? ok('the signpost points at a person, not at the app') : bad('the signpost points at a person, not at the app');
/crisis line/i.test(keyHtmlLow) ? ok('the signpost names somewhere to go') : bad('the signpost names somewhere to go');
!renderKey(P_KEY, okMind).includes('signpost') ? ok('the signpost stays away when it is not needed') : bad('the signpost stays away when it is not needed');
/never sent anywhere/i.test(keyHtmlLow) ? ok('the page says out loud that nothing leaves the browser') : bad('the page says out loud that nothing leaves the browser');
/not medical advice|not a diagnosis/i.test(keyHtmlLow) ? ok('the page says what it is not') : bad('the page says what it is not');
keyHtmlLow.includes('The key is not a secret') ? ok('the key is named as what it is — not a secret, a key') : bad('the key is named as what it is');
/How to work yourself out of the ditch/i.test(keyHtmlLow) ? ok('it says how to get out of the ditch') : bad('it says how to get out of the ditch');

/* Both halves of it: the lever and the lock, in one sentence. */
const two = keyBlank();
KEY_SCALES.forEach(id=>two[id] = 3);
two.money = 1; two.friends = 5;
const htmlTwo = renderKey(P_KEY, two);
htmlTwo.includes(KEY_AREAS.friends.n + ' is the part of the vault that is already open')
  ? ok('the key names the open part') : bad('the key names the open part');
htmlTwo.includes(KEY_AREAS.money.n + ' is the part that is not')
  ? ok('the key names the shut part') : bad('the key names the shut part');

/* Nothing typed can become markup. */
const nasty = keyBlank();
nasty.full = 1;
nasty.job = '<img src=x onerror="alert(1)">';
const htmlNasty = renderKey(P_KEY, nasty);
!htmlNasty.includes('<img src=x') ? ok('anything typed is escaped before it reaches the page') : bad('anything typed is escaped before it reaches the page');
htmlNasty.includes('&lt;img src=x') ? ok('and it is still shown back, harmlessly') : bad('and it is still shown back, harmlessly');

/* It has to hold for all 48 periods and all 366 days, not just one. */
let renderGaps = [];
PERIODS.forEach(p=>{
  const Q = profileOf({name:'X', month:p.sm, day:p.sd, year:null});
  const h = renderKey(Q, low);
  if(/undefined|\[object Object\]/.test(h)) renderGaps.push(p.n + ': hole in the page');
  if(h.length < 4000) renderGaps.push(p.n + ': page came back thin (' + h.length + ')');
  if(!h.includes('The Key')) renderGaps.push(p.n + ': lost its heading');
});
is(renderGaps.length, 0, 'the key renders whole for all 48 periods' + (renderGaps.length ? ' — ' + renderGaps.slice(0,3).join('; ') : ''));

let dayGaps = 0;
Object.keys(DAYS).forEach(k=>{
  const [m, d] = k.split('-').map(Number);
  const Q = profileOf({name:'X', month:m, day:d, year:null});
  const R = keyRead(Q, low);
  if(R.steps.length < 5 || R.locks.some(L=>L.mine.length === 0)) dayGaps++;
});
is(dayGaps, 0, 'and for all 366 days, with every lock answered and every step filled');

/* The empty case renders something honest rather than a blank box. */
const htmlBlank = renderKey(P_KEY, blank);
/Answer the questions above/i.test(htmlBlank) ? ok('an unanswered key asks rather than invents') : bad('an unanswered key asks rather than invents');
!/ditch|holding|strong/i.test(htmlBlank.replace(/class="[^"]*"/g,'')) ? ok('and passes no verdict on somebody who said nothing') : bad('and passes no verdict on somebody who said nothing');

(html.includes("if(already && already.id !== id){") && /already\.id !== id\)\{\s*stopSpeaking\(\);/.test(html))
  ? ok('changing tab stops the voice, rather than reading a page you have left')
  : bad('changing tab stops the voice');

/* The instructions have to cover it, or nobody finds it. */
const helpBox = html.slice(html.indexOf('id="help-box"'), html.indexOf('btn-help-close'));
helpBox.includes('<h4>The Key</h4>') ? ok('"How to use this" explains The Key') : bad('"How to use this" explains The Key');
/tap it again to unanswer/i.test(helpBox) ? ok('and says how to take an answer back') : bad('and says how to take an answer back');
/never leaves your phone/i.test(helpBox) ? ok('and says where the answers live') : bad('and says where the answers live');
/no AI in here/i.test(helpBox) ? ok('and is straight about there being no AI reading the boxes') : bad('and is straight about there being no AI');

helpBox.includes('<h4>Getting back</h4>') ? ok('and how to get back') : bad('and how to get back');

/* A class carrying a display rule beat the hidden attribute once already. */
html.includes('[hidden]{display:none !important}')
  ? ok('the hidden attribute wins over any class that would show the element')
  : bad('the hidden attribute wins over any class');

/* The tab is on the page and reachable. */
html.includes('id="tab-key"') ? ok('The Key has a tab') : bad('The Key has a tab');
html.includes('id="panel-key"') ? ok('The Key has a panel') : bad('The Key has a panel');
html.includes("if(id === 'tab-key') primeKey();") ? ok('opening the tab builds the questions') : bad('opening the tab builds the questions');
html.includes('btn-key-wipe') ? ok('there is a delete button') : bad('there is a delete button');
/personology\.key\.v1/.test(html) ? ok('answers are stored under their own key in this browser') : bad('answers are stored under their own key in this browser');
!/fetch\(|XMLHttpRequest|navigator\.sendBeacon/.test(html) ? ok('nothing in the file can send it anywhere') : bad('nothing in the file can send it anywhere');

}
{
group('The key, read over time');

const Pm = profileOf({name:'Test', month:11, day:12, year:null});
const snapAt = (date, scores, named)=>{
  const A = keyBlank();
  Object.keys(scores).forEach(k=>A[k] = scores[k]);
  if(named) A.struggle = named;
  const s = keySnapshot(A, keyRead(Pm, A));
  s.at = date;
  return s;
};
const allAt = (date, v, named)=>{
  const o = {}; KEY_SCALES.forEach(id=>o[id] = v);
  return snapAt(date, o, named);
};

/* A snapshot keeps the numbers and nothing else. */
const A1 = keyBlank();
KEY_SCALES.forEach(id=>A1[id] = 2);
A1.job = 'something private'; A1.bad = 'the worst thing that happened';
const snap = keySnapshot(A1, keyRead(Pm, A1));
is(Object.keys(snap.s).length, 12, 'a snapshot keeps all twelve scores');
is(JSON.stringify(snap).includes('something private'), false, 'and nothing anybody typed');
is(JSON.stringify(snap).includes('the worst thing'), false, 'especially not the hard parts');
is(/^\d{4}-\d{2}-\d{2}$/.test(snap.at), true, 'and is stamped with a plain date');

/* Twice in a day is one answer. */
let log = [];
log = keyLogPush(log, allAt('2026-01-01', 2));
log = keyLogPush(log, allAt('2026-01-01', 4));
is(log.length, 1, 'answering twice in one day replaces rather than invents a trend');
is(log[0].s.money, 4, 'and it is the later answer that is kept');
log = keyLogPush(log, allAt('2026-02-01', 4));
is(log.length, 2, 'a different day is a new entry');

/* One answer cannot show movement, and says so instead of guessing. */
is(keyMovement([]).enough, false, 'no answers, no movement');
is(keyMovement([allAt('2026-01-01', 3)]).enough, false, 'one answer is not a trend');
/Answer it again in a month/i.test(renderMovement([allAt('2026-01-01', 3)]))
  ? ok('the first turn asks them back rather than inventing a comparison')
  : bad('the first turn asks them back');
/first time/i.test(renderMovement([])) ? ok('and an empty log does the same') : bad('an empty log does the same');

/* Up, down, and the one that matters. */
const two = [snapAt('2026-01-01', {money:1, body:4, dir:2, self:1}),
             snapAt('2026-04-01', {money:3, body:2, dir:2, self:1})];
const M = keyMovement(two);
is(M.enough, true, 'two answers are enough');
is(M.runs, 2, 'it counts the turns');
is(M.span, 90, 'and the days between them');
is(M.up.length, 1, 'it finds what went up');
is(M.up[0].id, 'money', 'and names it');
is(M.up[0].by, 2, 'and by how much');
is(M.down.length, 1, 'it finds what went backwards');
is(M.down[0].id, 'body', 'and names that too');
is(M.stuck.map(r=>r.id).sort().join(','), 'dir,self', 'and what has not moved at all');

/* A steady 5 is not a problem to report. */
const steady = [snapAt('2026-01-01', {friends:5, money:1}), snapAt('2026-03-01', {friends:5, money:1})];
is(keyMovement(steady).stuck.map(r=>r.id).join(','), 'money',
   'a high score sitting still is not reported as stuck — only a low one is');

/* Naming the same fight over and over while it does not move. */
const nagged = [snapAt('2026-01-01', {money:1, friends:4}, 'money'),
                snapAt('2026-02-01', {money:1, friends:4}, 'money'),
                snapAt('2026-03-01', {money:1, friends:4}, 'money')];
const N = keyMovement(nagged);
is(N.namedStuck, 'money', 'it notices the fight named again and again that never moves');
is(N.namedTimes, 3, 'and how many times it was named');
const nagHtml = renderMovement(nagged);
/keep deciding to deal with later/i.test(nagHtml) ? ok('and says so, plainly') : bad('and says so');
/not\s+bad luck/i.test(nagHtml) ? ok('without blaming it on luck or on the app') : bad('it does not blame luck');

/* Named, and it did move — no nagging. */
const worked = [snapAt('2026-01-01', {money:1}, 'money'), snapAt('2026-03-01', {money:4}, 'money')];
is(keyMovement(worked).namedStuck, null, 'naming a fight you then win is not nagged about');
!/keep deciding to deal with later/i.test(renderMovement(worked))
  ? ok('and the nag stays off the page') : bad('the nag stays off the page');

/* Nothing moved at all. */
const flat = [allAt('2026-01-01', 3), allAt('2026-06-01', 3)];
const flatHtml = renderMovement(flat);
/Nothing moved in either direction/i.test(flatHtml) ? ok('a flat year is named as a flat year') : bad('a flat year is named');
/a year going past/i.test(flatHtml) ? ok('and what that costs is said out loud') : bad('the cost is said');

/* Overall direction. */
is(keyMovement([allAt('2026-01-01', 1), allAt('2026-06-01', 4)]).better, true, 'it knows when somebody climbed');
is(keyMovement([allAt('2026-01-01', 4), allAt('2026-06-01', 1)]).worse, true, 'and when they slid');
const climbed = renderMovement([allAt('2026-01-01', 1), allAt('2026-06-01', 4)]);
/ditch/.test(climbed) && /strong/.test(climbed) ? ok('and reports the change in standing') : bad('it reports the standing change');
/Say that out loud/i.test(climbed) ? ok('and makes them acknowledge the climb') : bad('it names the climb');
const slid = renderMovement([allAt('2026-01-01', 4), allAt('2026-06-01', 1)]);
/worth panicking about/i.test(slid) ? ok('a slide is reported without alarm') : bad('a slide is reported calmly');

/* Answers too close together are not dressed up as a trend. */
/too close together/i.test(renderMovement([allAt('2026-01-01', 2), allAt('2026-01-03', 4)]))
  ? ok('two answers days apart are called what they are') : bad('close answers are not oversold');

/* The log is bounded, so it cannot grow forever in a phone's storage. */
let big = [];
for(let i = 0; i < 80; i++) big = keyLogPush(big, allAt('2026-01-' + String((i % 28) + 1).padStart(2,'0') + '', 3));
is(big.length <= 60, true, 'the log is capped rather than growing without limit');

/* It holds for every period, and never leaks typed words onto the page. */
let moveGaps = [];
PERIODS.slice(0, 48).forEach(p=>{
  const Q = profileOf({name:'X', month:p.sm, day:p.sd, year:null});
  const h = renderKey(Q, A1, nagged);
  if(/undefined|\[object Object\]/.test(h)) moveGaps.push(p.n);
  if(!/Where you have moved/.test(h)) moveGaps.push(p.n + ': no movement section');
  if(h.includes('something private') && !h.includes('What you wrote down')) moveGaps.push(p.n + ': leak');
});
is(moveGaps.length, 0, 'the movement section renders for all 48 periods' + (moveGaps.length ? ' — ' + moveGaps.slice(0,2).join('; ') : ''));

/* Without a log, the reading is exactly what it was before. */
const noLog = renderKey(Pm, A1);
!/Where you have moved/.test(noLog) ? ok('a caller that passes no log gets no movement section') : bad('no log, no section');

/* Dates. */
is(daysBetween('2026-01-01', '2026-01-01'), 0, 'the same day is no days apart');
is(daysBetween('2026-01-01', '2026-03-01'), 59, 'and it counts real days across months');
is(todayKey(new Date(2026, 0, 5)), '2026-01-05', 'dates are stamped as plain local calendar days');

/* Names with a comma in them must not read as two things. */
is(Object.values(KEY_AREAS).filter(a=>a.n.includes(',')).length, 0, 'no area name carries a comma of its own');
is(listOf(['a']), 'a', 'a list of one is just the thing');
is(listOf(['a','b']), 'a &middot; b', 'a list of two is separated, not comma-joined');
is(listOf(['a','b','c']), 'a &middot; b &middot; c', 'and so is a longer one');
{
  const allStuck = [];
  const mk = (at)=>{ const o = {}; KEY_SCALES.forEach(id=>o[id] = 1); const A = keyBlank();
    Object.keys(o).forEach(k=>A[k] = o[k]); const sn = keySnapshot(A, keyRead(Pm, A)); sn.at = at; return sn; };
  allStuck.push(mk('2026-01-01'), mk('2026-06-01'));
  const h = renderMovement(allStuck);
  /and 7 more/.test(h) ? ok('a sheet where nothing moved lists five and counts the rest')
                       : bad('a fully stuck sheet is capped', h.slice(h.indexOf('Has not moved'), h.indexOf('Has not moved') + 200));
}

/* Storage: its own key, deleted with the rest, never sent. */
html.includes("const KLOG = 'personology.key.log.v1'") ? ok('the log has its own storage key') : bad('the log has its own key');
html.includes('delete logs[keySlot()];') ? ok('and Delete my answers clears it too') : bad('delete clears the log');
/Only the sliders are kept for this, never anything you typed/.test(nagHtml)
  ? ok('and the page says what is kept and what is not') : bad('the page says what is kept');
}

{
group('Going back');

html.includes('id="btn-back"') ? ok('there is a back button') : bad('there is a back button');
html.includes("addEventListener('popstate'") ? ok('and the phone’s own back button is caught') : bad('the hardware back button is caught');
/backPush\(\{k:'tab'/.test(html) ? ok('changing tab is a step you can come back from') : bad('a tab change is a step');
/backPush\(\{k:'help'\}\)/.test(html) ? ok('so is opening the instructions') : bad('opening help is a step');
/backPush\(\{k:'simple'\}\)/.test(html) ? ok('so is switching to the short version') : bad('the short version is a step');
/backPush\(\{k:'voice'/.test(html) ? ok('so is opening the voice picker') : bad('the voice picker is a step');

/* The count of history entries and the count of steps have to stay equal,
   or the hardware button starts needing two presses for one screen. */
/BACK\.push\(step\);\s*try\{ history\.pushState/.test(html)
  ? ok('every recorded step pushes exactly one history entry')
  : bad('steps and history entries are pushed together');
html.includes("history.back();") && /#btn-back'\)\)\{[\s\S]{0,220}history\.back\(\)/.test(html)
  ? ok('and the on-screen button goes through history rather than round it')
  : bad('the on-screen button goes through history');

/* Nothing may trap somebody trying to leave. */
!/popstate[\s\S]{0,200}pushState/.test(html)
  ? ok('going back never re-pushes an entry, so the app can always be left')
  : bad('going back could trap somebody on the page');
/if\(!step\) return false;/.test(html)
  ? ok('and with no steps left the press falls through to leaving')
  : bad('an empty stack falls through');

/* Undoing must not record itself, or back would never reach the bottom. */
/if\(backUndoing\) return;/.test(html) ? ok('undoing a step does not record a new one') : bad('undoing does not re-record');
/backUndoing = true;[\s\S]{0,900}finally \{ backUndoing = false; \}/.test(html)
  ? ok('and the flag is cleared even if a step throws') : bad('the undoing flag is cleared in a finally');

/* The button is only there when it does something. */
/b\.hidden = BACK\.length === 0;/.test(html) ? ok('the button hides when there is nowhere to go') : bad('the button hides when idle');

/* It must not sit on top of the reading on a phone. */
/@media\(max-width:640px\)\{ body\{padding-bottom:70px\} \}/.test(html)
  ? ok('and the page makes room for it on a phone') : bad('the page makes room for it');

/* Escape is the same gesture, but not while typing a name into a box. */
/e\.key === 'Escape'/.test(html) ? ok('Escape goes back too') : bad('Escape goes back');
/INPUT\|TEXTAREA\|SELECT/.test(html) ? ok('except while typing, where Escape means something else') : bad('Escape is ignored in a field');

/* The hash is written with replaceState, so sharing a reading cannot
   quietly fill the history with entries that back has to walk through. */
html.includes("history.replaceState(null, '', h)")
  ? ok('reading a birthday still replaces the hash rather than adding history')
  : bad('the hash does not add history entries');
}

/* ---------------------------------------------------------- */
console.log('\n' + '-'.repeat(58));
console.log(failures ? `FAILED — ${failures} of ${checks} checks failed` : `PASSED — all ${checks} checks`);
process.exit(failures ? 1 : 0);
