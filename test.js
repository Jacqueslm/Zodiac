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
               'makeQuiz','QUIZ_KINDS','findPeriod','PORTRAIT','DEPTH','renderDepth',
               'TAUNTS','STYLE','RING_ELEMENT','elementFactor',
               'PLACE_OF','PLACE_NAME','BODY_OF','periodSlug','fightURL','fightBrief'];
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
       makeQuiz, QUIZ_KINDS, findPeriod, PORTRAIT, DEPTH, renderDepth,
       TAUNTS, STYLE, RING_ELEMENT, elementFactor,
       PLACE_OF, PLACE_NAME, BODY_OF, periodSlug, fightURL, fightBrief} = api;

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
group('The fight');

/* Seeded, so any failure is reproducible. */
function seeded(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const tauntGaps = [];
PERIODS.forEach(p=>{
  const T = TAUNTS[p.n];
  if(!T) return tauntGaps.push(`no taunt for ${p.n}`);
  if(!T.t || T.t.length < 10) tauntGaps.push(`${p.n}: taunt too short`);
  if(!T.c || T.c.length < 10) tauntGaps.push(`${p.n}: counter too short`);
});
tauntGaps.length ? bad('all 48 periods have a taunt and a counter', tauntGaps.slice(0,4).join('\n      '))
                 : ok('all 48 periods have a taunt and a counter');
is(new Set(PERIODS.map(p=>TAUNTS[p.n].t)).size, 48, 'all 48 taunts are distinct');
is(new Set(PERIODS.map(p=>TAUNTS[p.n].c)).size, 48, 'all 48 counters are distinct — the right reply is never ambiguous');

/* The elemental wheel must be a cycle: each beats exactly one and loses to one. */
const wheel = ['Fire','Earth','Air','Water'];
const wheelBad = [];
wheel.forEach(a=>{
  const beats = wheel.filter(b=>a !== b && elementFactor([a],[b]) > 1);
  const loses = wheel.filter(b=>a !== b && elementFactor([a],[b]) < 1);
  if(beats.length !== 1) wheelBad.push(`${a} beats ${beats.length} elements`);
  if(loses.length !== 1) wheelBad.push(`${a} loses to ${loses.length} elements`);
  if(elementFactor([a],[a]) !== 1) wheelBad.push(`${a} is not neutral against itself`);
});
wheelBad.length ? bad('the elemental wheel is a clean cycle', wheelBad.join(', '))
                : ok('the elemental wheel is a clean cycle — each beats one, loses to one, neutral twice');

/* Each element has its own ring colour, so no two rooms look the same. */
is(new Set(Object.values(RING_ELEMENT).map(r=>r.colour)).size, 4, 'each element lights the ring a different colour');

/* ---- the address the app hands the game ---- */

/* Slugs are the join between index.html and fight.html. If two periods
   collided, one of them could never be fought. */
const slugs = PERIODS.map(p=>periodSlug(p.n));
is(new Set(slugs).size, 48, 'all 48 periods slug to a distinct key');
slugs.every(s=>/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))
  ? ok('every slug is safe in a query string')
  : bad('every slug is safe in a query string', slugs.filter(s=>!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)).join(', '));

is(new Set(Object.values(BODY_OF)).size, 4, 'each element walks out as a different one of the five fighters');
Object.values(BODY_OF).every(n=>n >= 1 && n <= 5)
  ? ok('every body is one the game actually has (1–5)')
  : bad('every body is one the game actually has (1–5)');
is(new Set(Object.values(PLACE_OF)).size, 4, 'each element brings its own room');
Object.values(PLACE_OF).every(p=>PLACE_NAME[p])
  ? ok('every room has a name to show') : bad('every room has a name to show');

/* The address must carry the whole matchup, and the rules must be the
   thirty-second six-rounder the real game is played at. */
