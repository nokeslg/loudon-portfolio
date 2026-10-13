/* ============================================================================
   BENIGHTED — SOUND

   Two of Loudon's tracks, mixed live against the one number that matters:

     benighted-song.m4a    2:35, the bed. Always running.
     benighted-threat.m4a  0:15, the tension layer. Always running too, at
                           zero, and brought up a step at a time as the thing
                           closes in.

   The threat layer is never started or stopped, only faded. Starting a loop
   when something scary happens announces itself — the player hears the game
   make a decision. A layer that has been playing silently since the title and
   simply becomes audible does not, and it means the two tracks never have to
   be re-synchronised against each other.

   WHY THE SPLIT IN HOW THEY ARE LOADED. The bed is a MediaElementSource: 155
   seconds decoded to float32 is about 54MB of memory for something nobody
   will hear loop, and streaming it costs nothing. The threat layer is an
   AudioBuffer, because AAC carries encoder padding at both ends and an
   <audio loop> of fifteen seconds puts an audible hole in the tension every
   fifteen seconds. Decoded it is ~5MB and the loop is sample-exact.

   `body.quiet` ALREADY MEANT THIS. v2.css has had a visual stand-in sitting
   on that class since before there was any audio — "Darkwood's preferred
   tell is not a sting, it is the ambient bed dropping OUT". Now it is the
   real thing: the bed ducks to almost nothing and leaves the threat layer
   alone in the room. The desaturation stays on top of it.
   ========================================================================== */
