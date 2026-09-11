#!/usr/bin/env node
/**
 * build-private.js — generates the private build of Life's Zodiacs.
 *
 *   node build-private.js          write private/key.html
 *   node build-private.js --check  verify it is current, write nothing
 *
 * The public app and the private one are the same file. This adds the AI
 * layer to a copy rather than keeping a second copy by hand, because two
 * copies of a 1.2MB file edited separately drift, and the one that drifts
 * is always the one nobody is looking at.
 *
 * What it adds, and nothing else:
 *   - private/ai.css  before </style>
 *   - private/ai.js   after the app's own </script>
 *   - a marker so the page, the server and the tests can all tell which
 *     build they are looking at
 *   - noindex/nofollow, because this one is not for the public
 *
 * The output goes inside the recovery app, behind sign-in and behind the
 * FRIENDLY_EMAILS allowlist. private/INSTALL.md says exactly where.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);
const SRC = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'private', 'key.html');

const MARK = '<!-- life-s-zodiacs:private -->';

function build(){
  const src = fs.readFileSync(SRC, 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'private', 'ai.css'), 'utf8');
  const js  = fs.readFileSync(path.join(ROOT, 'private', 'ai.js'), 'utf8');

  if(src.includes(MARK)) throw new Error('index.html already carries the private marker — the public file must not.');
  if(src.includes('/api/chat')) throw new Error('index.html mentions /api/chat — the public build must have no AI in it.');

  let out = src;

  /* Keep it out of search results even if it is ever reachable. Belt and
     braces with the Disallow line in robots.txt, since robots.txt is a
     request and a meta noindex is an instruction. */
  const head = '<meta name="robots" content="noindex, nofollow">';
  if(!out.includes('<title>')) throw new Error('index.html has no <title> to anchor the head insert to');
  out = out.replace('<title>', head + '\n<title>');

  /* The name says which build it is, so a screenshot is never ambiguous. */
  out = out.replace('<title>Life\'s Zodiacs</title>', '<title>The Key — private</title>');

  const styleAt = out.lastIndexOf('</style>');
  if(styleAt < 0) throw new Error('no </style> to put the AI styles before');
  out = out.slice(0, styleAt) + '\n/* ---------- the AI layer (private build) ---------- */\n' +
        css + out.slice(styleAt);

  const scriptAt = out.lastIndexOf('</script>');
  if(scriptAt < 0) throw new Error('no </script> to put the AI layer after');
  const end = scriptAt + '</script>'.length;
  out = out.slice(0, end) + '\n<script>\n' + js + '</script>\n' + out.slice(end);

  return MARK + '\n' + out;
}

if(require.main === module){
  const check = process.argv.includes('--check');
  let built;
  try{ built = build(); }
  catch(e){ console.error('build-private: ' + e.message); process.exit(1); }

  if(check){
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if(cur !== built){
      console.error('build-private: private/key.html is out of date — run `node build-private.js`');
      process.exit(1);
    }
    console.log(`build-private: private/key.html is up to date (${(built.length / 1024).toFixed(0)}KB)`);
  } else {
    fs.writeFileSync(OUT, built);
    console.log(`build-private: wrote private/key.html (${(built.length / 1024).toFixed(0)}KB)`);
  }
}

module.exports = {build, MARK, OUT};