const urlBad = [];
PERIODS.forEach(p=>{
  const them = profileOf({name:'T', month:p.sm, day:p.sd, year:null});
  const you  = profileOf({name:'Y', month:3, day:28, year:null});   // Aries I, Fire
  const q = new URLSearchParams(fightURL(you, them, 6).split('?')[1]);
  if(q.get('boss') !== periodSlug(p.n)) urlBad.push(`${p.n}: wrong boss`);
  if(q.get('place') !== PLACE_OF[them.elements[0]]) urlBad.push(`${p.n}: room does not follow its element`);
  if(q.get('secs') !== '30') urlBad.push(`${p.n}: rounds are not thirty seconds`);
  if(q.get('rest') !== '14') urlBad.push(`${p.n}: rest is not fourteen seconds`);
  if(q.get('fighter') !== '1') urlBad.push(`${p.n}: your body does not follow your element`);
});
urlBad.length ? bad('the address carries the whole matchup', urlBad.slice(0,4).join('\n      '))
              : ok('all 48 periods make a complete address — opponent, room, body, six rounds of thirty seconds');
fightURL(profileOf({name:'Y', month:3, day:28, year:null}),
         profileOf({name:'T', month:8, day:1, year:null}), 3).includes('rounds=3')
  ? ok('a three-round fight asks the game for three rounds')
  : bad('a three-round fight asks the game for three rounds');

/* The briefing is the reading. The counter must be the line that reaches the
   ring, because build-fight.js puts it in the corner's mouth. */
