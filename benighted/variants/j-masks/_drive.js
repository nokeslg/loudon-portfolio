/* ============================================================================
   PLAYTEST DRIVER — temporary, not part of the game.

   Drives the real build through real KeyboardEvents, so every system under
   test is the one that ships: the keydown handler, the rAF loop, the hold
   timer, the daylight spend, nightfall, the talk trees. Nothing is stubbed and
   no game function is called directly except to read state.

   Run headless with a large --virtual-time-budget: rAF then fires as fast as
   the CPU allows while the page still sees normal 16ms timestamps, so a
   three-minute run finishes in seconds and dt is unchanged.

   Results land in #out as JSON for --dump-dom to collect.
   ========================================================================== */
(function () {

const log = [];
/* Progress also goes into the title and into a live #out, so a run that hangs
   or throws still reports where it got to instead of dumping an empty page. */
let frames = 0;
(function count() { frames++; requestAnimationFrame(count); })();

/* HOW THE RESULT GETS OUT.

   Not --dump-dom. That fires at load, so it needs --virtual-time-budget to
   wait, and virtual time does not drive requestAnimationFrame: measured, a
   120-second budget advanced the game by TWELVE frames, with or without
   --run-all-compositor-stages-before-draw. The game only steps inside rAF, so
   under virtual time it does not step at all.

   So the browser runs in real time with no exit flag, and the page reports
   back by requesting URLs the dev server will 404 and log. serve.py writes
   every request line, which makes the access log the transcript. Chunked
   because a log line is not a place for 4KB. */
function send(tag, text) {
  const CH = 1200;
  const parts = Math.ceil(text.length / CH) || 1;
  for (let i = 0; i < parts; i++) {
    fetch(`/__drive/${tag}/${i + 1}of${parts}/` +
          encodeURIComponent(text.slice(i * CH, (i + 1) * CH)))
      .catch(() => {});
  }
}
function flush(stage) {
  document.title = 'DRIVE:' + stage + ':' + log.length + ':f' + frames;
}
const note = (tag, msg) => (flush('running'), log.push(
  `[d${S ? S.day : '?'} ${S ? S.daylight.toFixed(0).padStart(3) : '??'}L ` +
  `${S ? (S.at + '@' + (S.x | 0)).padEnd(16) : ''} t${S ? S.threat : '?'}] ` +
  `${tag.padEnd(9)} ${msg}`));

const raf   = () => new Promise(r => requestAnimationFrame(r));
const ticks = async n => { for (let i = 0; i < n; i++) await raf(); };

function key(k, down) {
  dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup',
    { key: k, bubbles: true, cancelable: true }));
}
const tap = async (k, n = 2) => { key(k, true); await ticks(n); key(k, false); await ticks(1); };

/* Walk until we are within `near` of x, or until the world stops us (an
   ending, a conversation, or simply running out of light). A frame budget
   rather than a time budget, so a stuck run fails instead of hanging. */
async function walkTo(x, near = 60) {
  const dirKey = () => (S.x < x ? 'arrowright' : 'arrowleft');
  let k = dirKey(), guard = 4000;
  key(k, true);
  while (Math.abs(S.x - x) > near && !S.over && !S.talk && guard-- > 0) {
    await raf();
    if (dirKey() !== k) { key(k, false); k = dirKey(); key(k, true); }
  }
  key(k, false);
  await ticks(2);
  if (guard <= 0) note('STUCK', `could not reach ${x}`);
  return Math.abs(S.x - x) <= near;
}

/* E is a press for people and doors and a HOLD for anything you search, and
   the driver does not get to know which — it holds E and watches, exactly as
   a player does. */
async function pressE(holdFrames = 140) {
  key('e', true);
  for (let i = 0; i < holdFrames; i++) {
    await raf();
    if (S.talk || S.over) break;        // a person or an ending answered first
    if (!S.hold && i > 4) break;        // the hold finished, or there was none
  }
  key('e', false);
  await ticks(2);
}

