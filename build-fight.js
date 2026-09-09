#!/usr/bin/env node
/**
 * build-fight.js — makes fight.html from The Fight of Your Life's ring3d.html.
 *
 * The real game is used as it is. The only change is the opponent: the 48
 * personology periods are added to its ADDICTIONS and LINES tables, so
 * ?boss=<period-slug> puts a period in the ring instead of an addiction.
 * Everything else — the ring, the referee, the crowd, the cameras, the
 * animations, the sound, the rules — is the game's own.
 *
 *   node build-fight.js <path-to-ring3d.html>
 */
const fs = require('fs'), path = require('path'), vm = require('vm');

const SRC = process.argv[2];
if(!SRC || !fs.existsSync(SRC)){
  console.error('usage: node build-fight.js <path-to-ring3d.html>');
  process.exit(1);
}

/* Take the period data from index.html so the two can never disagree. */
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const cut = script.lastIndexOf('/* ====', script.indexOf('   STORAGE'));
const ctx = vm.createContext({console});
vm.runInContext(script.slice(0, cut) + '\n;globalThis.__x = {PERIODS, TAUNTS, SIGNS, RING_ELEMENT};', ctx);
const {PERIODS, TAUNTS, SIGNS, RING_ELEMENT} = ctx.__x;

const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/* The glow is the element's colour from index.html, so the two cannot drift. */
const GLOW = el => parseInt(RING_ELEMENT[el].colour.slice(1), 16);

/* Ring talk that suits any opponent. Its own taunt is the first line and the
   one that says something about the period. */
const FILLER = ['Is that it?', 'Again.', 'You are slowing.', 'Stay down.',
                'I have seen better.', 'Come on then.', 'You are still here?'];

const table = {};
PERIODS.forEach(p=>{
  const el = SIGNS[p.signs[0]].e;
  table[slug(p.n)] = {
    n: p.n, t: p.t, g: GLOW(el), el,
    lines: [TAUNTS[p.n].t, ...FILLER],
    c: TAUNTS[p.n].c
  };
});

const patch = `
/* ---- personology periods as opponents (added by build-fight.js) ---- */
const ZODIAC = ${JSON.stringify(table)};
(function(){
  const k = new URLSearchParams(location.search).get('boss');
  const z = ZODIAC[k];
  if(!z) return;
  ADDICTIONS[k] = {name:z.n, glow:z.g, prop:'none'};
  window.__ZLINES = {}; window.__ZLINES[k] = z.lines.map(l=>({line:l}));
  window.__ZCOUNTER = z.c;
})();
`;

let src = fs.readFileSync(SRC, 'utf8');

/* 1. The entries must exist before the guard that falls back to 'habit'. */
const at = src.indexOf("let addictionKey=(new URLSearchParams");
if(at < 0) throw new Error('could not find the addictionKey guard');
src = src.slice(0, at) + patch + src.slice(at);

/* 2. LINES is defined much later; merge into it once it exists. */
const linesAt = src.indexOf('const LINES={');
if(linesAt < 0) throw new Error('could not find LINES');
let i = src.indexOf('{', linesAt), d = 0, k = i;
while(k < src.length){ if(src[k] === '{') d++; else if(src[k] === '}'){ d--; if(!d) break; } k++; }
const after = src.indexOf(';', k) + 1;
src = src.slice(0, after) +
  '\nObject.assign(LINES, window.__ZLINES || {});' +
  '\nif(window.__ZCOUNTER && typeof SUPPORT !== "undefined"){ SUPPORT.length = 0; SUPPORT.push(window.__ZCOUNTER, "Hands up.", "Read the lean.", "Day one, again."); }' +
  src.slice(after);

fs.writeFileSync(path.join(__dirname, 'fight.html'), src);
console.log(`fight.html written: ${(src.length/1024/1024).toFixed(1)}MB, ${Object.keys(table).length} periods added as opponents`);
console.log('example: fight.html?boss=' + Object.keys(table)[1]);
