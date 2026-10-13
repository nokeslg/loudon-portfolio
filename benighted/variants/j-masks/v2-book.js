/* ============================================================================
   BENIGHTED — THE BOOK AS A PICTURE      ?book=ring | string

   Five faces, the ring between them, and the break drawn as a break.

   WHY. The prose book states every fact correctly and still leaves the player
   to assemble the conclusion, and the conclusion is a shape: a closed loop in
   which each of the five vouches for the next, with exactly one link cut. Five
   true sentences in five different places do not add up to "the loop is broken
   THERE" without the reader drawing it in their head. That is the work this
   moves off the player — and it is not the interesting work. Working out WHO
   is the game; working out that the ring is a ring is bookkeeping.

   NEITHER LAYOUT ADDS INFORMATION. Both show the same facts as the prose page
   with fewer words. Hover (or tab to, or tap) a face for what you were told,
   verbatim, because that is the one thing a player cannot reconstruct and so
   the one thing that cannot be compressed.

   WHERE THE PARTS ARE IS NO LONGER FREE. The old page named every holder on
   day one, before you had met anybody — "Iron Axle, the miller has it" — which
   made the first circuit of the valley a delivery round. A holder is now shown
   only once you have spoken to them, so finding out who is carrying what is
   itself a reason to go and meet all five.
   ========================================================================== */
