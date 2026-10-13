/* ============================================================================
   V2 — RENDERER
   ----------------------------------------------------------------------------
   Same five plates as V1. Three things are different, and all three follow
   from the fact that there is now a person standing in the scene.

   1. THE CAMERA PANS. V1's parallax was a small mouse-driven nudge because the
      whole plate was always on screen. Here the camera follows the walker, so
      parallax becomes proportional to depth: fore moves 1:1 with the camera,
      sky barely moves at all. factor = depth / 68.

   2. THE LIGHT IS THE HUD. One overlay div, one radial gradient, radius driven
      by daylight. Nothing else reports the resource.

   3. VERTICAL ANCHORING IS TO THE GROUND, NOT THE FRAME. The bottom of the
      plate is pinned to the bottom of the viewport and the top is allowed to
      crop. If you centre it instead, the ground line drifts as the window
      resizes and the walker's feet come off the floor.
   ========================================================================== */

const SRC_H = 1200;                      // every plate is authored 1200 tall

/* THE BAND CONTRACT — ridge 55 / far 62 / mid 72 / near 82 / fore 92.
   These same five numbers appear in make-stage-guides.py (the Illustrator
   templates) and in the Blender camera solve. If you change one, change all
   three or the art, the guide and the game stop agreeing about where the
   ground is. `band` does two jobs: it positions the fallback colour stripe,
   and it is the ground line anything standing on that plane sits on. */
const LAYERS_V2 = [
  { id:'sky',   depth: 4,  v:'--v1' },
  /* ridge carries the castle — the one thing visible from every scene. NO
     `band`: every other layer falls back to a colour stripe so a missing PNG
     still reads as depth, but a stripe here draws a bar across the sky of
     every scene that has no ridge art yet. Optional layer, no fallback. */
  { id:'ridge', depth: 7,  v:'--v2', band:0.55 },
  { id:'far',   depth:11,  v:'--v3', band:0.62 },
  { id:'mid',   depth:24,  v:'--v4', band:0.72 },
  { id:'near',  depth:42,  v:'--v5', band:0.82 },
  { id:'fore',  depth:68,  v:'--v6', band:0.92 },
];

/* ---------------------------------------------------------------------------
   HOW MANY DEVICE PIXELS WE RASTERISE PER CSS PIXEL.

   The plates are authored 3600x1200 and rendered at sceneH 1305, so they are
   ALREADY being upscaled about 1.09x before anything else happens. Rasterising
   them again at devicePixelRatio 2 means asking the GPU to hold 2.17x the
   source resolution — pure invention, at four times the memory. 1 is the
   honest number here. Raise it if the art is ever redrawn larger.
--------------------------------------------------------------------------- */
let RENDER_SCALE = (() => {
  const q = +new URLSearchParams(location.search).get('rs');
  return q > 0 ? Math.min(q, 3) : 1;
})();

/* Judge it on your own screen: ?rs=1 (default) ?rs=1.5 ?rs=2.
   1   — about 1.09 device px per source px. Near enough 1:1 with the art.
         5 plate canvases + 2 light canvases = ~34MB at 1440x900.
   2   — matches exactly what the old renderer put on a retina display,
         ~145MB, and four times the fill rate every time the camera moves.
   The flicker is fixed at any of these, because the cause was scene-sized
   tiled layers being panned, and these are screen-sized surfaces we draw
   ourselves. The knob is only about sharpness versus memory. */

/* One Image per plate URL, shared across scenes. A plate that arrives late
   flips the dirty flag so the next frame redraws instead of the player staring
   at a colour band. */
const _plateImg = new Map();
function plateImage(url) {
  let rec = _plateImg.get(url);
  if (!rec) {
    rec = { img: new Image(), ok: false };
    rec.img.onload = () => { rec.ok = true; _platesDirty = true; };
    rec.img.onerror = () => { rec.ok = false; };
    rec.img.src = url;
    _plateImg.set(url, rec);
  }
  return rec;
}

/* Redraw gates. Nothing in the valley moves unless the camera does, so a
   player standing still should cost nothing at all. Before this, every frame
   re-rasterised two full-viewport gradients and re-transformed six
   scene-sized textures whether or not anything had changed. */
let _platesDirty = true;
let _lastCam = null;
let _lastLight = '';

/* Live view metrics, recomputed on resize and on scene change. Everything that
   converts between source pixels and screen pixels reads these. */
