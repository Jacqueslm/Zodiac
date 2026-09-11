#!/usr/bin/env node
/**
 * install.js — puts The Key into the recovery app.
 *
 *   node install.js /path/to/TurnSomeDayIntoOneday
 *   node install.js /path/to/TurnSomeDayIntoOneday --dry
 *
 * Does the four edits from server-patch.js so they do not have to be made
 * by hand, and copies key.html in. Safe to run twice: it checks for its own
 * work first and skips anything already done.
 *
 * Nothing is touched until every edit has been checked as possible. If one
 * anchor cannot be found, it stops before writing anything and says which,
 * rather than leaving the app half-patched.
 *
 * A .bak copy of every file it changes is written next to the original.
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const target = process.argv[2];
const dry = process.argv.includes('--dry');

function die(msg){ console.error('\n  ✗ ' + msg + '\n'); process.exit(1); }
function say(msg){ console.log('  ' + msg); }

if(!target){
  console.log(`
  Put The Key into the recovery app.

    node install.js /path/to/TurnSomeDayIntoOneday
    node install.js /path/to/TurnSomeDayIntoOneday --dry    (say what it would do, change nothing)
`);
  process.exit(0);
}

const APP = path.resolve(target);
const SERVER = path.join(APP, 'server', 'server.js');
const ROBOTS = path.join(APP, 'robots.txt');
const PAGE_SRC = path.join(HERE, 'key.html');
const PAGE_DST = path.join(APP, 'key.html');

if(!fs.existsSync(APP)) die(`No folder at ${APP}`);
if(!fs.existsSync(SERVER)) die(`That does not look like the recovery app — no server/server.js under ${APP}`);
if(!fs.existsSync(PAGE_SRC)) die(`key.html is not next to this script. Keep the unzipped folder together.`);

let server = fs.readFileSync(SERVER, 'utf8');
let robots = fs.existsSync(ROBOTS) ? fs.readFileSync(ROBOTS, 'utf8') : null;

/* ---- the edits, each one able to say whether it is already done ---- */

const GATE = `
/* Who may see The Key. isValidSession() only says the cookie is good — it does
   NOT set req.userId, only requireAuth does — so this reads the payload the
   same way isOwnerRequest above does. */
function isFriendlyRequest(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  const payload = token && verifySession(token);
  const userId = req.userId || (payload && payload.userId);
  if (!userId) return false;
  return isFriendlyAllowed(db.getUserById(userId));
}
`;

const ROUTE = `
// The Key — private. Signed in AND on the allowlist, or you go to /app without
// learning the page is there. A redirect rather than requireAuth, which answers
// 401 JSON — right for an API call, wrong for somebody opening a page.
app.get('/key', (req, res) => {
  if (!isValidSession(req)) return res.redirect('/app');
  if (!isFriendlyRequest(req)) return res.redirect('/app');
  res.sendFile(path.join(__dirname, '..', 'key.html'));
});
`;

const BLOCK = `app.get('/key.html', (req, res) => res.status(404).end());`;

const edits = [
  {
    name: 'the allowlist check (isFriendlyRequest)',
    done: () => server.includes('function isFriendlyRequest(req)'),
    anchor: 'function requireOwner(req, res) {',
    apply: () => { server = server.replace('function requireOwner(req, res) {', GATE + '\nfunction requireOwner(req, res) {'); }
  },
  {
    name: 'the 404 that stops the file being served directly',
    done: () => server.includes(BLOCK),
    anchor: "app.get('/admin-stats.html', (req, res) => res.status(404).end());",
    apply: () => {
      const a = "app.get('/admin-stats.html', (req, res) => res.status(404).end());";
      server = server.replace(a, a + '\n// Same reason as the line above: static would hand this out to anyone.\n' + BLOCK);
    }
  },
  {
    name: 'the /key route',
    done: () => /app\.get\('\/key',/.test(server),
    /* Goes after express.static so isFriendlyRequest is defined by the time
       the module finishes loading, and next to the other page routes. */
    anchor: "app.use(express.static(path.join(__dirname, '..')));",
    apply: () => {
      const a = "app.use(express.static(path.join(__dirname, '..')));";
      server = server.replace(a, a + '\n' + ROUTE);
    }
  }
];

console.log(`\n  The Key → ${APP}${dry ? '   (dry run — nothing will be written)' : ''}\n`);

/* Check everything before writing anything. */
const missing = edits.filter(e=>!e.done() && !server.includes(e.anchor));
if(missing.length){
  die('Could not find where to make these edits:\n      ' +
      missing.map(e=>e.name + '\n        looking for: ' + e.anchor).join('\n      ') +
      '\n\n    The app has changed since this was written. Make the edits by hand from\n' +
      '    server-patch.js, which shows each one with its surrounding code.');
}

let changed = 0;
edits.forEach(e=>{
  if(e.done()){ say(`· already there — ${e.name}`); return; }
  e.apply(); changed++;
  say(`✓ added ${e.name}`);
});

/* robots.txt */
let robotsChanged = false;
if(robots === null){
  say('· no robots.txt found — skipping (the page carries its own noindex anyway)');
} else if(/^\s*Disallow:\s*\/key\s*$/m.test(robots)){
  say('· already there — Disallow: /key');
} else {
  const a = 'Disallow: /letter.html';
  if(robots.includes(a)){ robots = robots.replace(a, a + '\nDisallow: /key'); }
  else { robots = robots.replace(/\n*Sitemap:/, '\nDisallow: /key\n\nSitemap:'); }
  robotsChanged = true;
  say('✓ added Disallow: /key to robots.txt');
}

/* the page */
const pageSame = fs.existsSync(PAGE_DST) &&
  fs.readFileSync(PAGE_DST, 'utf8') === fs.readFileSync(PAGE_SRC, 'utf8');
if(pageSame) say('· already there — key.html is current');

if(dry){
  console.log(`\n  Dry run. ${changed || robotsChanged || !pageSame ? 'There is work to do.' : 'Everything is already in place.'}\n`);
  process.exit(0);
}

/* ---- write ---- */
if(changed){
  fs.writeFileSync(SERVER + '.bak', fs.readFileSync(SERVER));
  fs.writeFileSync(SERVER, server);
  say(`  (kept the old server.js as server.js.bak)`);
}
if(robotsChanged){
  fs.writeFileSync(ROBOTS + '.bak', fs.readFileSync(ROBOTS));
  fs.writeFileSync(ROBOTS, robots);
}
if(!pageSame){
  fs.copyFileSync(PAGE_SRC, PAGE_DST);
  say('✓ copied key.html in');
}

/* A syntax check, so a broken server.js is found now and not on deploy. */
if(changed){
  try{ new Function(fs.readFileSync(SERVER, 'utf8')); say('✓ server.js still parses'); }
  catch(err){
    fs.copyFileSync(SERVER + '.bak', SERVER);
    die('The patched server.js did not parse, so it has been put back as it was.\n' +
        '    ' + err.message + '\n\n    Make the edits by hand from server-patch.js.');
  }
}

console.log(`
  Done.

  Next:
    1. Ship it the way you normally ship — Railway picks up the push.
    2. Railway → Variables → FRIENDLY_EMAILS → add the emails of whoever
       else should get in, comma-separated. If the variable is not there
       yet, create it. You do not need to be in it: APP_OWNER_EMAIL
       already lets you through.
    3. Open turnsomedayintodayone.com/key while signed in.

  Anyone not signed in, or not on the list, is sent to /app and never
  learns the page exists. Signed out, open a private window and try the
  URL — you should land on /app.
`);
