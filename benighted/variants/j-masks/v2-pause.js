/* ============================================================================
   PAUSE — Esc, and the four controls that used to live along the bottom.

   WHY THIS IS NOT A REAL PAUSE. Nothing in Benighted runs on a clock: daylight
   is spent by the pixel and by the question, the threat moves when you take a
   part or when a night passes, and standing still is free and always has been.
   So there is no simulation to suspend. What this does is take the keyboard
   away from the world, which is the only thing a pause has to do here.

   WHAT IT WILL NOT OPEN OVER. A conversation (Esc already steps back out of
   one, and that is the right meaning of the key there), the tutorial, the
   title, an ending, or the notebook. Two overlays answering the same key is
   how you end up closing the wrong one.

   DISCOVERABILITY, honestly: there is now nothing on screen that says the
   menu exists. Esc is close to universal for this, and the alternative was a
   permanent button in the corner of a game about what you can see. If it
   needs to be taught, the place is the tutorial's last frame, which is
   Loudon's artwork at his own coordinates — a decision for him, not a fifth
   key glyph invented here.
   ========================================================================== */
(function () {

let open = false;

const el = () => document.getElementById('pause');

/* The other dialogs, by the thing that owns each one. */
function busy() {
  if (window.S && (S.talk || S.over)) return true;
  const ids = ['start', 'tut', 'pro', 'panel', 'brief', 'ob', 'ledger', 'notes', 'book', 'end'];
  return ids.some(id => {
    const e = document.getElementById(id);
    return e && !e.hidden && getComputedStyle(e).display !== 'none';
  });
}

function show() {
  const e = el();
  if (!e || open || busy()) return;
  open = true;
  e.hidden = false;

  /* Let go of whatever is held. The world's keydown/keyup pair keeps its own
     map of what is down, and a player who hits Esc mid-stride would otherwise
     walk on behind the menu and be somewhere else when it closes. */
  for (const k of ['ArrowLeft', 'ArrowRight', 'a', 'd', ' ', 'e'])
    dispatchEvent(new KeyboardEvent('keyup', { key: k }));

  addEventListener('keydown', keys, true);
  const first = e.querySelector('#resume');
  if (first) first.focus();
}

function hide() {
  const e = el();
  if (!e || !open) return;
  open = false;
  e.hidden = true;
  removeEventListener('keydown', keys, true);
}

/* Capturing, so the world never sees these. Only Esc gets through, and only
   to close. Tab is left alone so the menu can be walked with the keyboard —
   it is the one dialog in the game that is a list of choices rather than a
   page of text. */
function keys(ev) {
  if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); return hide(); }
  if (ev.key === 'Tab' || ev.key === 'Enter' || ev.key === ' ') return;
  ev.preventDefault(); ev.stopPropagation();
}

addEventListener('DOMContentLoaded', () => {
  const e = el();
  if (!e) return;

  /* NOTHING HERE LISTENS FOR THE KEY THAT OPENS THIS.

     It did, twice, and both were wrong. The world's own handler closes a
     conversation on Esc and clears S.talk while doing it, so a listener here
     — bubbling OR capturing — asked "is a conversation open?" and got an
     answer that the handler in front of it had just changed, then opened the
     menu on top of the conversation the player had closed. Capturing fixes
     the ordering only while the event targets something inside the document;
     an event dispatched AT window fires both phases at the target in
     registration order, and v2-game.js is registered first.

     So Esc has one owner now, in v2-game.js's input handler, after the branch
     that gives it to a conversation. The order is a line of code you can read
     instead of a property of the event plumbing. */

  e.querySelector('#resume').addEventListener('click', hide);

  /* Click the backdrop, not the panel. */
  e.addEventListener('click', ev => { if (ev.target === e) hide(); });

  /* These two open something else or start something else, so the menu gets
     out of the way first. Their own handlers are bound elsewhere and still
     run; this only adds the closing. */
  e.querySelector('#help').addEventListener('click', hide);
  e.querySelector('#restart').addEventListener('click', () => {
    hide();
    if (window.V2Day) V2Day.show();     // same as R from an ending
  });
});

window.V2Pause = { show, hide, isOpen: () => open };

})();