(function () {

const SRC = {
  bed:    '../../audio/benighted-song.m4a',
  threat: '../../audio/benighted-threat.m4a',
};

/* Bed level, and the threat layer at each plane. 4 is offstage and silent;
   1 is the near plane, where it is the loudest thing in the mix.

   THESE TWO NUMBERS ARE A GUESS AND SHOULD BE TUNED BY EAR. They are a ratio
   between two tracks that were mastered separately, and nothing in the code
   can know what that ratio ought to be. Both are URL overrides for exactly
   that reason — ?bed=0.4&threat=0.7 auditions a mix without an edit, the
   same way ?vs= does for the villager scale. `threat` sets the level at the
   near plane; the three planes below it keep their proportions. */
const Q = new URLSearchParams(location.search);
const num = (k, d) => (isNaN(parseFloat(Q.get(k))) ? d : parseFloat(Q.get(k)));

const BED_GAIN    = num('bed', 0.55);
const BED_DUCKED  = BED_GAIN * 0.18;   // while `quiet` is on
const THREAT_NEAR = num('threat', 0.88);

/* WHEN THE LAYER IS ALLOWED IN.

   It used to rise a step per threat plane, which meant it was audible for
   most of a run - and a tension layer that is on most of the time is not a
   tension layer, it is the soundtrack. It now has exactly two reasons to
   exist, and both are moments the player is already afraid of:

     THE LIGHT GOING. Rises from nothing through the last third of a day,
     full at dark. This is the one heard every run, three times, and it
     resets to silence at dawn - which is what makes the morning feel like
     relief rather than just a bigger number.

     THE NEAR PLANE. Straight to full whenever the thing is at plane 1,
     whatever the hour. That is the last escalation in the game and it
     should sound like one.

   Whichever is louder wins; they are not added. Being caught out at dusk
   with it standing next to you is already the worst thing that can happen
   and does not need the mix to say so twice. */
const DUSK_AT = num('dusk', 32);       // light left when it starts to rise

/* FOOTSTEPS.

   Synthesised, not sampled. Three reasons, in order of how much they
   mattered: a recorded step is one step, and a loop of one step is the most
   obviously fake sound a game can make; the whole game is 7MB of art and a
   step library is a tenth of that again for something nobody should
   consciously hear; and a synthesised one can be varied per footfall, per
   foot and per scene for free, which is the only thing that stops a repeated
   noise from turning into a rhythm the player starts listening to.

   Each step is a band-passed noise burst (the scuff) over a very short
   low sine (the weight). Everything about both is randomised a little, and
   the two feet are deliberately not identical — real gaits are asymmetric,
   and a perfectly even step is the other way a synthesised walk gives
   itself away.

   STRIDE IS THE ANIMATION'S STRIDE. ANIM.STRIDE, read straight off v2-game.js
   rather than copied, because two constants that have to agree will not. The
   step fires on the frame the bob reaches the bottom of its arc, so the sound
   is ON the contact rather than near it — which is the whole of whether a
   footstep sounds like the character's foot or like a sound effect playing
   over him. ?stride= moves both at once. */
const STEP_GAIN = num('steps', 0.085);   // against a bed at 0.55. faint.
const STRIDE    = num('stride', typeof ANIM !== 'undefined' ? ANIM.STRIDE : 330);

/* Per scene, because the ground is not the same ground. Centre frequency of
   the scuff, how fast it dies, and how much weight is under it. The church
   is flagstone and gravel, the graveyard is wet grass over earth, the well
   is the packed dirt of a path people use every day. The differences are
   small on purpose: this should register as "somewhere else", not as a
   different sound effect. */
const GROUND = {
  church:    { hz: 1650, decay: 0.055, body: 0.55 },
  graveyard: { hz:  950, decay: 0.095, body: 0.30 },
  well:      { hz: 1250, decay: 0.070, body: 0.45 },
};
const GROUND_DEFAULT = GROUND.well;

const RAMP = 1.1;                    // seconds; the dusk rise is tracked live
const DUCK = 1.6;                    // seconds, the bed dropping out
const OUT  = 1.8;                    // seconds, an ending

const KEY = 'benighted.muted';

let ctx = null, bedGain = null, threatGain = null, master = null;
let bedEl = null, threatSrc = null;
let footBus = null, noiseBuf = null, footIdx = null, footSide = 1, footN = 0;
let started = false, ready = false;
let muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch (e) {}

const at = () => (ctx ? ctx.currentTime : 0);
function ramp(param, value, secs) {
  if (!ctx) return;
  /* setTargetAtTime, not linearRamp: an exponential approach has no corner
     at either end, which is what you want for something the player should
     not notice changing. The time constant is a third of the nominal ramp,
     so it is ~95% there by the time quoted. */
  param.cancelScheduledValues(at());
  param.setTargetAtTime(value, at(), Math.max(0.05, secs / 3));
}

/* ---------- build it, once, on the first gesture the browser gives us ----
   No audio context may start before one. The game is keyboard-driven, so the
   first arrow key is the gesture; a click anywhere counts too. */
async function start() {
  if (started) return;
  started = true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();

  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);

  bedGain = ctx.createGain();
  bedGain.gain.value = 0;
  bedGain.connect(master);

  threatGain = ctx.createGain();
  threatGain.gain.value = 0;
  threatGain.connect(master);

  /* Footsteps have their own bus so they can sit UNDER the mute switch and
     OVER the ambience duck. When the bed drops out for dread, your own steps
     are what is left in the room, and that is the point of the duck. */
  footBus = ctx.createGain();
  footBus.gain.value = STEP_GAIN;
  footBus.connect(master);

  /* A quarter-second of white noise, made once and re-pointed at by every
     step. Allocating a buffer per footfall would be 2 a second of garbage
     for a sound that is already in memory. */
  const len = Math.floor(ctx.sampleRate * 0.25);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;

  /* The bed: streamed. */
  bedEl = new Audio(SRC.bed);
  bedEl.loop = true;
  bedEl.crossOrigin = 'anonymous';
  bedEl.preload = 'auto';
  try {
    ctx.createMediaElementSource(bedEl).connect(bedGain);
    await bedEl.play();
    ramp(bedGain.gain, BED_GAIN, 3.5);     // fade up from silence, not a cut
  } catch (e) { /* no bed; the rest still works */ }

  /* The threat layer: decoded, so the loop has no seam. */
  try {
    const buf = await fetch(SRC.threat).then(r => r.arrayBuffer());
    const decoded = await ctx.decodeAudioData(buf);
    threatSrc = ctx.createBufferSource();
    threatSrc.buffer = decoded;
    threatSrc.loop = true;
    threatSrc.connect(threatGain);
    threatSrc.start();
  } catch (e) { /* no layer; the bed still works */ }

  ready = true;
  apply(true);
  requestAnimationFrame(footTick);
}

/* ---------- one footfall ----------
   Scheduled against ctx.currentTime, not fired "now": every envelope here is
   shorter than a frame at 60fps, so anything hung off a timer would be
   audibly uneven. The Web Audio clock does not care what the renderer is
   doing. */
function foot() {
  if (!ready || !ctx || muted) return;
  const g = GROUND[window.S && S.at] || GROUND_DEFAULT;
  const t = at() + 0.001;
  footSide = -footSide;
  footN++;

  /* The two feet are not the same foot. A few per cent of level and a few
     per cent of pitch is all it takes; make them identical and the ear hears
     a loop after about four steps. */
  const lead  = footSide > 0 ? 1 : 0.86;
  const decay = g.decay * (0.85 + Math.random() * 0.3);

  const n  = ctx.createBufferSource();
  n.buffer = noiseBuf;
  n.playbackRate.value = 0.8 + Math.random() * 0.4;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = g.hz * (0.85 + Math.random() * 0.3);
  bp.Q.value = 0.7;

  /* A second, lower band under the first. One band reads as a hiss; two
     read as something with mass landing on something with texture. */
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = g.hz * 2.4;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(lead, t + 0.004);   // the contact
  env.gain.exponentialRampToValueAtTime(0.0008, t + decay);

  n.connect(bp); bp.connect(lp); lp.connect(env);

  /* Weight. 60-ish Hz, gone in a twentieth of a second — felt rather than
     heard, and the first thing to disappear on a laptop speaker, which is
     fine. It is there for headphones and for the room on presentation day. */
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(78 + Math.random() * 16, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.05);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0, t);
  og.gain.linearRampToValueAtTime(g.body * lead, t + 0.006);
  og.gain.exponentialRampToValueAtTime(0.0008, t + 0.075);
  o.connect(og);

  /* A hand's width of stereo, alternating. Enough to feel like two feet,
     not enough to notice as an effect. Mono where the browser has no panner
     rather than no sound at all. */
  let out = footBus;
  if (ctx.createStereoPanner) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = footSide * 0.13;
    pan.connect(footBus);
    out = pan;
  }
  env.connect(out); og.connect(out);

  n.start(t); n.stop(t + decay + 0.02);
  o.start(t); o.stop(t + 0.09);
}