async function goScene(to) {
  const sc = SCENES[S.at];
  const ex = (sc.exits || []).find(e => e.to === to);
  if (!ex) return false;
  await walkTo(ex.x, 40);
  if (S.over) return false;
  await pressE(6);
  await ticks(4);
  const ok = S.at === to;
  note(ok ? 'travel' : 'TRAVEL!', `${sc.name} -> ${to}${ok ? '' : ' FAILED'}`);
  return ok;
}

/* Pick a numbered reply by matching the rendered option text. The driver reads
   the same words the player reads and presses the same number key. */
function options() {
  return [...document.querySelectorAll('#talk .choices li span')].map(n => n.textContent.trim());
}
async function choose(re) {
  const opts = options();
  const i = opts.findIndex(t => re.test(t));
  if (i < 0) return false;
  await tap(String(i + 1));
  await ticks(3);
  return true;
}

/* A FIRST MEETING IS NOT INSTANT. openTalk() hands off to playIntro(), which
   runs INTRO.DURATION + 900ms of portrait animation before the sheet appears,
   so E on a stranger sets S.talk about four seconds later. Waiting six frames
   for it — which is what this did at first — reads as "E opened nothing" on
   every first meeting in the run. Wait for the state, not for a frame count. */
/* Walk the conversation back to the root menu.

   The thing's branches are one node longer than everybody else's: a human's
   gossip returns you straight to root, while the thing deflects into
   `nothingtotell` and needs one more reply to get back. The first version of
   this driver did not know that, asked for the part at the wrong node, got
   nothing, and reported "the hasty player took zero parts in two days" — a
   finding that was entirely about the driver. Anything that walks this tree
   has to resynchronise on the root menu rather than count replies. */
async function toRoot(limit = 4) {
  for (let i = 0; i < limit; i++) {
    if (!S.talk) return false;
    if (options().some(t => /Why the masks/.test(t))) return true;
    if (!await choose(/.*/)) return false;      // whatever continues
  }
  return S.talk && options().some(t => /Why the masks/.test(t));
}

async function openWith(id) {
  const m = MASKS.find(x => x.id === id);
  if (!m || m.scene !== S.at) return false;
  if (S.gone[id]) { note('gone', `${m.name} is not at their post`); return false; }
  await walkTo(m.x, 80);
  if (S.over) return false;
  await pressE(6);
  for (let i = 0; i < 600 && !S.talk && !S.over; i++) await raf();
  if (!S.talk) { note('TALK!', `E at ${m.name} opened nothing`); return false; }
  return true;
}

/* One full visit: hear the gossip, check them if we can, take the part if the
   strategy allows it. `careless` skips the check entirely. */
async function visit(id, { careless = false, wantPart = true } = {}) {
  if (!await openWith(id)) return;
  const m = MASKS.find(x => x.id === id);

  await choose(/What do you know about/);
  await choose(/I will ask them|You have lived beside them/);
  await toRoot();

  /* Put the memory to them. Match MEMORY[id].ask exactly rather than by
     elimination — the root menu's options change as the run goes on, and a
     negative-lookahead regex picked a different line every time. */
  if (!careless && S.heard[id] && !S.verified[id]) {
    const ask = MEMORY[id] && MEMORY[id].ask;
    if (ask && await choose(new RegExp(ask.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))) {
      await choose(/That is all I wanted|That is not an answer/);
      await toRoot();
    }
  }

  if (wantPart && m.part && !S.parts.includes(m.part)) {
    if (await choose(/I need what you are holding/)) {
      const took = await choose(/I know what you are|^Take it\.$/);
      if (!took) await choose(/tell me who to ask/);
    }
  }

  if (S.talk) { key('escape', true); await ticks(2); key('escape', false); await ticks(2); }
  note('talk', `${m.name}  heard=${!!S.heard[id]} verified=${!!S.verified[id]} ` +
               `suspect=${!!S.suspect[id]} parts=[${S.parts}] marked=${S.marked}`);
}

