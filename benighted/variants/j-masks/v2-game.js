/* ============================================================================
   V2 — ACTOR, INPUT, LOOP
   ----------------------------------------------------------------------------
   The animation numbers in here are not guesses. They came out of the research
   pass and each one has a reason; the reasons are in the comments because a
   number with no reason gets "tuned" away by the next person to look at it.
   ========================================================================== */

/* --- ANIMATION CONSTANTS -------------------------------------------------
   BOB_HZ 1.5 — Richard Williams' contact method puts a natural brisk walk at
   24 frames per stride (1.0s), which is two bob cycles, so 2.0Hz. A lone
   traveller trudging at night with a lamp is a stroll-to-tired gait, which
   Williams times at 32-40 frames. 1.5Hz is that.

   BOB_AMP 0.035 — measured vertical centre-of-mass excursion in real walking
   is 1.6-2.8% of body height. Animators exaggerate roughly 2x. 3.5% of
   character height, peak to peak.

   The waveform is abs(sin), NOT sin. The body drops sharply at each footfall
   and rises smoothly to the passing position; abs(sin) gives you that cusp for
   free. A plain sine reads as a bouncing ball, not a walk.

   Phase is driven by DISTANCE WALKED, not by a clock. Drive it off time and
   the bob floats free of the movement the moment the player slows down, and
   that does read as broken.

   STRIDE 330 — source px between footfalls, and THE SOUND READS THE SAME
   NUMBER. It used to be a fraction of the character's height (STEP_LEN 0.42,
   "a normal step"), which is the correct way to size a stride and the wrong
   way to time one. Measured against WALK_SPEED 700 it put the gait at 10.3
   footfalls a second in the well and the graveyard and 14.9 in the church,
   where the actor is drawn smaller. At 3.5% of a 110px figure that is a 4px
   wobble and it passed for a trudge for six weeks — until there was a
   footstep on it, and then it was a sewing machine.

   A height-proportional stride CANNOT be made to sound right at this walk
   speed: 68px per step at 700px/s is fifteen steps a second, and the only
   way to slow that is to walk at 136px/s, which is seventeen seconds to
   cross a scene. The stride is the thing that gives, so it is now an
   absolute distance and it is the same in every scene — which also fixes the
   church running 45% faster than the other two for no reason anybody chose.

   Trade it with ?stride=, which moves the picture and the sound together:
   260 is urgent, 330 is the walk, 420 is a trudge.

   LANTERN_LAG — the lamp hangs from a hand, so it swings at half the bob
   frequency and arrives late. The lag is the entire effect: a lantern swinging
   in phase with the body looks welded on. 100 degrees behind, +/-6 degrees.
   Above 10 degrees it reads as agitated rather than trudging.
-------------------------------------------------------------------------- */
/* Measured off the cropped art, not guessed. */
const ACTOR_ASPECT = 420 / 604;
const THREAT_ASPECT = 478 / 706;

const ANIM = {
  BOB_HZ: 1.5,
  BOB_AMP: 0.035,
  STRIDE: (() => {
    /* Guarded for Node: variants/check.js evaluates this file with no
       `location`, the same way it does v2-data.js. */
    if (typeof location === 'undefined' || typeof URLSearchParams === 'undefined')
      return 330;
    const q = parseFloat(new URLSearchParams(location.search).get('stride'));
    return q > 0 ? q : 330;
  })(),
  LEAN_DEG: 2,
  LANTERN_DEG: 6,
  LANTERN_LAG: 100 * Math.PI / 180,
  TURN_MS: 120,          // paper-puppet flip: scaleX 1 -> 0 -> -1
};

let S = null;
window.S = null;
const keys = {};
let lastT = 0;

/* --------------------------------------------------------------------------
   PLACEHOLDER ART — both of these exist to be deleted.

   The traveller is research Direction 2, the hooded glugă: a peaked column,
   diagonal satchel strap, lamp held at chest height, no legs. No legs is not
   laziness — a figure with visible planted feet that translates horizontally
   reads as foot-skate, which is the single most broken-looking artefact in 2D
   character motion. An ankle-length coat removes the problem entirely and is
   period-correct rather than a compromise.

   The revenant is the media vampire — see threatSVG below for why the
   folkloric one was dropped.
-------------------------------------------------------------------------- */
function actorSVG() {
  /* The drawn walker, recoloured onto the ladder: body at fore #061C1E so it
     sits exactly one rung under the near band behind it, face up at ink, panes
     at ember. It was pure #000000, which is 8.7 L* BELOW the darkest rung —
     a figure darker than the darkest thing in the world has no silhouette at
     all, it is a hole.

     One thing lost against the old placeholder: the lantern no longer swings
     independently of the body, because a raster cannot be jointed. Export the
     lamp as its own PNG and it comes back in four lines. */
  return `<img id="actorSvg" src="../../art/characters/walker.png" alt="">`;
}


/* --- THE REVENANT -------------------------------------------------------
   The MEDIA vampire, not the folkloric one. A bloated peasant is what the
   record actually describes and it is not what anyone is afraid of.

   Silhouette vocabulary, all of it chosen because it survives being scaled
   down rather than because it is accurate:
     - a TALL NARROW COLUMN, long fall to the ground, no waist articulation
     - a COLLAR rising behind and above the head in a flared arc, which reads
       as two soft horns in outline. Most copyable element in the whole canon.
     - a WIDOW'S PEAK cut as a hard notch into the top of the skull. In
       silhouette this is what separates "vampire" from "man with long hair".
     - a BEARD WEDGE extending the chin to a point.
   The collar does a second job that matters more than the first: it
   MANUFACTURES ITS OWN SHADOW POCKET for the eyes to sit in. Vampire Hunter
   D's hat brim, Meier Link's raised collar, Alucard's fedora — all the same
   trick. It means the eyes read against any background layer instead of
   depending on the scene being dark enough.

   THE EYES ARE NOT IN HERE. They are separate DOM elements, because they must
   not scale with the figure and must not fade with distance. See paintThreat.
-------------------------------------------------------------------------- */
function threatSVG() {
  /* The drawn revenant. Angular where the walker is round, which is most of
     why the two read apart at silhouette size.

     THE EYES ARE STILL SEPARATE DOM ELEMENTS, over the top of the baked ones,
     because they must not scale with the figure and must not fade with
     distance. The art's own eyes sit at 45-54% across and 22-24% down; the
     overlay is aligned to that. */
  return `<div class="tbody"><img src="../../art/characters/revenant.png" alt=""></div>
  <i class="teye l"></i><i class="teye r"></i>`;
}


/* --------------------------------------------------------------------------
   STATE
-------------------------------------------------------------------------- */
function newRun() {
  /* The intros are once per PERSON per RUN, so a restart shows them again. */
  if (typeof resetIntros === 'function') resetIntros();
  hideEnd();
  resetLife();
  S = window.S = {
    day: 1,
    daylight: V2.DAYLIGHT_PER_DAY,
    at: 'church',
    x: 1150,                 // just inside the churchyard gate
    facing: 1,
    dist: 0,                 // total distance walked, drives the bob phase
    turning: 0,
    parts: [],
    searched: {},
    seen: { church: true },   // scenes already introduced; you start in the church
    oil: 0,
    stakes: 0,
    threat: THREAT.START,
    threatX: 400,
    eyeState: 'watching',
    blink: 0,            // seconds of eyes-off remaining
    nextBlink: 9,        // seconds until the next one
    over: null,
    line: '',
    exitLock: true,
    met: {},             // how many times you have spoken to each mask
    heard: {},           // masks you have been given a memory about
    verified: {},        // masks that answered their memory correctly
    suspect: {},         // masks that would not
    pointed: {},         // who to ask about whom, when you have been refused
    gave: {},            // part id -> the mask it came out of
    gone: {},            // masks no longer in the valley
    taken: null,         // who it took DURING the run (never the thing itself)
    revealed: false,     // it has stopped wearing a mask
    pendingReveal: false,// ...but not while you are looking at a face
    marked: false,       // you took something from an unchecked hand
    rule: false,         // the vault told you what it is and what it cannot do
    warnedToday: false,  // the last-light warning is once a day
    hold: null,          // { id, t } while you are crouched over something
    deflect: 0,
    talk: null,
    /* One of the five, picked fresh every run. Nothing in the data marks it,
       so neither the player nor the author can play a run already knowing. */
    thing: MASKS[(Math.random() * MASKS.length) | 0].id,
    notes: [],           // keys of the paper you are carrying, in the order found
    tokens: [],          // what the paper told you; see V2_LEADS
    turned: {},          // hiding places you have been to without understanding them
  };
  buildScene(S.at);
  say(`Day 1. Three days before the blood moon.`);
}