const View = {
  vw:0, vh:0,          // viewport
  sceneW:0, sceneH:0,  // rendered plate size
  scale:1,             // display px per source px
  panMax:0,            // how far the camera can travel, in display px
  top:0,               // y of the plate's top edge (negative when cropped)
  groundY:0,           // screen y of the walkable ground line
};

let camX = 0;          // current camera, display px
let _camT = 0;         // when the camera last moved, for the time-corrected ease
let camTarget = 0;

/* --------------------------------------------------------------------------
   Build the layer stack for a scene. A missing PNG falls through to the value
   band underneath it, exactly as in V1 — so a scene with no art yet still
   reads as depth and is still walkable. That is what lets you play the whole
   map before four fifths of it has been drawn.
-------------------------------------------------------------------------- */
function buildScene(id) {
  const sc = SCENES[id];
  const stage = document.getElementById('stage');

  /* A scene may declare a layer absent (church has no ridge). Skipping it
     here is the difference between 'no art' and 'a request that 404s on
     every entry to the scene'. */
  /* EACH PLANE IS NOW A CANVAS PLUS AN EMPTY HOST.

     The canvas is viewport-sized and the plate is drawn into it at the camera
     offset, so the texture is one screen instead of one scene. The host div is
     the old .lyr, kept because the threat, the villagers and the birds are
     parented into it and inherit its parallax transform — but it no longer
     carries a background, so it costs no texture at all. An element that
     paints nothing allocates nothing.

     The pair is interleaved canvas-then-host, plane by plane, so the z-order
     is exactly what it was: anything standing on a plane draws over that
     plane's art and under the next plane in front of it. */
  const live = LAYERS_V2.filter(l => sc[l.id] !== false);
  stage.innerHTML = live.map((l, i) =>
    `<canvas class="plate" data-id="${l.id}" data-depth="${l.depth}"
             style="z-index:${i * 10}"></canvas>
     <div class="lyr" data-depth="${l.depth}" data-id="${l.id}"
          style="z-index:${i * 10 + 1}"></div>`
  ).join('') + `<div class="lyr actorlyr" data-depth="${V2.ACTOR_DEPTH}">
       <div id="shadow"></div>
       <div id="actor">${actorSVG()}</div>
     </div>`;

  /* The walker sits between the near plane and the foreground, which is where
     the old hand-written z-index:2 put it. Derive it rather than hard-code it,
     so a scene that drops a layer does not shuffle him behind the scenery. */
  const foreIdx = live.findIndex(l => l.id === 'fore');
  const actorZ = (foreIdx < 0 ? live.length : foreIdx) * 10 - 5;
  stage.querySelector('.actorlyr').style.zIndex = actorZ;

  /* Start the plate loads now. Each one flips the dirty flag when it lands. */
  for (const l of live) plateImage(`${sc.art}${l.id}.png`);
  _platesDirty = true;

  /* The threat is built here rather than living in index.html, because it has
     to be re-parented into whichever layer it currently occupies and
     buildScene wipes the stage. */
  const t = document.createElement('div');
  t.id = 'threat';
  t.innerHTML = threatSVG();
  stage.appendChild(t);

  /* The layers are alive in this build. buildLife injects into each .lyr, so it
     has to run after the stage is rebuilt and before the first paint. */
  if (typeof buildLife === 'function') buildLife(id);
  if (typeof buildMasks === 'function') buildMasks(id);

  measure(id);
  camX = camTarget = 0;

  /* Prefetch the plates of everywhere you could walk next. The first entry to
     a scene pulls ~11MB, which arrives layer by layer while the player stands
     in it — that is the pop-in. Doing it now, for the neighbours, means the
     download has already happened by the time they reach a door. Idle-time and
     fire-and-forget: a failed prefetch costs nothing, and the cache does the
     rest because art is served no-cache, not no-store. */
  prefetchNeighbours(id);
}

const _prefetched = new Set();
function prefetchNeighbours(id) {
  const go = () => {
    for (const ex of (SCENES[id] || {}).exits || []) {
      const dest = SCENES[ex.to];
      if (!dest || _prefetched.has(ex.to)) continue;
      _prefetched.add(ex.to);
      for (const l of LAYERS_V2) {
        if (dest[l.id] === false) continue;
        new Image().src = `${dest.art}${l.id}.png`;
      }
    }
  };
  if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 2000 });
  else setTimeout(go, 600);
}

