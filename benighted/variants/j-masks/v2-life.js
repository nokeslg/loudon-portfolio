/* ============================================================================
   H — THE LIVING VALLEY

   The complaint this answers: the scenes look dense and play empty. Six parallax
   layers of art, and the player only ever touches the one narrow ground band at
   82%-92%. Sky, ridge, far and mid are wallpaper — they never move beyond
   parallax, never change, never mean anything.

   Nothing in here needs new art. Everything is positioned INSIDE an existing
   layer div, which is the same trick paintThreat already uses: a child of
   `.lyr[data-id="far"]` inherits that layer's parallax transform for free and is
   occluded correctly by everything in front of it.

   THREE SYSTEMS, in order of how much they buy:

   1. THE DAY WASH. The valley is a different colour on each of the three days,
      reddening toward the blood moon. Applied per layer with distance-weighted
      strength, so it reads as aerial perspective rather than a filter slapped
      over the screen. This is the single cheapest way to make day three LOOK
      like day three, and it costs one gradient per layer.

   2. MIST. Slow horizontal drift in the far and mid planes. The thing that makes
      flat art read as still is that nothing moves at a different rate from
      anything else; two drifting bands at different speeds fixes that for the
      whole scene.

   3. THE ROOST. Birds sitting on the far treeline. When the threat steps a plane
      closer they go up and leave, and they do not come back. THREAT.TELL already
      says "The birds have stopped" at plane 2 — this is that line, as a thing
      you watch happen instead of a sentence you read.

   PERFORMANCE: no `will-change` anywhere, deliberately. See the comment in
   v2.css — promoting these to compositor layers is what caused the flashing
   green box, and a scene layer here is 2204x1102. Transform animations
   composite fine without the hint.
   ========================================================================== */

/* How hard the day wash hits each plane. Distance does the work: the sky takes
   almost all of it, the foreground almost none, which is what aerial
   perspective actually does and why this does not read as a filter. */
const WASH_BY_LAYER = { sky: 1, ridge: 0.82, far: 0.62, mid: 0.4, near: 0.2, fore: 0.08 };

/* Per day. Day one is untouched — it has to be, or there is no baseline to
   notice day two against. */
const DAY_WASH = {
  1: { a: 0,    c: '255,170,110' },
  2: { a: 0.17, c: '226,142,86'  },   // something is wrong with the light
  3: { a: 0.34, c: '208,86,52'   },   // the moon is coming up red
};

const MIST = [
  { layer: 'far', top: 0.545, h: 0.13, a: 0.30, dur: 96 },
  { layer: 'mid', top: 0.655, h: 0.11, a: 0.22, dur: 61 },
];

/* Where the birds sit: fractions across the plate, on the far band. Spread
   unevenly on purpose — four evenly spaced birds read as a decoration. */
const ROOST = [0.14, 0.19, 0.225, 0.41, 0.46, 0.63, 0.78, 0.82, 0.86];

let _roost = [];        // live bird elements in the current scene
let _flown = false;     // once they go, they stay gone for the rest of the run

/* --------------------------------------------------------------------------
   Called at the end of buildScene(), once per scene entry.
-------------------------------------------------------------------------- */
function buildLife(sceneId) {
  _roost = [];

  /* ONE fixed overlay, not one per layer. Five `inset:0` children of a
     2204x1102 plate is twelve megapixels of gradient blended over a background
     image on every single camera pan — that is the flicker.

     And the per-layer weighting was never needed: the sky IS the top of the
     frame and the foreground IS the bottom, so one vertical gradient over the
     viewport reproduces the aerial falloff almost exactly, for one
     viewport-sized element instead of five plate-sized ones. */
  if (!document.getElementById('daywash')) {
    const w = document.createElement('div');
    w.id = 'daywash';
    document.body.appendChild(w);
  }

  /* One fixed host outside #stage, built once. See v2-life.css: in a parallax
     layer each of these was a 4400px-wide promoted texture. */
  let bed = document.getElementById('mistbed');
  if (!bed) {
    bed = document.createElement('div');
    bed.id = 'mistbed';
    document.body.appendChild(bed);
  }
  bed.innerHTML = '';
  for (const m of MIST) {
    const host = bed;
    const el = document.createElement('i');
    el.style.top = (m.top * 100) + 'vh';
    el.style.height = (m.h * 100) + '%';
    el.style.opacity = m.a;
    el.style.animationDuration = m.dur + 's';
    host.appendChild(el);
  }

  /* The roost only exists while the birds are still there. Once they have gone
     up, every later scene is built without them — which is the point: the
     valley is quieter than it was, everywhere, and you are not told. */
  if (_flown) return;
  const far = document.querySelector('#stage .lyr[data-id="far"]');
  if (!far) return;
  const spec = LAYERS_V2.find(l => l.id === 'far');
  for (const x of ROOST) {
    const b = document.createElement('i');
    b.className = 'bird';
    b.style.left = (x * 100) + '%';
    b.style.top = (spec.band * 100 - 0.7) + '%';
    /* A little stagger so they are not one organism. */
    b.style.animationDelay = (-Math.random() * 4).toFixed(2) + 's';
    far.appendChild(b);
    _roost.push(b);
  }
}

/* --------------------------------------------------------------------------
   Called every frame. Cheap: it only touches the DOM when the day changes.
-------------------------------------------------------------------------- */
let _washDay = null;
function paintLife(S) {
  if (!S || S.day === _washDay) return;
  _washDay = S.day;

  const el = document.getElementById('daywash');
  if (!el) return;
  const w = DAY_WASH[S.day] || DAY_WASH[3];
  /* Top of frame takes it all, bottom takes almost none. The stops are the old
     per-layer WASH_BY_LAYER weights, read off the band contract. */
  el.style.background = w.a === 0 ? 'none' :
    `linear-gradient(to bottom,` +
    ` rgba(${w.c},${(w.a).toFixed(3)}) 0%,` +
    ` rgba(${w.c},${(w.a * 0.82).toFixed(3)}) 42%,` +
    ` rgba(${w.c},${(w.a * 0.50).toFixed(3)}) 62%,` +
    ` rgba(${w.c},${(w.a * 0.22).toFixed(3)}) 80%,` +
    ` rgba(${w.c},${(w.a * 0.07).toFixed(3)}) 100%)`;
}

/* --------------------------------------------------------------------------
   Called from stepThreat(). The birds leaving IS the tell.
-------------------------------------------------------------------------- */
function birdsUp() {
  if (_flown || !_roost.length) return;
  _flown = true;

  _roost.forEach((b, i) => {
    /* Not all at once. One goes, then the rest follow in a ragged few hundred
       milliseconds, which is how a real flock leaves and is much more alarming
       than a synchronised launch. */
    setTimeout(() => {
      b.classList.add('up');
      b.style.setProperty('--drift', (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 90) + 'px');
      setTimeout(() => b.remove(), 4200);
    }, i * 55 + Math.random() * 180);
  });
  _roost = [];
}

function resetLife() { _flown = false; _washDay = null; }
