# Zodiac

A self-contained personology birthday index. Open `index.html` in a browser —
no server, no build step, no dependencies.

Enter a name and a birthday and it finds which of the 48 periods below the date
falls in, then reads it three ways:

- **Layer I — the period.** Name, title, date range, sign(s), element, quality,
  the reduced day-number with its ruling planet, and the tarot card for the day
  of the month.
- **Layer II — the pair.** Any two saved people read together: elemental and
  quality currents, four relationship domains, and a two-card spread. All 1,176
  combinations of the 48 periods resolve.
- **Layer III — the path.** A life-path reading derived from the period, number
  and card.

People are saved to the browser's `localStorage`. A **Matrix** tab reads every
saved person against every other automatically, and **The 48** tab browses the
whole year.

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

All interpretive text in the app — the readings, the path descriptions, the
pair profiles — was written for this project. Nothing is quoted from any book,
and the path names are this app's own rather than any published list.