/* --------------------------------------------------------------------------
   Geometry. Called on boot, on resize, and whenever the scene changes.
-------------------------------------------------------------------------- */
function measure(id) {
  const sc = SCENES[id];
  const stage = document.getElementById('stage');
  View.vw = stage.clientWidth;
  View.vh = stage.clientHeight;

  /* `zoom` buys pan room on a 2:1 plate by rendering the scene taller than the
     viewport and cropping the top. A 3:1 plate needs none of this, which is
     why new scenes should be drawn 3600x1200. */
  View.sceneH = View.vh * (sc.zoom || 1);
  View.sceneW = View.sceneH * sc.aspect;
  View.scale  = View.sceneH / SRC_H;
  View.panMax = Math.max(0, View.sceneW - View.vw);
  View.top    = View.vh - View.sceneH;
  View.groundY = View.top + View.sceneH * sc.ground;

  /* WHERE THE CAPTIONS CAN REACH.

     placePrompt() puts a caption's BOTTOM edge here — the same line for every
     object in the scene, because a caption hangs off the ground line rather
     than off the thing it names. Published as a custom property so the
     narration can sit above it instead of guessing.

     It has to be published from here, not computed in CSS: it depends on
     sc.zoom, sc.ground and the per-scene actorH, so no combination of vh and
     a constant can track it. The narration used to be at bottom:32vh, which
     put it 30px INSIDE the captions at a 770x994 window and somewhere else
     entirely at every other size. */
  document.documentElement.style.setProperty(
    '--capline', (View.groundY - View.sceneH * actorH() * 1.25).toFixed(1) + 'px');

  /* The hosts still span the whole scene, because their children are
     positioned as a fraction of it. They paint nothing, so this is free. */
  document.querySelectorAll('#stage .lyr').forEach(el => {
    el.style.width  = View.sceneW + 'px';
    el.style.height = View.sceneH + 'px';
    el.style.top    = View.top + 'px';
  });

  /* The canvases span the VIEWPORT, which is the whole point. */
  document.querySelectorAll('#stage canvas.plate').forEach(cv => {
    cv.style.width  = View.vw + 'px';
    cv.style.height = View.vh + 'px';
    cv.width  = Math.max(1, Math.round(View.vw * RENDER_SCALE));
    cv.height = Math.max(1, Math.round(View.vh * RENDER_SCALE));
  });
  const fx = document.getElementById('glowfx'), dk = document.getElementById('darkfx');
  for (const cv of [fx, dk]) {
    if (!cv) continue;
    cv.width  = Math.max(1, Math.round(View.vw * RENDER_SCALE));
    cv.height = Math.max(1, Math.round(View.vh * RENDER_SCALE));
  }
  _platesDirty = true; _lastLight = '';
}

/* --------------------------------------------------------------------------
   THE PLATES.

   Called only when the camera has actually moved, or a plate has just
   finished loading, or the scene changed. Standing still costs nothing.
-------------------------------------------------------------------------- */
function drawPlates() {
  const sc = SCENES[S.at];
  const R = RENDER_SCALE;

  document.querySelectorAll('#stage canvas.plate').forEach(cv => {
    const id = cv.dataset.id;
    const spec = LAYERS_V2.find(l => l.id === id);
    const ctx = cv.getContext('2d');
    ctx.setTransform(R, 0, 0, R, 0, 0);
    ctx.clearRect(0, 0, View.vw, View.vh);

    const x = -camX * (spec.depth / 68);
    const rec = plateImage(`${sc.art}${id}.png`);

    /* The fallback band, drawn underneath, so a scene whose art has not been
       made yet still reads as depth and is still walkable — same contract the
       CSS fallback had. */
    if (!rec.ok && spec.band != null && id !== 'ridge') {
      ctx.fillStyle = getComputedStyle(document.documentElement)
                        .getPropertyValue(spec.v).trim() || '#0A2325';
      ctx.fillRect(0, View.top + View.sceneH * spec.band, View.vw,
                   View.vh - (View.top + View.sceneH * spec.band));
    } else if (!rec.ok && id === 'sky') {
      ctx.fillStyle = getComputedStyle(document.documentElement)
                        .getPropertyValue(spec.v).trim() || '#0A2325';
      ctx.fillRect(0, 0, View.vw, View.vh);
    }

    if (rec.ok) ctx.drawImage(rec.img, x, View.top, View.sceneW, View.sceneH);
  });
}