/* Distance, not time, and the SAME distance the bob is drawn from.

   On the absolute count — floor(dist / STRIDE) — not on an accumulator. An
   accumulator started wherever the player happened to be standing when the
   audio context woke up, which left the sound a constant fraction of a stride
   away from the body's lowest point for the whole run. The floor of the real
   distance cannot drift: the bob is at the bottom of its arc exactly when
   that integer changes.

   Stop halfway through a stride and the next step waits for you. Walk into
   the edge of a scene and there are no steps at all, because x is clamped and
   no distance is covered. Neither of those is special-cased anywhere. */
function footTick() {
  requestAnimationFrame(footTick);
  if (!ready || !window.S || S.over || S.talk) { footIdx = null; return; }
  const i = Math.floor(S.dist / STRIDE);
  /* First tick, a new run, or a tab that was in the background: take the
     count as it is and make no sound. Catching up would fire a burst of
     footsteps for ground the player watched nothing walk across. */
  if (footIdx === null || i < footIdx || i - footIdx > 4) { footIdx = i; return; }
  if (i > footIdx) { footIdx = i; foot(); }
}

/* ---------- the mix, read off the game state ----------
   Pulled every frame rather than pushed from stepThreat(), because the
   things that move it — the threat plane, the ambience drop, an ending —
   are set in four different places and a missed call is a stuck mix. */
