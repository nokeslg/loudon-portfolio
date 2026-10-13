/* ============================================================================
   BENIGHTED — THE BRIEFING, AND THE FOUR THINGS THE WORLD TEACHES

   The problem this solves, in Loudon's words: "there's ZERO onboarding and to
   an outside user, the game might not make sense on first glance."

   WHY A CARD AND NOT A GUIDED TUTORIAL. A scripted tutorial has to gate the
   world — no walking until you have searched, no searching until you have
   talked — and every one of those gates fights a system that is already
   load-bearing here: the daylight budget, the exit lock, the threat planes,
   the five once-per-run character intros. It is also a tax on a run that is
   ten minutes long and built to be replayed: a tutorial you cannot skip is
   paid for every single time, and one you can skip teaches nobody.

   And it would be answering the wrong question. The HUD already says which
   keys there are, and the pills already say "Hold E To Search". What a first
   player does not know is WHY: that daylight is a budget rather than a timer,
   that a refusal is the tell, and that they are the vehicle. None of that is a
   tutorial. It is four sentences and a legend.

   So: one card up front, and four lines that fire in the world at the exact
   moment each lesson becomes true. The card is the premise; the four lines
   are the teaching, and they are deliberately not on the card, because nobody
   remembers the fourth bullet of a notice forty seconds later.

   NOTHING IN HERE EDITS THE GAME. It reads window.S and calls say(), the same
   two things v2-audio.js leans on, and it finds a new run by watching for a
   new S OBJECT rather than by being told about one — newRun() assigns a fresh
   object to window.S, so identity is the signal and there is no call to miss.
   ========================================================================== */