/* Per-scene override. ACTOR_H is a fraction of SCENE height, and a zoomed
   plate has a taller scene — so the church at zoom 1.45 rendered the walker
   1.45x bigger than the well did, which is a visible jump every time you cross
   between them. Scenes on a zoomed plate carry an `actorH` that cancels it out.
   Draw the plate at 3:1, drop the zoom, and you can drop the override too. */
function actorH() { return (SCENES[S.at] || {}).actorH || V2.ACTOR_H; }

/* HOW FAR INTO THE GROUND EVERYBODY STANDS, in source pixels, positive = down.

   The figures are placed on the ground line and the ground line matches the
   art: the well's fore plate starts its dark earth band at source row 1105
   and ground 0.92 puts the line at 1104. They are planted to the pixel, and
   they still read as floating, because the band is a flat silhouette and a
   figure whose feet stop exactly at its top edge looks like it is standing
   BEHIND the band rather than on it. A few pixels of overlap is what sells
   contact in a layered scene.

   This moves the people, not the plate. Moving the plate would take the well,
   the fence, the mill and the crates with it and desync the art from the
   coordinates the game reaches for them at; the figures are the only thing
   that looks wrong, so the figures are the only thing that moves. Applied to
   the walker and the villagers together, so they cannot disagree.

   ?sink=6 to audition. 0 is the shipped behaviour and changes nothing. */
function sink() {
  const q = parseFloat(new URLSearchParams(location.search).get('sink'));
  return isNaN(q) ? 0 : q;
}

/* Source-image x -> screen x, given the current camera. */
function srcToScreen(x) { return x * View.scale - camX; }

/* --------------------------------------------------------------------------
   Per-frame paint.
-------------------------------------------------------------------------- */
function paintScene(S) {
  const sc = SCENES[S.at];

  /* Camera centres the walker, then clamps at the plate edges so you never see
     past the art. Eased rather than locked, so turning around does not snap
     the whole world sideways. */
  camTarget = Math.min(View.panMax,
              Math.max(0, S.x * View.scale - View.vw / 2));
  /* Eased in play; snapped flat when the UI capture harness is driving, because
     camTarget depends on View.scale/panMax, which are recomputed on resize and
     on load — AFTER the harness has set up. Snapping once was not enough: every
     later frame eased toward the new target, so how far the valley had slid
     depended on how many frames had been drawn before the shutter, and two
     captures of one scenario differed across the whole stage. */
  /* SNAP WHEN CLOSE ENOUGH. An exponential ease converges but never actually
     arrives, so camX kept changing by millionths of a pixel forever — which
     meant the "has the camera moved?" gate below was always true and the
     plates redrew on every single frame even when the player was standing
     perfectly still. Sub-pixel movement is not movement. */
  /* TIME-CORRECTED, NOT PER-FRAME.

     This was `camX += (camTarget - camX) * 0.12` — a fixed FRACTION of the
     remaining distance per frame, which makes the camera's speed a function
     of how often frames happen. The walker moves on dt and the camera did
     not, so the gap between them changed with every hitch in the frame
     timing: at 60fps the camera settles about 48 display px behind the
     centre while walking, at 50fps it settles somewhere else, and anything
     uneven in between slides the whole valley back and forth under a walker
     who is moving perfectly smoothly. That is most of what "choppy" is here.
     The frames were never the problem; the frame-RATE DEPENDENCE was.

     Same feel, now a time constant: 0.12 per frame at 60fps is a tau of
     0.13s, and exp() makes it identical at any rate. */
  const _now = performance.now();
  const _dt  = Math.min(0.05, (_now - _camT) / 1000 || 1 / 60);
  _camT = _now;
  if (window.CAP_SNAP || Math.abs(camTarget - camX) < 0.05) camX = camTarget;
  else camX += (camTarget - camX) * (1 - Math.exp(-_dt / 0.13));

  /* The hosts still carry the parallax so their children ride it, but they
     paint nothing — a transform on an empty element is free. The plates
     themselves are drawn into their canvases, and only when something moved.

     NOTE translate3d, not translate: it is the classic promotion trigger, and
     that is deliberate here. On an empty element promotion costs nothing and
     keeps the children composited. It was NOT free when these divs were
     scene-sized and carried the artwork — see the long note in v2.css. */
  document.querySelectorAll('#stage .lyr').forEach(el => {
    const f = (+el.dataset.depth) / 68;
    el.style.transform = `translate3d(${-camX * f}px,0,0)`;
  });

  if (_platesDirty || camX !== _lastCam) {
    drawPlates();
    _lastCam = camX;
    _platesDirty = false;
  }

  paintActor(S);
  paintLight(S);
  paintThreat(S);
}

