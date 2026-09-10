# Zodiac

A self-contained personology birthday index. Open `index.html` in a browser —
no server, no build step, no dependencies.

Enter a name and a birthday and it finds which of the 48 periods below the date
falls in, then reads it three ways:

- **Layer I — the period.** A written portrait of that period, then its date
  range, sign(s), element, quality, the reduced day-number with its ruling
  planet, and the tarot card for the day of the month.
- **Layer II — the pair.** Any two saved people read together: elemental and
  quality currents, four relationship domains, and a two-card spread. All 1,176
  combinations of the 48 periods resolve.
- **Layer III — the path.** A birthday read as a direction rather than a
  description: the starting position it begins from, the destination it moves
  toward, the core lesson, the goal, the pitfall, what to release and what
  arrives in return, and a first step.

Each reading also carries a **state of mind**, a **body and wellbeing** note
(the region each sign traditionally rules, plus the period's own tendency), and
a **correspondences** panel: birthstone for the birth month, the planetary
stone, sign and planet colours, metal, day of the week, flower and body zone.

### How to use this

A **How to use this** button sits in the header, reachable from any tab. It
opens plain instructions covering every tab, the three controls at the top of
a reading, saving people, importing contacts, and putting the app on a phone's
home screen. Held to the same reading level as the short version of a reading
— it is the screen for somebody who is already stuck — and tested for it:
sentences average twelve words and long words stay at three per cent.

### The day

Above all of it sits the day itself — a named profile for each of the 366 days,
from *The Secret Language of Days*: the name of the day, an opening, then love,
money, family, emotions, friendships, mind, body, spirit, work, risk and
outlook, strengths and weaknesses, advice, and a closing line. The writing is
unchanged. Two things were regenerated.

**The header line** under each name is rebuilt for all 366 days from the period
table, which is generated from this README and checked for full-year coverage.
As supplied it disagreed on fourteen days: six of its cusps ended on the 22nd
while its other six ran to the 24th or 25th, handing the last days of
Taurus–Gemini, Gemini–Cancer, Leo–Virgo, Virgo–Libra, Libra–Scorpio and
Scorpio–Sagittarius to the following week. It also gave the 30th of each month
The Hanged Man, card twelve, where its own rule everywhere else — add the
digits once, which gives Justice on the 29th and The Emperor on the 31st —
gives The Empress. Every header now comes from one place, and a test compares
all 366 against it.

**Six pairs of days shared a name.** One of each was renamed from its own text
— 12 February, 8 May, 18 May, 15 July, 14 August and 10 November. All 366 are
now distinct, and a collision fails the build.

The corrected source sits in `days/`, one Markdown file per month plus
`days.json`.

### The whole person

Under that sits the deep reading — all 48 periods, written for this app. Each
one covers both sides of the personality, then love, anger, envy, what a
person daydreams about, fun, the dark stretch and money, then mind, body and
spirit, the family you came from and the family you make, how close people
get, the direction, and four stages of a life.

It opens on **where the three books meet**: the period and its line from
*Birthdays*, the from/toward from *Destiny*, and — for *Relationships* — the
pair engine itself, run against all four elements, so that line can never
drift from what the Pair tab would say about the same person. Under it, the
hinge all three circle, and **where they pull against each other**, which is
the part that makes it one system instead of three lists. *Birthdays* counts a
period's trait as its gift; *Destiny* counts the same trait as the thing to
put down. Both are true, and saying so is more use than pretending they agree.

The writing is blunt where the books are blunt. A period is called
manipulative, lazy, contemptuous or a liar when its own week carries that, and
never when it does not. Two buttons sit at the top of it:

Two controls sit at the top of every reading, in a bar that stays put while
the reading scrolls — a reading runs to some fifteen thousand pixels, so
anything below the fold may as well not be there.

- **Short version** — the whole reading in plain English: which day and week
  you are, then you, you and other people, and where you are going. Tested for
  reading level, not just for existing: sentences must average under fourteen
  words and long words stay under one in twenty.
- **Read it to me** — the device's own voice, so nothing downloads and it
  works offline. It reads whichever version is on screen: about a thousand
  characters for the short one, twelve thousand for the full reading. Stops on
  demand and when the page closes.
- **Voice** — pick from whatever your phone or computer has installed, warmest
  first, with a sample button. The choice is remembered.

The voice handling is ported from the voice guide in Some Day / Day One, where
it was worked out on real devices. Browsers do not have one speech engine but
dozens, and most fail quietly: a default voice that is the flattest one
installed, an utterance garbage-collected mid-sentence on Chrome and Android,
desktop Chrome stopping after fifteen seconds unless nudged, and an engine
with no voices at all erroring within milliseconds — which, taken as the end
of a line, races an entire reading past in a second. Each has a guard, and
each guard has a test naming it, because losing one of them breaks nothing
visible until somebody presses the button.

People are saved to the browser's `localStorage`. A **Matrix** tab reads every
saved person against every other automatically, and **The 48** tab browses the
whole year.

The **Learn** tab teaches the system rather than just testing it.

Astrology is a small system, not a long list: twelve signs built from four
elements and three qualities, laid out across four seasons. Four study screens
lay that out — **the wheel** (all twelve at once, and why each sits where it
does), **the four elements** (what a person is made of, at their best and
their worst, and how to spot each one), **the three qualities** (Cardinal,
Fixed and Mutable — which are not personality words but positions in a season:
the sign that opens it, the one that holds its middle, the one that ends it
and hands over), and **one sign in full**, including the weeks inside it and
any of your saved people born under it.

Then a **quiz** of ten questions drawn from 24 generators. Fourteen of them
are on the elements, the qualities, the seasons and how they combine — which
sign opens Summer, what Fixed actually means, which sign is Water and
Cardinal, which three signs make up Autumn — alongside periods, dates, cards,
stones and body regions, plus questions about the people you have saved once
there are three or more. Every answer comes back with the reasoning rather
than a tick, because the explanation is where the learning happens.

## Entering people

Beyond one-at-a-time entry, the **People** tab takes a pasted list — one person
per line, name and birthday separated by a comma or a tab:

```
Ada Marchetti, 29 Nov 1988
Bo Tran	1991-04-07
Cy Okonkwo, February 29 1996
Dara Whitlock, 3/14
```

Dates may be `1991-04-07`, `29 Nov 1988`, `Nov 29, 1988`, `3/14/1990` or `3/14`.
Numeric dates are read month/day; the year is optional. Lines that cannot be read
are reported individually rather than silently dropped, and duplicates are
skipped. The same tab exports and re-imports everyone as JSON.

**Import contacts** takes a contacts export directly:

- **Google Contacts** — contacts.google.com → Export → Google CSV
- **Outlook** — a CSV with `First Name` / `Last Name` / `Birthday` columns
- **iPhone / iCloud** — a vCard (`.vcf`), including multi-card exports

Only contacts that actually have a birthday saved are imported; the rest are
counted and reported so nothing disappears quietly. Birthdays stored without a
year — Google's `--11-29`, Apple's `X-APPLE-OMIT-YEAR` — import as a day and
month, which is all the reading needs.

The address bar always holds a permalink to the reading on screen, so a reading
can be bookmarked or reopened directly.

## The 48 periods

This list is the single source of truth for the dates. `index.html` does not
contain a hand-written copy of it — the period table inside the file is
generated from the lines below by `build.js`. To change a date or a name, edit
this list and run the build.

Pisces–Aries Cusp | Mar 19–24 | The Cusp of Rebirth
Aries I | Mar 25–Apr 2 | The Week of the Child
Aries II | Apr 3–10 | The Week of the Star
Aries III | Apr 11–18 | The Week of the Pioneer
Aries–Taurus Cusp | Apr 19–24 | The Cusp of Power
Taurus I | Apr 25–May 2 | The Week of Manifestation
Taurus II | May 3–10 | The Week of the Teacher
Taurus III | May 11–18 | The Week of the Natural
Taurus–Gemini Cusp | May 19–24 | The Cusp of Energy
Gemini I | May 25–Jun 2 | The Week of Freedom
Gemini II | Jun 3–10 | The Week of New Language
Gemini III | Jun 11–18 | The Week of the Seeker
Gemini–Cancer Cusp | Jun 19–24 | The Cusp of Magic
Cancer I | Jun 25–Jul 2 | The Week of the Empath
Cancer II | Jul 3–10 | The Week of the Unconventional
Cancer III | Jul 11–18 | The Week of the Persuader
Cancer–Leo Cusp | Jul 19–25 | The Cusp of Oscillation
Leo I | Jul 26–Aug 2 | The Week of Authority
Leo II | Aug 3–10 | The Week of Balanced Strength
Leo III | Aug 11–18 | The Week of Leadership
Leo–Virgo Cusp | Aug 19–25 | The Cusp of Exposure
Virgo I | Aug 26–Sep 2 | The Week of System Builders
Virgo II | Sep 3–10 | The Week of the Enigma
Virgo III | Sep 11–18 | The Week of the Literalist
Virgo–Libra Cusp | Sep 19–24 | The Cusp of Beauty
Libra I | Sep 25–Oct 2 | The Week of the Perfectionist
Libra II | Oct 3–10 | The Week of Society
Libra III | Oct 11–18 | The Week of Theater
Libra–Scorpio Cusp | Oct 19–25 | The Cusp of Drama & Criticism
Scorpio I | Oct 26–Nov 2 | The Week of Intensity
Scorpio II | Nov 3–11 | The Week of Depth
Scorpio III | Nov 12–18 | The Week of Charm
Scorpio–Sagittarius Cusp | Nov 19–24 | The Cusp of Revolution
Sagittarius I | Nov 25–Dec 2 | The Week of Independence
Sagittarius II | Dec 3–10 | The Week of the Originator
Sagittarius III | Dec 11–18 | The Week of the Titan
Sagittarius–Capricorn Cusp | Dec 19–25 | The Cusp of Prophecy
Capricorn I | Dec 26–Jan 2 | The Week of the Ruler
Capricorn II | Jan 3–9 | The Week of Determination
Capricorn III | Jan 10–16 | The Week of Dominance
Capricorn–Aquarius Cusp | Jan 17–22 | The Cusp of Mystery & Imagination
Aquarius I | Jan 23–30 | The Week of Genius
Aquarius II | Jan 31–Feb 7 | The Week of Youth & Ease
Aquarius III | Feb 8–15 | The Week of Acceptance
Aquarius–Pisces Cusp | Feb 16–22 | The Cusp of Sensitivity
Pisces I | Feb 23–Mar 2 | The Week of Spirit
Pisces II | Mar 3–10 | The Week of the Loner
Pisces III | Mar 11–18 | The Week of Dancers & Dreamers

## Working on it

```
node build.js           regenerate the period table in index.html from this file
node build.js --check   fail if index.html is out of date (used by CI)
node test.js            run the test suite
npm test                both of the above
```

`build.js` refuses to write a period table that does not cover the year
cleanly: if an edit here leaves a day belonging to no period, or to two, the
build fails and names the day.

`test.js` runs the app's engine outside a browser and checks, among other
things, that every name, range and title still matches this file verbatim; that
all 366 days of a leap year resolve to exactly one period; that all 1,176 pair
combinations render; and that the two numeric reductions stay distinct — the
day-number reduces all the way (the 29th → 2, ruled by the Moon) while the
tarot card sums the digits only once (the 29th → XI, Justice).

CI runs both on every push.

## A note on sources

The 48 periods, their titles and their date ranges are the personology
framework popularised by Gary Goldschneider and Joost Elffers. The
correspondences the app uses are standard: a period's sign gives its element
and quality, the day of the month reduces to a number with its ruling planet,
and the day of the month also names a Major Arcana card.

The correspondence tables are traditional attributions: the body region each
sign rules, the classical planetary metals and days, and the common modern
birthstone list. Uranus and Neptune are modern planets with no classical metal
or day, and the app says so rather than inventing one.

All interpretive text in the app — the readings, the path descriptions, the
pair profiles, the health and state-of-mind notes — was written for this
project. The health notes are general observations about temperament, not
medical advice, and the app says that too. Nothing is quoted from any book,
and the path names are this app's own rather than any published list.
