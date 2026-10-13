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


const RAMP = 1.1;                    // seconds; the dusk rise is tracked live
const DUCK = 1.6;                    // seconds, the bed dropping out
const OUT  = 1.8;                    // seconds, an ending

const KEY = 'benighted.muted';

let ctx = null, bedGain = null, threatGain = null, master = null;
let bedEl = null, threatSrc = null;
let bedSrc = null, outTap = null;
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

  /* A tap on the way out. Gains and currentTime tell you what the graph
     INTENDS; this is the only thing that tells you what is leaving it, which
     is the exact distinction the missing song lived in for a month. */
  outTap = ctx.createAnalyser();
  outTap.fftSize = 2048;
  master.connect(outTap);

  bedGain = ctx.createGain();
  bedGain.gain.value = 0;
  bedGain.connect(master);

  threatGain = ctx.createGain();
  threatGain.gain.value = 0;
  threatGain.connect(master);


  /* The bed: streamed. */
  bedEl = new Audio(SRC.bed);
  bedEl.loop = true;
  bedEl.crossOrigin = 'anonymous';
  bedEl.preload = 'auto';
  try {
    /* HOLD THE SOURCE NODE.

       This used to be createMediaElementSource(bedEl).connect(bedGain) with
       the node thrown away on the same line. The element went on playing and
       currentTime went on advancing — __mix() reported bedPlaying true and a
       bed gain of 0.55 the entire time — but a MediaElementAudioSourceNode
       that nothing in JS references is collectable, and when it is collected
       the sound stops while every number you can read still looks right.

       threatSrc was always held, which is exactly why the threat layer kept
       working and the song did not. */
    bedSrc = ctx.createMediaElementSource(bedEl);
    bedSrc.connect(bedGain);
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
window.V2Audio = { start, setMuted, isMuted: () => muted };

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
  /* WHAT IS ACTUALLY COMING OUT, as opposed to what the gains say ought to be.
     Peak sample on the master bus over one analyser frame. A zero here under a
     bed of 0.55 is the graph lying to you. */
  out: (() => {
    if (!outTap) return null;
    const b = new Float32Array(outTap.fftSize);
    outTap.getFloatTimeDomainData(b);
    let p = 0; for (let i = 0; i < b.length; i++) { const v = Math.abs(b[i]); if (v > p) p = v; }
    return +p.toFixed(4);
  })(),
});

})();
