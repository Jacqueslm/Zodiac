#!/usr/bin/env node
/**
 * test-private.js — checks the private build, which is the only one with AI in it.
 *
 *   node test-private.js
 *
 * Two things matter more than the rest and are checked hardest:
 *   1. The PUBLIC file never grows an AI, a server call, or a private marker.
 *   2. Nothing is sent anywhere until somebody presses the button, and what
 *      the button says is being sent is what is actually sent.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const pub = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const aiSrc = fs.readFileSync(path.join(ROOT, 'private', 'ai.js'), 'utf8');
const patch = fs.readFileSync(path.join(ROOT, 'private', 'server-patch.js'), 'utf8');

let failures = 0, checks = 0;
function ok(l){ checks++; console.log('  ✓ ' + l); }
function bad(l, d){ checks++; failures++; console.log('  ✗ ' + l + (d ? '\n      ' + d : '')); }
function is(a, e, l){ a === e ? ok(l) : bad(l, `got ${JSON.stringify(a)}, expected ${JSON.stringify(e)}`); }
function group(n){ console.log('\n' + n); }

/* ---------------------------------------------------------- */
group('The public build has no AI in it, and never will by accident');

!/\/api\/chat/.test(pub) ? ok('the public file never calls /api/chat') : bad('the public file calls /api/chat');
!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(pub)
  ? ok('the public file cannot send anything anywhere at all') : bad('the public file can make a network call');
!pub.includes('life-s-zodiacs:private') ? ok('the public file carries no private marker') : bad('the public file carries the private marker');
!/noindex/.test(pub) ? ok('the public file is still meant to be found') : bad('the public file went noindex');

/* The build refuses rather than shipping a second AI into the public file. */
const {build, MARK} = require('./build-private.js');
let built;
try{ built = build(); ok('the private build runs'); }
catch(e){ bad('the private build runs', e.message); }