/* --------------------------------------------------------------------------
   THE LIGHT — this is the whole UI.

   Radius falls off as sqrt(daylight), so the light holds through the afternoon
   and then collapses. That is both how dusk actually behaves and when you want
   the panic. A linear falloff spends the drama evenly and so spends it on
   nothing.

   Two stops: a clear core and a long shoulder out to full dark. One stop gives
   you a hard-edged circle that reads as a spotlight bug.
-------------------------------------------------------------------------- */
function paintLight(S) {
  const t = Math.max(0, Math.min(1, S.daylight / V2.DAYLIGHT_PER_DAY));
  const full = Math.hypot(View.vw, View.vh) * V2.LIGHT_FULL;

  /* The hold pulls the light in. Searching something means putting both hands
     in it and your head down, and the lantern is on the ground by your feet.
     This is the one place the game charges you in VISIBILITY instead of
     daylight. */
  const pull = 1 - V2.HOLD_PULL * (typeof holdP === 'function' ? holdP() : 0);

  /* THE FALLOFF IS LINEAR, NOT sqrt.

     sqrt(t) was chosen so the light "holds through the afternoon and then
     collapses", and it does exactly that — which turned out to be the bug.
     The derivative of sqrt is tiny near t=1 and enormous near t=0, so the
     first forty per cent of a day produced no visible change at all and
     everything happened in the last fifth. By the time the screen told you
     to find a roof you could no longer reach one.

     Linear spends the contraction evenly: the circle is visibly smaller every
     time you look up, which is the information the player needs while they
     can still act on it. The drama moves to checkLastLight(), which speaks at
     the moment the nearest roof is still just reachable. */
  const r = (V2.LIGHT_LANTERN + t * (full - V2.LIGHT_LANTERN)
          + (S.oil > 0 ? 120 : 0)) * pull;

  const x = srcToScreen(S.x);
  const y = View.groundY - View.sceneH * actorH() * 0.55;   // lantern height
  const gr = V2.LIGHT_LANTERN * (S.oil > 0 ? 1.34 : 0.92) * (0.55 + 0.45 * pull);

  /* THE LIGHT IS TWO CANVASES NOW, NOT TWO CSS GRADIENTS.

     What was here before assigned a fresh `radial-gradient(...)` string to the
     background of two position:fixed, inset:0 elements on EVERY SINGLE FRAME.
     A background-image change cannot be composited — it forces a full repaint
     and re-rasterisation of both elements, which at 1440x900 on a retina
     screen is about ten megapixels of gradient work per frame, sixty times a
     second, on the raster threads. That is the stutter, and it was entirely
     separate from the memory problem.

     A canvas of the same size is one surface the GPU already owns, and the
     gate below means it is only touched when the lantern has actually moved.
     Standing still now costs nothing. */
  const key = `${Math.round(x)},${Math.round(y)},${Math.round(r)},${Math.round(gr)}`;
  if (key !== _lastLight) {
    _lastLight = key;
    const R = RENDER_SCALE;

    const gc = document.getElementById('glowfx');
    if (gc) {
      const g = gc.getContext('2d');
      g.setTransform(R, 0, 0, R, 0, 0);
      g.clearRect(0, 0, View.vw, View.vh);
      const warm = g.createRadialGradient(x, y, 0, x, y, gr * 1.05);
      warm.addColorStop(0,    'rgba(230,176,108,.40)');
      warm.addColorStop(0.30, 'rgba(214,152,84,.17)');
      warm.addColorStop(0.56, 'rgba(186,128,72,.055)');
      warm.addColorStop(0.76, 'rgba(186,128,72,0)');
      g.fillStyle = warm;
      /* Drawn as an ellipse the way the CSS version was: a pool on the ground
         reads wider than it is tall. */
      g.save(); g.translate(x, y); g.scale(1, 0.74 / 1.05); g.translate(-x, -y);
      g.fillRect(0, -View.vh, View.vw, View.vh * 3);
      g.restore();
    }

    const dc = document.getElementById('darkfx');
    if (dc) {
      const d = dc.getContext('2d');
      d.setTransform(R, 0, 0, R, 0, 0);
      d.clearRect(0, 0, View.vw, View.vh);
      const dark = d.createRadialGradient(x, y, 0, x, y, r);
      dark.addColorStop(0,    'rgba(4,14,15,0)');
      dark.addColorStop(0.46, 'rgba(4,14,15,0)');
      dark.addColorStop(0.78, 'rgba(4,14,15,.72)');
      dark.addColorStop(1,    'rgba(4,14,15,.97)');
      d.fillStyle = dark;
      /* A canvas radial gradient holds its last stop past r1, so one fillRect
         covers the screen and everything outside the lantern is night. */
      d.fillRect(0, 0, View.vw, View.vh);
    }
  }

  /* Ground shadow. Without a cast shadow a figure's position relative to the
     floor is ambiguous — it is the cheapest depth anchor there is, and now
     that the glow has lifted the ground there is something for it to sit on. */
  const sh = document.getElementById('shadow');
  if (sh) {
    const w = View.sceneH * actorH() * 0.62;
    sh.style.width  = w + 'px';
    sh.style.height = (w * 0.22) + 'px';
    sh.style.left   = (S.x * View.scale) + 'px';
    sh.style.top    = (View.groundY - View.top - w * 0.11) + 'px';
  }
}

