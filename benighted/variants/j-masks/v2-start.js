/* ============================================================================
   BENIGHTED — THE TITLE SCREEN

   Loudon's StartingScreen.svg, as a page. The art is his four painted layers
   flattened (art/ui/start/yard.jpg); the type is his sizes and colours set
   live in the real faces; the menu is four buttons that do something.

   WHY IT IS NOT THE SVG. The export has a bug: an opaque #072F30 rect is
   drawn OVER the four art layers, and the whole group carries
   mix-blend-mode:screen. Rendered as exported you get a flat green field with
   the type on it and none of the painting. Composited the way it was painted
   it is a stone tower with a lantern burning over the door and a broken
   wagon in the left foreground — which is, pleasingly, your wagon.

   THE LANTERN. "I think a little lantern cursor would be great and have
   everything else be dark." So the valley is at a quarter brightness and the
   pointer carries a pool of light that reveals the painting underneath, with
   a warm glow over the top of it. There is a second, fixed pool over the
   church door, because that light is IN the picture and is not yours —
   somebody else's lamp is already burning when you arrive, which is the whole
   premise in one detail.

   It is a mask over a second copy of the same jpeg rather than a canvas: one
   decode, one paint, no per-frame work beyond two custom properties.

   ?start=0 skips this screen. ?lantern=0 turns the dark and the pool off and
   shows the painting flat, for comparing the two.
   ========================================================================== */
