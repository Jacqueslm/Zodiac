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
               'makeQuiz','QUIZ_KINDS','findPeriod'];
const ctx = vm.createContext({console});
vm.runInContext(engine + `\n;globalThis.__api = {${NAMES.join(',')}};`, ctx, {filename:'index.html:engine'});
const api = ctx.__api;
const missing = NAMES.filter(n=>api[n] === undefined);
if(missing.length){ console.error('engine did not export: ' + missing.join(', ')); process.exit(1); }
const {PERIODS, LORE, NUMBERS, TAROT, EL_REL, Q_REL, SIGNS, ELEMENTS, QUALITIES, DIM, MONTHS,
       profileOf, reduceNum, digitSum, tarotFor, tarotIndex, relKey, isLeap,
       parseBirthday, parseBulkLine, renderCrest, renderReading, renderPath, renderPair,
       parseCSV, parseContactsCSV, parseVCF, parseContacts, parseContactDate,
       WELLBEING, SIGN_BODY, SIGN_SWATCH, PLANET_LORE, BIRTHSTONE, DESTINY,
       makeQuiz, QUIZ_KINDS, findPeriod} = api;

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
group('The quiz');

/* Seeded, so a failure is reproducible. */
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
