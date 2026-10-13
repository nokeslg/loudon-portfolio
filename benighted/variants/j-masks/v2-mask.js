/* ============================================================================
   THE MASKED VILLAGE — shared engine

   Five people in the valley. All of them masked, because a strigoi comes back
   for its own kin and the only defence anyone has is to stop being
   recognisable. So you cannot tell who anyone is. Neither can it.

   This file is the engine: placing masks in a scene, walking up to one, and
   running a dialogue tree. The RULES differ per build and live in v2-talk.js —
   who holds what, what the tell is, what taking help costs you.

   WHY THE MASKS ARE NOT IN THE PALETTE. Everything in this game sits on a
   six-step green value ladder. The masks are pure black and bone white and are
   deliberately left that way: the one thing in the valley that is not the
   colour of the valley. When the lantern comes up on a face it should look
   wrong against everything around it.
   ========================================================================== */

/* --------------------------------------------------------------------------
   PLACING THEM IN THE WORLD
-------------------------------------------------------------------------- */
function buildMasks(sceneId) {
  /* THE FORE LAYER, NOT THE NEAR ONE.

     A child of a layer inherits that layer's parallax, and near moves at
     42/68 of the camera while the walker moves at 1:1. So a villager parented
     into near DRIFTS as you walk: the game thinks it is one place, the drawing
     is somewhere else, and by the far end of a 3600px plate the gap is a couple
     of hundred pixels. The prompt said 769 and the figure was at 1001.

     fore is factor 1, and its band is 0.92 — the exact line the walker stands
     on. The `bottom:8%` below was always written for that band, so the feet
     were right and only the parallax was wrong. */
  const near = document.querySelector('#stage .lyr[data-id="fore"]');
  if (!near) return;

  /* CLEAR FIRST. This used to be called only from buildScene(), which hands
     over a freshly built and therefore empty layer, so appending was safe.
     It is now also called mid-scene when somebody is taken or the thing stops
     wearing its mask — and without this, the figure that just left is still
     standing there while everybody else is drawn a second time on top of
     themselves. */
  near.querySelectorAll('.villager').forEach(el => el.remove());

  for (const m of MASKS) {
    if (m.scene !== sceneId) continue;
    if (S && S.gone && S.gone[m.id]) continue;      // this one is not here any more

    const el = document.createElement('div');
    el.className = 'villager';
    el.dataset.mask = m.id;
    el.style.left = (m.x / (SRC_H * SCENES[sceneId].aspect) * 100) + '%';
    /* The feet are set per frame in paintMasks() against View.groundY itself.
       A percentage of the layer looked right and was eleven pixels out, because
       a scene can carry its own `zoom` and the band contract is a property of
       the ART, not of the rendered layer box. Measuring beats arithmetic. */
    /* TWO COPIES OF THE SAME FIGURE, stacked. The bottom one is flat ink —
       a person-shaped hole. The top one is the drawing. Fading the top by
       distance is the whole "what is just outside the lantern" idea: the
       silhouette never goes anywhere, the FACE does. */
    el.innerHTML =
      `<img class="dark" src="../../art/characters/npc/${m.img}-dark.png" alt="">` +
      `<img class="lit"  src="../../art/characters/npc/${m.img}.png" alt="">`;
    near.appendChild(el);
  }
}

/* Size them against the scene the way the walker is sized, so a villager and
   the traveller are the same species. */
/* The villagers stand taller than the traveller. Partly because the drawings
   are elongated on purpose and cutting them to the walker's height shrinks the
   plate to the point where you cannot read a face at the edge of the lamp;
   partly because a valley of people who are all slightly too tall is the right
   amount of wrong. Tune this one number. */
/* Was 1.16, which put a villager at 59px against the walker's 51px — close
   enough to the same height that they read as bystanders rather than as
   something standing over you. At 1.70 the figure is 86px to the walker's 51,
   head clear of the fence rail, on the same ground line — so the height reads
   as height rather than as being nearer the camera.

   Tune by eye, not by argument: ?vs=1.52 and ?vs=1.38 are the two steps back
   if this turns out to be too much once there are five of them on screen. */
const VILLAGER_SCALE =
  parseFloat(new URLSearchParams(location.search).get('vs')) || 1.70;

