/* ============================================================
   The recovery app side of The Key.

   This is NOT a file to drop in. It is the edits to make to
   TurnSomeDayIntoOneday/server/server.js, written out with enough
   of the surrounding code to show where each one goes.

   Everything it relies on is already in that file:
     COOKIE_NAME, verifySession, isValidSession — imported from ./auth
     isFriendlyAllowed  — defined around line 64
     DIAG_OWNER_EMAIL   — defined around line 803
     db.getUserById     — used throughout

   Nothing new is invented. This is the /admin/stats + isOwnerRequest
   pattern that is already in that file and already works, pointed at
   a new page and at the allowlist instead of at the owner email.
   ============================================================ */


/* ------------------------------------------------------------
   EDIT 1 — who is allowed through.

   isValidSession() only says the cookie is good; it does NOT set
   req.userId — only requireAuth does that. isOwnerRequest() in that
   file already works around exactly this by reading the payload
   itself, so this is the same three lines pointed at the allowlist.

   Put it directly under isOwnerRequest(), which is around line 806.
   It has to sit BELOW the definitions of isFriendlyAllowed and
   DIAG_OWNER_EMAIL, and that spot is below both.
   ------------------------------------------------------------ */

function isFriendlyRequest(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  const payload = token && verifySession(token);
  const userId = req.userId || (payload && payload.userId);
  if (!userId) return false;
  return isFriendlyAllowed(db.getUserById(userId));
}


/* ------------------------------------------------------------
   EDIT 2 — block the file from static serving.

   express.static serves the whole app root, so key.html would be
   handed to anybody who typed the URL. Put this NEXT TO the line
   that already does the same for the admin shell, and ABOVE
   app.use(express.static(...)) — order matters: whichever is
   registered first wins, and static would win.

   404, not 403. A 403 tells somebody there is something there.
   ------------------------------------------------------------ */

// ...existing, around line 162:
// app.get('/admin-stats.html', (req, res) => res.status(404).end());

app.get('/key.html', (req, res) => res.status(404).end());

// app.use(express.static(path.join(__dirname, '..')));   <-- already there, below


/* ------------------------------------------------------------
   EDIT 3 — the real door.

   Same shape as /admin/stats. Not signed in, or not on the list,
   and they go to /app without learning anything else exists.

   A redirect rather than requireAuth: requireAuth answers with
   401 JSON, which is right for an API call and wrong for somebody
   opening a page in a phone browser.

   This must be registered BELOW isFriendlyRequest (Edit 1). Put it
   with the other app.get page routes near the bottom.
   ------------------------------------------------------------ */

app.get('/key', (req, res) => {
  if (!isValidSession(req)) return res.redirect('/app');
  if (!isFriendlyRequest(req)) return res.redirect('/app');
  res.sendFile(path.join(__dirname, '..', 'key.html'));
});


/* ------------------------------------------------------------
   EDIT 4 — robots.txt

   One line, next to the private-letters block already in there:

     Disallow: /key

   And leave /key out of sitemap.xml.

   The page also carries <meta name="robots" content="noindex,
   nofollow"> from the build, so it is covered twice: robots.txt is
   a request that a crawler may ignore, the meta tag is not.
   ------------------------------------------------------------ */


/* ------------------------------------------------------------
   NOT AN EDIT — the AI is already gated.

   /api/chat already calls isFriendlyAllowed() on every request. The
   page needs no new endpoint and gets no new permission. If somebody
   somehow obtained key.html, the AI would still refuse them, which is
   the check that actually matters — your own comment in that file
   says why it lives on the server and not in the client.

   Nothing here touches CHAT_LIMIT. The Key shares the recovery app's
   daily cap, so a runaway costs nothing extra to stop.
   ------------------------------------------------------------ */


/* ------------------------------------------------------------
   OPTIONAL — a link on the app's own nav.

   /api/friendly/access already exists and already returns { allowed }:

     const { allowed } = await (await fetch('/api/friendly/access')).json();
     if (allowed) showTheKeyLink();

   The page does not need this. It is only so you and the few people
   on the list see a way in without typing the URL.
   ------------------------------------------------------------ */