async function searchHere(ids) {
  for (const id of ids) {
    const o = (SCENES[S.at].objects || []).find(x => x.id === id);
    if (!o) continue;
    await walkTo(o.x, 60);
    if (S.over) return;
    /* What a search can actually change: S.heard (a proof), S.stakes/S.oil (a
       supply), S.turned (you handled it and did not understand it). It does
       NOT change S.notes, which is what this reported at first — so every
       search in the first transcript read "nothing new" while quietly doing
       its job. */
    const b = { heard: Object.keys(S.heard).length, st: S.stakes, oil: S.oil,
                turned: Object.keys(S.turned).length };
    await pressE();
    const got = [];
    if (Object.keys(S.heard).length > b.heard) got.push('a proof');
    if (S.stakes > b.st) got.push('a stake');
    if (S.oil > b.oil) got.push('oil');
    if (!got.length && Object.keys(S.turned).length > b.turned) got.push('something unreadable');
    note('search', `${o.name} -> ${got.length ? got.join(' + ') : 'nothing'}`);
  }
}

/* Get under a roof before the light goes. Not optional: the church door and
   the crypt steps are the only two in the valley. */
async function bed() {
  if (S.over) return;
  /* The well has no roof. costToShelter() already knows that the answer from
     there is a walk, an exit and another walk, so bedding down means leaving
     the scene first — the driver's first version only looked for a shelter
     object in the scene it was standing in, logged NOROOF, and stranded
     itself at the well with enough light to have made it. */
  if (!(SCENES[S.at].objects || []).some(o => o.shelter)) {
    const ex = (SCENES[S.at].exits || [])[0];
    if (!ex) { note('NOROOF!', `${SCENES[S.at].name} has none and no way out`); return; }
    note('run', `no roof at ${SCENES[S.at].name}, ${S.daylight.toFixed(0)} light, ` +
                `${costToShelter().toFixed(0)} to one`);
    if (!await goScene(ex.to)) return;
  }
  const roof = (SCENES[S.at].objects || []).find(o => o.shelter);
  if (!roof) { note('NOROOF!', `${SCENES[S.at].name} has none`); return; }
  await walkTo(roof.x, 60);
  if (S.over) return;
  const d = S.day;
  await pressE(6);
  await ticks(6);
  note('sleep', S.over ? 'ENDED instead' : `day ${d} -> ${S.day}` +
       (S.day === d ? '  (NOTHING HAPPENED)' : ''));
}

/* -------------------------------------------------------------------------
   THE THREE RUNS
   ---------------------------------------------------------------------- */

/* Go to bed if there is not enough light left to get under a roof AND do one
   more thing. The game computes the walk home itself in costToShelter(); the
   driver asks it rather than guessing, which is also what the in-game warning
   line does. */
async function maybeBed(reserve = 10) {
  if (S.over) return false;
  if (S.daylight > costToShelter() + reserve) return false;
  note('dusk', `${S.daylight.toFixed(0)} light, ${costToShelter().toFixed(0)} to a roof`);
  await bed();
  return true;
}

/* Everything worth turning over, in the order you would meet it walking. */
const SPOTS = {
  church:    ['crate', 'gate'],
  well:      ['trough', 'shed', 'shaft', 'windlass'],
  graveyard: ['railings', 'moved', 'vault'],
};

/* 1. Plays it the way the design wants: hear a memory, carry it to its owner,
      prove you listened, then ask. The ring of five breaks at one place every
      run — whoever the thing was supposed to vouch for — so this also searches
      for the paper that covers the break. V2_PLACEMENT is empty in this build:
      searching never yields a part, only proof and supplies. */