function paintMasks(S) {
  const h = View.sceneH * actorH() * VILLAGER_SCALE;

  /* One measurement for everybody: where the bottom of the fore layer sits
     relative to the line the walker's feet are on. Read once per frame, not
     once per villager. */
  const fore = document.querySelector('#stage .lyr[data-id="fore"]');
  const foot = fore ? fore.getBoundingClientRect().bottom - View.groundY : 0;

  document.querySelectorAll('#stage .villager').forEach(el => {
    /* Height only. Every figure is drawn at its own aspect and trimmed to its
       own bounding box, so forcing a width would squash whoever is widest. */
    el.style.height = h + 'px';
    el.style.bottom = (foot - sink() * View.scale) + 'px';
    /* Out past the lantern a person is a shape, not a face. This is the whole
       "what is just outside the light" idea, and it is one line: fade the mask
       image by distance while the body stays black. */
    const m = MASKS.find(x => x.id === el.dataset.mask);
    if (!m) return;
    const d = Math.abs(m.x - S.x) * View.scale;
    const lit = Math.max(0, Math.min(1, 1 - (d - 90) / 240));
    const img = el.querySelector('img.lit');
    if (img) img.style.opacity = lit.toFixed(2);
  });
}

function nearestMask() {
  if (!S || S.over) return null;
  let best = null, bd = V2.REACH;
  for (const m of MASKS) {
    if (m.scene !== S.at) continue;
    if (S.gone && S.gone[m.id]) continue;
    const d = Math.abs(m.x - S.x);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

/* --------------------------------------------------------------------------
   TALKING

   S.talk = { mask, node } while a conversation is open. The player is frozen
   for the duration — you do not walk and talk, you stop and look at a face.
-------------------------------------------------------------------------- */
function openTalk(m) {
  if (!S || S.talk || S.over) return;

  /* FIRST MEETING GETS THE INTRO. It plays once per person per run and hands
     straight into the conversation; the portrait is already in place when the
     sheet appears, so there is no cut. */
  if (typeof introPending === 'function' && introPending(m)) {
    return playIntro(m, () => {
      if (!S || S.over) return;
      settleAfterIntro();
      S.talk = { mask: m, node: firstNode(m) };
      S.met[m.id] = (S.met[m.id] || 0) + 1;
      paintTalk();
    });
  }

  S.talk = { mask: m, node: firstNode(m) };
  S.met[m.id] = (S.met[m.id] || 0) + 1;
  paintTalk();
}

function closeTalk() {
  if (!S) return;
  S.talk = null;
  const el = document.getElementById('talk');
  if (el) el.hidden = true;
}

/* Choices are 1-5 on the keyboard. Numbered rather than arrow-selected because
   it is one keypress and because the player's hands are already on the walk
   keys — a menu you have to navigate is a menu you resent. */
/* Leaving is ALWAYS escape, never a number. The numbered options are filtered
   by what you know, so "leave" drifts between 3, 4 and 5 depending on who you
   are standing in front of and what you are carrying — which means the player
   has to read and count every single time just to walk away. One fixed key. */
function talkChoose(n) {
  if (!S || !S.talk) return;
  const node = currentNode();
  if (!node) return closeTalk();

  const opts = openChoices(node);
  const c = opts[n - 1];
  if (!c) return;

  /* Topics that ask something of the other person cost daylight. */
  const cost = typeof c.cost === 'function' ? c.cost(S, S.talk.mask) : c.cost;
  if (cost) {
    if (cost > S.daylight) {
      S.talk.node = 'nolight';
      return paintTalk();
    }
    S.daylight -= cost;
  }

  if (c.do) c.do(S, S.talk.mask);

  /* Run out mid-conversation and the conversation is over. */
  if (S.daylight <= 0) { S.daylight = 0; closeTalk(); return nightfall(); }
  /* `to` may be a function, resolved AFTER `do` has run, so a choice can send
     you somewhere based on what it just discovered — which is how asking the
     thing for gossip lands on a different node from asking a person. */
  const to = typeof c.to === 'function' ? c.to(S, S.talk.mask) : c.to;
  if (to === null || to === 'leave') return closeTalk();
  S.talk.node = to;
  paintTalk();
}

function currentNode() {
  const t = S.talk;
  if (!t) return null;
  return (TALK[t.mask.id] || {})[t.node] || null;
}

/* A choice can be gated on what you know. Filtering here rather than in the
   data keeps every tree readable. */
function openChoices(node) {
  return (node.choices || []).filter(c => !c.if || c.if(S, S.talk.mask));
}

function paintTalk() {
  const el = document.getElementById('talk');
  if (!el) return;
  if (!S || !S.talk) { el.hidden = true; return; }

  const m = S.talk.mask;
  const node = currentNode();
  if (!node) { closeTalk(); return; }

  const body = typeof node.text === 'function' ? node.text(S, m) : node.text;
  const opts = openChoices(node);

  /* Everything inside .frame is in 1920x1080 design coordinates — the same
     space the intro animation is authored in. fitFrame() maps it onto the
     window, so the portrait below lands exactly where the animation left it. */
  el.innerHTML = `
    <div class="frame">
      <div class="disc"></div>
      <div class="face full"><img src="../../art/characters/npc/${m.img}-head.png" alt=""></div>
      <div class="face clipped"><img src="../../art/characters/npc/${m.img}-head.png" alt=""></div>
      <div class="who">${m.name}</div>
      <div class="flow">
        <p class="said">${body}</p>
        <ol class="choices">${
          opts.map((c, i) => {
            /* SAY WHICH ONES COST. The three options that ask something of
               the other person spend daylight and the other three do not,
               and until now the sheet looked identical either way — so a
               player working out the valley could not tell a free question
               from a paid one, and every answer felt like it might have
               been taken out of their afternoon. That is the whole reason
               asking why the masks are worn felt like a punishment: it is
               free, and nothing on screen said so.

               A mark, not a number. Daylight is never a number in this game
               and is not about to become one on a dialogue sheet; one ember
               pip means "this one costs you light", and no pip means ask as
               much as you like. */
            const costs = !!(typeof c.cost === 'function' ? c.cost(S, m) : c.cost);
            return `<li data-choice="${i + 1}"${costs ? ' class="costs"' : ''}>` +
                   `<b>${i + 1}</b><span>${
                     typeof c.say === 'function' ? c.say(S, m) : c.say}</span>` +
                   (costs ? '<i class="pip" aria-label="costs daylight"></i>' : '') +
                   `</li>`;
          }).join('')
        }</ol>
        <div class="esc"><b>ESC</b><span>step back</span></div>
      </div>
    </div>`;
  el.hidden = false;
  fitFrame();

  /* Arriving straight out of an intro? Open on the intro's last frame and
     then let the transition above do the rest. Two frames of delay, because
     removing the class in the same frame it was added gives nothing to
     transition from. */
  if (_settleNext) {
    _settleNext = false;
    el.classList.add('settle');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('settle')));
  } else {
    el.classList.remove('settle');
  }
}

