#!/usr/bin/env node
/**
 * build.js — regenerates the period table in index.html from README.md.
 *
 * README.md is the single source of truth for the 48 periods. This script
 * parses it and rewrites the block between the GENERATED PERIODS markers,
 * so the dates in the app can never drift from the dates in the README.
 *
 *   node build.js          rewrite index.html if it is out of date
 *   node build.js --check   exit 1 if it is out of date, write nothing (CI)
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const README = path.join(ROOT, 'README.md');
const INDEX = path.join(ROOT, 'index.html');
const BEGIN = '/* BEGIN GENERATED PERIODS */';
const END = '/* END GENERATED PERIODS */';

const MONTHS = {Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12};
const DIM = [31,29,31,30,31,30,31,31,30,31,30,31];

/** "Mar 25–Apr 2" | "Apr 3–10" -> {sm,sd,em,ed} */
function parseRange(range, where){
  const parts = range.split(/[–—-]/).map(s=>s.trim());
  if(parts.length !== 2) throw new Error(`${where}: cannot split range "${range}"`);
  const start = parts[0].split(/\s+/);
  if(start.length !== 2) throw new Error(`${where}: bad start "${parts[0]}"`);
  const sm = MONTHS[start[0]];
  if(!sm) throw new Error(`${where}: unknown month "${start[0]}"`);
  const sd = Number(start[1]);
  let em, ed;
  if(/^[A-Za-z]/.test(parts[1])){
    const end = parts[1].split(/\s+/);
    em = MONTHS[end[0]];
    if(!em) throw new Error(`${where}: unknown month "${end[0]}"`);
    ed = Number(end[1]);
  } else {
    em = sm; ed = Number(parts[1]);
  }
  for(const [m,d,lbl] of [[sm,sd,'start'],[em,ed,'end']]){
    if(!Number.isInteger(d) || d < 1 || d > DIM[m-1]) throw new Error(`${where}: impossible ${lbl} day ${d}`);
  }
  return {sm, sd, em, ed};
}

/** "Pisces–Aries Cusp" -> [Pisces, Aries];  "Aries I" -> [Aries] */
function parseSigns(name, where){
  const signs = name.includes('Cusp')
    ? name.replace(/\s*Cusp\s*$/, '').split(/[–—-]/).map(s=>s.trim())
    : [name.replace(/\s+(I{1,3})$/, '').trim()];
  const known = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  signs.forEach(s=>{ if(!known.includes(s)) throw new Error(`${where}: unrecognised sign "${s}"`); });
  return signs;
}

/* A period line is exactly:  Name | Mon D[–[Mon ]D] | Title
   Anything else containing a pipe (prose, a markdown table) is ignored, so
   the README can grow without breaking the build. */
const RANGE_RE = /^[A-Z][a-z]{2}\s+\d{1,2}\s*[–—-]\s*(?:[A-Z][a-z]{2}\s+)?\d{1,2}$/;

function parseReadme(file){
  const lines = fs.readFileSync(file || README, 'utf8').split('\n');
  const periods = [];
  lines.forEach((line, i)=>{
    if(!line.includes('|')) return;
    const cols = line.split('|').map(s=>s.trim());
    if(cols.length !== 3) return;
    const [n, r, t] = cols;
    if(!n || !r || !t || !RANGE_RE.test(r)) return;
    periods.push({n, t, r, ...parseRange(r, `README line ${i+1}`), signs: parseSigns(n, `README line ${i+1}`)});
  });
  return periods;
}

/** Every day of a leap year must land in exactly one period. */
function verifyCoverage(periods){
  const problems = [];
  for(let mo = 1; mo <= 12; mo++){
    for(let d = 1; d <= DIM[mo-1]; d++){
      const key = mo * 100 + d;
      const hits = periods.filter(p=>{
        const s = p.sm*100 + p.sd, e = p.em*100 + p.ed;
        return s <= e ? (key >= s && key <= e) : (key >= s || key <= e);
      });
      if(hits.length !== 1){
        problems.push(`${mo}/${d} matches ${hits.length} periods${hits.length ? ' (' + hits.map(h=>h.n).join(', ') + ')' : ''}`);
      }
    }
  }
  return problems;
}

function render(periods){
  const rows = periods.map(p=>
    `  {n:${JSON.stringify(p.n)}, t:${JSON.stringify(p.t)}, r:${JSON.stringify(p.r)}, ` +
    `sm:${p.sm}, sd:${p.sd}, em:${p.em}, ed:${p.ed}, signs:${JSON.stringify(p.signs)}}`
  ).join(',\n');
  return `${BEGIN}\nconst PERIODS = [\n${rows}\n];\n${END}`;
}

function main(){
  const check = process.argv.includes('--check');
  const periods = parseReadme();

  if(periods.length !== 48) fail(`README defines ${periods.length} periods, expected 48`);
  const dupes = periods.map(p=>p.n).filter((n,i,a)=>a.indexOf(n) !== i);
  if(dupes.length) fail(`duplicate period names: ${dupes.join(', ')}`);
  const gaps = verifyCoverage(periods);
  if(gaps.length) fail(`the year is not cleanly covered:\n  ` + gaps.join('\n  '));

  const html = fs.readFileSync(INDEX, 'utf8');
  const a = html.indexOf(BEGIN), b = html.indexOf(END);
  if(a === -1 || b === -1) fail('generation markers not found in index.html');

  const next = html.slice(0, a) + render(periods) + html.slice(b + END.length);
  if(next === html){
    console.log(`build: index.html is up to date (${periods.length} periods, 366/366 days covered)`);
    return;
  }
  if(check){
    console.error('build --check: index.html is STALE. Run `node build.js` and commit the result.');
    process.exit(1);
  }
  fs.writeFileSync(INDEX, next);
  console.log(`build: regenerated ${periods.length} periods into index.html (366/366 days covered)`);
}

function fail(msg){ console.error('build failed: ' + msg); process.exit(1); }

if(require.main === module) main();
else module.exports = {parseReadme, parseRange, parseSigns, verifyCoverage, render, README, INDEX, DIM};