function say(t) {
  S.line = t;
  const el = document.getElementById('line');
  el.textContent = t;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

/* --------------------------------------------------------------------------
   INPUT
-------------------------------------------------------------------------- */
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'e' && !e.repeat) interact();
  if (k === 'v') stepThreat();          // demo key — advance the threat a plane
  if (S && S.talk) {
    if (k >= '1' && k <= '5') { e.preventDefault(); talkChoose(+k); return; }
    if (k === 'escape') { closeTalk(); return; }
    return;                            // nothing else reaches the world mid-talk
  }
  if (k === 'tab') { e.preventDefault(); toggleNotes(); }
  if (k === '`') document.body.classList.toggle('debug');
  if (k === 'f') toggleFull();
  /* only from an ending, so it is not a stray restart */
  if (k === 'r' && S && S.over) { newRun(); if (window.V2Day) V2Day.show(); }
  if ([' ', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

/* --------------------------------------------------------------------------
   THE LOOP
-------------------------------------------------------------------------- */
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
  lastT = t;
  if (S && !S.over) update(dt);
  if (S) { blinkTick(dt); paintScene(S); paintPrompt(); paintLife(S); paintMasks(S); }
  requestAnimationFrame(frame);
}

/* Off for 200-400ms, once every 8-15 seconds, irregular. Far rarer and far
   slower than a human blink — a frequent one makes the thing read as harmless,
   and a regular one reads as a machine. */
function blinkTick(dt) {
  if (S.blink > 0) { S.blink -= dt; return; }
  S.nextBlink -= dt;
  if (S.nextBlink <= 0) {
    S.blink = 0.2 + Math.random() * 0.2;
    S.nextBlink = 8 + Math.random() * 7;
  }
}

function update(dt) {
  const sc = SCENES[S.at];
  const srcW = SRC_H * sc.aspect;

  if (S.talk) return;                 // you stop and look at a face

  /* Safe point for the unmasking: nobody's face is on screen. */
  if (S.pendingReveal && !S.over) {
    S.pendingReveal = false;
    S.revealed = true;
    S.gone[S.thing] = true;
    buildMasks(S.at);
    say('One of them is not at their post any more. You do not have to wonder which.');
  }

  let dir = 0;
  if (keys['arrowleft']  || keys['a']) dir -= 1;
  if (keys['arrowright'] || keys['d']) dir += 1;

  if (dir !== 0) {
    if (dir !== S.facing) { S.facing = dir; S.turning = ANIM.TURN_MS; }
    const move = dir * V2.WALK_SPEED * dt;
    const nx = Math.max(40, Math.min(srcW - 40, S.x + move));
    const actual = Math.abs(nx - S.x);
    S.x = nx;
    S.dist += actual;

    /* Walking is the spend. This is the whole point of V2 — in V1 a plan cost
       one click to execute, which is not a plan. */
    S.daylight -= actual * V2.WALK_COST;
    if (S.daylight <= 0) { S.daylight = 0; nightfall(); }
  }

  tickHold(dt, dir !== 0);
  checkLastLight();

  if (S.turning > 0) S.turning -= dt * 1000;
  if (S.oil > 0) S.oil -= dt;

  checkExit();
}

/* --------------------------------------------------------------------------
   THE ACTOR
-------------------------------------------------------------------------- */
function paintActor(S) {
  const el = document.getElementById('actor');
  const svg = document.getElementById('actorSvg');
  const h = View.sceneH * actorH();

  /* Phase from distance, not from a clock, and from an ABSOLUTE distance
     rather than one scaled by the drawn height — see ANIM.STRIDE. v2-audio.js
     fires a footstep on the same number, so the sound lands on the contact
     instead of near it. */
  const phase = (S.dist / ANIM.STRIDE) * Math.PI;

  const bob  = Math.abs(Math.sin(phase)) * h * ANIM.BOB_AMP;
  const lean = Math.sin(phase) * ANIM.LEAN_DEG;

  /* Paper-puppet flip: the figure goes edge-on and comes back the other way,
     exactly as a physical cutout on a light table would. Three lines, and it
     is the most aesthetically correct motion in the whole character. */
  let flip = S.facing;
  if (S.turning > 0) {
    const p = 1 - (S.turning / ANIM.TURN_MS);
    flip = S.facing * Math.abs(p * 2 - 1);
  }

  el.style.width  = (h * ACTOR_ASPECT) + 'px';   // drawn walker is 0.695, placeholder was 0.455
  el.style.height = h + 'px';
  el.style.left   = (S.x * View.scale) + 'px';
  el.style.top    = (View.groundY - View.top - h + bob) + 'px';
  /* Lean is applied to the whole figure now rather than to an inner <g>.
     Pivot at the feet, so he rocks over his own footing instead of sliding. */
  el.style.transformOrigin = '50% 100%';
  el.style.transform = `translateX(-50%) scaleX(${flip}) rotate(${lean}deg)`;
}

/* --------------------------------------------------------------------------
   INTERACTION

   The prompt appears only when the object is within reach AND inside the lit
   radius. That second condition is the whole affordance system: you cannot
   touch what you cannot see, and what you can see is lit. Somerville had
   Playdead's pedigree and a no-HUD rule and still failed, because players
   could not tell where to interact. One rule fixes it.
-------------------------------------------------------------------------- */
function nearestObject() {
  const sc = SCENES[S.at];
  let best = null, bd = V2.REACH;
  for (const o of sc.objects) {
    const d = Math.abs(o.x - S.x);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

/* WHO WINS THE KEYPRESS.

   A person used to beat an object just by being within REACH, however much
   nearer the object was. At the well that meant the widow, standing at 1050,
   silently owned every E press from 900 to 1200 — including one pressed
   while standing on top of the bucket windlass. You reached for the crank
   and got a conversation, and the only clue was that the prompt had said
   her name all along.

   So compare the distances, with a small bias kept for the person, because
   the original instinct is right: if you are genuinely between the two, you
   meant the person. 40 source pixels is about a third of a stride.

   One function, used by both interact() and paintPrompt(), so the caption
   can never promise something the key will not do.

   An exit is weighed the same way, and for the same reason. The collapsed
   shed sits at 3380 and the road home at 3540: an object claimed its whole
   150 first, so the only place you could actually leave the well was the
   thirty pixels past 3530 — walk up to the exit from inside the scene and E
   searched the shed instead, forever. Nearest wins, person breaks ties. */
function hereIs() {
  const who = nearestMask();
  const o   = nearestObject();
  const ex  = nearestExit();
  const dw  = who ? Math.abs(who.x - S.x) : Infinity;
  const dob = o   ? Math.abs(o.x   - S.x) : Infinity;
  const dex = ex  ? Math.abs(ex.x  - S.x) : Infinity;

  if (who && dw <= Math.min(dob, dex) + V2.PERSON_BIAS) return { mask: who };
  if (o  && dob <= dex) return { object: o };
  if (ex) return { exit: ex };
  if (o)  return { object: o };
  return {};
}

function paintPrompt() {
  const el = document.getElementById('prompt');
  if (!S || S.over || S.talk) { el.classList.remove('on'); return; }
  const at = hereIs();
  if (at.mask) return void paintMaskPrompt(el, at.mask);
  if (!at.object) return paintExitPrompt(el);

  const o = at.object;
  const done = S.searched[S.at + ':' + o.id];
  const holding = !!(S.hold && S.hold.id === o.id);
  /* Only a search is a hold. The door and the wagon are one gesture and still
     fire on the press, so telling the player to hold them would be a lie the
     first time they tried it. */
  const held = !o.wagon && !o.shelter;

  el.classList.add('on');
  el.classList.toggle('holding', holding);
  el.classList.toggle('spent', !!done);

  /* CONTENT FIRST, THEN PLACE IT. placePrompt() has to measure the caption to
     keep it inside the frame, and it cannot measure one that has not been
     written yet. */
  if (done) {
    el.innerHTML = `<div class="name">${o.name} \u2014 nothing left</div>`;
  } else {
    el.innerHTML = pillMarkup(
      held ? 'search' : (o.wagon ? 'wagon' : 'shelter'), o.name, holding);
    if (holding) {
      /* 206 is the track width in the design; the fill is a plain inner rect
         so the rounded ends behave the way they do in the Figma frame. */
      el.querySelector('.pill i').style.width = (206 * holdP()).toFixed(1) + 'px';
    }
  }
  placePrompt(el, o.art || o.x);
}

/* --------------------------------------------------------------------------
   Put the prompt over the thing it labels.

   Centred on the object and sitting the same distance above the ground line
   the old one did, then scaled by the same factor the rest of the UI uses, so
   a 24px name here is the same weight as a 24px choice in the conversation.
-------------------------------------------------------------------------- */
/* --------------------------------------------------------------------------
   THE PILL CAPTIONS

   "Hold E To Search" is Loudon's. The rest follow its shape — verb-led, "E To
   <do the thing>" — because a generic "Press E" beside it would read as two
   designers. The pill sizes itself to whichever caption it is carrying, using
   the padding measured off the original frame.
-------------------------------------------------------------------------- */
const PILL_PAD = 10.5;              // a side, measured off HoldEToSearch.svg
const PROMPT_VERB = {
  search:  'Hold E To Search',
  shelter: 'E To Enter',
  wagon:   'E To Repair',
  exit:    'E To Travel',
  person:  'E To Speak',
};

const _pillW = new Map();
function pillWidth(label) {
  if (_pillW.has(label)) return _pillW.get(label);
  let probe = document.getElementById('_pillprobe');
  if (!probe) {
    probe = document.createElement('span');
    probe.id = '_pillprobe';
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;' +
      'font-family:"masonic-lodge",serif;font-weight:400;font-size:16px;line-height:1';
    document.body.appendChild(probe);
  }
  probe.textContent = label;
  const w = probe.getBoundingClientRect().width + PILL_PAD * 2;

  /* CACHE ONLY ONCE THE ACTUAL FACE IS THERE.

     `document.fonts.status` reports 'loaded' whenever nothing is pending — and
     a webfont nobody has used yet is not pending, so it reads 'loaded' before
     Masonic Lodge has been fetched at all. Measuring then gives the serif
     fallback, and caching it pinned every pill to the wrong width for the rest
     of the session: 95.8px for a caption that needs 205.6. check() asks about
     this specific face, which is the question actually being asked. */
  if (document.fonts && document.fonts.check('16px "masonic-lodge"'))
    _pillW.set(label, w);
  return w;
}

/* Belt and braces: throw away anything measured before the fonts landed. The
   loop repaints every frame, so the pills resize on the next one. */
if (document.fonts && document.fonts.ready)
  document.fonts.ready.then(() => _pillW.clear());

/* The markup for a prompt in its two shapes, so the object, the exit and the
   villager cannot drift apart. */
function pillMarkup(kind, name, holding) {
  const label = PROMPT_VERB[kind] || PROMPT_VERB.search;
  const w = holding ? 206 : pillWidth(label);
  return `<div class="pill" style="width:${w.toFixed(1)}px"><i></i><span>${label}</span></div>` +
         `<div class="name">${holding ? 'searching\u2026' : name}</div>`;
}

function promptScale() { return Math.max(innerWidth / 1920, innerHeight / 1080); }

/* A PROMPT HAS TO RIDE THE PLANE ITS SUBJECT IS DRAWN ON.

   srcToScreen() is x * scale - camX, which is the FORE plane and nothing
   else. That is right for the walker, for the villagers (who are parented
   into the fore layer for exactly this reason) and for anything drawn in
   fore.png. It is wrong for everything else, because a layer at depth d is
   translated by -camX * d/68: the churchyard gate is drawn in near.png and
   moves at 0.62 of the camera, so a prompt pinned to the fore plane slides
   off it the moment you take a step. Measured across one reach window that
   is a hundred and fourteen source pixels of drift, and across the scene it
   is several hundred.

   So an object may carry `art: {x, depth}` — where it is actually drawn and
   on which plate — and the prompt is placed there instead. `x` stays what it
   always was: where you stand, in fore space, which is what nearestObject()
   and the walk are measured in. The two are different questions and were
   only ever the same answer for props drawn in fore.

   Accepts a bare number for callers whose subject is on the fore plane. */
function placePrompt(el, src) {
  const at = typeof src === 'number' ? { x: src, depth: 68 } : src;
  const f  = (at.depth || 68) / 68;
  const k  = promptScale();
  el.style.transform = `translate(-50%,-100%) scale(${k})`;
  el.style.top  = (View.groundY - View.sceneH * actorH() * 1.25) + 'px';

  /* KEEP IT ON THE SCREEN.

     Some props cannot be stood underneath. The collapsed shed at the well is
     drawn at 3020 on the near plate, and the camera hits its right stop long
     before you reach it, so the best available standing point still leaves
     the caption 201 source pixels to the right — nineteen pixels from the
     edge of a 2133-wide window, which cut "the collapsed shed" in half. The
     crypt did the same thing. Pin the caption inside the frame rather than
     pretend every drawing can be centred on. */
  const half = (el.getBoundingClientRect().width || 0) / 2;
  const edge = 10;
  let x = at.x * View.scale - camX * f;
  if (half) x = Math.max(half + edge, Math.min(View.vw - half - edge, x));
  el.style.left = x + 'px';
}

function interact() {
  if (!S || S.over || S.talk) return;

  /* Same ruling the caption is drawn from — see hereIs(). */
  const at = hereIs();
  if (at.mask) return openTalk(at.mask);
  if (at.exit) return takeExit(at.exit);
  const o = at.object;
  if (!o) return;

  if (o.wagon)   return repair();
  if (o.shelter) return bedDown();

  return beginHold(o);
}

/* --------------------------------------------------------------------------
   THE HOLD

   E on a person or a door still fires on the press — those are not searches,
   they are one gesture. E on a thing you have to go through starts a hold. You
   stay still, the lantern comes in, and you finish or you do not.

   Walking cancels it, because the whole point is that you are standing in one
   place with your head down.
-------------------------------------------------------------------------- */
function beginHold(o) {
  const key = S.at + ':' + o.id;
  if (S.searched[key]) return say('You have already been through that.');
  /* A place you cannot get into yet. Refused BEFORE the hold and before the
     light is charged, same as the price check below — being made to crouch
     over something for a second and a bit and then told no is the worst
     version of every one of these. */
  if (o.needs && !S.searched[S.at + ':' + o.needs]) {
    const need = (SCENES[S.at].objects || []).find(x => x.id === o.needs);
    return say(`Not from up here. You would have to do something about ` +
               `${need ? need.name : 'that'} first.`);
  }
  /* Check the price BEFORE the hold, not after it. Standing still in a
     shrinking circle of light for a second and a bit and then being told you
     could not afford it is the worst possible version of this. */
  if (o.cost > S.daylight) return say('Not enough of the day left for that.');
  if (S.hold && S.hold.id === o.id) return;
  S.hold = { id: o.id, t: 0 };
}

function holdP() { return S.hold ? Math.min(1, S.hold.t / V2.HOLD_SEC) : 0; }

function tickHold(dt, moving) {
  if (!S.hold) return;
  const o = nearestObject();
  if (!keys['e'] || moving || !o || o.id !== S.hold.id) { S.hold = null; return; }
  S.hold.t += dt;
  if (S.hold.t >= V2.HOLD_SEC) { S.hold = null; doSearch(o); }
}

function doSearch(o) {
  const key = S.at + ':' + o.id;

  const hit = (V2_PLACEMENT[S.at] || []).find(h => h.spot === o.id);
  const knows = hit && understands(hit.part);

  /* Coming back to a place you now understand is cheaper. You are not searching
     any more, you are collecting. */
  const cost = Math.round(o.cost * (S.turned[key] && knows ? V2.KNOWN_DISCOUNT : 1));
  if (cost > S.daylight) return say('Not enough of the day left for that.');
  S.daylight -= cost;


  /* WORK, NOT PAPER. Marked searched — doing it twice is not a thing — and
     checked before the supplies and the proofs because these two objects are
     the only ones whose output is a change to the valley rather than
     something you carry away from it. */
  const wk = V2_WORK[key];
  if (wk) {
    S.searched[key] = true;
    if (wk.rule) S.rule = true;
    say(wk.text);
    if (S.daylight <= 0) nightfall();
    return;
  }

  /* A STANDING SUPPLY. Not marked searched, so you can come back — the price
     is the daylight and the walk, every time. */
  const sk = V2_STOCK[key];
  if (sk) {
    if (sk.id === 'oil')   S.oil = 18;
    if (sk.id === 'stake') S.stakes++;
    say(sk.text);
    if (S.daylight <= 0) nightfall();
    return;
  }

  /* THE GROUND TALKS. This is what makes searching worth the daylight and the
     dark: it is the only route to whoever the thing was supposed to tell you
     about. The line never states the conclusion — it shows you the burned
     sleeve and lets you be the one who notices which arm. */
  const pf = V2_PROOF[key];
  if (pf && !S.heard[pf.who]) {
    S.searched[key] = true;
    S.heard[pf.who] = true;
    const who = MASKS.find(m => m.id === pf.who);
    say(pf.text + (who ? `  You could put that to ${who.name}.` : ''));
    if (S.daylight <= 0) nightfall();
    return;
  }

  if (hit && !S.parts.includes(hit.part)) {
    if (!knows) {
      /* THE SPOT STAYS OPEN. Marking it searched here would let a player burn
         their own run by walking the valley in the wrong order, which is
         exactly the bug class this project has already paid for twice. */
      S.turned[key] = true;
      /* The tail clause is doing real work. In F this printed a flavour line and
         stopped, which a player reads as "the key did nothing". Saying out loud
         that there is something here and you do not yet know what teaches the
         whole gating rule the first time it bites. */
      const already = S.notes.length > 0;
      say((V2_BLANK[key] || 'You turn it over and make nothing of it.') +
          (already ? '  Something is here. You do not yet know what you are looking at.'
                   : '  Something is here, and you have no idea what.'));
      if (S.daylight <= 0) nightfall();
      return;
    }
    S.searched[key] = true;
    S.parts.push(hit.part);
    const p = V2_PARTS.find(x => x.id === hit.part);
    /* PROGRESS IS THE ESCALATOR. This is the Slender structure and it is the
       single most important line in V2: winning is what endangers you. */
    stepThreat(`You knew what you were reaching for. The ${p.name}.`);
    if (S.daylight <= 0) nightfall();
    return;
  }

  S.searched[key] = true;

  const note = V2_NOTES[key];
  if (note) {
    S.notes.push(key);

    /* Which leads were still short before this, so we can tell which one this
       piece of paper just completed. */
    const wasShort = V2_PARTS.filter(p => !understands(p.id)).map(p => p.id);
    if (note.token && !S.tokens.includes(note.token)) S.tokens.push(note.token);
    const clicked = wasShort.find(id => understands(id) && !S.parts.includes(id));

    /* The click is the payoff of the whole structure, so it gets the line
       instead of the note's own text. The note itself is in the book. */
    if (clicked && V2_CLICK[clicked]) {
      say(V2_CLICK[clicked] + '  [TAB]');
    } else {
      const flat = note.text.replace(/<[^>]+>/g, '');
      say(flat.length > 112 ? flat.slice(0, 109).trimEnd() + '\u2026  [TAB]' : flat);
    }
    if (S.daylight <= 0) nightfall();
    return;
  }

  const f = roll(V2_FINDS);
  if (f.id === 'oil')   { S.oil = 18; }
  if (f.id === 'stake') { S.stakes++; }
  say(f.text);
  if (S.daylight <= 0) nightfall();
}

/* --------------------------------------------------------------------------
   THE BOOK

   Rendered on open rather than every frame: it is a sheet of paper, it changes
   about ten times a run, and a rAF-driven innerHTML rewrite of a scrolling
   panel is how you reintroduce the compositor thrash this build spent a day
   getting rid of.
-------------------------------------------------------------------------- */
/* A part comes up only when every lead it needs is in hand. Two of the three
   need one piece of paper; the wheel needs two, from opposite ends of the
   valley. See V2_LEADS — the shape of that object is the level design. */
function understands(part) {
  const need = V2_LEADS[part] || [];
  return need.length > 0 && need.every(t => S.tokens.includes(t));
}

function toggleNotes() {
  const el = document.getElementById('notes');
  if (!el || !S) return;
  /* Not over an ending. #end outranks #notes in the stack, so the win card
     draws straight through the paper and you get both at once. */
  if (S.over) { el.hidden = true; return; }
  if (!el.hidden) { el.hidden = true; return; }

  /* ------------------------------------------------------------------------
     J'S BOOK IS A LEDGER OF PEOPLE, NOT OF PAPER.

     What was here before was inherited from the build where you found notes in
     crates and assembled leads out of them. J has no notes — every lead comes
     out of a mouth or out of the ground — so TAB opened a book with nothing in
     it, every single run.

     This is the information a player in the middle of a three-day deduction
     actually needs: who is where, who you have heard something about, who
     answered it, who would not, and who is still holding a piece of your
     wagon. It never names the thing. It only records what you did.

     The markup is deliberately plain. It is content for the UI pass to be
     designed against, not a design.
  ------------------------------------------------------------------------ */
  const STATUS = {
    clear:   'answered it',
    dodged:  'would not answer',
    ready:   'you have something to put to them',
    unknown: 'nothing on them yet',
    gone:    'not where they should be',
  };

  const scenes = [];
  for (const id of ['church', 'well', 'graveyard']) {
    /* S.gone is keyed by MASK id, not scene id. Keyed by scene, one person
       vanishing would have emptied the whole roster for that place. */
    /* GONE PEOPLE KEEP THEIR ROW. Filtering them out made somebody being taken
       completely silent — the book simply had one fewer name than last time
       you opened it, which nobody notices. An empty post is only frightening
       if you can see that it is empty. */
    const here = MASKS.filter(m => m.scene === id);
    if (!here.length) continue;

    const rows = here.map(m => {
      const isGone = !!(S.gone && S.gone[m.id]);
      const state = isGone            ? 'gone'
                  : S.verified[m.id]  ? 'clear'
                  : S.suspect[m.id]   ? 'dodged'
                  : S.heard[m.id]     ? 'ready'
                  : 'unknown';

      /* What you were told about them, if anything — the question you are
         carrying around, in the words you heard it in. */
      const line = S.heard[m.id] ? `<p class="told">${MEMORY[m.id].told}</p>` : '';

      /* Being refused is progress, so the book remembers who they sent you to. */
      const sent = S.pointed[m.id] && !S.verified[m.id]
        ? `<p class="sent">Sent you to ${MASKS.find(x => x.id === S.pointed[m.id]).name}.</p>`
        : '';

      /* WHAT A DISAPPEARANCE COST YOU.

         Scripted runs found this the hard way: the one taken in the night is
         the only person who can vouch for somebody else, and losing them
         silently locks that somebody's wagon part behind a search the player
         has no reason to suspect exists. All the game said was one line of
         narration on waking, which had faded by the time you walked to the
         empty post.

         So the book says it, and it says it on the row of the person you can
         no longer check — which is where a player stuck on a refusal is
         actually looking. It names the loss, not the fix: that the proof is
         on the ground somewhere is the whole reason to search. */
      /* A LINK CAN BREAK TWO WAYS, and only one of them was being reported.

         Every person in the ring has exactly one neighbour who can vouch for
         them. That neighbour becomes unavailable if they are taken in the
         night — which this already said — or if they simply will not
         discuss them, which is what the thing does and is the entire tell.
         Both leave you unable to verify somebody, and the second one is far
         more common: it happens in every single run, by design, because the
         ring always breaks at the culprit.

         It was not being reported at all. A player who put the question to
         the miller, got a dodge, and then could not understand why the
         sexton would never hand over the wheel was reading a book that had
         nothing to say about it. The part was still gettable — the proof is
         in the church crates — but nothing anywhere connected the dodge to
         the lock, so the run was unwinnable in practice while being
         perfectly winnable on paper. That is the worst kind of difficulty.

         Still names the loss, not the fix. "On the ground somewhere" is as
         far as it goes; which ground is the search. */
      const voucher = MASKS.find(x => x.knows === m.id);
      const stuck = !isGone && !S.heard[m.id] && !S.verified[m.id] && voucher;
      const lost =
          stuck && S.gone[voucher.id]
            ? `<p class="lost">Nobody left to vouch for them. Whatever ` +
              `${voucher.name} could have told you went up the valley too.</p>`
        : stuck && S.suspect[voucher.id]
            ? `<p class="lost">${voucher.name[0].toUpperCase()}${voucher.name.slice(1)} ` +
              `would not talk about them, and nobody else can. If there is ` +
              `anything to know it is on the ground somewhere.</p>`
        : '';

      /* And on the other end of the broken link, so the two rows agree —
         whether the link was broken by a disappearance or by a dodge. */
      const far = m.knows && MASKS.find(x => x.id === m.knows);
      const pending = far && !S.heard[far.id] && !S.verified[far.id] && !S.gone[far.id];
      const took =
          isGone && pending
            ? `<p class="lost">Took what they knew about ${far.name} with them.</p>`
        : !isGone && pending && S.suspect[m.id]
            ? `<p class="lost">Would not say a word about ${far.name}.</p>`
        : '';

      /* No "holding the axle" badge on somebody who is not there to hold it —
         nor on somebody you have not met yet; see the note on `owed`. */
      const part = !isGone && S.met[m.id] && m.part && !S.parts.includes(m.part)
        ? `<span class="holds">holding the ${V2_PARTS.find(p => p.id === m.part).name}</span>`
        : '';

      return `<li class="${state}">
        <b>${m.name}</b>
        <span class="state">${STATUS[state]}</span>
        ${part ? '<span class="sep">&middot;</span>' + part : ''}
        ${line}${isGone ? took : sent + lost + took}
        ${isGone || S.met[m.id] ? '' : '<p class="unmet">You have not spoken to them.</p>'}
      </li>`;
    }).join('');

    scenes.push(`<h3>${SCENES[id].name}</h3><ul class="people">${rows}</ul>`);
  }

  /* WHERE THE PARTS ARE IS NOT FREE ANY MORE.

     This used to name every holder on day one, before the player had met
     anybody — "Iron Axle, the miller has it" — which turned the first circuit
     of the valley into a delivery round. Loudon: "it would be best if the
     location of the parts ISN'T obvious at first so that you're forced to talk
     to all of the villagers to figure it out."

     Gated on having SPOKEN to them, not on some new flag, because that is
     already exactly the act being asked for and it needs no extra state. */
  const owed = V2_PARTS.map(p => {
    if (S.parts.includes(p.id)) return `<li class="done"><b>${p.name}</b> in the wagon</li>`;
    const who = MASKS.find(m => m.part === p.id);
    return (who && S.met[who.id])
      ? `<li><b>${p.name}</b> &mdash; ${who.name} has it</li>`
      : `<li><b>${p.name}</b> &mdash; somewhere in the valley</li>`;
  }).join('');

  const left = V2.PARTS_NEEDED - S.parts.length;

  /* THE RULE, ONCE YOU HAVE READ IT OFF THE STONE.

     Standing at the top of the book rather than in a row, because it is not
     about a person — it is the thing every row is measured against, and it
     is the only sentence in the game that states the deduction outright. A
     player who never opens the vault never sees it and has to work the rule
     out from five conversations, which is the game as it was. */
  const rule = S.rule
    ? `<p class="rule">It has their face and their coat and none of their
       life. It cannot be told a thing it did not live — so ask about
       something small, and watch for the one who will not be specific.</p>`
    : '';

  el.innerHTML = `
    <div class="sheet">
      <h2>What you know</h2>
      ${rule}
      <ul class="ledger">${owed}</ul>
      ${scenes.join('')}
      <div class="still">${
        left === 0
          ? 'Everything accounted for. The wagon is outside the church.'
          : `${left} still out there, and ${V2.DAYS - S.day + 1} ${V2.DAYS - S.day === 0 ? 'day' : 'days'} of light.`
      }</div>
      <div class="shut"><b>TAB</b><span>put it away</span></div>
    </div>`;

  el.hidden = false;
}

function roll(table) {
  const tot = table.reduce((a, f) => a + f.weight, 0);
  let r = Math.random() * tot;
  for (const f of table) { r -= f.weight; if (r <= 0) return f; }
  return table[table.length - 1];
}

/* --------------------------------------------------------------------------
   THE THREAT
-------------------------------------------------------------------------- */
/* `lead` is what the player did to cause this. See patch-all-findline.py: the
   caller used to say() its own sentence and then call this, which painted over
   it one frame later. One line, composed here. */
/* `silent` suppresses the spoken tell and hands it back instead, so a caller
   that is already saying something — nextDay(), which has a day number and
   possibly a disappearance to report — can fold it into one line rather than
   overwrite it a frame later. Everything else still happens: the birds, the
   eye state, the new offstage position, the ambience drop. */
function stepThreat(lead, silent) {
  /* Already at the edge of the light: nothing left to step, but the lead still
     has to be spoken or finding your last part is reported by total silence. */
  if (S.threat <= 1) { if (lead && !silent) say(lead); return ''; }
  S.threat--;
  S.eyeState = S.threat <= 1 ? 'lunging' : S.threat === 2 ? 'watching' : 'dormant';
  /* "The birds have stopped" is already the line at plane 2. This makes it a
     thing you watch happen a beat before you read it. */
  birdsUp();

  /* THE COVER COMES OFF AT THE NEAR PLANE, and the near plane is reached only
     by taking the third part — so this fires when the deduction has already
     done its job and cannot be short-circuited by it. You find out whether you
     were right at the exact moment it stops being any use to you.

     Armed rather than applied: takePart() calls stepThreat() from inside an
     open conversation, so removing the mask here could delete the face you are
     currently looking at. update() applies it on the first frame you are not
     talking to anybody. */
  if (S.threat <= 1 && !S.revealed) S.pendingReveal = true;

  const tell = THREAT.TELL[S.threat];
  if (tell) {
    /* Not a bare roll any more. See pickThreatX() in v2-scene.js: the plate
       is scanned for where it is solid at standing height, because the mid
       plane carries the church and a uniform roll put the thing inside it. */
    S.threatX = (typeof pickThreatX === 'function')
      ? pickThreatX(S.at, THREAT.SIGHT[S.threat])
      : 300 + Math.random() * (SRC_H * SCENES[S.at].aspect - 600);
    document.body.classList.toggle('quiet', tell.drop);
    if (silent) return tell.line;
    say((lead ? lead + '  ' : '') + tell.line);
  } else if (lead && !silent) {
    say(lead);
  }
  return '';
}

/* --------------------------------------------------------------------------
   TRAVEL, NIGHT, WIN
-------------------------------------------------------------------------- */
function checkExit() {
  const sc = SCENES[S.at];
  const W  = SRC_H * sc.aspect;

  /* Release the lock once we are clear of every door in this scene. Without
     this, arriving next to a door re-triggers it on the next frame and the
     player ping-pongs between two scenes — which looks exactly like the screen
     flashing, because it is the screen rebuilding sixty times a second. */
  if (S.exitLock &&
      (sc.exits || []).every(e => Math.abs(e.x - S.x) > V2.EXIT_REACH * 2)) {
    S.exitLock = false;
  }

  /* NOTHING TRAVELS ON ITS OWN ANY MORE. See patches/patch-all-exits.py: this
     loop used to move you the moment you came within EXIT_REACH of a door, which
     made the four-door crossroads impossible to cross — walking to the well
     dragged you into the graveyard on the way past, in both directions. Standing
     near a gateway now only offers it. */
}

/* The gateway you are standing in, if any. Mirrors nearestObject(). */
function nearestExit() {
  if (!S || S.over || S.exitLock) return null;
  const sc = SCENES[S.at];
  let best = null, bd = V2.EXIT_REACH;
  for (const ex of sc.exits || []) {
    const d = Math.abs(ex.x - S.x);
    if (d < bd) { bd = d; best = ex; }
  }
  return best;
}

function takeExit(ex) {
  if (ex.cost > S.daylight) return say('You would not make it before dark.');

  S.daylight -= ex.cost;
  const sc    = SCENES[S.at];
  const W     = SRC_H * sc.aspect;
  const dest  = SCENES[ex.to];
  const destW = SRC_H * dest.aspect;

  /* Land beside the door that leads BACK where we came from, stepped well
     inside. The old rule picked a side from which half of the SOURCE scene
     the exit sat in, which is unrelated to where the matching entrance is —
     leaving the graveyard westward dropped you at the far east end of the
     road, next to the door to the well. */
  const back = (dest.exits || []).find(e => e.to === S.at);
  let nx = back
    ? (back.x < destW / 2 ? back.x + V2.EXIT_DROP : back.x - V2.EXIT_DROP)
    : (ex.x < W / 2 ? destW - V2.EXIT_DROP : V2.EXIT_DROP);
  S.x = Math.max(80, Math.min(destW - 80, nx));

  S.at = ex.to;
  S.exitLock = true;
  buildScene(S.at);

  /* The blurb is an establishing line, so it establishes once. Playing a full
     run, the crossroads introduced itself FOUR times — you cross it on every
     journey, and "Four ways out, and your wagon sat in the middle of them" on
     the fourth pass reads as the game having lost its place. After the first
     visit the art and the gateway you just pressed E on are the whole answer to
     "where am I". */
  if (!S.seen[S.at]) { S.seen[S.at] = true; say(SCENES[S.at].blurb); }
  if (S.daylight <= 0) nightfall();
}

/* Drawn in the same place and the same shape as an object prompt, because to the
   player a gateway is just another thing you can walk up to and use. */
function paintExitPrompt(el) {
  const ex = nearestExit();
  if (!ex) { el.classList.remove('on'); return; }
  const broke = ex.cost > S.daylight;
  el.classList.add('on');
  el.classList.toggle('holding', false);
  el.classList.toggle('spent', broke);
  el.innerHTML = broke
    ? `<div class="name">${SCENES[ex.to].name} \u2014 not before dark</div>`
    : pillMarkup('exit', SCENES[ex.to].name, false);
  placePrompt(el, ex.x);
}

function bedDown() {
  nextDay(true, 'You bar the door and wait out the dark.');
}

/* --------------------------------------------------------------------------
   THE TWO ENDINGS

   Both used to be one say() line and nothing else — in the one moment the
   player is guaranteed to be looking at the screen.

   The scene is NOT cleared. You die where you died, and the wash goes over the
   top of it, because the location is the only context that makes an ending
   mean anything. Cutting to black throws that away.
-------------------------------------------------------------------------- */
/* The words on the four ending screens.

   `head` is one string split on the <br>: the first half sets at 72px as the
   kicker, the second at 144px as the headline. That is the shape of Loudon's
   Lose Screen and Win Screen frames.

   The blood moon and the win are his, verbatim from those frames. Caught is
   his too, written for the ending the frames did not cover. */
const END_COPY = {
  won: {
    head: 'You Found All The Parts<br>You Got Away.',
    sub:  'You are on the road before the light goes.',
  },
  /* THE THIRD OUTCOME. It is not a win and it does not say it is.

     It wears the win's frame on purpose — the same dawn, the same lantern,
     the same three filled slots — because every signal this game has for
     success is present and the player earned all of them. The only thing
     that is different is in the cart. The deduction was the one thing they
     got wrong, and this is the only screen in the game that tells them so;
     nothing else ever asks who it was out loud. */
  carried: {
    head: 'You Got Out Of The Valley<br>So Did It.',
    sub:  'The road takes you both.',
  },
  caught: {
    head: 'You Were Caught Out In The Dark<br>Something From The Ridge',
    sub:  'Whatever was counting has finished.',
  },
  bloodmoon: {
    head: 'The Moon Went Red<br>Before You Could Escape.',
    sub:  'The wagon is still in pieces where you left it.',
  },
};


/* The three part marks, as drawn in art/props and reused in the lose screen's
   recovered slot — Loudon's own Figma frame uses the harness one, so these are
   already the vocabulary of that screen. */
const PART_MARK = {
  axle: `<svg viewBox="0 0 24 24" fill="#072F30"><rect x="4" y="10.5" width="16" height="3" rx=".5"/>` +
        `<rect x="2.5" y="6.5" width="3.5" height="11" rx="1"/><rect x="18" y="6.5" width="3.5" height="11" rx="1"/></svg>`,
  wheel: `<svg viewBox="0 0 24 24" fill="none" stroke="#072F30" stroke-width="2" stroke-linecap="round">` +
         `<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M3.5 12h17"/>` +
         `<circle cx="12" cy="12" r="2.6" fill="#072F30" stroke="none"/></svg>`,
  harness: `<svg viewBox="0 0 24 24" fill="none" stroke="#072F30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
           `<rect x="6.5" y="6.5" width="13" height="11" rx="2.5"/><path d="M13 6.5v11"/><path d="M6.5 12H2.5"/></svg>`,
};

/* Shrink the headline only if it would run off the frame.

   The design sets 144px against the lines Loudon wrote, which fit. The
   endings do not all share a line length, though, so this leaves 144 alone
   whenever it fits and steps down only when it must — the copy can be
   rewritten without the layout breaking. */
function fitHeadline(root) {
  const h = root.querySelector('h1');
  const frame = root.querySelector('.frame');
  if (!h || !frame) return;

  /* MEASURE THE TEXT, NOT THE BOX. The headline is a centred block the full
     width of the frame, so scrollWidth reports 3200 no matter what it says —
     which drove this loop straight to its floor and set every ending at 72px,
     the same size as the kicker above it. A Range measures the glyphs.

     The frame is transformed, so the range comes back in rendered pixels;
     dividing by the frame's own scale puts it back into design units. */
  const design = +frame.dataset.w;
  const scale = frame.getBoundingClientRect().width / design;
  const textWidth = () => {
    const r = document.createRange();
    r.selectNodeContents(h);
    return r.getBoundingClientRect().width / (scale || 1);
  };

  const avail = design - 240;          // a margin each side
  let size = 144;
  h.style.fontSize = size + 'px';
  while (textWidth() > avail && size > 72) {
    size -= 4;
    h.style.fontSize = size + 'px';
  }
}


/* --------------------------------------------------------------------------
   THE ENDING SCREENS

   One skeleton, three endings. Loudon's frames, 3200x1800.

   The two losses share a layout because they are the same outcome — you did
   not get out — and the headline is what separates being reached from running
   out of nights.
-------------------------------------------------------------------------- */
function endingScreen(how) {
  const copy = END_COPY[how] || END_COPY.bloodmoon;
  const out  = how === 'won' || how === 'carried';   // the wagon rolled
  const won  = out;                                  // ...so the win layout
  const got  = S.parts.length;
  const need = V2.PARTS_NEEDED;
  const dayWord = ['', 'one day', 'two days', 'three days'][S.day] || `${S.day} days`;

  const slots = V2_PARTS.map(p => {
    const has = S.parts.includes(p.id);
    return `<div class="slot${has ? ' has' : ''}" title="${p.name}">${has ? PART_MARK[p.id] || '' : ''}</div>`;
  }).join('');

  /* Loudon's Win frame still carried the Lose tally — these are mine, written
     to his sentence shape so the two endings read as a pair. */
  /* The carried tally has to do one job the other two do not: say WHY, in
     plain words, because the player has no other way to find out. They never
     accused anyone and nobody ever confirmed anything. Naming the hand is the
     answer to the question the whole run was asking. */
  const taken = how === 'carried'
    ? MASKS.find(m => m.id === S.thing)
    : null;

  /* "The last came out of..." was wrong whenever the marked take was followed
     by a clean one in the same afternoon — you can take from the thing and
     then collect a third part from a verified hand before the light goes, and
     S.marked survives both. "One of them" is true in every case. */
  const tally =
      how === 'carried'
        ? `You found all ${need}/${need} parts. One of them came out of<br>` +
          `${taken ? taken.name + "'s" : 'a'} hands, and you never checked them.`
    : won
        ? `You found all ${need}/${need} parts and were<br>on the road before the light went.`
        : `You only got ${got}/${need} parts and were<br>unable to repair the wagon in time.`;

  /* .stowed goes BEFORE .cart so the crates paint over it: the figure is in
     the wagon bed, not standing behind it, and the occlusion is DOM order
     rather than a clip path that would have to be re-measured if the art
     ever moves. */
  const cast =
      how === 'carried'
        ? `<div class="stowed"></div><div class="cart"></div>` +
          `<div class="lantern"></div><div class="walker"></div>`
    : won
        ? `<div class="cart"></div><div class="lantern"></div><div class="walker"></div>`
        : `<div class="revenant"><i class="reye l"></i><i class="reye r"></i></div>`;

  const head = copy.head.split('<br>');

  return `<div class="frame" data-w="3200" data-h="1800">
      <div class="bloom"></div>
      ${cast}
      <div class="kicker">${head[0]}</div>
      <h1>${head[1] || copy.sub}</h1>
      <div class="slots">${slots}</div>
      <div class="tally">${tally}</div>
      <div class="again"><b>R</b>walk it again</div>
    </div>`;
}

function showEnd(how) {
  /* Kill any in-flight narration. A line fading out behind the ending reads as
     a rendering fault, and it is competing with the one thing on screen that
     matters. */
  const ln = document.getElementById('line');
  if (ln) { ln.classList.remove('show'); ln.textContent = ''; }
  S.line = '';

  /* `out` is "the wagon rolled", which decides the LAYOUT. `S.over` stays a
     two-value thing because the only thing reading it is the restart key. */
  const out = how === 'won' || how === 'carried';
  const won = out;
  S.over = out ? 'won' : 'dead';

  /* All three endings are Loudon's 3200x1800 frames now. The old centred card
     and the `won` / `dead` rules in v2-end.css that styled it are no longer
     reachable from here; what is still live in that file is the fade-in on
     #end.on and the wash behind it. */
  const endEl = document.getElementById('end');
  endEl.className = '';                // reset first, so a second run re-animates
  void endEl.offsetWidth;              // force reflow or the transition is skipped
  endEl.innerHTML = endingScreen(how);
  endEl.className = 'on ending ' + (won ? 'wonx' : 'lost') +
                    (how === 'carried' ? ' carried' : '');
  fitFrame();
  fitHeadline(endEl);
}


function hideEnd() {
  const el = document.getElementById('end');
  if (el) { el.className = ''; el.innerHTML = ''; }
}

/* WHY `S.marked` IS THE WHOLE TEST, and no new flag was added for it.

   `marked` is set in exactly one place — takePart() with mark true, which is
   `!verified(S, m.id) && isThing(S, m)`. It means: you took a wagon part out
   of the revenant's own hands without ever having checked that hand. It is
   cleared at nightfall(), where the thing comes and takes the part back.

   So the only way to still be marked when the wagon rolls is to have taken
   that part and repaired before the light went — the same afternoon, in a
   hurry, at the end. That is precisely the player this ending is for, and it
   needs no bookkeeping of its own: being marked at the moment you leave IS
   carrying it out, because the night that would have taken it back never
   came. */
function repair() {
  if (S.parts.length < V2.PARTS_NEEDED) return say('You do not have everything you need.');
  if (V2.REPAIR_COST > S.daylight)      return say('Not enough light left to fit them.');
  showEnd(S.marked ? 'carried' : 'won');
}

/* Escalation is now SPATIAL, not calendrical. V1 keyed the night to the day
   number — day one taught, day three killed — which is a calendar and can be
   budgeted against. Here it keys to how near the thing is. */
/* NOTHING IS BURIED IN THIS BUILD, so the old "put it back where it was hiding"
   loop ran over an empty V2_PLACEMENT and did nothing at all — the part simply
   evaporated and the narration told you to go and look somewhere that does not
   exist. A part belongs to whoever handed it over, and that is where it goes
   back to. You can go and ask them again; they already trust you. */
function losePartToItsOwner(lead) {
  const lost = S.parts.pop();
  const p = V2_PARTS.find(x => x.id === lost);
  const owner = MASKS.find(m => m.id === S.gave[lost]);
  return nextDay(false, owner
    ? `${lead} The ${p.name} is back in ${owner.name}'s hands, and you will have to ask again.`
    : `${lead} The ${p.name} is gone with it.`);
}

/* --------------------------------------------------------------------------
   HOW MUCH LIGHT IT COSTS TO GET UNDER A ROOF

   The well has no shelter, so from its far end the answer is a walk, an exit,
   and another walk — about a third of a day. A player cannot be expected to
   hold that sum in their head, and by the time the dark is obvious it is
   already too late to act on it. So the game works it out and says so, once.
-------------------------------------------------------------------------- */
function costToShelter() {
  const here = SCENES[S.at];
  const roof = (here.objects || []).find(o => o.shelter);
  if (roof) return Math.abs(roof.x - S.x) * V2.WALK_COST;

  let best = Infinity;
  for (const ex of here.exits || []) {
    const dest = SCENES[ex.to];
    if (!dest) continue;
    const destRoof = (dest.objects || []).find(o => o.shelter);
    if (!destRoof) continue;                   // one hop only; two is a lost run

    /* Where takeExit() actually drops you, so the sum is the real walk. */
    const destW = SRC_H * dest.aspect;
    const back  = (dest.exits || []).find(e => e.to === S.at);
    const land  = back
      ? (back.x < destW / 2 ? back.x + V2.EXIT_DROP : back.x - V2.EXIT_DROP)
      : destW / 2;

    best = Math.min(best,
      Math.abs(ex.x - S.x) * V2.WALK_COST + ex.cost +
      Math.abs(destRoof.x - land) * V2.WALK_COST);
  }
  return best;
}

/* Said once a day, at the last moment it is still true. The margin is the
   difference between a warning and an obituary. */
function checkLastLight() {
  if (!S || S.over || S.warnedToday) return;
  const need = costToShelter();
  if (!isFinite(need)) return;
  if (S.daylight > need * 1.35) return;
  S.warnedToday = true;

  const here = SCENES[S.at];
  const roof = (here.objects || []).find(o => o.shelter);
  say(roof
    ? 'The light is going. You would want to be behind that door.'
    : 'The light is going, and there is no roof on this end of the valley.');
}

function nightfall() {
  /* MARKED: you took something out of a hand you had not checked, and it knows
     your face now. The door does not help. It comes, it takes back what it gave
     you, and it goes — so this is a real cost and not a dead end.

     That matters, because the thing can be holding a part you need. Then you
     either work out who it is and pay this price on purpose, or you never find
     out and pay it by accident. Both are a game. Killing you outright would
     make a third of the runs unwinnable through no fault of yours. */
  if (S.marked) {
    S.marked = false;
    if (!S.parts.length) return showEnd('caught');
    return losePartToItsOwner('It came for you in the night and it did not have to look.');
  }

  const sc = SCENES[S.at];
  const inShelter = (sc.objects || []).some(o =>
    o.shelter && Math.abs(o.x - S.x) < V2.REACH);

  if (inShelter || sc.shelter && S.x < 200) { return nextDay(true, 'The light goes while you are safe behind the door.'); }
  if (S.threat <= 1) { return showEnd('caught'); }
  if (S.stakes > 0)  { S.stakes--; return nextDay(true, 'The whitethorn holds it at the gate. The stake is gone.'); }

  if (S.parts.length) return losePartToItsOwner('You woke on the church floor.');
  {
    nextDay(false, 'Something followed you back. You are alive, and lighter than you were.');
  }
  return;
}

/* --------------------------------------------------------------------------
   IT DOES NOT WAIT FOR YOU

   One villager is taken during the run. You are never told who — you walk to
   where they stand and they are not standing there.

   WHY THE MISSING ONE IS NEVER THE THING. The obvious version of this feature
   gives the whole game away: if the absent mask is the culprit, a player stops
   deducing and starts counting heads. So the absence is not evidence, it is a
   LOSS. Whoever goes is somebody whose memory you needed, and the only other
   place that memory exists is in the ground — which is the one thing that
   reliably makes searching matter more than talking.

   It does narrow the field by one, and that is a real clue. It is also a clue
   you paid a villager for.

   ELIGIBILITY protects the run from itself: never the thing, never somebody
   already gone, and never somebody still holding a part you need, because
   that is an unwinnable run served up by a dice roll.

   LIMITATION, STATED HONESTLY: early on the only people holding no part are
   the thresher and the boy, so on day two it is nearly always one of those
   two and a replaying player will notice the pattern. Widening it means
   letting a part-holder go and leaving the part on the ground where they
   stood, which is a new searchable object and real plumbing. Worth doing
   after the presentation, not two days before it. */
function takeSomeone() {
  const pool = MASKS.filter(m =>
    m.id !== S.thing &&
    !S.gone[m.id] &&
    !(m.part && !S.parts.includes(m.part)));
  if (!pool.length) return '';

  /* PREFER THE ABSENCE THAT ACTUALLY COSTS SOMETHING. Every memory in the ring
     has exactly one teller, so taking somebody deletes one link — but the link
     only matters if the person on the far end of it is still holding a part
     you need. The boy tells you about the thresher, and the thresher holds
     nothing, so losing the boy is pure atmosphere; the thresher tells you
     about the widow, who has the harness, so losing the thresher forces you
     into the ground to find her proof instead.

     Unbiased that was a coin flip. Weighted, roughly four runs in five put a
     search where a conversation used to be, which is the entire point of the
     feature. */
  const costly = pool.filter(m => {
    const far = MASKS.find(x => x.id === m.knows);
    return far && far.part && !S.parts.includes(far.part);
  });
  const from = costly.length ? costly : pool;

  /* NOT SOMEBODY YOU HAVE NEVER MET.

     An empty post is only frightening if you know whose it was. Taking a
     stranger is bookkeeping: the player walks up to a place they have never
     been, finds nobody, and has lost something they cannot miss. It happens
     most often to the boy — when the thresher is the thing, the pool on the
     morning of day two is the boy and nobody else, every run.

     So prefer a face the player has actually stood in front of, and if
     there is no such face, take nobody tonight and come back tomorrow. The
     caller allows that now: it tries again on each new day until it lands,
     rather than getting one attempt on day two. By day three a player who
     has been anywhere at all has met somebody. */
  const met = from.filter(x => S.met[x.id]);
  if (!met.length) return '';

  const m = met[Math.floor(Math.random() * met.length)];
  S.gone[m.id] = true;
  S.taken = m.id;
  /* The line does NOT name them. Finding out who costs a walk. */
  return 'Something went up the valley in the night and came back down it.';
}

/* `stay` = you survived the night where you stood, so you wake there. Only a
   night that went badly marches you back to the church.

   This is what makes the crypt a real decision. It used to reset S.at to the
   church unconditionally, so sleeping at the crypt teleported you home anyway
   and the crypt had no mechanical effect whatsoever — which emptied out the
   one strategic choice the map exists to pose. */
/* `lead` is what happened to get you here. say() replaces the one narration line
   rather than queueing, so a caller that says its own sentence and THEN calls
   nextDay() is writing over its own outcome one frame later — which is how the
   night phase came to report itself to nobody. One line, composed here. */
function nextDay(stay, lead) {
  if (S.day >= V2.DAYS) { return showEnd('bloodmoon'); }
  S.day++;
  S.daylight = V2.DAYLIGHT_PER_DAY;
  S.warnedToday = false;          // a fresh day gets a fresh warning
  if (!stay) { S.at = 'church'; S.x = 1150; buildScene(S.at); }
  S.exitLock = true;

  /* Day two, so it has time to cost you something. Night is also the only
     moment that cannot collide with an open conversation. */
  /* From day two, and every morning after until it lands — takeSomeone()
     declines any night when the only candidates are people the player has
     never met, and a night it declines must not be the only night it had. */
  const took = (S.day >= 2 && !S.taken) ? takeSomeone() : '';

  /* TIME IS ALSO THE ESCALATOR.

     Before this, stepThreat() was reached from exactly one place that
     mattered — taking a part out of a hand — so the threat only ever moved
     three times a run and only if you were winning. Scripted playthroughs
     found the consequence: a player who spent three days searching every
     object in the valley finished with the threat still on plane 4, having
     never once seen it. The planes, the birds going up, the ambience drop and
     the figure itself were all gated behind near-victory.

     A night survived now costs a plane as well. "Progress is the escalator"
     is unchanged; this adds "and so is time", which the blood moon has been
     promising since the first line of the game.

     FLOORED AT 2, deliberately. The near plane is still reachable only by
     taking the third part, so the unmasking still fires when the deduction
     has already done its job and cannot arrive for free while you sleep. What
     the nights guarantee is that day two is lived at the far plane and day
     three at the middle one. */
  const tell = S.threat > 2 ? stepThreat(null, true) : '';

  say((lead ? lead + '  ' : '') + `Day ${S.day}.` +
      (took ? '  ' + took : '') + (tell ? '  ' + tell : ''));
  if (took) buildMasks(S.at);   // in case they stood in the scene you woke in

  /* The card says the day and the job; the narration line says what happened
     in the night. They are deliberately not the same sentence — the card is
     over in three seconds and the line stays. */
  if (window.V2Day) V2Day.show();
}

/* Fullscreen. V1 had this and V2 did not, which matters the moment you want to
   show the thing to someone — the browser chrome is most of what makes a
   demo look like a web page rather than a game. */
function toggleFull() {
  const el = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen();
  else if (el.requestFullscreen) el.requestFullscreen();
}

addEventListener('DOMContentLoaded', () => {
  newRun();
  requestAnimationFrame(frame);
  document.getElementById('fs').addEventListener('click', toggleFull);
  document.getElementById('restart').addEventListener('click', newRun);
});
