/* ============================================================================
   BENIGHTED — FIVE WAYS TO TEACH IT

   ?onboard=slides | meter | prompts | ledger | card | none      (default card)

   `card` is v2-brief.js and is what the build shipped this morning. The four
   here exist because of one note: the card describes daylight, and daylight is
   the one thing in this game that cannot be described. It is a lantern radius
   that shrinks. Four of these five show it; they differ in WHERE, and in what
   they charge the player to find out.

     slides   a five-card deck before the valley. The light ladder is four
              real frames of the same churchyard at four hours, so the lesson
              is a photograph rather than a sentence. Costs four keypresses.
     meter    no deck at all. Daylight becomes a drawn instrument that is
              always on screen, and a pointer names it the first time it
              MOVES. Costs nothing, and adds a HUD to a game whose whole
              thesis is not having one.
     prompts  no new surface. The caption already over the crate gains a
              second line saying why you would bother, once per verb, and
              never again. Cheapest possible, teaches nothing about the
              shape of a three-day run.
     ledger   the run opens with your own book open at its first page, in the
              hand of the carter who came before you. Teaches TAB by being
              the thing TAB puts away, and the premise by being in the
              fiction. All text, which is the thing the note was about.
     card     one screen, everything on it. v2-brief.js.

   ALL FIVE keep the four world lines in v2-brief.js, which fire at the moment
   each lesson becomes true. Those are not in competition with anything here —
   whichever front end wins, they stay.

   This file is meant to lose four fifths of itself.
   ========================================================================== */
