# The Key, inside the recovery app

Private. For you and whoever you put on the list. The public Life's Zodiacs
at `jacqueslm.github.io/Zodiac` does not change and has no AI in it.

---

## What you are installing

One file — `key.html` — plus four small edits to the recovery app.

`key.html` is the whole of Life's Zodiacs with one extra thing: a button on
The Key that sends your answers to the AI you already pay for, and gets back
a reading of what you actually wrote.

It is **generated**, not hand-written. `node build-private.js` in the Zodiac
repo takes the public `index.html` and adds the AI layer to a copy. Never edit
`key.html` by hand — edit `index.html` or `private/ai.js` and build again, or
the two versions drift and the one that drifts is the one nobody is looking at.

---

## Install

**1. Copy the page in**

```
cp private/key.html  <recovery-app>/TurnSomeDayIntoOneday/key.html
```

**2. Make the four edits to `server/server.js` and `robots.txt`**

They are written out in full, with the surrounding code, in
`private/server-patch.js`. Short version:

| # | Where | What |
|---|-------|------|
| 1 | `server.js`, under `isOwnerRequest` (~line 806) | add `isFriendlyRequest()` |
| 2 | `server.js`, next to the `admin-stats.html` 404 (~line 163) | `app.get('/key.html', …404)` |
| 3 | `server.js`, with the other page routes | `app.get('/key', …)` |
| 4 | `robots.txt`, by the `/l/` block | `Disallow: /key` |

Edit 2 **must** sit above `app.use(express.static(...))`. Whichever is
registered first wins, and static would win.

**3. Restart.** That's it. No new dependency, no new env var, no schema change.

---

## Who can get in

Whoever is in **`FRIENDLY_EMAILS`** on Railway, plus whoever is in
`APP_OWNER_EMAIL`. The same list that already controls Friendly.

Adding somebody: Railway → Variables → `FRIENDLY_EMAILS` → add their email,
comma-separated → Save. No deploy. Removing somebody: delete their email.
They are locked out on their next click.

---

## Why nobody else can see it

Four separate locks, and any one of them alone would do it:

1. **`/key.html` returns 404.** A 404, not a 403 — a 403 tells somebody there
   is something there.
2. **`/key` checks the cookie, then the list.** Fail either and you are sent to
   `/app` without learning the page exists.
3. **`/api/chat` checks the list again, server-side.** This is the one that
   actually matters. Even holding the page HTML, the AI refuses. Your own
   comment in `server.js` says why it lives there and not in the client.
4. **`noindex` in the page + `Disallow: /key` in robots.txt.** robots.txt is a
   request a crawler may ignore; the meta tag is not.

The AI key stays on the server. It is never in the page, so it cannot be read
out of it.

---

## What actually gets sent, and when

**Nothing, until the button is pressed.** Loading the page sends nothing.
Turning the key sends nothing — that whole reading is worked out on the phone.

Press **Ask the AI to read it** and this goes, and only this:

- your birthday, your period, and your own reading's text (so the AI works
  from the books' framing rather than inventing astrology)
- your twelve sliders, as words and numbers
- your five choices
- **every word you typed in the boxes**

The screen says that in plain words before you press, and counts what it is
about to send. There is no automatic send anywhere in the file.

This is the one thing in either app that leaves the device. Everything else —
your saved people, your answers, your voice choice — stays in the browser.
The answers themselves are still only stored on the phone; sending them to be
read does not save them anywhere else.

---

## The rules the AI is held to

Sent with every single request, in `private/ai.js`:

- No medical claims. No mechanisms, no diagnosis, no "research shows".
- It can end a fight, a floor, a day. It can never tell somebody they are
  finished.
- Never blame somebody for what happened to them.
- If something horrific was reported: don't ask what, don't guess, don't say
  what it did to them.
- Work from the reading. Don't invent astrology.

If the AI is down, blocked, over its daily cap, or the phone is offline, the
page says which of those it is in plain words — and the key above it still
stands, because that part never needed the AI.

---

## Keeping it current

From the Zodiac repo:

```
node test.js             # the app itself
node test-private.js     # the AI layer, and that the public file has no AI
node build-private.js    # regenerate key.html
```

`node build-private.js --check` fails if `key.html` is stale, so it can go in
CI. The build refuses outright if `index.html` ever grows a `/api/chat` — the
public file having an AI in it should be a build failure, not a surprise.