if(built){
  built.startsWith(MARK) ? ok('the private build is marked as private') : bad('the private build is marked');
  built.includes('noindex, nofollow') ? ok('and is told not to be indexed') : bad('and is told not to be indexed');
  built.includes('/api/chat') ? ok('and it is the one with the AI in it') : bad('the private build has the AI');
  built.includes('<title>The Key — private</title>') ? ok('and says which build it is in the tab') : bad('the tab names the build');
  is((built.match(/fetch\('\/api\/chat'/g) || []).length, 1, 'it calls the AI from exactly one place');
  /* Everything the public file does must survive the copy. */
  ['id="panel-key"','id="tab-key"','function keyRead','function renderKey','personology.key.v1','speakLabel']
    .forEach(n=>built.includes(n) ? ok(`the private build keeps ${n}`) : bad(`the private build keeps ${n}`));
  is(built.length > pub.length, true, 'the private build is the public one plus the layer, not a rewrite');
}

/* ---------------------------------------------------------- */
group('What the AI layer sends, and when');

/* Run the engine, then the AI layer on top of it, with a DOM stubbed just
   enough for the module to register. */
const script = pub.match(/<script>([\s\S]*)<\/script>/)[1];
const cut = script.lastIndexOf('/* ====', script.indexOf('   STORAGE'));
const engine = script.slice(0, cut);

const listeners = [];
const el = () => ({addEventListener(){}, value:'', innerHTML:'', hidden:true, querySelector:()=>null,
                   insertAdjacentHTML(){}, classList:{contains:()=>false}, dataset:{}});
let fetchCalls = 0;
const ctx = vm.createContext({
  console, URLSearchParams,
  fetch: ()=>{ fetchCalls++; return Promise.reject(new Error('no network in tests')); },
  document:{readyState:'complete', addEventListener:(t,f)=>listeners.push(t), getElementById:el,
            querySelectorAll:()=>[], querySelector:()=>null},
  globalThis:undefined
});
/* $ is defined in the app's UI half, below the engine cut this harness loads,
   so it is supplied here rather than pulling the whole DOM layer in. */
ctx.$ = el;
ctx.globalThis = ctx;
vm.runInContext(engine + `\n;globalThis.__api = {profileOf,keyRead,KEY_Q,KEY_AREAS,KEY_SCALES,KEY_TEXTS,keyBlank,DEPTH,DAYS,DESTINY,MONTHS,esc};`,
                ctx, {filename:'index.html:engine'});
vm.runInContext(aiSrc, ctx, {filename:'private/ai.js'});

const api = ctx.__api, AI = ctx.__ai;
AI ? ok('the AI layer loads on top of the app') : bad('the AI layer loads');

if(AI && api){
  is(fetchCalls, 0, 'loading the page sends nothing — nothing goes out until the button is pressed');

  const P = api.profileOf({name:'Test', month:11, day:12, year:null});
  const A = api.keyBlank();
  api.KEY_SCALES.forEach(id=>A[id] = 2);
  A.struggle = 'money'; A.horrific = 'yes'; A.faith = 'left';
  A.job = 'I build apps'; A.goals = 'Finish what I start';

  const msg = AI.buildMessage(P, A);

  /* It must work from the reading, or the model invents astrology. */
  msg.includes(P.per.n) ? ok('the reading’s own period goes with it') : bad('the period goes with it');
  msg.includes(api.DEPTH[P.per.n].hinge) ? ok('and the deep reading') : bad('and the deep reading');
  msg.includes(api.DESTINY[P.per.n].lesson) ? ok('and the path’s lesson') : bad('and the path’s lesson');
  msg.includes(api.DAYS['11-12'].t) ? ok('and the day’s own name') : bad('and the day’s name');

  /* Scores go as words as well as numbers, so a 1 is not read as good. */
  msg.includes('at the very bottom') || msg.includes('low')
    ? ok('scores go over in words, not only as digits') : bad('scores go over in words');
  msg.includes('Money') ? ok('the fight they named goes with it') : bad('the named fight goes with it');
  msg.includes('I build apps') && msg.includes('Finish what I start')
    ? ok('and every word they typed') : bad('the typed words go with it');

  /* It must not ask the model to repeat the page. */
  /do not repeat it/i.test(msg) ? ok('the model is told what the page already said')
                                : bad('the model is told what the page already said');

  /* Blank boxes must be stated, not silently omitted. */
  const blankA = api.keyBlank();
  api.KEY_SCALES.forEach(id=>blankA[id] = 3);
  /left every box blank/i.test(AI.buildMessage(P, blankA))
    ? ok('an empty sheet says so rather than sending a gap') : bad('an empty sheet says so');

  /* The button has to describe what it actually does. */
  const says = AI.whatGoesOver(A);
  says.includes('12 sliders') ? ok('the button counts the sliders being sent') : bad('the button counts the sliders', says);
  /2 boxes/.test(says) ? ok('and counts the boxes') : bad('and counts the boxes', says);
  /nothing typed/.test(AI.whatGoesOver(blankA)) ? ok('and says so when there is nothing typed') : bad('and says so when nothing is typed');

  const blk = AI.block(A);
  /sends it off this phone/i.test(blk) ? ok('the screen says the words leave the device') : bad('the screen says the words leave the device');
  /Nothing else in this app ever leaves your device/i.test(blk) ? ok('and that nothing else does') : bad('and that nothing else does');
  /the key above never\s+needed to/i.test(blk) ? ok('and that the key did not need it') : bad('and that the key did not need it');
  blk.includes('id="ai-go"') ? ok('and there is a button rather than it just happening') : bad('there is a button');

  /* The voice rules travel with every single request. */
  const S = AI.SYSTEM;
  [['no medical claims', /No medical claims/i],
   ['never tells anybody they are finished', /NEVER tell somebody they are finished/i],
   ['never blames somebody for what happened', /Never blame somebody for what happened/i],
   ['does not ask what the horrific thing was', /do not ask what/i],
   ['does not invent astrology', /Do not invent astrology/i],
   ['covers all of a life, not the flattering half', /the bad, the fun, depression, hate, love, envy, fantasy/i],
   ['is blunt and warm at once', /Blunt, warm, and honest/i]
  ].forEach(([label, re])=>re.test(S) ? ok('every request carries the rule: ' + label)
                                      : bad('every request carries the rule: ' + label));

  /* Errors must name the real thing that happened. */
  is(AI.ERRORS[403].includes('not on the list'), true, 'a blocked account is told it is not on the list');
  is(AI.ERRORS[429].includes('tomorrow'), true, 'hitting the daily cap says when it comes back');
  is(AI.ERRORS[401].includes('signed out'), true, 'a signed-out session says so');
  is(AI.ERRORS[503].includes('not switched on'), true, 'no key on the server says so');

  /* A browser's own error text must never reach the screen. */
  /Could not reach the AI/.test(aiSrc) && /err && err\.said/.test(aiSrc)
    ? ok('a dead network gets wording written for a person, not "Failed to fetch"')
    : bad('a dead network gets readable wording');

  /* The model's reply is escaped before it reaches the page. */
  const nasty = AI.render('THE ONE THING\n<img src=x onerror=alert(1)>');
  !nasty.includes('<img src=x') ? ok('the AI’s reply is escaped before it is shown') : bad('the AI reply is escaped');
  nasty.includes('&lt;img') ? ok('and still shown, harmlessly') : bad('and still shown');

  /* A reply that ignores the headings still renders. */
  AI.render('just some prose with no headings at all').includes('<p>')
    ? ok('a reply that ignores the headings still shows') : bad('an unstructured reply still shows');
  AI.render('THE ONE THING\nDo the thing.').includes('<h4>')
    ? ok('and a structured one gets its headings') : bad('a structured reply gets headings');
}

/* ---------------------------------------------------------- */
group('The server patch matches the app it is for');

const server = (()=>{
  const p = '/home/user/jacqueslm/app/TurnSomeDayIntoOneday/server/server.js';
  try{ return fs.readFileSync(p, 'utf8'); }catch(e){ return null; }
})();

if(!server){
  console.log('  – recovery app not in this session, skipping the cross-check');
} else {
  /* Everything the patch leans on has to actually exist over there. */
  ['function isFriendlyAllowed','isValidSession','verifySession','COOKIE_NAME',
   'db.getUserById','express.static','app.get(\'/admin-stats.html\'','/api/friendly/access']
    .forEach(n=>server.includes(n) ? ok(`the recovery app still has ${n}`) : bad(`the recovery app still has ${n}`));

  /* The bug this patch was written around: isValidSession does not set req.userId. */
  const ivs = server.slice(0, 0) || '';
  const auth = (()=>{ try{ return fs.readFileSync('/home/user/jacqueslm/app/TurnSomeDayIntoOneday/server/auth.js','utf8'); }catch(e){ return ''; } })();
  const body = auth.slice(auth.indexOf('function isValidSession'), auth.indexOf('function isValidSession') + 400);
  !/req\.userId\s*=/.test(body)
    ? ok('isValidSession still does not set req.userId — which is why the patch reads the payload itself')
    : bad('isValidSession now sets req.userId — the patch can be simplified');
  patch.includes('const userId = req.userId || (payload && payload.userId);')
    ? ok('and the patch reads it the same way isOwnerRequest does') : bad('the patch reads the user id safely');

  /* /api/chat already gates on the allowlist — the patch must not re-open it. */
  server.includes('if (!isFriendlyAllowed(user)) {')
    ? ok('/api/chat still checks the allowlist itself, so the page cannot grant AI access')
    : bad('/api/chat still checks the allowlist itself');
  !/app\.(get|post|use)\('\/api\//.test(patch)
    ? ok('the patch adds no new API endpoint') : bad('the patch adds an API endpoint');
  patch.includes("app.get('/key.html', (req, res) => res.status(404).end());")
    ? ok('the patch 404s the file so static cannot serve it') : bad('the patch blocks static serving');
  /404, not 403/.test(patch) ? ok('and says why it is a 404 and not a 403') : bad('the 404 choice is explained');
  patch.includes('Disallow: /key') ? ok('and keeps it out of search') : bad('and keeps it out of search');
}

/* ---------------------------------------------------------- */
console.log('\n' + '-'.repeat(58));
console.log(failures ? `FAILED — ${failures} of ${checks} checks failed` : `PASSED — all ${checks} checks`);
process.exit(failures ? 1 : 0);
