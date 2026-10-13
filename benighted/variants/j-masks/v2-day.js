/* ============================================================================
   BENIGHTED — THE DAY CARD

   Loudon's NewDay.svg, rebuilt. Shown for three seconds at the top of every
   day: the day's number, one sentence of what is left to do, and the three
   part slots.

   EVERYTHING IS IN HIS COORDINATES. The comp is 2880x1800 and every number
   below is lifted straight out of the file — the numeral's baseline at
   1184.29, the body copy at x 139 rather than the numeral's 155 (he optically
   aligned the D), the slots at 157.053 / 294.598 / 432.143. The card is one
   2880x1800 box scaled to fit the window, so his layout survives any aspect
   ratio instead of being re-guessed in percentages.

   THE ICONS ARE HIS, NOT REDRAWN. The nine paths are lifted out of the SVG
   verbatim and each one keeps its original viewBox, so the art cannot drift
   from the file it came from. Only the colours are swapped for currentColor,
   because they are state: #45331C on an empty slot, #072F30 on a filled one.

   THE BACKDROP IS THE LIVE GAME. His export has a screenshot baked into it
   with a #111 wash underneath that the screenshot completely covers, so the
   only dim that actually does anything in the comp is the #061C1E at 50% on
   top. That is what is here. The valley keeps moving behind the card.

   IT NEVER TAKES A KEYPRESS. pointer-events are off and the listener does not
   preventDefault — press anything and the card goes, but the thing you
   pressed still happens. A card that eats the first input of the day would be
   worse than no card.
   ========================================================================== */