/* --------------------------------------------------------------------------
   THE THREAT.

   It is a silhouette parked on whichever layer it currently occupies, scaled
   and faded to match that layer's distance. It never appears on fore — fore is
   the frame, the thing that hides other things from you, not a place.

   No direction is ever given. Silent Hill's radio tells you how close and
   refuses to tell you where, and that asymmetry is the entire trick: the
   moment a signal localises the threat, fear turns into a pathfinding problem.
-------------------------------------------------------------------------- */
/* MEASURED OFF THE ART, NOT GUESSED. A pixel scan of revenant.png (478x706)
   finds the drawn eyes at y 153..166 and x 215..259 — so the pair sits at
   0.2259 of the height, with centres at 0.4665 and 0.5251 of the width and a
   drawn size of 17x14. The previous numbers here were invented: 0.058w wide
   against a true 0.0356w, and a pair spread to 0.409/0.591 against a true
   0.4665/0.5251. Since the art already carries its own red eyes, that error
   was visible as TWO EXTRA GLOWS sitting outside the real ones.

   The pair is very slightly left of the image centre (237 against 239). That
   is in the drawing and is kept.

   SINK exists because the PNG is opaque to its last row — zero padding — so
   standing it on the band puts a hard horizontal cut exactly on the horizon
   with nothing in front of it to hide the join. It drops below the line, and
   the bottom fade in v2-chars.css dissolves the cut before it gets there. */
const THREAT_EYE_Y   = 0.2259;  // pair centre, fraction of figure HEIGHT
const THREAT_EYE_CX  = 0.4958;  // pair centre, fraction of figure WIDTH
const THREAT_EYE_SEP = 0.0586;  // centre-to-centre, fraction of figure WIDTH
const THREAT_EYE_W   = 0.0356;  // 17/478
const THREAT_EYE_AR  = 17 / 14; // the drawn eye's own width/height
const THREAT_EYE_GAP = 28 / 17; // the drawn pair's own separation/width
const THREAT_EYE_MIN = 3;       // px. See below — this is what actually fires.
const THREAT_SINK    = 0.07;    // of figure height, pushed below the band

/* WHY THE FLOOR IS THE REAL RULE AND THE FRACTIONS ARE ONLY THE ANCHOR.
   On screen this figure is 33px wide on the far plane and 63px on the near
   one, so the drawn eye — a true 0.0356 of the width — comes out between 1.2
   and 2.2 PIXELS at every distance it is ever seen at. Matching the art
   exactly therefore produces two sub-pixel dots about two pixels apart, which
   anti-alias together into a single smudge, and one mark reads as an animal
   where two read as a person looking at you.

   So the mark is clamped and the SEPARATION is clamped with it, both at the
   drawing's own proportions (gap 28/17 of the eye's width, aspect 17/14).
   The result is a constant ~3px pair, centred on the pair centre measured off
   the art and carrying its tilt, which overflows the drawn head slightly at
   distance. That is the intended trade and it is the same one Hollow Knight
   makes: the eye void there is about six times anatomical. Clamping only the
   size and letting the gap keep shrinking is the bug this replaced. */

