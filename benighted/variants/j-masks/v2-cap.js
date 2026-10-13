/* ============================================================================
   BENIGHTED — UI CAPTURE HARNESS

   Dormant unless the URL carries ?cap=<scenario>. Then it puts the game into
   one exact, repeatable state, stops the simulation dead, and lets the page be
   photographed.

   WHY IT FREEZES: every pair in the UI pack has to differ by exactly one
   element and nothing else. The walker blinks on a random timer, the thing is
   drawn at random every run, the mist drifts on a CSS keyframe, and a hold
   completes in 1.15 seconds. Photograph a live game twice and you get two
   different frames. So `update` is replaced with a no-op, every animation is
   paused at frame zero, and the random draws are pinned.

   ?clean=1 hides that scenario's own element and nothing else, which is the
   plate the design goes on top of.
   ?clean=all strips every piece of UI for a bare frame of the valley.
   ?clean=backdrop keeps a full-screen overlay's dimming and drops its contents.
   ========================================================================== */
(function () {
  const q = new URLSearchParams(location.search);
  const want = q.get('cap');
  if (!want) return;

  const clean = q.get('clean');

  /* Every element the player can see, so ?clean=all has a list to work from. */
  const CHROME = ['brand', 'prompt', 'notes', 'talk', 'line', 'hud', 'debug', 'end'];

  const SCEN = {
    /* ---------- the prompt, in all five of its states ------------------- */
    'prompt-search':  { el:'prompt', at:'church', x:360,  say:null },
    'prompt-hold':    { el:'prompt', at:'church', x:360,  say:null,
                        post: () => { S.hold = { id:'crate', t: V2.HOLD_SEC * 0.62 }; } },
    'prompt-spent':   { el:'prompt', at:'church', x:360,  say:null,
                        post: () => { S.searched['church:crate'] = true; } },
    'prompt-press':   { el:'prompt', at:'church', x:760,  say:null },
    'prompt-person':  { el:'prompt', at:'church', x:1430, say:null },
    'prompt-exit':    { el:'prompt', at:'church', x:120,  say:null },
    'prompt-exit-shut': { el:'prompt', at:'church', x:120, light:4, say:null },

    /* ---------- the conversation ---------------------------------------- */
    'talk-root':      { el:'talk', at:'church', x:1430,
                        post: () => { S.heard.thresher = true;
                                      openTalk(MASKS.find(m => m.id === 'thresher')); } },
    'talk-two':       { el:'talk', at:'well', x:1050,
                        post: () => { openTalk(MASKS.find(m => m.id === 'widow')); } },
    'talk-told':      { el:'talk', at:'church', x:1430,
                        post: () => { const m = MASKS.find(x => x.id === 'thresher');
                                      openTalk(m); S.talk.node = 'gossip'; paintTalk(); } },
    'talk-refused':   { el:'talk', at:'well', x:1050,
                        post: () => { const m = MASKS.find(x => x.id === 'widow');
                                      openTalk(m); S.talk.node = 'part'; paintTalk(); } },
    'talk-deflect':   { el:'talk', at:'well', x:2950,
                        post: () => { S.thing = 'miller'; S.heard.miller = true;
                                      const m = MASKS.find(x => x.id === 'miller');
                                      openTalk(m); S.talk.node = 'check'; paintTalk(); } },
    'talk-nolight':   { el:'talk', at:'well', x:1050, light:3,
                        post: () => { const m = MASKS.find(x => x.id === 'widow');
                                      openTalk(m); S.talk.node = 'nolight'; paintTalk(); } },

    /* ---------- the narration line -------------------------------------- */
    'line-short':     { el:'line', at:'church', x:1150,
                        say:'Nothing but dust and your own breathing.' },
    'line-long':      { el:'line', at:'church', x:360,
                        say: V2_PROOF['church:crate'].text + '  You could put that to the sexton.' },
    'line-day':       { el:'line', at:'church', x:760, day:2,
                        say:'You bar the door and wait out the dark.  Day 2.' },

    /* ---------- the book ------------------------------------------------ */
    'notes-full':     { el:'notes', at:'church', x:1150, day:2,
                        post: () => { S.heard.widow = true; S.verified.widow = true;
                                      S.heard.miller = true; S.suspect.miller = true;
                                      S.heard.sexton = true;
                                      S.met.thresher = 1; S.met.widow = 2;
                                      S.met.miller = 1; S.met.sexton = 1;
                                      S.parts.push('harness'); S.gave.harness = 'widow';
                                      S.pointed.sexton = 'miller';
                                      toggleNotes(); } },
    'notes-empty':    { el:'notes', at:'church', x:1150, post: () => toggleNotes() },
    /* The book after a night that cost you somebody. The thresher is the only
       person who can vouch for the widow, so taking him locks the harness
       behind a search — which is exactly the thing the book now says out
       loud on both rows. The vault has been read, so the rule is up top. */
    /* The broken ring: the miller dodged, so the sexton can never be
       verified by talking and the book has to say so. */
    'notes-dodged':   { el:'notes', at:'church', x:1150, day:2,
                        post: () => { S.thing = 'miller';
                                      S.suspect.miller = true;
                                      S.heard.miller = true; S.verified.widow = true;
                                      S.met.miller = 2; S.met.widow = 1;
                                      S.met.thresher = 1; S.met.sexton = 1;
                                      S.parts.push('harness'); S.gave.harness = 'widow';
                                      S.rule = true;
                                      toggleNotes(); } },
    'notes-gone':     { el:'notes', at:'church', x:1150, day:2,
                        post: () => { S.gone.thresher = true; S.taken = 'thresher';
                                      S.rule = true;
                                      S.heard.miller = true; S.verified.miller = true;
                                      S.met.miller = 1; S.met.widow = 1;
                                      S.parts.push('axle'); S.gave.axle = 'miller';
                                      toggleNotes(); } },

    /* Stand anywhere and photograph whatever prompt comes up:
       ?cap=spot&at=<scene>&x=<source px>. Used to check every prompt against
       the drawing it is supposed to be labelling. */
    /* &dl=<daylight left> photographs the same spot at any hour. It is NOT
       ?light=, which is the per-day BUDGET and is read in v2-data.js: the
       lantern radius is S.daylight/DAYLIGHT_PER_DAY, so halving the budget
       and starting a run gives you noon again, not dusk. */
    'spot':           { el:'prompt', at: q.get('at') || 'church',
                        x: +(q.get('x') || 1150),
                        light: q.get('dl') ? +q.get('dl') : undefined,
                        say:null,
                        /* &th=<plane> photographs the revenant where it
                           actually stands. 3 far, 2 mid, 1 near; 4 is offstage
                           and draws nothing, which is the point of 4.

                           paintThreat() parents the figure INTO the layer div
                           it occupies, so it inherits that plane's parallax and
                           its occlusion for free — which means a capture of
                           plane 3 genuinely has it behind the trees rather than
                           composited in front of them. There was no way to ask
                           for that from outside until now.

                           The eye state is set to match rather than left where
                           it was: stepThreat() moves them together, so a
                           photograph with plane 1 and dormant eyes is of a
                           state the game cannot be in. */
                        post: q.get('th') ? () => {
                          const n = +q.get('th');
                          S.threat = n;
                          S.eyeState = n <= 1 ? 'lunging'
                                     : n === 2 ? 'watching' : 'dormant';
                          if (q.get('thx')) S.threatX = +q.get('thx');
                        } : undefined },

    /* ---------- the furniture ------------------------------------------- */
    'legend':         { el:'hud',   at:'church', x:1150 },
    'title':          { el:'brand', at:'church', x:1150 },

    /* ---------- the three ways it stops --------------------------------- */
    'end-won':        { el:'end', at:'church', x:1880, day:3,
                        post: () => { S.parts = ['axle','wheel','harness']; showEnd('won'); } },
    'end-carried':    { el:'end', at:'church', x:1880, day:3,
                        post: () => { S.parts = ['axle','wheel','harness'];
                                      S.marked = true; showEnd('carried'); } },
    'end-caught':     { el:'end', at:'well', x:2000, day:2, light:6,
                        post: () => { S.threat = 1; showEnd('caught'); } },
    'end-bloodmoon':  { el:'end', at:'graveyard', x:1800, day:3, light:5,
                        post: () => { showEnd('bloodmoon'); } },

    /* ---------- bare valley, for judging contrast ----------------------- */
    'plate-church-noon':  { el:null, at:'church',    x:1150, light:95 },
    'plate-church-dusk':  { el:null, at:'church',    x:1150, light:34 },
    'plate-church-dark':  { el:null, at:'church',    x:1150, light:6  },
    'plate-well-noon':    { el:null, at:'well',      x:1800, light:95 },
    'plate-well-dusk':    { el:null, at:'well',      x:1800, light:34 },
    'plate-well-dark':    { el:null, at:'well',      x:1800, light:6  },
    'plate-grave-noon':   { el:null, at:'graveyard', x:1700, light:95 },
    'plate-grave-dusk':   { el:null, at:'graveyard', x:1700, light:34 },
    'plate-grave-dark':   { el:null, at:'graveyard', x:1700, light:6  },
  };

  const sc = SCEN[want];
  if (!sc) { document.title = 'CAP-UNKNOWN'; return; }

  /* Runs INSIDE DOMContentLoaded, not in a task after it.

     The setTimeout(…, 0) that used to be here pushed the whole setup into a
     later task, and Chrome's --screenshot fires on `load`. So the picture was
     sometimes taken before the scenario had been applied at all — you got the
     default opening state instead. For `title` the default state happens to
     BE the scenario, which is why three identical captures of it looked like
     proof of determinism and were not.

     v2-cap.js is loaded after v2-game.js, so this listener runs after the
     game's own init and `S` already exists. Everything below is synchronous,
     and `load` cannot fire until it has finished. */
  addEventListener('DOMContentLoaded', () => {
    /* Silence. A capture is a photograph and the harness is usually running
       several of them in parallel headless tabs. */
    if (window.V2Audio) V2Audio.setMuted(true);
    /* Nothing may move between the two photographs. */
    const css = document.createElement('style');
    css.textContent =
      '*,*::before,*::after{animation:none!important;transition:none!important}' +
      /* #line lives at opacity:0 and is only ever made visible BY its 7s
         keyframe, so killing animations killed the narration outright and
         three line captures came out blank. Same fix the reduced-motion
         block in v2.css already uses. */
      '#line.show{opacity:1!important;transform:translateX(-50%)!important}' +
      '#debug{display:none!important}';
    document.head.appendChild(css);

    newRun();

    /* Pin every random draw. The culprit is picked at random each run and the
       blink is on a random timer; both would make two captures differ. */
    S.thing = 'thresher';
    S.blink = 0; S.nextBlink = 9e9;
    /* Cleared by checkExit() during normal play, and checkExit() lives in
       update(), which is about to be a no-op. Leave it set and every exit
       prompt renders as nothing at all. */
    S.exitLock = false;

    if (sc.at && sc.at !== S.at) { S.at = sc.at; buildScene(sc.at); S.seen[sc.at] = true; }
    if (sc.x != null)    S.x = sc.x;
    if (sc.day != null)  S.day = sc.day;
    if (sc.light != null) S.daylight = sc.light;

    if (sc.post) sc.post();
    if (sc.say !== undefined && sc.say !== null) say(sc.say);

    /* SNAP THE CAMERA.

       camX eases toward camTarget at 12% a frame, so where the valley sits
       depends on HOW MANY FRAMES have been drawn — and that varies run to run
       by a frame or two. Which meant the pair of photographs that are supposed
       to differ by one element differed across the entire frame, because the
       whole world had slid a few pixels sideways between them.

       Paint once to let paintScene() work out camTarget from the walker, then
       put camX on top of it and paint again. */
    window.CAP_SNAP = true;      // paintScene stops easing the camera entirely
    paintScene(S);
    paintScene(S);

    /* Stop the world. paint* still runs every frame and reads this frozen
       state, so the DOM stays exactly as set here. */
    window.update = () => {};

    /* Hide whatever this capture is a plate for.

       A scenario declared with `el:null` IS a bare plate — that is what el:null
       means — so it hides the chrome whether or not the URL asked. The nine
       frames in 00-plates were shot without it and came out with the title bar,
       the legend, the prompt and the narration still on them, while the README
       described them as having no UI at all. */
    if (clean === 'all' || sc.el === null) CHROME.forEach(hide);
    else if (clean === 'backdrop' && sc.el) {
      const inner = document.querySelector('#' + sc.el + ' .sheet');
      if (inner) inner.style.visibility = 'hidden';
    }
    else if (clean && sc.el)   hide(sc.el);

    function hide(id) {
      const n = document.getElementById(id);
      if (n) n.style.visibility = 'hidden';
    }

    /* Two frames of paint, then say so — the capture waits on this. */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.title = 'CAP-READY';
    }));
  });
})();