async function runCareful() {
  /* Day 1: the church and the well. */
  await searchHere(['crate']);                 // the burial book -> the sexton
  await visit('thresher');                     // -> hear about the widow
  await searchHere(['gate']);                  // the dog collar -> the miller
  await goScene('well');
  await visit('widow');                        // verify, take the harness
  await maybeBed() || await goScene('church'), await maybeBed();

  /* Day 2: the rest of the well, then east. */
  if (S.at !== 'well') await goScene('well');
  await visit('miller');                       // verify, take the axle
  await searchHere(['mill', 'shed']);        // oil, and the burned coat
  await goScene('church');
  await maybeBed();

  /* Day 3: the graveyard and home. */
  await goScene('graveyard');
  await searchHere(['shed']);                  // a whitethorn stake
  await visit('sexton');                       // verify, take the wheel
  await maybeBed();
  await goScene('church');
  await walkTo(1880, 50);
  await pressE(8);
}

/* 2. Never checks a hand. This is the run the carried ending exists for: the
      thing is the only one who will put a part in a stranger's hand without
      being asked to prove anything, so a player in a hurry takes it from
      exactly the wrong person — and if they repair before the light goes, the
      night that would have taken it back never comes. */
async function runHasty() {
  await goScene('well');
  await visit('widow',  { careless: true });
  await visit('miller', { careless: true });
  await maybeBed() || await goScene('church'), await maybeBed();
  if (S.at !== 'graveyard') await goScene('graveyard');
  await visit('sexton', { careless: true });
  await maybeBed();
  for (let pass = 0; pass < 3 && !S.over; pass++) {
    if (S.parts.length >= 3) break;
    /* Go back round and ask again for whatever is still missing. */
    for (const id of ['widow', 'miller', 'sexton']) {
      const m = MASKS.find(x => x.id === id);
      if (S.parts.includes(m.part) || S.gone[id]) continue;
      if (m.scene !== S.at) await goScene(m.scene);
      await visit(id, { careless: true });
      await maybeBed();
    }
  }
  if (S.at !== 'church') await goScene('church');
  await walkTo(1880, 50);
  await pressE(8);
  note('repair', `tried the wagon: parts=[${S.parts}] marked=${S.marked} over=${S.over}`);
}

/* 3. Burns the light walking and searching and never gets under a roof, to
      exercise nightfall in the open, losing a part in the night, and the
      blood moon. */
async function runWanderer() {
  await searchHere(SPOTS.church);
  await goScene('well');
  await searchHere(SPOTS.well);
  await goScene('church');
  await goScene('graveyard');
  await searchHere(SPOTS.graveyard);
  for (let i = 0; i < 10 && !S.over; i++) await walkTo(i % 2 ? 3100 : 300, 80);
}

/* A probe, not a run: stand in front of the culprit and report exactly what
   the conversation offers, word for word, at every node the driver touches. */
async function runProbe() {
  const m = MASKS.find(x => x.id === S.thing);
  if (m.scene !== S.at) await goScene(m.scene);
  if (!await openWith(m.id)) return;
  note('probe', `root: ${JSON.stringify(options())}`);
  const hit = await choose(/I need what you are holding/);
  note('probe', `chose part? ${hit}  talkOpen=${!!S.talk}  node=${S.talk && S.talk.node}`);
  const said = document.querySelector('#talk .said p');
  note('probe', `said: ${said ? said.textContent.slice(0,160) : 'NO .said p'}`);
  note('probe', `options now: ${JSON.stringify(options())}`);
  note('probe', `raw: ${(document.getElementById('talk').innerText || '').replace(/\s+/g,' ').slice(0,420)}`);
}

/* 4. The run the third ending is for: a competent player who checked the two
      people who asked to be checked, and then — on the last day, with the
      light going — took the third part out of the one hand that was offered
      without asking anything in return, and drove straight out.

      Pin the culprit to someone who holds a part (sexton holds the wheel) or
      there is nothing to take and the run is just a win. */