(function () {

const W = 2880, H = 1800;

const Q = new URLSearchParams(location.search);
const num = (k, d) => (isNaN(parseFloat(Q.get(k))) ? d : parseFloat(Q.get(k)));

/* Quick, as asked. In, hold, out — and the hold is the only one anybody will
   consciously notice, so it is the only one worth arguing about. */
const IN   = num('dayin',   380);
const HOLD = num('dayhold', 1900);
const OUT  = num('dayout',  900);
const OFF  = Q.get('daycard') === '0';

/* His three slots, left to right, and what each one is waiting for. The order
   is HIS — harness, wheel, axle — which is not the order the notebook uses.
   Filled by part id rather than by index, so the two can disagree about
   presentation without either of them lying about state. */
const SLOTS = [
  { part: 'harness', x: 157.053, ico: '<svg class="ico" viewBox="157.053 1416.05 108.804 110.533" fill="none"><path d="M202.76 1449.51H237.539C240.991 1449.51 243.788 1452.31 243.788 1455.76V1481.84C243.788 1485.3 240.991 1488.09 237.539 1488.09H202.76C199.309 1488.09 196.511 1485.3 196.511 1481.84V1455.76C196.511 1452.31 199.309 1449.51 202.76 1449.51Z" stroke="currentColor" stroke-width="9.23809" stroke-linecap="round" stroke-linejoin="round"/><path d="M219.667 1450.25L219.667 1486.18" stroke="currentColor" stroke-width="9.23809" stroke-linecap="round" stroke-linejoin="round"/><path d="M191.892 1468.8H174.503" stroke="currentColor" stroke-width="9.23809" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { part: 'wheel',   x: 294.598, ico: '<svg class="ico" viewBox="294.598 1416.05 108.804 110.533" fill="none"><path d="M349 1504.17C367.14 1504.17 381.846 1489.46 381.846 1471.32C381.846 1453.18 367.14 1438.47 349 1438.47C330.859 1438.47 316.153 1453.18 316.153 1471.32C316.153 1489.46 330.859 1504.17 349 1504.17Z" stroke="currentColor" stroke-width="9.23809" stroke-linecap="round"/><path d="M349 1438.47V1504.17" stroke="currentColor" stroke-width="9.23809" stroke-linecap="round"/><path d="M316.153 1471.32H381.846" stroke="currentColor" stroke-width="9.23809" stroke-linecap="round"/></svg>' },
  { part: 'axle',    x: 432.143, ico: '<svg class="ico" viewBox="432.143 1416.05 108.804 110.533" fill="none"><path d="M515.353 1467.79V1474.84H457.737V1467.79H515.353Z" fill="currentColor" stroke="currentColor" stroke-width="4.61905"/><path d="M453.482 1452.24H459.317C460.19 1452.24 460.897 1452.94 460.897 1453.82V1488.82C460.897 1489.7 460.19 1490.4 459.317 1490.4H453.482C452.61 1490.4 451.902 1489.7 451.902 1488.82V1453.82C451.902 1452.94 452.61 1452.24 453.482 1452.24Z" fill="currentColor" stroke="currentColor" stroke-width="4.61905"/><path d="M513.773 1452.24H519.608C520.48 1452.24 521.188 1452.94 521.188 1453.82V1488.82C521.188 1489.7 520.48 1490.4 519.608 1490.4H513.773C512.9 1490.4 512.193 1489.7 512.193 1488.82V1453.82C512.193 1452.94 512.9 1452.24 513.773 1452.24Z" fill="currentColor" stroke="currentColor" stroke-width="4.61905"/></svg>' },
];

/* --- WHAT THE DAY SAYS ----------------------------------------------------
   His day two line is the template and the shape of all of them: what you
   have left in days, what you have left to find, and the reminder that
   finding it is not the whole job. The count is computed, never written
   down, because a card that says "the 2 remaining parts" while you are
   holding all three is worse than a card that says nothing.
-------------------------------------------------------------------------- */
function body(day, got) {
  const left = 3 - got;
  const days = V2.DAYS - day;                    // nights still to come

  if (!left) {
    return days
      ? 'You have everything the wagon needs. Get back to it in the churchyard and fit the parts before dark.'
      : 'You have everything the wagon needs. Get back to it in the churchyard and fit the parts before the light goes.';
  }

  const what = left === 3 ? 'the 3 parts'
             : left === 2 ? 'the 2 remaining parts'
             : 'the last part';

  if (days >= 2)
    return 'You have today and two more days. Find ' + what +
           ', figure out what\u2019s going on, and get out of there.';
  if (days === 1)
    return 'You have today and tomorrow. Find ' + what +
           ', figure out what\u2019s going on, and get out of there.';

  /* The last morning. No arithmetic left to offer, so it does not offer any. */
  return 'There is no tomorrow. Find ' + what +
         ' and be out of the valley before the light goes.';
}

/* --- the card ------------------------------------------------------------ */
let timer = null, seenS = null, shown = {};

function el() { return document.getElementById('day'); }

function fit() {
  const e = el(); if (!e) return;
  const card = e.querySelector('.card'); if (!card) return;
  card.style.transform = 'scale(' + Math.min(innerWidth / W, innerHeight / H) + ')';
}

/* --- BASELINES ------------------------------------------------------------
   An SVG text node is positioned by its BASELINE; a CSS block is positioned
   by the top of its line box. His file gives baselines — 1184.29 for the
   numeral, 1281.81 for the first line of body — so the top of each block has
   to be worked backwards through the font's own metrics, and the right ones
   are the font's, not a guess at 0.75em.

   Where the baseline sits inside a line box:  half-leading + ascent, where
   half-leading is (line-height - (ascent + descent)) / 2. Canvas hands over
   exactly those two numbers for a font at a size, which is the only way to
   ask a browser what a webfont's metrics actually are.

   Re-run on document.fonts.ready, because until Masonic Lodge has arrived
   these are Georgia's metrics and Georgia sits differently. Getting this
   wrong is a numeral that creeps up or down the card depending on how warm
   the font cache is. */
const BASE = { n: 1184.29, b: 1281.81 };

function topFor(font, sizePx, lineHeightPx, baselineY) {
  const c = topFor._c || (topFor._c = document.createElement('canvas').getContext('2d'));
  c.font = font;
  const m = c.measureText('Day');
  const a = m.fontBoundingBoxAscent, d = m.fontBoundingBoxDescent;
  if (!(a > 0)) return null;                       // no metrics: leave the CSS alone
  return baselineY - ((lineHeightPx - (a + d)) / 2 + a);
}

function place() {
  const e = el(); if (!e) return;
  const n = e.querySelector('.n'), b = e.querySelector('.b');
  if (!n || !b) return;
  const tn = topFor('233px "masonic-lodge", Georgia, serif', 233, 233, BASE.n);
  const tb = topFor('300 48px "alverata-irregular", Georgia, serif', 48, 56, BASE.b);
  if (tn !== null) n.style.top = tn.toFixed(2) + 'px';
  if (tb !== null) b.style.top = tb.toFixed(2) + 'px';
}

function build(day, got) {
  const slots = SLOTS.map(s => {
    const have = window.S && S.parts.indexOf(s.part) >= 0;
    return '<div class="slot' + (have ? ' on' : '') + '" style="left:' + s.x + 'px"></div>' +
           '<div class="ico-box' + (have ? ' on' : '') + '" style="left:' + s.x + 'px">' + s.ico + '</div>';
  }).join('');

  return '<div class="card">' +
           '<p class="n">Day ' + day + '</p>' +
           '<p class="b">' + body(day, got) + '</p>' +
           slots +
         '</div>';
}

function hide(fast) {
  const e = el(); if (!e || e.hidden) return;
  clearTimeout(timer);
  e.style.transition = 'opacity ' + (fast ? 260 : OUT) + 'ms ease';
  e.style.opacity = '0';
  timer = setTimeout(() => { e.hidden = true; }, (fast ? 260 : OUT) + 40);
  removeEventListener('keydown', onKey);
  removeEventListener('pointerdown', onKey);
  removeEventListener('resize', fit);
}

function onKey() { hide(true); }

/* Once per day per run. The tutorial calls this on its way out and so does
   nextDay(), and the tutorial can be reopened from the ? at any hour of any
   day — so the guard is here rather than at either call site, where it would
   have to be written twice and would be wrong in one of them. */
function show(force) {
  if (OFF || !window.S || S.over) return;
  if (seenS !== S) { seenS = S; shown = {}; }      // object identity: a new run
  if (shown[S.day] && !force) return;
  shown[S.day] = true;

  const e = el(); if (!e) return;
  e.innerHTML = build(S.day, S.parts.length);
  e.hidden = false;
  fit();
  place();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  e.style.transition = 'none';
  e.style.opacity = '0';
  /* Two frames: one to land the display change, one so the transition has an
     old value to leave from. One frame is enough in Chrome and is not enough
     in Safari, and this is going on a projector somebody else owns. */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    e.style.transition = 'opacity ' + IN + 'ms ease';
    e.style.opacity = '1';
  }));

  clearTimeout(timer);
  timer = setTimeout(() => hide(false), IN + HOLD);
  addEventListener('keydown', onKey);
  addEventListener('pointerdown', onKey);
  addEventListener('resize', fit);
}

window.V2Day = { show, hide: () => hide(true), _place: place };

})();
