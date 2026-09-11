/* ============================================================
   THE KEY — the AI layer. Private build only.

   The public Life's Zodiacs has no AI and no server, and that
   does not change. This file is injected only into the copy that
   lives inside the recovery app, behind sign-in and behind the
   FRIENDLY_EMAILS allowlist, and it talks to that app's own
   /api/chat — the same endpoint Friendly uses, with the key on
   the server and never in this page.

   What it adds is the one thing the rules genuinely cannot do:
   read what somebody actually typed. The key above it is worked
   out on the device, needs nothing, and still stands if this
   whole file fails. Nothing is sent until the button is pressed,
   and the button says where the words are going.
   ============================================================ */
(function(){
  'use strict';

  /* The voice. His rules, from the recovery app, plus the ones this
     app was written to — the good and the bad, not just the flattering
     half. Held here as one string so it is one thing to change. */
  const SYSTEM = `You are reading one person's life against their personology reading, inside a private app built by Jacques.

WHOSE VOICE THIS IS
Blunt, warm, and honest at the same time. Responsible, accountable, dependable, truth-seeking. You hammer all of a life, not just the good part — the bad, the fun, depression, hate, love, envy, fantasy, all of it. Kindness AND bluntness. You say the true thing, including the unflattering one, but you never say a cruel thing for its own sake.

You are not a horoscope and you do not flatter. You are also not a therapist.

HARD RULES — these do not bend
- No medical claims. No "research shows", no studies, no brain chemistry, no mechanisms, no diagnosis, no treatment. Only what people report.
- You can end a fight, a floor, a day. You can NEVER tell somebody they are finished, beyond help, or too late.
- Never blame somebody for what happened to them.
- If they told you something horrific happened, do not ask what, do not guess what, and do not tell them what it did to them. Acknowledge it and move on to what is theirs to do now.
- Short sentences. Plain words. No jargon. No bullet-point lists of advice.

WHAT YOU ARE WORKING FROM
Below is the person's reading — their period, their deep reading, where their path runs — and their own answers about where they actually are. The reading is the source. Do not invent astrology, do not add signs or planets or dates that are not given to you, and do not contradict what the reading says. Your job is to tie what they WROTE to what the reading already says about them.

WHAT TO WRITE
Four short parts, with these exact headings, nothing before or after:

WHAT YOU WROTE THAT THE SLIDERS COULD NOT SHOW
The thing in their own words that a score could never have caught. Quote a few of their words back. If they wrote almost nothing, say that plainly and keep this part to one line.

WHERE YOUR LIFE AND YOUR READING AGREE
Name it. Be specific about which part of the reading and which part of their life.

WHERE THEY DISAGREE
The interesting part. Where what they wrote does not match what the reading says this temperament does. Do not force this — if they genuinely line up, say so and say what that costs them instead.

THE ONE THING
One move. This week. Specific enough to actually do, small enough to actually do. Not a plan.

Total under 400 words. Write to them as "you".`;

  const SCALE_WORDS = {
    1:'at the very bottom', 2:'low', 3:'in the middle', 4:'good', 5:'at the top'
  };

  /* Everything that goes over the wire is built here, in one place, so
     what is sent is exactly what the button says is sent. */
  function buildMessage(P, A){
    const K = keyRead(P, A);
    const D = (typeof DEPTH !== 'undefined' && DEPTH[P.per.n]) || {};
    const day = (typeof DAYS !== 'undefined' && DAYS[P.person.month + '-' + P.person.day]) || {};
    const dest = P.dest || {};
    const L = [];

    L.push('THEIR READING');
    L.push(`Born ${MONTHS[P.person.month - 1]} ${P.person.day} — ${day.t || ''}.`);
    L.push(`Period: ${P.per.n}, ${P.per.t}.`);
    if(D.hinge) L.push(`What the three books agree on: ${D.hinge}`);
    if(D.tension) L.push(`Where they pull against each other: ${D.tension}`);
    if(D.strong) L.push(`At their best: ${D.strong}`);
    if(D.hard) L.push(`At their worst: ${D.hard}`);
    if(dest.from) L.push(`Path: from ${dest.from} toward ${dest.toward}. The lesson: ${dest.lesson}. The pitfall: ${dest.pitfall}`);

    L.push('');
    L.push('WHERE THEY SAY THEY ARE');
    KEY_SCALES.forEach(id=>{
      const v = Number(A[id]);
      if(!(v >= 1 && v <= 5)) return;
      const q = KEY_Q.find(x=>x.id === id);
      L.push(`- ${KEY_AREAS[id].n}: ${SCALE_WORDS[v]} (${v}/5) — "${q.q}"`);
    });
    if(K.named) L.push(`They named the biggest fight right now as: ${KEY_AREAS[K.named].n}.`);

    ['horrific','kids','faith','world'].forEach(id=>{
      if(!A[id]) return;
      const q = KEY_Q.find(x=>x.id === id);
      const opt = q.opts.find(o=>o[0] === A[id]);
      if(opt) L.push(`- ${q.q} ${opt[1]}`);
    });

    const written = KEY_TEXTS
      .map(id=>({q:(KEY_Q.find(x=>x.id === id) || {}).q, v:String(A[id] || '').trim()}))
      .filter(x=>x.v);
    L.push('');
    if(written.length){
      L.push('WHAT THEY WROTE, IN THEIR OWN WORDS');
      written.forEach(w=>L.push(`${w.q}:\n${w.v}`));
    } else {
      L.push('WHAT THEY WROTE: nothing. They left every box blank.');
    }

    L.push('');
    L.push(`The app has already told them this much on its own, so do not repeat it: their weakest area is ${K.lead ? KEY_AREAS[K.lead].n : 'not established'}, their strongest is ${K.lever ? KEY_AREAS[K.lever].n : 'not established'}, and the key it gave them is the second spent on the first.`);
    L.push('Now write the four parts.');
    return L.join('\n');
  }

  /* What the person is about to send, in their words, so the button is
     not asking them to trust a description of itself. */
  function whatGoesOver(A){
    const typed = KEY_TEXTS.filter(id=>String(A[id] || '').trim()).length;
    const scales = KEY_SCALES.filter(id=>Number(A[id]) >= 1).length;
    const choices = ['struggle','horrific','kids','faith','world'].filter(id=>A[id]).length;
    const bits = [];
    if(scales) bits.push(`${scales} slider${scales === 1 ? '' : 's'}`);
    if(choices) bits.push(`${choices} choice${choices === 1 ? '' : 's'}`);
    bits.push(typed ? `and every word in the ${typed} box${typed === 1 ? '' : 'es'} you filled in`
                    : 'and nothing typed, because you left the boxes empty');
    return bits.join(', ');
  }

  /* Marks an error as one whose wording was written for a person to read. */
  function said(message){ const e = new Error(message); e.said = true; return e; }

  const ERRORS = {
    401: 'You are signed out. Sign in and press it again.',
    403: 'This account is not on the list for the AI. The key above does not need it.',
    429: 'That is today’s AI readings. It comes back tomorrow.',
    503: 'The AI is not switched on for this server at the moment.'
  };

  function block(A){
    return `
    <div class="ai-ask" id="ai-ask">
      <div class="at">One more pass, if you want it</div>
      <p>Everything above was worked out on this phone. It read your sliders. It could not read
      a word you typed, because there is nothing in that page that can.</p>
      <p>The AI can. It will take what you wrote and hold it against your own reading &mdash; what the
      words show that the numbers could not, where your life and your reading agree, and where they
      do not.</p>
      <p class="warn"><b>This sends it off this phone.</b> ${whatGoesOver(A)} &mdash; all of it goes to
      the AI to be read. Nothing else in this app ever leaves your device, and the key above never
      needed to. Only press this if you want that.</p>
      <button class="btn primary" id="ai-go">Ask the AI to read it</button>
      <div class="ai-out" id="ai-out" hidden></div>
    </div>`;
  }

  function render(text){
    /* The model is asked for four fixed headings; anything else it sends
       still shows, just as paragraphs. */
    const heads = ['WHAT YOU WROTE THAT THE SLIDERS COULD NOT SHOW',
                   'WHERE YOUR LIFE AND YOUR READING AGREE',
                   'WHERE THEY DISAGREE', 'THE ONE THING'];
    let html = '';
    const rest = String(text).trim(), up = rest.toUpperCase();
    heads.forEach((h, i)=>{
      const at = up.indexOf(h);
      if(at < 0) return;
      const next = heads.slice(i + 1).map(n=>up.indexOf(n)).filter(x=>x > at);
      const end = next.length ? Math.min.apply(null, next) : rest.length;
      const body = rest.slice(at + h.length, end).trim();
      html += `<h4>${h.charAt(0) + h.slice(1).toLowerCase()}</h4>` +
              body.split(/\n{2,}/).map(p=>`<p>${esc(p.trim())}</p>`).join('');
    });
    if(!html) html = rest.split(/\n{2,}/).map(p=>`<p>${esc(p.trim())}</p>`).join('');
    return html;
  }

  async function ask(P, A){
    const out = $('ai-out'), go = $('ai-go');
    out.hidden = false;
    out.className = 'ai-out';
    out.innerHTML = '<p class="ai-wait">Reading it…</p>';
    go.disabled = true;
    try{
      const res = await fetch('/api/chat', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          system:[{type:'text', text:SYSTEM}],
          messages:[{role:'user', content:buildMessage(P, A)}]
        })
      });
      if(!res.ok){
        let owner = '';
        try{ const j = await res.json(); if(j && j.ownerError) owner = ' (' + j.ownerError + ')'; }catch(e){}
        throw said((ERRORS[res.status] || 'The AI could not be reached just now.') + owner);
      }
      const data = await res.json();
      const text = data && data.content && data.content[0] && data.content[0].text;
      if(!text) throw said('The AI answered with nothing. Press it again.');
      out.innerHTML = render(text);
      /* The voice reads whatever is on the key screen, and this is now part
         of it — so an in-progress reading has to be stopped rather than left
         halfway through a page that changed underneath it. */
      if(typeof stopSpeaking === 'function') stopSpeaking();
    }catch(err){
      /* Only wording written here reaches the screen. A thrown browser
         error says things like "Failed to fetch", which tells somebody
         sitting on a train nothing they can act on. */
      const msg = (err && err.said) ? err.message
        : 'Could not reach the AI — the phone may be offline, or the server may be down.';
      out.className = 'ai-out bad';
      out.innerHTML = `<p>${esc(msg)}</p>
        <p class="ai-still">The key above still stands. It was worked out on this phone and it did
        not need the AI to be right.</p>`;
    }finally{
      go.disabled = false;
      go.textContent = 'Ask the AI again';
    }
  }

  /* Registered after the page's own handler, so it runs once the key is
     on screen. If the key did not render, there is nothing to add to. */
  function wire(){
    const btn = $('btn-key');
    if(!btn) return;
    btn.addEventListener('click', ()=>{
      const out = $('k-result');
      if(!out || !out.innerHTML.trim()) return;
      const body = out.querySelector('.layer.key .layer-body');
      if(!body || body.querySelector('#ai-ask')) return;
      body.insertAdjacentHTML('beforeend', block(KANS));
    });
    document.addEventListener('click', e=>{
      if(!e.target.closest || !e.target.closest('#ai-go')) return;
      const name = $('k-name').value.trim();
      if(!name) return;
      ask(profileOf({name, month:+$('k-month').value, day:+$('k-day').value, year:null}), KANS);
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

  /* Exposed for the test harness only. */
  if(typeof globalThis !== 'undefined') globalThis.__ai = {SYSTEM, buildMessage, whatGoesOver, render, ERRORS, block};
})();