(function () {

const Q    = new URLSearchParams(location.search);
/* The harness turns all of this off by default, because a screenshot of a
   prompt does not want a deck over it. But ?cap=…&onboard=… ON PURPOSE is how
   these five get photographed at all — a method that cannot be captured is a
   method that gets compared from memory. Explicit beats implicit. */
const MODE = Q.get('onboard') || (Q.get('cap') ? 'none' : 'prologue');
window.V2_ONBOARD = MODE;              // v2-brief.js reads this
if (MODE === 'card' || MODE === 'none') return;

const IMG = '../../docs/onboarding/img/';


/* ==========================================================================
   0. PROLOGUE  →  PANEL      (the chosen flow)

   Loudon: "Right when you click start, having a dark screen with text on the
   screen laying out the story (in Alveretta). After this, you're placed into
   the game and you get a card like 05 but only the right side of it. Controls,
   daylight explanation, maybe sleeping logic, then you start."

   Two beats, and the split is the point. The STORY runs on black, where it has
   no competition and can be paced; the RULES run over the valley, where the
   thing they describe is already visible behind them. Neither has to be a wall,
   because neither is carrying the other one's job.

   The prologue is four held pairs of lines rather than one page, because six
   sentences arriving at once is the wall this was built to replace, and one
   sentence at a time is a title sequence nobody can read back. Any key takes
   the next pair; escape takes you straight to the panel.
   ========================================================================== */
/* TWO INTROS, and ?intro= picks. A is the original: premise only, no history,
   four beats. B adds the lore — who the thing is, whose door that is, and why
   anybody is wearing a mask at all — in five.

   Keeping both because the question they answer is not "which reads better"
   but "which gives a proper gauge of the game", and that is a thing you find
   out by sitting through each of them, not by editing one. */

/* ---- A. the premise, and nothing before it ---- */
const PRO_A = [
  [`You stopped in this valley for one night.`,
   `In the night somebody took your wagon to pieces and hid the three of them
    apart.`],

  [`Five people are left here. Each wears a carved mask and answers to a trade
    instead of a name.`,
   `One of the five is not a person.`],

  [`It came out of a vault three weeks ago, and it cannot leave on its own
    feet. To leave, it has to be carried &mdash; under cover, out of the
    daylight.`,
   `<em>You are not a victim who wandered in. You are the vehicle.</em>`],

  [`Three days until the blood moon.`,
   `After that it will not need you.`],
];

/* ---- B. the same, with the history that explains the masks ----

   WHAT IT ADDS AND WHY. A tells you there are masks; B tells you what they are
   FOR, and that turns out to be the same sentence as the mechanic: it calls
   the name of a face it remembers and the face answers. A player who has heard
   that understands within one conversation why they are being asked which hand
   lost two fingers — the thing has the face and the coat and none of the life,
   so small domestic memory is the one thing it cannot counterfeit.

   WHAT IT DELIBERATELY DOES NOT SAY. No names. Not the son's, not anybody's —
   §4 of the story document is that a spoken name is the weapon, and an intro
   that says one out loud has broken its own world before the game starts.
   Ilinca is named once in this build, scratched in the mortar at the vault,
   and finding her there should be the first time you read it.

   And it never states the arithmetic. "Six masks, for the six people still
   alive" followed by "five are left" is the whole reveal, and a player who
   counts gets to have found it. Saying "it took the sixth and wears their
   mask" hands over the one thing the game is about. */
const PRO_B = [
  [`You are a carter. You stopped here for one night, and in the night somebody
    took your wagon to pieces and hid the three of them apart.`,
   `You will want them back before the third night.`],

  [`A son of this valley died in the spring.`,
   `Three weeks ago he came back up out of the family vault, and he went to his
    mother first. That is what they do.`],

  [`She is behind that door now. The sexton mortared it shut from the outside,
    so that her son could not go back to her a second time.`,
   `Then he cut six masks, for the six people still alive.`],

  [`It walks up to a face it remembers and it calls the name, and the face
    answers, and that is that. So nobody here has a face, and nobody has a name
    &mdash; only a trade.`,
   `Five of them are left. One of the five is not a person.`],

  [`It cannot leave the valley on its own feet. To leave, it has to be carried
    &mdash; under cover, out of the daylight.
    <em>You are not a victim who wandered in. You are the vehicle.</em>`,
   `Three days until the blood moon. After that it will not need you.`],
];

const PRO = Q.get('intro') === 'b' ? PRO_B : PRO_A;

const BEAT = 5600;          // ms a pair is held before the next arrives

/* THE PANEL. Card 05's right-hand column and nothing else: the story has
   already been told on black and does not need telling again. Loudon's order —
   controls, then daylight, then what happens when it runs out — which is also
   the order they stop being guessable in. */
const PANEL = `<div class="pcard" role="document">
  <h2>Before you go</h2>

  <div class="pbody">
  <div class="pblock">
    <h3>What you press</h3>
    <dl class="keys">
      <dt>&larr; &rarr;</dt><dd>walk</dd>
      <dt>E</dt><dd>speak, search, travel, repair &mdash; whatever you are
                    standing in front of</dd>
      <dt>TAB</dt><dd>your book: who is holding what, what you were told, and
                      <b>who would not answer</b> &mdash; free to open, and the
                      thing most players never find</dd>
      <dt><i class="pip"></i></dt><dd>beside a question, means asking it costs
                      daylight</dd>
    </dl>
  </div>

  <div class="pblock">
    <h3>What it costs</h3>
    <p>Daylight, and nothing else. Walking spends it, searching spends it, and
       some questions spend it. Nothing runs on a clock &mdash; standing still
       is free. One corner of the churchyard, four times in one day:</p>
    <div class="pladder">
      <figure><img src="${IMG}light-95.jpg" alt="full light"
                   ><figcaption>morning</figcaption></figure>
      <figure><img src="${IMG}light-58.jpg" alt="light falling"
                   ><figcaption>afternoon</figcaption></figure>
      <figure><img src="${IMG}light-30.jpg" alt="dusk"
                   ><figcaption>dusk</figcaption></figure>
      <figure><img src="${IMG}light-9.jpg" alt="almost dark"
                   ><figcaption>last light</figcaption></figure>
    </div>
  </div>

  <div class="pblock">
    <h3>When it runs out</h3>
    <p>Night falls where you are standing. Each end of the valley has one roof
       &mdash; the church door, the mill, the crypt steps &mdash; and behind one
       of them you simply wake up in the morning where you slept.</p>
    <p>Caught in the open, something finds you, and you wake on the church floor
       with less than you had. You get three nights. The third is the blood
       moon.</p>
  </div>
  </div>

  <div class="pgo">
    <span class="press">Press any key to begin</span>
    <span class="again">? in the bar brings this back</span>
  </div>
</div>`;

let beat = 0, beatTimer = null;

function proMarkup() {
  return `<div class="pro">
    ${PRO.map((pair, i) => `<div class="beat${i ? '' : ' on'}">${
      pair.map(l => `<p>${l}</p>`).join('')}</div>`).join('')}
    <div class="proskip"><span class="k">any key</span> to go on
      &middot; <span class="k">esc</span> to skip</div>
  </div>`;
}

function showBeat(n) {
  const e = document.getElementById('pro');
  if (!e || e.hidden) return;
  if (n >= PRO.length) return toPanel();
  beat = n;
  e.querySelectorAll('.beat').forEach((b, i) => b.classList.toggle('on', i === beat));
  clearTimeout(beatTimer);
  beatTimer = setTimeout(() => showBeat(beat + 1), BEAT);
}

function startPrologue() {
  /* &pro=0 goes straight to the panel. For photographing it, and for the
     twentieth playtest of the afternoon — the prologue is twenty-two seconds
     and is meant to be seen once, not once per run. */
  if (Q.get('pro') === '0') return openPanel();
  /* &beat=N opens the prologue on one pair, for the same reason. */
  const e = document.getElementById('pro');
  e.innerHTML = proMarkup();
  e.hidden = false;
  /* The valley is already built behind this and will be there the moment the
     black lifts; the prologue does not pause anything, because nothing in this
     game runs on a clock. */
  showBeat(+(Q.get('beat') || 1) - 1);
  addEventListener('keydown', proKeys, true);
  e.addEventListener('pointerdown', proClick);
}

function proKeys(ev) {
  if (ev.metaKey || ev.ctrlKey || ev.key === 'F11') return;
  ev.preventDefault(); ev.stopPropagation();
  if (window.V2Audio) V2Audio.start();     // the first real gesture of the run
  if (ev.key === 'Escape') return toPanel();
  showBeat(beat + 1);
}
function proClick(ev) {
  ev.preventDefault(); ev.stopPropagation();
  if (window.V2Audio) V2Audio.start();
  showBeat(beat + 1);
}

/* The handoff. Black goes, valley arrives, and the rules land on top of it —
   so every noun in the panel has its referent on screen behind the panel. */
function toPanel() {
  clearTimeout(beatTimer);
  const e = document.getElementById('pro');
  if (e && !e.hidden) {
    removeEventListener('keydown', proKeys, true);
    e.removeEventListener('pointerdown', proClick);
    e.classList.add('out');
    setTimeout(() => { e.hidden = true; e.classList.remove('out'); e.innerHTML = ''; }, 900);
  }
  openPanel();
}

let panelOpen = false;

/* THE RULES SCREEN IS LOUDON'S NOW. v2-tutorial.js owns the three frames he
   drew; this file keeps the single-column panel it used to show, behind
   ?panel=old, because it is the thing his deck was designed against and the
   two will want comparing at least once. */
const OLD_PANEL = Q.get('panel') === 'old';

function openPanel() {
  if (!OLD_PANEL && window.V2Tutorial) return V2Tutorial.open();
  const p = document.getElementById('panel');
  if (!p || panelOpen) return;
  if (window.S && S.over) return;
  if (!p.innerHTML) p.innerHTML = PANEL;
  p.hidden = false;
  panelOpen = true;
  addEventListener('keydown', panelKeys, true);
  p.addEventListener('pointerdown', panelClick);
}
function closePanel() {
  if (!OLD_PANEL && window.V2Tutorial) return V2Tutorial.close();
  const p = document.getElementById('panel');
  if (!p || !panelOpen) return;
  panelOpen = false;
  p.hidden = true;
  removeEventListener('keydown', panelKeys, true);
  p.removeEventListener('pointerdown', panelClick);
  if (window.V2Audio) V2Audio.start();
}
function panelKeys(ev) {
  if (ev.metaKey || ev.ctrlKey || ev.key === 'F11') return;
  ev.preventDefault(); ev.stopPropagation();
  closePanel();
}
function panelClick(ev) { ev.preventDefault(); ev.stopPropagation(); closePanel(); }

/* So a title screen's Start button can own this when there is one. The fifteen
   concepts in docs/start-screens.html have not been picked from yet, so for now
   "clicking start" is loading the page. */
window.V2Prologue = {
  play:  startPrologue,
  panel: openPanel,
  isOpen: () => panelOpen || !document.getElementById('pro').hidden,
};

/* ==========================================================================
   1. SLIDES
   ========================================================================== */
const SLIDES = [
  `<h2>Benighted</h2>
   <p class="lede">You are a carter. You stopped in this valley for one night,
      and in the night somebody took your wagon to pieces and hid the three of
      them apart.</p>
   <p class="lede">Something here came out of a vault three weeks ago and it
      cannot leave on its own feet. To leave, it has to be carried &mdash;
      under cover, out of the daylight.
      <b>You are not a victim who wandered in. You are the vehicle.</b></p>
   <p class="lede">Five people are left. Each wears a carved mask and answers
      to a trade instead of a name. One of the five is not a person.</p>`,

  `<h2>You spend one thing</h2>
   <p class="lede">Daylight. Walking spends it, searching spends it, and some
      questions spend it. Nothing here runs on a clock &mdash; standing still
      is free. This is the same corner of the churchyard, four times in one
      day.</p>
   <div class="strip">
     <figure><img src="${IMG}light-95.jpg" alt="The churchyard in full light">
       <figcaption><b>Morning</b>You can see the whole yard, and everything in
         it is worth walking to.</figcaption></figure>
     <figure><img src="${IMG}light-58.jpg" alt="The churchyard, light falling">
       <figcaption><b>Afternoon</b>The far end has gone. You are choosing now,
         not browsing.</figcaption></figure>
     <figure><img src="${IMG}light-30.jpg" alt="The churchyard at dusk">
       <figcaption><b>Dusk</b>One more errand, and it had better be the right
         one.</figcaption></figure>
     <figure><img src="${IMG}light-9.jpg" alt="The churchyard, almost dark">
       <figcaption><b>Last light</b>Everything you can still reach is inside
         the lantern. Get indoors.</figcaption></figure>
   </div>`,

  `<h2>Two verbs</h2>
   <div class="pair">
     <div>
       <h3>Hold E &mdash; search</h3>
       <img src="${IMG}promptsrch.jpg" alt="A search prompt over the crates">
       <p>Nobody in this valley will say a name out loud. Written down is the
          only place names survive, so the ground is where the plot is.</p>
     </div>
     <div>
       <h3>E &mdash; speak</h3>
       <img src="${IMG}talk.jpg" alt="A conversation with a villager">
       <p>Ask what someone remembers about a neighbour, then put it to the
          neighbour. An ember dot beside a question means asking it costs
          daylight.</p>
     </div>
   </div>`,

  `<h2>The book remembers</h2>
   <div class="book">
     <img src="${IMG}notes.jpg" alt="The notebook, open">
     <div class="callouts">
       <h3>TAB, at any time</h3>
       <ul>
         <li><b>Who is holding what.</b> Three parts, three people, struck
             through as they come loose.</li>
         <li><b>What you were told, in the words you heard it in.</b> You never
             have to remember a question &mdash; only who to put it to.</li>
         <li><b>Who would not answer.</b> This is the one most players miss. A
             refusal is not a dead end, it is the tell, and the book says who
             can vouch for them instead.</li>
       </ul>
       <p class="lede" style="margin-top:14px">Opening it is free. It costs no
          daylight and nothing moves while you read.</p>
     </div>
   </div>`,

  `<h2>Three days</h2>
   <p class="lede">Find the three parts, fit them to the wagon, and be gone
      before the moon comes up red. If you are still here on the fourth night,
      it does not need you any more.</p>
   <p class="lede"><b>One of the five is not a person.</b> You will know which
      because they are the one who will not talk about their neighbour.</p>`,
];

let slide = 0;

function deckMarkup() {
  return `<div class="deck" role="document">
    ${SLIDES.map((s, i) => `<div class="slide${i ? '' : ' on'}">${s}</div>`).join('')}
    <div class="bar">
      <div class="dots">${SLIDES.map((_, i) =>
        `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
      <span class="hint">&larr; &rarr; to page</span>
      <button class="skip">Skip</button>
      <button class="next">Next</button>
    </div>
  </div>`;
}

function showSlide(n) {
  const e = document.getElementById('ob');
  slide = Math.max(0, Math.min(SLIDES.length - 1, n));
  e.querySelectorAll('.slide').forEach((s, i) => s.classList.toggle('on', i === slide));
  e.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i === slide));
  const next = e.querySelector('.next');
  /* The last card's button is the one that starts the game, and it should say
     so. "Next" on a final slide is how a deck ends up being clicked past. */
  next.textContent = slide === SLIDES.length - 1 ? 'Begin' : 'Next';
  e.querySelector('.skip').style.visibility =
    slide === SLIDES.length - 1 ? 'hidden' : 'visible';
}

function startSlides() {
  const e = document.getElementById('ob');
  e.innerHTML = deckMarkup();
  e.hidden = false;
  /* &slide=N opens the deck on one card. For photographing it — a headless
     capture cannot press Next, and a deck whose later cards nobody has looked
     at is a deck with its mistakes on the later cards. */
  showSlide(+(Q.get('slide') || 1) - 1);
  e.querySelector('.next').addEventListener('click', ev => {
    ev.stopPropagation();
    slide === SLIDES.length - 1 ? endOverlay(e) : showSlide(slide + 1);
  });
  e.querySelector('.skip').addEventListener('click', ev => {
    ev.stopPropagation(); endOverlay(e);
  });
  addEventListener('keydown', deckKeys, true);
}

function deckKeys(ev) {
  if (ev.metaKey || ev.ctrlKey) return;
  const k = ev.key.toLowerCase();
  ev.preventDefault(); ev.stopPropagation();
  if (k === 'arrowleft')  return showSlide(slide - 1);
  if (k === 'escape')     return endOverlay(document.getElementById('ob'));
  /* Everything else goes forward, and off the end is "begin" — a deck you can
     only leave by finding the right key is a deck people sit inside. */
  if (slide === SLIDES.length - 1) return endOverlay(document.getElementById('ob'));
  showSlide(slide + 1);
}

/* ==========================================================================
   4. LEDGER
   ========================================================================== */
const LEDGER = `<div class="sheet">
  <h2>What you know</h2>
  <p>Woke to the wagon in three pieces. Axle gone, a wheel gone, the harness
     cut off the tilt. Whoever did it did it quietly and did it all the way.</p>
  <p>Five people left in this valley and not one of them has a face or a name
     &mdash; the thresher, the widow, the miller, the sexton, the boy. They
     answer to the trade and nothing else.</p>
  <p class="hand">Took her to pieces myself. Three bits, three places, none of
     them together. If it cannot roll it cannot carry him.</p>
  <p>That is not my hand. Somebody came through here before me and broke his
     own wagon on purpose, to stop a thing being carried out. Mine was broken
     for the opposite reason.</p>
  <p>Three days until the blood moon. Light goes fast here and every step of
     it is spent &mdash; walking, searching, asking. Nothing moves while I am
     standing still, so there is no sense hurrying, only in choosing.</p>
  <p>Keep this to hand. Who is holding what, what I have been told, and who
     would not answer &mdash; that last one is worth more than the other two.</p>
  <div class="close"><b>TAB</b> puts it away, and brings it back</div>
</div>`;

function startLedger() {
  const e = document.getElementById('ledger');
  e.innerHTML = LEDGER;
  e.hidden = false;
  addEventListener('keydown', ledgerKeys, true);
  e.addEventListener('pointerdown', ev => {
    ev.preventDefault(); ev.stopPropagation(); endOverlay(e);
  });
}
function ledgerKeys(ev) {
  if (ev.metaKey || ev.ctrlKey) return;
  ev.preventDefault(); ev.stopPropagation();
  endOverlay(document.getElementById('ledger'));
}

/* Shared exit. Hides whichever overlay is up, releases its key hook, and makes
   the dismissal double as the gesture the audio context has been waiting for,
   so the bed starts at the top of the run rather than on the first step. */
function endOverlay(e) {
  if (!e || e.hidden) return;
  e.hidden = true;
  removeEventListener('keydown', deckKeys, true);
  removeEventListener('keydown', ledgerKeys, true);
  if (window.V2Audio) V2Audio.start();
  if (MODE === 'meter') document.body.classList.add('meter');
}

/* ==========================================================================
   2. METER — daylight as an instrument
   An arc with the sun on it, sliding from one horizon to the other across a
   day, and three notches for the three days. Drawn rather than numeric: this
   game has never put a number in front of the player and a tutorial is a bad
   place to start.
   ========================================================================== */
const ARC = `
<svg viewBox="0 0 168 56" aria-label="Daylight left today" role="img">
  <path d="M6 50 A 106 106 0 0 1 162 50" fill="none"
        stroke="#2E5250" stroke-width="1.5"/>
  <line x1="2" y1="50" x2="166" y2="50" stroke="#1B3A3B" stroke-width="1"/>
  <circle id="sun" cx="6" cy="50" r="6" fill="#D9A05B"/>
  <circle id="sunglow" cx="6" cy="50" r="12" fill="#D9A05B" opacity=".16"/>
</svg>
<div class="days"><i></i><i></i><i></i></div>`;

/* THE ARC IS SHALLOW, AND THAT IS ARITHMETIC, NOT TASTE.

   It was first drawn as a half circle: r=78 across a 156 chord, which puts its
   apex at y = 50-78 = -28, twenty-eight pixels ABOVE the top of a 56-tall
   viewBox. It only rendered at all because the svg carries overflow:visible,
   and at noon the sun sat off the top of the instrument and over the valley.

   r=106 gives a sagitta of 50 - sqrt(106^2 - 78^2) ... = 34, so the whole
   path lives between y=16 and y=50 and the sun never leaves its own box. The
   geometry below is read off the same three numbers as the path, so the disc
   cannot drift off the line it is supposed to be travelling on.

   Computed every tick rather than keyframed, because daylight is spent in
   jumps — a walk of forty pixels, a question that costs six — and an
   animation would smooth away exactly the feedback this exists to give. */
const R  = 106;
const CX = 84;
const CY = 50 + Math.sqrt(R * R - 78 * 78);    // centre, below the horizon
const A0 = Math.atan2(50 - CY,   6 - CX);      // sunrise, left end
const A1 = Math.atan2(50 - CY, 162 - CX);      // nightfall, right end

function placeSun() {
  const svg = document.getElementById('meter');
  if (!svg || !window.S) return;
  const t = Math.max(0, Math.min(1, S.daylight / V2.DAYLIGHT_PER_DAY));
  const a = A0 + (1 - t) * (A1 - A0);
  const x = CX + R * Math.cos(a);
  const y = CY + R * Math.sin(a);
  for (const id of ['sun', 'sunglow']) {
    const c = document.getElementById(id);
    if (c) { c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); }
  }
  svg.querySelectorAll('.days i').forEach((d, i) =>
    d.classList.toggle('spent', i < S.day - 1));
}

/* The pointer. Shown once, and only when the thing it names has just moved —
   a label that arrives before anything has happened is a label nobody reads. */
function point(html, css, secs) {
  const p = document.createElement('div');
  p.className = 'point ' + (css.cls || '');
  p.innerHTML = html;
  Object.assign(p.style, css.style || {});
  document.body.appendChild(p);
  requestAnimationFrame(() => p.classList.add('on'));
  setTimeout(() => {
    p.classList.remove('on');
    setTimeout(() => p.remove(), 600);
  }, (secs || 6) * 1000);
}

let meterTold = {};
function meterTick() {
  if (!window.S || S.over) return;
  placeSun();
  if (!meterTold.sun && S.daylight < V2.DAYLIGHT_PER_DAY - 0.4) {
    meterTold.sun = true;
    point('Your day. Walking spends it, and so does everything else.',
          { cls: 'toright', style: { top: '30px', right: '208px', textAlign: 'right' } }, 7);
  }
  if (!meterTold.book && S.heard && Object.keys(S.heard).length) {
    meterTold.book = true;
    point('Somebody told you something.<br>Your book has it &mdash; press TAB.',
          { cls: 'up', style: { bottom: '46px', left: '50%',
                                transform: 'translateX(-50%)', textAlign: 'center' } }, 7);
  }
}

function startMeter() {
  const m = document.createElement('div');
  m.id = 'meter';
  m.innerHTML = ARC;
  document.body.appendChild(m);
  document.body.classList.add('meter');
  /* No overlay at all, so nothing has taken the audio gesture; the game's own
     first-keypress hook in v2-audio.js is left to do it. */
  setInterval(meterTick, 120);
}

/* ==========================================================================
   3. PROMPTS — the world's own captions carry the reason, once per verb

   IT CANNOT BE APPENDED TO #prompt, which is how this was written first.
   paintPrompt() rewrites that element's innerHTML EVERY FRAME, so the extra
   line survived about sixteen milliseconds out of every hundred and never
   once made it onto the screen — the DOM said it was there and the player
   never saw it. It is its own element, parked under the prompt's own
   measured box, so the two agree without either one owning the other.
   ========================================================================== */
const WHY = {
  search: 'The ground keeps the names nobody here will say out loud.',
  person: 'Ask what they remember about a neighbour. Then go and ask the neighbour.',
  exit:   'Each road costs a slice of the day. Take one you have a question for.',
  wagon:  'Three parts, and this is where they go.',
};

/* Learned by doing, not by being shown: the line is gone the moment the player
   has used that verb once, and never comes back for the rest of the run. */
function learned(kind) {
  if (!window.S) return true;
  if (kind === 'search') return Object.keys(S.searched).length > 0;
  if (kind === 'person') return Object.keys(S.met).length > 0;
  if (kind === 'exit')   return Object.keys(S.seen).length > 1;
  if (kind === 'wagon')  return S.parts.length > 0;
  return true;
}

function whyEl() {
  let w = document.getElementById('why');
  if (!w) {
    w = document.createElement('div');
    w.id = 'why';
    document.body.appendChild(w);
  }
  return w;
}

function promptsTick() {
  const w  = whyEl();
  const el = document.getElementById('prompt');
  const hide = () => w.classList.remove('on');
  if (!el || !window.S || S.over || S.talk) return hide();
  if (!el.classList.contains('on')) return hide();

  const at = (typeof hereIs === 'function') ? hereIs() : {};
  let kind = null;
  if (at.mask) kind = 'person';
  else if (at.object) kind = at.object.wagon ? 'wagon' : 'search';
  else if (at.exit) kind = 'exit';
  if (!kind || learned(kind)) return hide();

  if (w.textContent !== WHY[kind]) w.textContent = WHY[kind];
  /* Centred on the prompt and sitting just under it. Measured rather than
     given a fixed offset: the pill grows with its caption and the whole thing
     is scaled by View.scale, so there is no constant that stays right. */
  const r = el.getBoundingClientRect();
  w.style.left = (r.left + r.width / 2) + 'px';
  w.style.top  = (r.bottom + 8) + 'px';
  w.classList.add('on');
}

/* ==========================================================================
   WIRING
   ========================================================================== */
addEventListener('DOMContentLoaded', () => {
  if (MODE === 'prologue') {
    const btn = document.getElementById('help');
    /* The ? button reopens the PANEL, never the prologue: the story is a thing
       that happened at the start of the run, not a reference card. */
    if (btn) btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const up = (!OLD_PANEL && window.V2Tutorial) ? V2Tutorial.isOpen() : panelOpen;
      up ? closePanel() : openPanel();
    });
    /* A title screen owns the opening now: its Start button calls
       V2Prologue.play(). Playing on load as well would run the prologue
       behind it and have it already finished by the time anyone pressed
       Start. */
    if (window.V2_START) return;
    return startPrologue();
  }
  if (MODE === 'slides')  return startSlides();
  if (MODE === 'ledger')  return startLedger();
  if (MODE === 'meter')   return startMeter();
  if (MODE === 'prompts') return setInterval(promptsTick, 100);
});

})();
