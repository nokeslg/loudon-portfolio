/* ============================================================================
   THE CHARACTER INTRO

   Plays once per villager per run, the first time you speak to them, and hands
   off into the conversation without a cut.

   WHY IT LANDS EXACTLY. The animation is authored in a 1920x1080 frame and
   leaves the portrait at translate(260,393) at 626x444. The dialogue sheet
   puts its portrait at exactly those frame coordinates. Both are mapped onto
   the window by the same cover transform — the SVG through its own
   preserveAspectRatio="xMidYMid slice", the sheet through fitFrame() below —
   so the two agree at every window size with no measured numbers anywhere.

   The art is Loudon's, exported from Figma. The only things changed here are:
     - `infinite` becomes `forwards`, so it plays once and holds
     - the name and the head are parameters, so one file serves all five
     - the whole thing is skippable, because it plays five times a run and a
       run is meant to be replayed
   ========================================================================== */

const INTRO = {
  /* Figma authored 5.5s with everything resolved at 57.14% — the last 2.4
     seconds are dead. The keyframes below are the same motion with the
     percentages scaled by 5500/3143, so the timeline ENDS the instant the
     portrait settles. That matters for more than tidiness: it means
     `animationend` is the handoff, so the cut cannot happen before the
     portrait has arrived. Handing off on a timer was off by 22px on a slower
     frame rate. */
  DURATION: 3143,
  SKIPPABLE: 600,      // before this, a keypress is probably a mistyped walk
};

/* Who has already introduced themselves this run. Cleared by newRun(). */
let _introSeen = {};
function resetIntros() { _introSeen = {}; }

/* The name is set in two sizes, as drawn: "the" small over the trade large. */
function introMarkup(m) {
  const trade = m.name.replace(/^the\s+/i, '');
  return `
<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice"
     xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <style>
    @keyframes benighted_band {
      0%     { animation-timing-function: ease-out;
               transform: translateY(243px) translateX(-5000px); }
      10.5%  { transform: translateY(243px) translateX(0px); }
      89.5%  { animation-timing-function: ease-out;
               transform: translateY(243px) translateX(0px); }
      100%   { transform: translateY(243px) translateX(5000px); }
    }
    @keyframes benighted_name {
      0%     { transform: translate(915px,437px) translateX(5000px); }
      11.0%  { transform: translate(915px,437px) translateX(998.373px); }
      15.9%  { transform: translate(915px,437px) translateX(-0.798px); }
      31.8%  { transform: translate(915px,437px) translateX(-11.825px); }
      47.7%  { transform: translate(915px,437px) translateX(-31.818px); }
      63.6%  { transform: translate(915px,437px) translateX(-58.164px); }
      79.5%  { transform: translate(915px,437px) translateX(-89.847px); }
      84.1%  { animation-timing-function: ease-in;
               transform: translate(915px,437px) translateX(-100px); }
      100%   { transform: translate(915px,437px) translateX(-5100px); }
    }
    @keyframes benighted_head {
      0%     { transform: translate(260px,393px) translateX(-200px); }
      10.57% { animation-timing-function: ease-out;
               transform: translate(260px,393px) translateX(-200px); }
      100%   { transform: translate(260px,393px) translateX(0px); }
    }
    @keyframes benighted_head_in { 0%,0.04% { opacity:0 } 10.57%,100% { opacity:1 } }

    /* BIND THEM. These three rules are the only thing attaching the keyframes
       above to the elements below; without them nothing animates and every
       piece sits at its untransformed origin, which looks like the whole
       intro is stuck in the top-left corner.

       transform-box is set explicitly rather than left to the initial value:
       on an SVG child it decides whether these translations are read in the
       viewBox's coordinate system or the element's own border box, and the
       default has differed between browsers and between versions. */
    #ib, #in, #ih { transform-box: view-box; transform-origin: 0 0; }
    #ib { animation: benighted_band ${INTRO.DURATION}ms linear forwards; }
    #in { animation: benighted_name ${INTRO.DURATION}ms linear forwards; }
    #ih { animation: benighted_head ${INTRO.DURATION}ms linear forwards,
                     benighted_head_in ${INTRO.DURATION}ms linear forwards; }

    @media (prefers-reduced-motion: reduce) {
      /* Skip straight to the settled frame rather than strobe someone. */
      #ib, #in { display:none }
      #ih { animation:none; transform:translate(260px,393px); opacity:1 }
    }
  </style>

  <rect width="1920" height="1080" fill="#071414"/>
  <rect id="ib" width="1920" height="594" fill="#D9A05B"/>
  <g id="in" fill="#072F30" font-family="masonic-lodge" font-weight="400">
    <text x="0" y="55.84"  font-size="64">the</text>
    <text x="0" y="199.84" font-size="144">${trade}</text>
  </g>
  <image id="ih" width="626" height="444" preserveAspectRatio="none"
         href="../../art/characters/npc/${m.img}-head.png"/>
</svg>`;
}

/* --------------------------------------------------------------------------
   playIntro(mask, done)

   Runs the animation, then calls `done`. Any key, or a click, cuts straight
   to the conversation — after a short guard, because the player's hand is on
   the walk keys and the first fifth of a second of any overlay eats a
   keystroke somebody meant for the world.
-------------------------------------------------------------------------- */
let _introTimers = [];
function playIntro(m, done) {
  const el = document.getElementById('intro');
  if (!el) return done();

  _introSeen[m.id] = true;
  el.innerHTML = introMarkup(m);
  el.hidden = false;

  const t0 = performance.now();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    _introTimers.forEach(clearTimeout); _introTimers = [];
    removeEventListener('keydown', onKey, true);
    removeEventListener('pointerdown', onKey, true);
    el.hidden = true;
    el.innerHTML = '';
    done();
  };
  function onKey(e) {
    if (performance.now() - t0 < INTRO.SKIPPABLE) return;
    e.preventDefault(); e.stopPropagation();
    finish();
  }
  addEventListener('keydown', onKey, true);
  addEventListener('pointerdown', onKey, true);

  /* THE HANDOFF IS AN EVENT, NOT A CLOCK. The portrait's own animation ending
     is the only thing that actually guarantees it has arrived at (260,393);
     a timer fires on schedule whether or not the frame rate kept up, and on a
     slow frame it cuts to the dialogue while the head is still sliding. The
     timeout below is a safety net for a browser that never fires the event,
     and it is deliberately late. */
  const head = el.querySelector('#ih');
  if (head) head.addEventListener('animationend', finish, { once: true });
  _introTimers.push(setTimeout(finish, INTRO.DURATION + 900));
}

function introPending(m) { return !_introSeen[m.id]; }