async function runCarried() {
  /* Day 1: the thresher names the widow, the widow names the miller, and both
     of them hand over once they have been checked. */
  await visit('thresher');
  await goScene('well');
  await visit('widow');
  await visit('miller');
  if (!await maybeBed()) { await goScene('church'); await bed(); }

  /* Day 2 onwards: the wheel is in the thing's hands. Take it without
     checking and get to the wagon in the same day. */
  for (let day = 0; day < 3 && !S.over && S.parts.length < 3; day++) {
    if (S.at !== 'graveyard') await goScene('graveyard');
    await visit('sexton', { careless: true });
    if (S.parts.length < 3) { await bed(); continue; }
    note('dash', `${S.parts.length} parts, marked=${S.marked}, ${S.daylight.toFixed(0)} light left`);
    await goScene('church');
    await walkTo(1880, 50);
    await pressE(8);
  }
  note('repair', `parts=[${S.parts}] marked=${S.marked} over=${S.over}`);
}

/* 5. The same situation as `carried`, played by someone who worked it out.
      Find the whitethorn, make the thing deflect until you are sure, then
      take the part knowing exactly whose hand it is coming out of. That path
      calls takePart with mark=false, so you are never marked — which means
      the stake is now the difference between the two road endings, not just
      a way to keep a part overnight. */
async function runStaked() {
  await goScene('graveyard');
  await searchHere(['shed']);                 // whitethorn
  await visit('sexton', { careless: true });  // deflects -> suspect, then the stake take
  note('stake', `stakes=${S.stakes} suspect=${!!S.suspect.sexton} parts=[${S.parts}] marked=${S.marked}`);
  if (!await maybeBed()) { await goScene('church'); await bed(); }

  await visit('thresher');
  await goScene('well');
  await visit('widow');
  await visit('miller');
  if (!await maybeBed()) { await goScene('church'); await bed(); }
  if (S.at !== 'church') await goScene('church');
  await walkTo(1880, 50);
  await pressE(8);
  note('repair', `parts=[${S.parts}] marked=${S.marked} over=${S.over}`);
}

/* 6. Verifies the three changes made after the first six runs: the threat
      stepping on a night survived, the two searches that used to roll dice,
      and the gate between the windlass and the shaft. */
async function runChanges() {
  note('check', `threat at dawn of day 1 = ${S.threat}`);

  /* The shaft should refuse until the windlass has been turned. */
  await goScene('well');
  const shaft = SCENES.well.objects.find(o => o.id === 'shaft');
  await walkTo(shaft.x, 60);
  await pressE();
  note('gate', `shaft before windlass: searched=${!!S.searched['well:shaft']} ` +
               `line="${S.line}"`);
  await searchHere(['windlass']);
  note('gate', `windlass: searched=${!!S.searched['well:windlass']}`);
  await walkTo(shaft.x, 60);
  await pressE();
  note('gate', `shaft after windlass: searched=${!!S.searched['well:shaft']} ` +
               `heardBoy=${!!S.heard.boy}`);

  await bed();
  note('check', `threat at dawn of day ${S.day} = ${S.threat}`);

  /* The vault should state the rule rather than roll on the find table. */
  await goScene('graveyard');
  await searchHere(['vault']);
  note('vault', `rule=${S.rule} line="${S.line.slice(0, 90)}"`);

  await bed();
  note('check', `threat at dawn of day ${S.day} = ${S.threat}  revealed=${S.revealed}`);
}

/* Reads the live mix off the audio graph at each threat plane, and checks
   the ambience drop actually drops the bed. Needs Chrome started with
   --autoplay-policy=no-user-gesture-required, or nothing will be running. */