/* Set by openTalk() when a character intro has just played. */
let _settleNext = false;
function settleAfterIntro() { _settleNext = true; }

/* CHOICES ARE CLICKABLE. They are numbered and the numbers are the fast way
   in, but a row of numbered options reads as a list of buttons and the first
   thing anyone does is click one. Until now nothing happened — the sheet sat
   inside .frame, which is pointer-events:none. Delegated, so it keeps working
   as the sheet is re-rendered on every node. */
addEventListener('click', e => {
  if (!S || !S.talk) return;
  const li = e.target.closest && e.target.closest('#talk .choices li[data-choice]');
  if (!li) return;
  e.preventDefault();
  talkChoose(+li.dataset.choice);
});

/* --------------------------------------------------------------------------
   Map the 1920x1080 design frame onto the window, cover-style: scale by
   whichever axis needs more and centre the overflow. This is exactly what the
   intro SVG does with preserveAspectRatio="xMidYMid slice", which is why the
   two agree without a single measured number passing between them.
-------------------------------------------------------------------------- */
function fitFrame() {
  /* Each frame carries the size it was drawn at. The conversation is a
     1920x1080 Figma frame; the lose screen is 2880x1800, which is 16:10 — so
     a single hard-coded design size would letterbox one of them. */
  document.querySelectorAll('.frame').forEach(f => {
    const dw = +f.dataset.w || 1920, dh = +f.dataset.h || 1080;
    const k = Math.max(innerWidth / dw, innerHeight / dh);
    const x = (innerWidth  - dw * k) / 2;
    const y = (innerHeight - dh * k) / 2;
    f.style.width  = dw + 'px';
    f.style.height = dh + 'px';
    f.style.transform = `translate(${x}px,${y}px) scale(${k})`;
  });
}
addEventListener('resize', fitFrame);

/* --------------------------------------------------------------------------
   THE PROMPT

   A villager outranks an object: if you are standing next to a person and a
   crate, you meant the person.
-------------------------------------------------------------------------- */
/* `m` comes from hereIs(), which has already weighed the person against
   whatever object is also in reach. Falls back to nearestMask() so the
   function still works if anything calls it the old way. */
function paintMaskPrompt(el, m) {
  m = m || nearestMask();
  if (!m) return false;
  el.classList.add('on');
  el.classList.remove('holding', 'spent');
  /* Content before placement: placePrompt() measures the caption so it can
     keep it inside the frame. */
  const seen = S.met[m.id];
  el.innerHTML = pillMarkup('person', seen ? m.name : 'someone in a mask', false);
  placePrompt(el, m.x);
  /* A villager sits a touch higher than an object — they are taller than a
     crate and the prompt should clear the mask plate, not sit on it. */
  el.style.top = (View.groundY - View.sceneH * actorH() * 1.3) + 'px';
  return true;
}
