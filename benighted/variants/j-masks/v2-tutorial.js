/* ============================================================================
   BENIGHTED — THE TUTORIAL

   Loudon's three frames, wired up. His order, which his own progress dots
   already stated:

     Frame 56  "You Spend One Thing"  — dot 1 lit
     Frame 55  "When it runs out"     — dot 2 lit
     Frame 57  "Before You Go"        — dot 3 lit

   The copy below is his, to the word. The four grey 234x129 rectangles on the
   first frame are placeholders in the SVG and are filled here with the real
   daylight frames out of this build, which is what they were left empty for.

   ONE DELIBERATE DEPARTURE, and it is behavioural rather than visual. In the
   files, frame 56 has a white Back button and frame 55 has a greyed one — but
   56 is the FIRST slide, where Back has nowhere to go, and 55 is the second,
   where it does. The two states are his; which slide wears which is swapped,
   so Back is only ever dead on slide one. Both appearances come straight off
   his file: enabled is the white fill with #072F30 type, disabled is the
   stroke on its own with #777.
   ========================================================================== */
(function () {

const IMG = '../../docs/onboarding/img/';

/* His frame is 1052 x 443 and every number in the CSS is in those units. */
const W = 1052, H = 443;

/* Positioned by FIRST BASELINE, exactly as the SVG gives them, minus the
   ascent of the face at that size. Alverata sits its baseline about 0.75em
   down, and the 25px line box adds 2px of half-leading on 21px type:
   top = baseline - 2 - 15.75. Kept as the arithmetic rather than the answer so
   the next person can see where 112.5 came from. */
const asc21 = 2 + 21 * 0.75;
const at = b => (b - asc21).toFixed(1) + 'px';

const SLIDES = [
  /* ---- Frame 56 ---------------------------------------------------- */
  { title: 'You Spend One Thing',
    body: `
      <p class="thin" style="left:40px;top:${at(130.291)};width:980px">
        Daylight is your currency in this game. Walking, searching, repairing,
        and some questions spend your daylight. There is no clock, standing
        still is totally free.</p>
      <p class="thin" style="left:40px;top:${at(205.291)};width:980px">
        What you can see is a gauge of the time you have left. Use it wisely.</p>
      <div class="ladder">
        <figure><img src="${IMG}light-95.jpg" alt="the churchyard in full light">
          <figcaption>Morning</figcaption></figure>
        <figure><img src="${IMG}light-58.jpg" alt="the churchyard, light falling">
          <figcaption>Afternoon</figcaption></figure>
        <figure><img src="${IMG}light-30.jpg" alt="the churchyard at dusk">
          <figcaption>Dusk</figcaption></figure>
        <figure><img src="${IMG}light-9.jpg" alt="the churchyard, almost dark">
          <figcaption>Last Light</figcaption></figure>
      </div>` },

  /* ---- Frame 55 ---------------------------------------------------- */
  { title: 'When it runs out',
    body: `
      <p class="thin" style="left:40px;top:${at(130.291)};width:1000px">
        Night enshrouds you where you&rsquo;re standing and you&rsquo;re caught
        out in the open. Something finds you, and you wake up in a random
        building, with no memories of what happened, and less than you had.</p>
      <p style="left:40px;top:${at(205.291)};width:980px">
        Each end of the valley has one roof to sleep under:</p>
      <p style="left:40px;top:${at(255.291)};width:980px">
        <b>The Church, The Mill, and The Crypt.</b></p>
      <p class="thin" style="left:40px;top:${at(305.291)};width:980px">
        You have 3 nights, the third is the blood moon.</p>
      <p style="left:40px;top:${at(355.291)};width:980px">
        Make it out before then.</p>` },

  /* ---- Frame 57 ---------------------------------------------------- */
  { title: 'Before You Go',
    body: `
      <div class="key k1">&larr;&rarr;</div>
      <div class="key k2">E</div>
      <div class="key k3">Tab</div>
      <div class="key k4"><i class="pip"></i></div>
      <p style="left:113px;top:${at(135.291)};width:900px">Walk.</p>
      <p style="left:113px;top:${at(206.291)};width:900px">
        Speak, search, travel, repair.</p>
      <p style="left:113px;top:${at(264.291)};width:910px">
        Your book: who is holding what, what you were told, and
        <span class="ember">who would not answer.</span><br>Free to open.</p>
      <p style="left:113px;top:${at(348.291)};width:900px">
        Beside a question means it costs you daylight.</p>` },
];

let i = 0, open = false;

function el() { return document.getElementById('tut'); }

function markup() {
  return `<div class="sheet" role="document" aria-label="How to play">
    ${SLIDES.map((s, n) => `<div class="slide${n ? '' : ' on'}">
        <h2>${s.title}</h2>${s.body}
      </div>`).join('')}
    <div class="dots">${SLIDES.map((_, n) =>
      `<i class="${n ? '' : 'on'}"></i>`).join('')}</div>
    <div class="btns">
      <button class="back" disabled>Back</button>
      <button class="next">Next</button>
    </div>
  </div>`;
}

function show(n) {
  const e = el();
  if (n < 0) return;
  if (n >= SLIDES.length) return close();
  i = n;
  e.querySelectorAll('.slide').forEach((s, k) => s.classList.toggle('on', k === i));
  e.querySelectorAll('.dots i').forEach((d, k) => d.classList.toggle('on', k === i));
  /* Dead only on the first slide. See the note at the top. */
  e.querySelector('.back').disabled = i === 0;
  /* The last button starts the game, so it should say so. "Next" on a final
     slide is how a deck ends up being clicked past rather than read. The row
     is pinned to the right edge, so the wider word grows leftward and the
     margins his file sets do not move. */
  e.querySelector('.next').textContent =
    i === SLIDES.length - 1 ? 'Begin' : 'Next';
}

/* ONE SCALE FACTOR FOR THE WHOLE SHEET.

   CSS cannot do this on its own: scale() needs a unitless number and calc()
   will not divide a length by a length, so min((100vw - 48px) / 1052, …) is
   not expressible. Measured here instead, which is also what fitFrame() does
   for the dialogue sheet.

   Allowed slightly over 1 on a big window — his frame is 1052 wide and a 1440
   screen can carry it at 1.2 without softening anything, because every pixel
   in it is either live type or an image with more resolution than it needs. */
function fit() {
  const e = el();
  if (!e || e.hidden) return;
  /* CLAMPED AT THE BOTTOM, and not defensively — it actually happened. A
     window measured at 0x0 (which is what an embedded pane reports before it
     has laid out) gives (0 - 56) / 443 = -0.126, and scale(-0.126) draws the
     whole sheet upside down and backwards at an eighth of a millimetre. Any
     environment that can report a zero viewport can hand you a negative
     scale, so the floor is part of the formula rather than a guard around it. */
  const s = Math.max(0.4,
            Math.min(1.22, (innerWidth - 56) / W, (innerHeight - 56) / H));
  e.querySelector('.sheet').style.setProperty('--s', s.toFixed(4));
}

function openTut() {
  const e = el();
  if (!e || open) return;
  if (window.S && S.over) return;
  if (!e.innerHTML) e.innerHTML = markup();
  e.hidden = false;
  open = true;
  /* &tut=N opens on one frame. For photographing it, and for checking a slide
     against the file it came from without clicking Next twice. */
  show(+(new URLSearchParams(location.search).get('tut') || 1) - 1);
  fit();
  addEventListener('resize', fit);
  addEventListener('keydown', keys, true);
  e.querySelector('.back').onclick = ev => { ev.stopPropagation(); show(i - 1); };
  e.querySelector('.next').onclick = ev => { ev.stopPropagation(); show(i + 1); };
}

function close() {
  const e = el();
  if (!e || !open) return;
  open = false;
  e.hidden = true;
  removeEventListener('resize', fit);
  removeEventListener('keydown', keys, true);
  if (window.V2Audio) V2Audio.start();

  /* Day one's card. This fires on every way out of the tutorial — Begin,
     Escape, and the ? reopened at noon on day three — and V2Day refuses a day
     it has already shown in this run, so only the first one lands. The guard
     lives there rather than here because nextDay() needs the same one. */
  if (window.V2Day) V2Day.show();
}

/* The buttons are the interface, but a keyboard-driven game should not make
   you reach for the mouse three times before it starts. Arrows page, escape
   leaves, and enter or space takes the next slide — and off the end, begins. */
function keys(ev) {
  if (ev.metaKey || ev.ctrlKey || ev.key === 'F11') return;
  const k = ev.key;
  ev.preventDefault(); ev.stopPropagation();
  if (k === 'ArrowLeft')  return show(i - 1);
  if (k === 'Escape')     return close();
  show(i + 1);
}

window.V2Tutorial = { open: openTut, close, isOpen: () => open };

})();