/* ---------------------------------------------------------------------------
   WHERE IT IS ALLOWED TO STAND

   A plate is one flat canvas, so there is no depth INSIDE it: anything in a
   layer div paints above that layer's own plate and below the next one. The
   church is drawn on `mid`. The threat, when it steps to the mid plane, is
   also on `mid` — so it painted over the church wall, and `S.threatX` was a
   uniform random across the whole scene with no idea what was drawn there.
   Standing in a building is the most obvious possible flaw and it was live.

   It cannot be fixed by reordering: the plate is a SIBLING canvas, not a child
   of the layer div, so putting the figure first inside its div changes
   nothing. Either the figure is in front of its whole plate or behind all of
   it, and behind means invisible wherever that plate has ground.

   So it is fixed by not standing there. Each plate is scanned once per scene
   for where it is solid at standing height, and the threat picks a column that
   is clear. The project already measures art by scanning plate alpha — every
   `art:{x,depth}` in v2-data came from exactly this — so this is the same
   method pointed at a different question.
--------------------------------------------------------------------------- */
const _clearCols = new Map();
const CLEAR_N = 256;

function clearColumns(sceneId, lay) {
  const key = sceneId + ':' + lay;
  if (_clearCols.has(key)) return _clearCols.get(key);

  const sc  = SCENES[sceneId];
  const rec = plateImage(`${sc.art}${lay}.png`);
  if (!rec.ok || !rec.img.naturalWidth) return null;   // not loaded yet; retry later
  const spec = LAYERS_V2.find(l => l.id === lay);
  if (!spec) return null;

  const img  = rec.img;
  const band = (sc.horizons && sc.horizons[lay]) || spec.band || 0.8;

  /* The strip just ABOVE the band is where a figure standing on this plane has
     its body, and where a building would be hiding it. Sampling at the band
     itself only ever reads ground. */
  const sy = Math.max(0, Math.round(img.naturalHeight * (band - 0.16)));
  const sh = Math.max(2, Math.round(img.naturalHeight * 0.15));

  const c = document.createElement('canvas');
  c.width = CLEAR_N; c.height = 48;
  const g = c.getContext('2d', { willReadFrequently: true });
  try {
    g.drawImage(img, 0, sy, img.naturalWidth, sh, 0, 0, CLEAR_N, 48);
    const d = g.getImageData(0, 0, CLEAR_N, 48).data;
    const out = new Uint8Array(CLEAR_N);
    for (let x = 0; x < CLEAR_N; x++) {
      let solid = 0;
      for (let y = 0; y < 48; y++) if (d[((y * CLEAR_N) + x) * 4 + 3] > 60) solid++;
      out[x] = solid < 48 * 0.42 ? 1 : 0;
    }
    _clearCols.set(key, out);
    return out;
  } catch (e) { return null; }       /* tainted or zero-sized: fall back */
}

/* Pick a source x on `lay` that is not inside a building. Falls back to the
   old uniform roll when the plate has not loaded or has no clear column —
   a threat that refuses to appear is worse than one standing awkwardly. */
function pickThreatX(sceneId, lay) {
  const w   = SRC_H * SCENES[sceneId].aspect;
  const lo  = 300, hi = w - 300;
  const rnd = () => lo + Math.random() * (hi - lo);
  const map = lay ? clearColumns(sceneId, lay) : null;
  if (!map) return rnd();
  for (let i = 0; i < 40; i++) {
    const x = rnd();
    if (map[Math.min(CLEAR_N - 1, Math.max(0, Math.floor(x / w * CLEAR_N)))]) return x;
  }
  return rnd();
}