async function runAudio() {
  await tap('arrowright');                 // the gesture that starts the context
  for (let i = 0; i < 240; i++) { await raf(); if (window.__mix && __mix().ready) break; }
  const read = () => JSON.stringify(__mix());
  const settle = async (n = 160) => { for (let i = 0; i < n; i++) await raf(); };

  note('audio', `start, full light: ${read()}`);

  /* The threat planes on their own must now do NOTHING until the near one. */
  for (const plane of [3, 2]) {
    S.threat = plane; await settle();
    note('audio', `plane ${plane}, light ${S.daylight.toFixed(0)}: ${read()}`);
  }

  /* The light going is the trigger that fires every run. */
  S.threat = 3;
  for (const light of [40, 32, 24, 16, 8, 0]) {
    S.daylight = light; await settle();
    note('audio', `light ${String(light).padStart(2)}, plane 3: ${read()}`);
  }

  /* Dawn: it should fall away again. */
  S.daylight = 95; await settle(220);
  note('audio', `dawn, plane 3:  ${read()}`);

  /* The near plane, in full daylight, should take it straight up. */
  S.threat = 1; await settle(220);
  note('audio', `plane 1, light 95: ${read()}`);

  document.body.classList.add('quiet'); await settle(200);
  note('audio', `quiet on:       ${read()}`);
  document.body.classList.remove('quiet'); await settle(200);
  note('audio', `quiet off:      ${read()}`);

  S.over = 'won'; await settle(240);
  note('audio', `ending:         ${read()}`);
}

/* Plays the route the design wants now that the well has a roof: go west,
   work the well across two days sleeping in the mill, come home for the
   sexton. This is the run that was impossible before — the widow and the
   miller in one trip. */
async function runMill() {
  await visit('thresher');
  await goScene('well');
  await visit('widow');
  note('plan', `widow done, ${S.daylight.toFixed(0)} light left, parts=[${S.parts}]`);
  if (S.daylight < 40) { await bed(); note('plan', `slept at the well, day ${S.day}`); }
  await visit('miller');
  note('plan', `miller done, ${S.daylight.toFixed(0)} light, parts=[${S.parts}]`);
  await bed();
  if (S.at !== 'church') await goScene('church');
  await goScene('graveyard');
  await visit('sexton');
  note('plan', `sexton done, ${S.daylight.toFixed(0)} light, parts=[${S.parts}]`);
  await bed();
  if (S.at !== 'church') await goScene('church');
  await walkTo(1910, 50);
  await pressE(8);
  note('plan', `wagon: parts=[${S.parts}] over=${S.over}`);
}

const RUNS = { mill: runMill, audio: runAudio, changes: runChanges, staked: runStaked, carried: runCarried, careful: runCareful, hasty: runHasty, wanderer: runWanderer, probe: runProbe };

addEventListener('load', async () => {
  const q = new URLSearchParams(location.search);
  const which = q.get('run') || 'careful';
  const thing = q.get('thing');          // pin the culprit, so a run is repeatable

  flush('loaded');
  await ticks(5);
  newRun();
  if (thing) S.thing = thing;
  await ticks(5);

  note('start', `run=${which} culprit=${S.thing}`);
  try { await RUNS[which](); }
  catch (err) { note('THREW!', err && err.message); }

  await ticks(10);
  note('end', `over=${S.over || 'still playing'} day=${S.day} parts=[${S.parts}] ` +
              `verified=[${Object.keys(S.verified)}] suspect=[${Object.keys(S.suspect)}] ` +
              `marked=${S.marked} revealed=${S.revealed} taken=${S.taken}`);

  const frame = document.querySelector('#end .frame');
  const result = JSON.stringify({
    run: which,
    culprit: S.thing,
    outcome: S.over || 'none',
    screen: frame ? document.querySelector('#end').className : 'none',
    headline: frame ? frame.querySelector('h1').textContent : null,
    kicker: frame ? frame.querySelector('.kicker').textContent : null,
    tally: frame ? frame.querySelector('.tally').innerText : null,
    stowed: !!document.querySelector('#end .stowed'),
    day: S.day, parts: S.parts, marked: S.marked,
    log,
  });
  send('result-' + which, result);
  document.title = 'DRIVE-DONE';
});

})();