(function () {

const Q = new URLSearchParams(location.search);
/* ?pro=0 means "skip to the rules", and a title screen in front of that is
   the one thing it was asked not to do — so it skips this too. Likewise an
   explicit ?onboard=, which selects one of the bake-off methods and should
   land on it rather than on a menu. */
const SKIP = Q.get('start') === '0' || !!Q.get('cap') ||
             Q.get('pro') === '0' || !!Q.get('beat') || !!Q.get('onboard');
const LAMP = Q.get('lantern') !== '0';

/* v2-onboard.js reads this: when a title screen is up, the prologue waits for
   the Start button instead of playing on load. */
window.V2_START = !SKIP;
if (SKIP) return;

const MENU = [
  { id:'start',    label:'Start Game' },
  { id:'continue', label:'Continue'   },
  { id:'credits',  label:'Credits'    },
  { id:'audio',    label:'Audio'      },
];

const MARKUP = `
  <div class="yard">
    <div class="plate dark"></div>
    <div class="plate lit door"></div>
    <div class="lamp"><div class="plate lit"></div></div>
  </div>
  <div class="glow"></div>
  <i class="core"></i>
  <div class="front">
    <div class="mark">
      <h1>Benighted</h1>
      <p class="days">3 Days of Light</p>
    </div>
    <nav aria-label="Main menu">
      ${MENU.map((m, i) =>
        `<button data-id="${m.id}"${i ? '' : ' class="sel"'}>${m.label}</button>`).join('')}
    </nav>
  </div>
  <div class="credits" role="dialog" aria-label="Credits">
    <div class="inner">
      <h2>Benighted</h2>
      <p>Written, drawn, composed and built by <b>Loudon Nokes</b>.</p>
      <p>Masonic Lodge and Alverata Irregular. Made in the browser with no
         engine, no framework and no build step.</p>
      <p class="back">Esc, or click anywhere, to go back</p>
    </div>
  </div>`;

let sel = 0, el = null;

function el$() { return document.getElementById('start'); }

/* ---------- the lantern ----------
   THREE TRANSFORMS AND NOTHING ELSE. See the long note in v2-start.css for
   what this replaced and what it measured.

   The lamp box is moved to the pointer; the painting inside it is moved by
   the same amount in the opposite direction, so the picture stays nailed to
   the yard while the hole slides across it. The glow and the core follow in
   viewport coordinates because they are not part of the painting.

   NOW THROTTLED TO A FRAME. The old comment here said a handler that sets two
   custom properties is cheaper than the rAF that would schedule it. That was
   true of the properties and false of what they fed: each one invalidated a
   nine-megapixel mask. A mouse reports faster than the screen refreshes, so
   anything past the first event in a frame was work thrown away even when it
   was cheap. */
let lampX = 0, lampY = 0, lampQueued = false;

function applyLamp() {
  lampQueued = false;
  const s = el$();
  if (!s || s.hidden) return;
  const yard = s.querySelector('.yard');
  const lamp = s.querySelector('.lamp');
  const r = yard.getBoundingClientRect();
  if (!r.width || !r.height) return;

  /* Pointer, in the yard's own coordinates. */
  const x = lampX - r.left, y = lampY - r.top;
  const half = lamp.offsetWidth / 2;
  lamp.style.transform = `translate3d(${(x - half).toFixed(1)}px,${(y - half).toFixed(1)}px,0)`;
  lamp.firstElementChild.style.transform =
    `translate3d(${(half - x).toFixed(1)}px,${(half - y).toFixed(1)}px,0)`;

  const g = s.querySelector('.glow'), gh = g.offsetWidth / 2;
  g.style.transform = `translate3d(${(lampX - gh).toFixed(1)}px,${(lampY - gh).toFixed(1)}px,0)`;
  s.querySelector('.core').style.transform =
    `translate3d(${lampX.toFixed(1)}px,${lampY.toFixed(1)}px,0)`;
}

function moveLamp(clientX, clientY) {
  lampX = clientX; lampY = clientY;
  if (lampQueued) return;              // one update per frame, whatever the mouse does
  lampQueued = true;
  requestAnimationFrame(applyLamp);
}

/* Keyboard players get the lantern too: it goes to whatever is selected, so
   the screen is never navigated in the dark. */
function lampToSel() {
  const b = el$().querySelectorAll('nav button')[sel];
  if (!b) return;
  const r = b.getBoundingClientRect();
  moveLamp(r.left + r.width / 2, r.top + r.height / 2);
}

function select(n) {
  const btns = el$().querySelectorAll('nav button');
  sel = (n + btns.length) % btns.length;
  btns.forEach((b, i) => b.classList.toggle('sel', i === sel));
  if (LAMP) lampToSel();
}

/* ---------- what the four do ---------- */
function choose(id) {
  const s = el$();
  if (id === 'credits') { s.classList.add('showing-credits'); return; }
  if (id === 'audio') {
    /* The one switch there is. The HUD's mute button is the same state, so
       this is not a second setting that can disagree with the first. */
    if (window.V2Audio) { V2Audio.start(); V2Audio.setMuted(!V2Audio.isMuted()); }
    const b = s.querySelector('[data-id="audio"]');
    if (b) b.textContent = (window.V2Audio && V2Audio.isMuted()) ? 'Audio: off' : 'Audio';
    return;
  }
  /* Start plays the prologue; Continue goes straight in, which is what the
     word means to somebody who has already read it once. There is no save
     game to continue, and pretending there is would be worse than this. */
  leave(id === 'start');
}

function leave(withPrologue) {
  const s = el$();
  if (window.V2Audio) V2Audio.start();     // the gesture, at the real start
  s.classList.add('out');
  setTimeout(() => {
    s.hidden = true;
    removeEventListener('keydown', keys, true);
    if (withPrologue && window.V2Prologue) V2Prologue.play();
    else if (window.V2Prologue)            V2Prologue.panel();
  }, 820);
}

function keys(ev) {
  if (ev.metaKey || ev.ctrlKey || ev.key === 'F11') return;
  const s = el$();
  if (s.classList.contains('showing-credits')) {
    ev.preventDefault(); ev.stopPropagation();
    s.classList.remove('showing-credits');
    return;
  }
  const k = ev.key;
  if (k === 'ArrowLeft'  || k === 'ArrowUp')   { ev.preventDefault(); ev.stopPropagation(); return select(sel - 1); }
  if (k === 'ArrowRight' || k === 'ArrowDown') { ev.preventDefault(); ev.stopPropagation(); return select(sel + 1); }
  if (k === 'Enter' || k === ' ') {
    ev.preventDefault(); ev.stopPropagation();
    return choose(MENU[sel].id);
  }
  /* Anything else starts the game, because a title screen that only responds
     to the right key is a title screen people sit in front of. */
  ev.preventDefault(); ev.stopPropagation();
  choose('start');
}

addEventListener('DOMContentLoaded', () => {
  el = document.getElementById('start');
  if (!el) return;
  el.innerHTML = MARKUP;
  el.hidden = false;
  if (!LAMP) el.classList.add('lamp-off');

  el.querySelectorAll('nav button').forEach((b, i) => {
    b.addEventListener('click', ev => { ev.stopPropagation(); sel = i; choose(b.dataset.id); });
    b.addEventListener('mouseenter', () => { sel = i;
      el.querySelectorAll('nav button').forEach((x, j) => x.classList.toggle('sel', j === i)); });
  });
  el.querySelector('.credits').addEventListener('click', ev => {
    ev.stopPropagation(); el.classList.remove('showing-credits');
  });

  if (LAMP) {
    addEventListener('pointermove', ev => moveLamp(ev.clientX, ev.clientY));
    /* WHERE THE LAMP STARTS IS A COMPOSITION DECISION, not a default.

       On the title it put a teal halo of empty sky behind the wordmark, which
       reads as a spotlight on nothing. Down and to the left it lands on the
       broken wagon in the foreground — which is YOUR wagon, in pieces, and
       the reason there is a game — with the church door's own lamp burning
       separately to the right of it. The still frame is then the premise, and
       the first mouse movement is the player picking the lamp up. */
    requestAnimationFrame(() => {
      const r = el.querySelector('.yard').getBoundingClientRect();
      moveLamp(r.left + r.width * 0.19, r.top + r.height * 0.74);
    });
  }
  addEventListener('keydown', keys, true);
});

window.V2Start = { leave, isOpen: () => { const s = el$(); return !!s && !s.hidden; } };

})();