function paintThreat(S) {
  const el = document.getElementById('threat');
  const lay = THREAT.SIGHT[S.threat];
  if (!lay) { el.style.opacity = 0; return; }

  const spec = LAYERS_V2.find(l => l.id === lay);

  /* IT LIVES INSIDE ITS LAYER, not on top of the stack. Parented into the
     layer div it currently occupies, it inherits that layer's parallax
     transform for free AND it is occluded correctly — a figure on the far
     ridge goes behind the trees and the church, which is the entire reason to
     have layers in the first place. Painted above the stack it would stand in
     front of a building half a mile closer than it is. */
  const host = document.querySelector(`#stage .lyr[data-id="${lay}"]`);
  if (host && el.parentElement !== host) host.appendChild(el);

  /* IT DOES NOT STAND ON YOUR GROUND LINE. On a receding plane, the further
     away a thing is the HIGHER its feet sit in the frame. Standing the threat
     on the walker's ground line makes it read as a small person next to you
     rather than a full-size one in the distance — which kills the entire
     effect, because the horror is the distance closing.

     Each layer's band fraction is where that plane's ground meets it, so it is
     also where anything standing on that plane has its feet. Override per
     scene with `horizons` once the real art disagrees with the fallbacks. */
  const sc   = SCENES[S.at];
  const f    = spec.depth / 68;
  const band = (sc.horizons && sc.horizons[lay]) || spec.band;

  /* Layer-local coordinates now — the parent layer supplies the parallax. */
  const h  = View.sceneH * actorH() * (0.30 + f * 0.85);
  const w  = h * THREAT_ASPECT;   // drawn revenant is 0.677

  el.style.width  = w + 'px';
  el.style.height = h + 'px';
  el.style.left   = (S.threatX * View.scale) + 'px';
  el.style.top    = (View.sceneH * band - h + h * THREAT_SINK) + 'px';
  el.style.opacity = 1;

  /* THE BODY fades with distance — atmospheric perspective, same as the art.
     THE EYES DO NOT. That exemption is the whole reason this reads: everything
     else in a far layer washes toward the fog, so a mark that holds full
     chroma and full alpha is the only thing on screen that says something is
     actually THERE rather than painted on the backdrop. */
  const body = el.querySelector('.tbody');
  if (body) body.style.opacity = 0.34 + f * 0.6;

  /* Eye geometry. Sized in PIXELS with a hard floor, never scaled with the
     figure — anatomically-correct eyes are sub-pixel until the figure is about
     60px tall, which is why every game that does this exaggerates. Below the
     floor the marks are allowed to overflow the head; it looks wrong in
     isolation and correct on screen. */
  const eyeW = Math.max(THREAT_EYE_MIN, w * THREAT_EYE_W);
  const eyeH = eyeW / THREAT_EYE_AR;
  const cy   = h * THREAT_EYE_Y;                // CENTRE, not the top edge
  /* Separation floors with the mark, at the drawing's own ratio, so the pair
     never closes up into one smudge however far away the figure is. */
  const sep  = Math.max(w * THREAT_EYE_SEP, eyeW * THREAT_EYE_GAP);
  const ecx  = w * THREAT_EYE_CX;

  const st = THREAT_EYE[S.eyeState] || THREAT_EYE.watching;
  const lit = S.blink > 0 ? 0 : 1;

  el.querySelectorAll('.teye').forEach((e, i) => {
    const left = i === 0;
    e.style.width  = eyeW + 'px';
    e.style.height = eyeH + 'px';
    /* Centred on the drawn eye and pulled back by half its own size below, so
       that flooring the mark at 2px grows it AROUND the art's eye instead of
       walking it down and to the right. */
    e.style.left   = (ecx + (left ? -sep / 2 : sep / 2)) + 'px';
    e.style.top    = cy + 'px';
    e.style.opacity = lit * st.a;
    e.style.background = st.c;
    /* Inner corner DOWN 12-18 degrees. Below about 90px this angle is the only
       expression channel there is — level marks read neutral or friendly, and
       the same two marks tilted read as a scowl. */
    e.style.transform = `translate(-50%,-50%) rotate(${left ? 15 : -15}deg)`;
    /* Three-layer glow: tight core, mid halo, wide dim bloom. Bloom floored at
       10px because peripheral acuity is poor and being caught out of the
       corner of the eye IS the scare; capped relative to head width because
       past that the figure reads as a lamp rather than a creature. */
    const bloom = Math.min(Math.max(10, eyeW * 3.5), w * 0.55);
    e.style.boxShadow =
      `0 0 ${eyeW * 1.5}px ${st.c},` +
      `0 0 ${bloom}px rgba(255,104,62,${st.b})`;
  });
}

/* Dormant / watching / lunging. Red as a STATE rather than a default —
   Christopher Lee's eyes only went red when feeding, and an always-on glow is
   a lamp where a state change is a predator. */
const THREAT_EYE = {
  dormant:  { c:'#C21B0E', a:0.42, b:0.05 },
  watching: { c:'#FF4A2E', a:1,    b:0.15 },
  lunging:  { c:'#FFE3D6', a:1,    b:0.30 },
};

window.addEventListener('resize', () => { if (window.S) measure(S.at); });