(function () {

const Q = new URLSearchParams(location.search);

/* ?brief=0 turns off ALL of this — the card and the four lines both, because
   they are one feature and a flag that only half-applies is a flag nobody can
   remember the meaning of. The capture harness turns it off unconditionally,
   and that has to cover the lines as well as the card: the first ?cap=spot
   screenshot came back with "Nobody here will say a name out loud" written
   across the church, because the harness stands the player next to the thing
   it is photographing, which is exactly what the lesson watches for. */
const SKIP = Q.get('brief') === '0' || !!Q.get('cap');

/* v2-onboard.js parses first and sets this. The card is one of five methods in
   the bake-off and is the default; when another is in play the card stays shut
   and only the four world lines below are shared. */
const IS_CARD = (window.V2_ONBOARD || 'card') === 'card';
const TEACH_OFF = SKIP || window.V2_ONBOARD === 'none';

/* --------------------------------------------------------------------------
   THE CARD
-------------------------------------------------------------------------- */
const IMG = '../../docs/onboarding/img/';

const CARD = `
<div class="card" role="document" aria-label="How to play Benighted">
  <h2 class="title">Benighted</h2>
  <p class="sub">Three days before the blood moon</p>
  <div class="rule"></div>

  <div class="cols">
    <div>
      <div class="block">
        <h3>What is happening</h3>
        <p>You are a carter. You stopped here for one night, and in the night
           somebody took your wagon to pieces and hid the three of them across
           the valley.</p>
        <p>Something in this valley came out of a vault three weeks ago, and it
           cannot leave on its own feet. To leave, it has to be carried &mdash;
           under cover, out of the daylight.</p>
        <p class="turn">You are not a victim who wandered in. You are the
           vehicle.</p>
        <p>Five people are left here. Each wears a carved mask and answers to a
           trade instead of a name. One of the five is not a person. Find your
           three parts, fit them, and be gone before the moon comes up red.</p>
      </div>
    </div>

    <div>
      <div class="block">
        <h3>What it costs</h3>
        <p>Daylight, and nothing else. Walking spends it, searching spends it,
           and some questions spend it. Nothing runs on a clock &mdash;
           standing still is free. One corner of the churchyard, four times in
           one day:</p>
        <div class="ladder">
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

      <div class="block">
        <h3>What you press</h3>
        <dl class="keys">
          <dt>&larr; &rarr;</dt><dd>walk</dd>
          <dt>E</dt><dd>speak, search, travel, repair &mdash; whatever you are
                        standing in front of</dd>
          <dt>TAB</dt><dd>your book: who is holding what, what you were told,
                          and <b>who would not answer</b> &mdash; free to open,
                          and the thing most players never find</dd>
          <dt><i class="pip"></i></dt><dd>beside a question, means asking it
                          costs daylight</dd>
        </dl>
      </div>
    </div>

    <div class="block wide">
      <h3>How a part comes loose</h3>
      <p>Ask someone what they remember about a neighbour, then put that to the
         neighbour. Get it right and they hand over what they are holding.</p>
      <p>Someone who will not talk about a neighbour has not wasted your day.
         It is the most useful thing anybody will tell you.</p>
    </div>
  </div>

  <div class="go">
    <span class="press">Press any key to begin</span>
    <span class="again">? in the bar below brings this back<br>
                        nothing is lost while it is open</span>
  </div>
</div>`;

let open = false;

function el() { return document.getElementById('brief'); }

function openBrief() {
  const e = el();
  if (!e || open) return;
  /* Not over an ending: #end is the payoff frame and this would land on top
     of it, and "press any key to begin" is a lie at that point anyway. */
  if (window.S && S.over) return;
  if (!e.innerHTML) e.innerHTML = CARD;
  e.hidden = false;
  open = true;
  markScroll();
  addEventListener('resize', markScroll);
  /* Capturing, so a keypress meant for the card never also walks the player
     one frame to the left. Same guard playIntro() uses, same reason. */
  addEventListener('keydown', swallow, true);
  e.addEventListener('pointerdown', byClick);
}

function closeBrief() {
  const e = el();
  if (!e || !open) return;
  open = false;
  e.hidden = true;
  removeEventListener('resize', markScroll);
  removeEventListener('keydown', swallow, true);
  e.removeEventListener('pointerdown', byClick);
  /* Dismissing it is also the gesture the audio context has been waiting for,
     so the bed starts at the top of the run rather than on the first step. */
  if (window.V2Audio) V2Audio.start();
}

/* Does the body overflow? Only then does it get the fade at its bottom edge.
   Measured after a frame, because the card is written into the DOM and
   unhidden in the same tick and has no layout yet at that point. */
function markScroll() {
  requestAnimationFrame(() => {
    const c = el() && el().querySelector('.cols');
    if (c) c.classList.toggle('scrolls', c.scrollHeight - c.clientHeight > 2);
  });
}

function swallow(ev) {
  /* Let the browser's own chrome through; eat everything else. */
  if (ev.metaKey || ev.ctrlKey || ev.key === 'F11') return;
  ev.preventDefault();
  ev.stopPropagation();
  closeBrief();
}
function byClick(ev) { ev.preventDefault(); ev.stopPropagation(); closeBrief(); }

/* --------------------------------------------------------------------------
   THE FOUR LINES

   One per lesson, once per run, in the narration line the game already uses
   for everything else it says to you — so they arrive in the game's own voice
   and in the game's own place, rather than as a second UI with a different
   opinion.

   ORDER IS NOT FIXED and must not be. Which of these fires first depends on
   whether the player walks left out of the churchyard gate or right, and both
   are correct openings; each line has to make sense cold.
-------------------------------------------------------------------------- */
const TEACH = {
  person:  'Everything you need is in a mouth or in the ground. Start with the mouth.',
  search:  'Nobody here will say a name out loud. Written down is the only place they survive.',
  lead:    'You are carrying a question now. Put it to the one it is about — TAB if you forget it.',
  refusal: 'They would not answer for their neighbour. Find who can vouch for them instead.',
};

let seenS = null;         // the run we are teaching
let taught = {};          // which lessons this run has had
let lastLine = '';        // to notice the game saying something of its own
let lineAt = 0;           // when it last did

function tick() {
  if (!window.S || typeof say !== 'function') return;

  if (S !== seenS) { seenS = S; taught = {}; lastLine = ''; lineAt = 0; }
  if (S.line !== lastLine) { lastLine = S.line; lineAt = performance.now(); }

  if (open || S.over || S.talk) return;
  const intro = document.getElementById('intro');
  if (intro && !intro.hidden) return;

  /* NEVER STEP ON THE GAME'S OWN VOICE. #line animates for seven seconds, and
     a lesson that lands on top of "Day 1. Three days before the blood moon."
     has cost the player the only sentence that was actually plot. Six seconds
     of quiet is the price of saying anything here. */
  if (performance.now() - lineAt < 6000) return;

  const next = pick();
  if (!next) return;
  taught[next] = true;
  say(TEACH[next]);
  lastLine = S.line;
  lineAt = performance.now();
}

function pick() {
  /* The two that depend on what you are standing next to. hereIs() already
     answers "within reach and lit", which is the same test the prompt uses,
     so the lesson cannot arrive before the thing it is about is visible. */
  const at = (typeof hereIs === 'function') ? hereIs() : {};
  if (!taught.person && at.mask) return 'person';
  if (!taught.search && at.object && !at.object.wagon && !at.object.shelter)
    return 'search';

  /* The two that depend on what you have been told. A lead is the moment the
     game becomes a deduction; a refusal is the moment it becomes a hunt, and
     a first-time player reads it as a dead end unless somebody says otherwise.
     Both are keyed off state the game already keeps for the book. */
  if (!taught.lead    && S.heard   && Object.keys(S.heard).length)   return 'lead';
  if (!taught.refusal && S.suspect && Object.keys(S.suspect).length) return 'refusal';
  return null;
}

/* --------------------------------------------------------------------------
   WIRING
-------------------------------------------------------------------------- */
addEventListener('DOMContentLoaded', () => {
  /* HIDE IT ONLY IF NOBODY OWNS IT.

     This read `if (!IS_CARD)`, from back when the card was one of five
     bake-off methods and the only one with a ? button. The prologue became
     the default and wires that button itself in v2-onboard.js — so this hid
     the button of a method that was using it, and the only visible way back
     into the tutorial has been display:none ever since.

     It survived a test because the test clicked it with .click(), which works
     perfectly well on a hidden element. Asking whether the handler fires is
     not the same question as asking whether anybody can reach it.

     It matters more now than it did: the key legend is gone, so ? is the only
     route back to the three tutorial frames. */
  const OWNS_HELP = ['card', 'prologue'].indexOf(window.V2_ONBOARD || 'card') >= 0;
  const btn = document.getElementById('help');
  if (btn && !OWNS_HELP) btn.style.display = 'none';
  if (btn && IS_CARD) btn.addEventListener('click', e => {
    e.stopPropagation();
    open ? closeBrief() : openBrief();
  });

  /* Shown on page LOAD, not on restart. Pressing `restart` is somebody who has
     already played deciding to play again; putting the premise in front of
     them every time is the tutorial tax this file exists to avoid. A reload
     brings it back, which is what you want with a laptop on a lectern. */
  if (!SKIP && IS_CARD) openBrief();

  /* 200ms. The slowest thing this watches is a six-second quiet window. */
  if (!TEACH_OFF) setInterval(tick, 200);
});

/* For the capture harness and the console. */
window.V2Brief = { open: openBrief, close: closeBrief, isOpen: () => open };

})();