(function () {

const Q    = new URLSearchParams(location.search);
const MODE = Q.get('book');
if (MODE !== 'ring' && MODE !== 'string') return;

const HEAD = '../../art/characters/npc/';

/* ---- where the faces sit ------------------------------------------------
   RING: evenly round a circle, starting at the top and going clockwise in the
   ORDER OF THE RING ITSELF (thresher → widow → miller → sexton → boy), so the
   arrows run round the rim instead of criss-crossing the middle. That one
   decision is most of why it is readable.

   STRING: the same five, hand-placed off the grid, because a board somebody
   pinned in a hurry is not a pentagon. The threads then cross, which is the
   point — it looks made rather than generated. */
/* 640 wide rather than 560: two of the five names now sit OUTSIDE the ring,
   on the flanks, and they need somewhere to be. */
const VB = { w: 640, h: 480 };
const RING_POS = (n, i) => {
  const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
  return { x: 320 + 175 * Math.cos(a), y: 232 + 162 * Math.sin(a) };
};

/* WHERE EACH NAME SITS, by position in the ring, which is fixed: thresher,
   widow, miller, sexton, boy.

   Set below every disc, two of them collided with the chords — "the widow's
   name gets cutoff and the boy's name is quite close to the line", and both
   are on the flanks where a link leaves the rim at exactly name height. Those
   two go outboard, away from the middle, where no chord can reach them. The
   other three were never in the way and are left alone, because a general
   rule that moves all five is a general rule that can be wrong about three. */
const RING_LABEL = ['down', 'right', 'down', 'down', 'left'];
/* Kept clear of the bottom edge: a node at y=392 puts its disc, its part tag
   and its name at 473 in a 470 box, and the sexton's name was cut in half. */
const STRING_POS = [
  { x: 128, y:  86 }, { x: 407, y:  64 }, { x: 562, y: 229 },
  { x: 341, y: 363 }, { x:  98, y: 288 },
];

function order() {
  /* Walk the ring from the thresher so adjacency on screen is adjacency in the
     graph. MASKS' own array order is scene order, which is not the same thing. */
  const out = [];
  let m = MASKS.find(x => x.id === 'thresher') || MASKS[0];
  for (let i = 0; i < MASKS.length && m; i++) {
    out.push(m);
    m = MASKS.find(x => x.id === m.knows);
    if (out.includes(m)) break;
  }
  /* Anyone not on the cycle still gets a place rather than vanishing. */
  for (const x of MASKS) if (!out.includes(x)) out.push(x);
  return out;
}

/* ---- what the player knows about one person ---------------------------- */
function stateOf(m) {
  if (S.gone && S.gone[m.id])  return 'gone';
  if (S.verified[m.id])        return 'clear';
  if (S.suspect[m.id])         return 'dodged';
  if (S.heard[m.id])           return 'ready';
  return 'unknown';
}
const WORD = {
  clear:   'answered it',
  dodged:  'would not answer',
  ready:   'you have something to put to them',
  unknown: 'nothing on them yet',
  gone:    'not where they should be',
};

/* A link is drawn from A to the one A can vouch for. It is KNOWN once you hold
   that memory, CUT once the route to it is shut — because A dodged, or A is
   gone — and plain otherwise. */
function linkState(a) {
  const b = a.knows;
  if (!b) return 'plain';
  if (S.heard[b] || S.verified[b]) return 'known';
  if ((S.gone && S.gone[a.id]) || S.suspect[a.id]) return 'cut';
  return 'plain';
}

/* ---- geometry ----------------------------------------------------------- */
const R = 58;                        // disc radius plus a little air

function edge(p, q) {
  /* Stop the line at the rim of each disc rather than under it, so an arrow
     points AT a face instead of into it. */
  const dx = q.x - p.x, dy = q.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  return { x1: p.x + ux * R, y1: p.y + uy * R,
           x2: q.x - ux * R, y2: q.y - uy * R, ux, uy, d: d - R * 2 };
}

/* A thread sags. A drawn arrow does not. */
function path(e, sag) {
  if (!sag) return `M${e.x1} ${e.y1} L${e.x2} ${e.y2}`;
  const mx = (e.x1 + e.x2) / 2, my = (e.y1 + e.y2) / 2;
  return `M${e.x1} ${e.y1} Q${mx} ${my + sag} ${e.x2} ${e.y2}`;
}

function arrowAt(e) {
  const a = Math.atan2(e.uy, e.ux) * 180 / Math.PI;
  /* THE TIP IS AT THE ANCHOR AND THE TAIL RUNS BACK. Written forwards
     ("0,-5 11,0 0,5") the head extends 11px PAST the point where the line was
     trimmed to the rim of the disc — which put every arrowhead underneath the
     face it was pointing at, and the first render had no arrowheads anywhere. */
  return `<polygon class="arrow ARROWCLS" points="-11,-5 0,0 -11,5"
           transform="translate(${e.x2.toFixed(1)} ${e.y2.toFixed(1)}) rotate(${a.toFixed(1)})"/>`;
}

function graph(people, parts) {
  const pos = people.map((_, i) =>
    MODE === 'ring' ? RING_POS(people.length, i) : STRING_POS[i % STRING_POS.length]);

  let svg = '';
  people.forEach((m, i) => {
    const j = people.findIndex(x => x.id === m.knows);
    if (j < 0) return;
    const e = edge(pos[i], pos[j]);
    const st = linkState(m);
    const sag = MODE === 'string' ? 26 : 0;

    if (st === 'cut' && MODE === 'string') {
      /* A cut thread does not dash. It hangs in two pieces. */
      const mx = (e.x1 + e.x2) / 2, my = (e.y1 + e.y2) / 2 + sag * 0.5;
      svg += `<path class="link cut" d="M${e.x1} ${e.y1} Q${(e.x1+mx)/2} ${(e.y1+my)/2+10} ${mx - e.ux*16} ${my - e.uy*16 + 12}"/>`
          +  `<path class="link cut" d="M${e.x2} ${e.y2} Q${(e.x2+mx)/2} ${(e.y2+my)/2+10} ${mx + e.ux*16} ${my + e.uy*16 + 12}"/>`;
    } else {
      svg += `<path class="link ${st}" d="${path(e, sag)}"/>`;
      if (MODE === 'ring') svg += arrowAt(e).replace('ARROWCLS', st === 'known' ? 'known' : '');
    }
  });

  const nodes = people.map((m, i) => {
    const st = stateOf(m);
    const met = !!S.met[m.id];
    const held = m.part && !S.parts.includes(m.part);
    /* THE GATE. A holder is named only once you have spoken to them.

       THE QUESTION MARK IS GONE, and that was a real leak. It sat in the same
       slot as a part tag, so an unmet face wearing one read as "this one is
       holding something you have not identified" — on the boy, who holds
       nothing at all, it pointed straight at the last part. An empty slot says
       nothing, which is the correct amount. Not having met somebody is said by
       the face being unlit instead. */
    const tag = met && held
      ? `<i class="has">${V2_PARTS.find(p => p.id === m.part).name}</i>` : '';
    const lab = MODE === 'ring' ? (RING_LABEL[i] || 'down') : 'down';
    return `<button class="node ${st}${met ? '' : ' unmet'} lab-${lab}"
              data-id="${m.id}" type="button"
              style="left:${pos[i].x}px;top:${pos[i].y}px"
              aria-label="${m.name}, ${met ? WORD[st] : 'not yet spoken to'}">
        <span class="disc"><img src="${HEAD}${m.img}-head.png" alt=""></span>
        ${tag}<span class="nm">${m.name.replace(/^the /, '')}</span>
      </button>`;
  }).join('');

  return `<div class="graphwrap"><div class="graph"
       style="--vbw:${VB.w}px;--vbh:${VB.h}px">
      <svg viewBox="0 0 ${VB.w} ${VB.h}" aria-hidden="true">${svg}</svg>
      <div class="parts">${parts || ''}</div>
      ${nodes}
    </div></div>`;
}

/* ---- the panel ---------------------------------------------------------- */
function readout(m) {
  if (!m) return `<p class="empty">Hover over a face</p>`;
  const st  = stateOf(m);
  const met = !!S.met[m.id];
  const bits = [];

  if (!met) {
    bits.push(`<p class="hint">You have not spoken to them. Whatever they are
      carrying, you will only find out by asking.</p>`);
  } else if (m.part && !S.parts.includes(m.part)) {
    bits.push(`<p>Holding the <b>${V2_PARTS.find(p => p.id === m.part).name}</b>.</p>`);
  } else if (m.part) {
    bits.push(`<p>Gave you the ${V2_PARTS.find(p => p.id === m.part).name}.</p>`);
  } else {
    bits.push(`<p class="hint">Carrying nothing of yours.</p>`);
  }

  /* The memory, in the words it was told to you in. The one thing on this page
     that cannot be compressed — you have to put the question back exactly. */
  if (S.heard[m.id] && MEMORY[m.id]) {
    bits.push(`<p class="quote">${MEMORY[m.id].told}</p>`);
    if (!S.verified[m.id]) bits.push(`<p class="hint">Put that to them.</p>`);
  }

  if (S.pointed[m.id] && !S.verified[m.id]) {
    const to = MASKS.find(x => x.id === S.pointed[m.id]);
    if (to) bits.push(`<p class="hint">Sent you to ${to.name}.</p>`);
  }

  /* Both ends of a broken link, named. */
  const voucher = MASKS.find(x => x.knows === m.id);
  if (voucher && !S.heard[m.id] && !S.verified[m.id]) {
    if (S.gone && S.gone[voucher.id])
      bits.push(`<p class="warn">Nobody left to vouch for them &mdash; whatever
        ${voucher.name} knew went up the valley too. It is on the ground
        somewhere.</p>`);
    else if (S.suspect[voucher.id])
      bits.push(`<p class="warn">${voucher.name} would not talk about them, and
        nobody else can. If there is anything to know it is on the ground
        somewhere.</p>`);
  }

  const far = MASKS.find(x => x.id === m.knows);
  if (far && S.suspect[m.id] && !S.heard[far.id] && !S.verified[far.id])
    bits.push(`<p class="warn">Would not say a word about ${far.name}.</p>`);

  return `<h3>${m.name}</h3><p class="st">${WORD[st]}</p>${bits.join('')}`;
}

/* ---- the whole page ----------------------------------------------------- */
let hovering = null;

function render() {
  const el = document.getElementById('book');
  const people = order();

  /* THE THREE SLOTS, IN THE HOLE IN THE MIDDLE OF THE RING.

     His, measured off Notebook Example.svg: 61.08 x 62.05, radius 4.61, 2.3
     border, 16.1 apart, centred on the ring. "I put the parts indicator UI in
     the middle now and made it all bigger" meant the middle of the RING, not
     the middle of the page — and it is the right place for it. The centre of a
     ring of five is dead space, and the three parts are the one thing all five
     of those people have in common.

     Same glyphs as the ending screen, so the shape you watch fill up all run
     is the shape on the last frame. PART_MARK paints itself #072F30 for an
     ember slot; recoloured to currentColor here so an EMPTY slot can show its
     mark muted — three anonymous boxes say how many are left, three marked
     ones say WHICH, and which is the thing you are about to walk somewhere
     for. */
  const parts = V2_PARTS.map(p => {
    const has = S.parts.includes(p.id);
    return `<div class="slot${has ? ' has' : ''}" title="${p.name}">${
      (PART_MARK[p.id] || '').replace(/#072F30/g, 'currentColor')}</div>`;
  }).join('');

  el.className = MODE;
  el.innerHTML = `<div class="sheet" role="document">
      <h2>What you know</h2>
      <p class="lede">Each one can vouch for the next. ${
        MODE === 'ring' ? 'An ember arrow is a memory you hold. A red gap is a link that is shut.'
                        : 'An ember thread is a memory you hold. A cut thread is a link that is shut.'}</p>
      <div class="body">
        ${graph(people, parts)}
        <div class="read">${readout(hovering && MASKS.find(m => m.id === hovering))}</div>
      </div>
      <div class="foot"><span><b>TAB</b> put it away</span></div>
    </div>`;

  fitGraph();
  el.querySelectorAll('.node').forEach(n => {
    const pick = () => { hovering = n.dataset.id; paintRead(); mark(); };
    n.addEventListener('mouseenter', pick);
    n.addEventListener('focus', pick);
    n.addEventListener('click', pick);
  });
  mark();
}

/* ---- make the ring fit, whatever the window is -------------------------
   Two passes, because the question is circular: how tall may the graph be
   depends on how tall everything else is, and everything else is laid out
   around the graph. So the wrapper is collapsed to nothing, the rest of the
   sheet is measured at its natural height, and what is left over is the
   budget. One reflow, on open and on resize, for a page that changes about ten
   times a run.

   This is the fix for "half the ring was off the screen and I couldn't scroll
   to it" — the graph was a fixed 560x470 and the overflow was hidden, so a
   window that could not spare the room simply ate the bottom of the ring. */
function fitGraph() {
  const el = document.getElementById('book');
  if (!el || el.hidden) return;
  const wrap = el.querySelector('.graphwrap');
  const sheet = el.querySelector('.sheet');
  if (!wrap || !sheet) return;

  wrap.style.height = '0px';
  const cs = getComputedStyle(el);
  const roomH = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const chrome = sheet.offsetHeight;             // the sheet with no graph in it
  const availH = Math.max(150, roomH - chrome);
  const availW = Math.max(150, wrap.clientWidth);

  /* Never above 1: upscaling a 112px face on a big monitor only makes the
     jpeg artefacts bigger. */
  const g = Math.min(1, availW / VB.w, availH / VB.h);
  const graph = el.querySelector('.graph');
  graph.style.setProperty('--g', g.toFixed(4));
  /* Centred by hand. transform-origin is top-left so the arithmetic above
     stays simple, which leaves the scaled ring pinned to the left edge of a
     column it no longer fills — so shift it by half the slack. */
  graph.style.left = Math.max(0, (availW - VB.w * g) / 2).toFixed(1) + 'px';
  wrap.style.height = (VB.h * g).toFixed(1) + 'px';
}

/* Only the panel is rewritten on hover. Re-rendering the graph would rebuild
   five <img> elements eight times a second and flash the faces. */
function paintRead() {
  const el = document.getElementById('book');
  const r = el && el.querySelector('.read');
  if (r) r.innerHTML = readout(MASKS.find(m => m.id === hovering));
}
function mark() {
  const el = document.getElementById('book');
  if (el) el.querySelectorAll('.node').forEach(n =>
    n.classList.toggle('on', n.dataset.id === hovering));
}

/* ---- TAB opens this one instead -----------------------------------------
   toggleNotes() is a global function declaration in v2-game.js and the keydown
   handler looks it up at call time, so replacing the global is enough — no
   edit to the input code, and ?book= with no value gives the prose page back. */
const prose = window.toggleNotes;
window.toggleNotes = function () {
  const el = document.getElementById('book');
  if (!el || !window.S) return;
  if (S.over) { el.hidden = true; removeEventListener('resize', fitGraph); return; }
  if (!el.hidden) { el.hidden = true; removeEventListener('resize', fitGraph); return; }
  document.getElementById('notes').hidden = true;
  hovering = null;
  el.hidden = false;        // measurable before fitGraph() runs inside render()
  render();
  addEventListener('resize', fitGraph);
};
window.V2Book = { render, fitGraph, prose };

})();