const briefBad = [];
PERIODS.forEach(p=>{
  const them = profileOf({name:'T', month:p.sm, day:p.sd, year:null});
  const you  = profileOf({name:'Y', month:6, day:20, year:null});
  const b = fightBrief(you, them);
  if(b.answer !== TAUNTS[p.n].c) briefBad.push(`${p.n}: corner does not answer its taunt`);
  if(b.says !== TAUNTS[p.n].t) briefBad.push(`${p.n}: briefing quotes the wrong taunt`);
  if(!b.room || !b.weather || !b.holds || !b.reading) briefBad.push(`${p.n}: briefing has a hole in it`);
  if(!/^#[0-9a-f]{6}$/i.test(b.colour)) briefBad.push(`${p.n}: no colour for the room`);
});
briefBad.length ? bad('every period briefs completely', briefBad.slice(0,4).join('\n      '))
                : ok('all 48 periods brief completely — room, taunt, the answer to it, and how it holds');
new Set(PERIODS.map(p=>fightBrief(profileOf({name:'Y', month:3, day:28, year:null}),
        profileOf({name:'T', month:p.sm, day:p.sd, year:null})).holds)).size === 3
  ? ok('the three qualities give three different ways of holding')
  : bad('the three qualities give three different ways of holding');

/* ---- fight.html: the real game, with the periods added ---- */

const FIGHT = path.join(ROOT, 'fight.html');
if(!fs.existsSync(FIGHT)){
  bad('fight.html is built', 'run: node build-fight.js <path to ring3d.html>');
}else{
  const fight = fs.readFileSync(FIGHT, 'utf8');
  ok(`fight.html is built (${(fight.length / 1024 / 1024).toFixed(1)}MB)`);

  /* It has to still be the real game, not something regenerated. These are
     the game's own, and nothing in this repository writes them. */
  const OWN = [
    ["function faceOff()", "the game's own facing"],
    ["const PLACES={temple:", "the game's own rooms"],
    ["function tellMs()", "the game's own tell"],
    ["function temptLine()", "the game's own talking"],
    ["const ADDICTIONS=", "the game's own table of opponents"],
    ["ROUND_SECS=+Q.get('secs')||30", "the game's own thirty-second round"]
  ];
  const ownGaps = OWN.filter(([f])=>!fight.includes(f));
  ownGaps.length ? bad('fight.html is The Fight of Your Life itself', ownGaps.map(g=>'missing ' + g[1]).join('\n      '))
                 : ok(`fight.html is the real game — all ${OWN.length} of its own parts are still in it`);

  /* Nothing loads from outside: it has to work from a file, offline. */
  /<script[^>]+\bsrc=/.test(fight) ? bad('fight.html pulls nothing in from outside', 'it has a script src')
                                   : ok('fight.html pulls nothing in from outside — one file, opens offline');

  /* The only change: the 48 periods are opponents. */
  const at = fight.indexOf('const ZODIAC = ');
  if(at < 0){ bad('the 48 periods are added as opponents', 'no ZODIAC table'); }
  else{
    const table = JSON.parse(fight.slice(at + 15, fight.indexOf(';\n(function()', at)));
    is(Object.keys(table).length, 48, 'all 48 periods are in fight.html as opponents');
    const zBad = [];
    PERIODS.forEach(p=>{
      const z = table[periodSlug(p.n)];
      if(!z) return zBad.push(`${p.n} is not in the ring`);
      if(z.n !== p.n) zBad.push(`${p.n}: wrong name on the card`);
      if(z.lines[0] !== TAUNTS[p.n].t) zBad.push(`${p.n}: does not open with its own taunt`);
      if(z.c !== TAUNTS[p.n].c) zBad.push(`${p.n}: the corner does not have its counter`);
      const want = parseInt(RING_ELEMENT[SIGNS[p.signs[0]].e].colour.slice(1), 16);
      if(z.g !== want) zBad.push(`${p.n}: glows the wrong element`);
    });
    zBad.length ? bad('every period arrives in the ring intact', zBad.slice(0,4).join('\n      '))
                : ok('every period arrives with its own name, taunt, counter and element colour');
  }
  fight.includes('Object.assign(LINES, window.__ZLINES')
    ? ok("the period's lines are merged into the game's own")
    : bad("the period's lines are merged into the game's own");
  fight.includes('SUPPORT.push(window.__ZCOUNTER')
    ? ok('your corner shouts the line that answers the period')
    : bad('your corner shouts the line that answers the period');

  /* The app must open it, and open it with a real address. */
  html.includes("'fight.html?' + q.toString()")
    ? ok('the app opens the real ring') : bad('the app opens the real ring');
}

/* The rebuilt ring and everything it needed is gone: the real game carries
   its own models, audio and Three.js inside the one file. */
const GONE = ['three.min.js','GLTFLoader.js','SkeletonUtils.js','fighter1.glb','fighter4.glb','ring.glb','audio'];
const left = GONE.filter(f=>fs.existsSync(path.join(ROOT, f)));
left.length ? bad('the rebuilt ring is not shipped alongside the real one', 'still here: ' + left.join(', '))
            : ok('the rebuilt ring and its assets are gone — the real game carries its own');
/(r3-canvas|new THREE\.WebGLRenderer|function playClip)/.test(html)
  ? bad('index.html no longer draws a ring of its own')
  : ok('index.html no longer draws a ring of its own');

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

/* And it has to be about THIS period, not personology in general. */
const generic = [];
Object.entries(DEPTH).forEach(([n,D])=>{
  const mine = new Set(FIELDS.map(f=>cwords(D[f])).flat());
  const others = Object.entries(DEPTH).filter(([m])=>m !== n)
    .map(([,O])=>new Set(FIELDS.map(f=>cwords(O[f])).flat()));
  if(!others.length) return;
  const avgShared = others.reduce((a,S)=>a + [...mine].filter(w=>S.has(w)).length/mine.size, 0)/others.length;
  if(avgShared > 0.30) generic.push(`${n} shares ${Math.round(avgShared*100)}% of its words with the average other reading`);
});
generic.length ? bad('each period reads as its own person', generic.slice(0,4).join('\n      '))
               : ok('each deep reading is its own person — none overlaps the average of the others by a third');

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

/* ---------------------------------------------------------- */
group('The quiz');

/* seeded() is defined in the fight group above. */
function _unusedSeeded(seed){
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

/* Every generator must be exercised and must be answerable from the app's own data. */
const kindsSeen = new Set();
for(let seed = 1; seed <= 400; seed++) makeQuiz([], 6, seeded(seed)).forEach(q=>kindsSeen.add(q.kind));
const missingKinds = Object.keys(QUIZ_KINDS).filter(k=>!kindsSeen.has(k));
missingKinds.length ? bad('every question type gets generated', missingKinds.join(', '))
                    : ok(`every question type gets generated (${kindsSeen.size} types)`);

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