let lastWant = null, lastQuiet = null, lastOver = null;

function apply(force) {
  if (!ready || !window.S) return;

  const over  = !!S.over;
  const quiet = document.body.classList.contains('quiet');

  if (over !== lastOver) {
    lastOver = over;
    if (over) {
      /* Both out. Whatever happened, it has happened, and the ending frame
         is a still image — it should not have a loop running under it. */
      ramp(bedGain.gain, 0, OUT);
      ramp(threatGain.gain, 0, OUT);
      return;
    }
    force = true;                     // a new run: put the mix back
  }
  if (over) return;

  /* The two reasons, whichever is louder. Daylight is a continuous number
     that falls every step you take, so this is recomputed on every tick
     rather than watched for a change of state — the dusk rise has no
     state to change. The epsilon keeps it from rescheduling the same ramp
     eight times a second while standing still. */
  const light = Math.max(0, S.daylight);
  const dusk  = Math.max(0, Math.min(1, (DUSK_AT - light) / DUSK_AT));
  const near  = S.threat <= 1 ? 1 : 0;
  const want  = THREAT_NEAR * Math.max(dusk, near);

  if (force || lastWant === null || Math.abs(want - lastWant) > 0.01) {
    lastWant = want;
    ramp(threatGain.gain, want, RAMP);
  }
  if (force || quiet !== lastQuiet) {
    lastQuiet = quiet;
    ramp(bedGain.gain, quiet ? BED_DUCKED : BED_GAIN, DUCK);
  }
}

/* ---------- the switch ---------- */
function setMuted(v) {
  muted = v;
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
  const btn = document.getElementById('mute');
  if (btn) {
    /* A verb, like `fullscreen` and `restart` beside it. "sound on" as a
       label is ambiguous in a row of buttons that say what they do — it
       reads as the current state to half the people who see it and as the
       thing they are about to cause to the other half. */
    btn.textContent = v ? 'unmute' : 'mute';
    btn.setAttribute('aria-pressed', String(v));
  }
  if (master) ramp(master.gain, v ? 0 : 1, 0.25);
}

addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('mute');
  if (btn) btn.addEventListener('click', () => { start(); setMuted(!muted); });
  setMuted(muted);

  const kick = () => { start(); };
  addEventListener('keydown', kick, { once: true });
  addEventListener('pointerdown', kick, { once: true });

  /* 8Hz is plenty for something whose fastest change takes 1.6 seconds, and
     it keeps a getComputedStyle-free class read off the render loop. */
  setInterval(() => apply(false), 125);
});

/* So the capture harness can photograph a scene in silence. */
window.V2Audio = { start, setMuted, isMuted: () => muted,
  /* The footstep bus, so the level it actually puts out can be MEASURED with
     an analyser rather than described. "It sounded faint to me" is not a
     check, and faint is the entire specification here. */
  _foot: () => footBus, foot: () => foot() };

/* A read-only window onto the live graph, so the mix can be asserted on
   rather than listened to. There is no other way to tell from the outside
   whether the threat layer actually came up — it is a number inside a
   GainNode, and "it sounded right to me" is not a check. */
window.__mix = () => ({
  ready,
  ctx:    ctx ? ctx.state : 'none',
  bed:    bedGain    ? +bedGain.gain.value.toFixed(3)    : null,
  threat: threatGain ? +threatGain.gain.value.toFixed(3) : null,
  master: master     ? +master.gain.value.toFixed(3)     : null,
  bedPlaying: !!(bedEl && !bedEl.paused && bedEl.currentTime > 0),
  bedAt:  bedEl ? +bedEl.currentTime.toFixed(1) : null,
  loopSecs: threatSrc && threatSrc.buffer
    ? +threatSrc.buffer.duration.toFixed(2) : null,
  steps:  footBus ? +footBus.gain.value.toFixed(3) : null,
  stepsFired: footN,
  stride: STRIDE,
});

})();
