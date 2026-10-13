/* ============================================================================
   G — MYSTERY. THREE SCENES, NO HUB.
   ----------------------------------------------------------------------------
   WHAT CHANGED FROM F, AND WHY

   1. THE CROSSROADS IS GONE. Measured: a full winning run was 60-80 seconds of
      holding one direction key against 13-17 key presses. Most of that was hub
      transit — every journey was scene -> hub -> scene, so every round trip paid
      four exit costs and two crossings of an empty plate to reach two places.

   2. THE CHURCH IS THE MIDDLE. Not a third spoke: the middle of a line.

          THE WELL  <---->  THE CHURCH  <---->  THE GRAVEYARD

      A hub fails when passing through it is dead time. The church is shelter,
      it is where the wagon is, and it is where you finish — so every transit
      through it is an opportunity to sleep or to repair rather than a toll.
      That is the whole difference between this and the crossroads.

   3. THE WAGON MOVED BACK TO THE CHURCH. It is already drawn there: the church
      fore plate has a broken cart at roughly x=1880, left over from before the
      wagon was moved out. So this costs no art, and it deletes "paint the wagon
      out of the church plate" from the to-do list.

   4. KNOWLEDGE IS THE GATE, NOT DAYLIGHT. Searching never hands you a part. It
      hands you paper. A part only comes up when you are holding the specific
      thing that explains where it is — and one of the three needs TWO separate
      pieces that are in two different scenes, which is what forces the
      back-and-forth to be a route rather than a loop.

   COORDINATES are still source image pixels. The art is still the level editor.
   ========================================================================== */

const V2 = {
  DAYS: 3,
  /* 140 carried over from F. With the hub gone the days are cheaper, which is
     the point: the budget that was being spent on corridor is now available for
     content. See `node route.js`. */
  /* 95, down from 140. Nothing is buried in this build, so the searching the
     old budget was sized for does not exist — and with conversation as the only
     verb a 140 day finished the whole game before dusk on day one.

     A part now costs roughly: 18 in talk (hear the memory, check it, ask for the
     thing) plus two journeys at ~28 each. Call it 74. One part is a day's work,
     which is what a three-day game with three parts should mean. */
  /* THE DIFFICULTY DIAL, and ?light= turns it without an edit.

     Left at 95. The arithmetic says the budget was never the problem: an
     optimal run of the whole game costs 123-140 light depending on which of
     the five the thing turns out to be, against 285 available, so there is
     already slack of more than two to one. What was eating runs was the
     well having no roof, which is fixed above, and the sheet not saying
     which questions cost anything, which is fixed in paintTalk().

     Raise this only if it is still hard after those two — and raise it
     knowing why 140 was wrong before: it finished the game before dusk on
     day one, which costs the blood moon all its meaning. Try 110 first.
     Guarded for Node, because variants/check.js evaluates this file outside
     a browser and there is no `location` there — which it told me about
     immediately, which is the entire point of having it. */
  DAYLIGHT_PER_DAY:
    (() => {
      if (typeof location === 'undefined' || typeof URLSearchParams === 'undefined')
        return 95;
      const q = parseFloat(new URLSearchParams(location.search).get('light'));
      return q > 0 ? q : 95;
    })(),
  PARTS_NEEDED: 3,
  REPAIR_COST: 8,

  WALK_COST: 14 / 2400,

  REACH: 150,
  EXIT_REACH: 110,
  EXIT_DROP: 260,

  LIGHT_FULL: 1.25,
  LIGHT_LANTERN: 190,

  ACTOR_DEPTH: 68,
  ACTOR_H: 0.135,

  /* 700, not 420. Daylight is spent per PIXEL, not per second, so this changes
     nothing about the economy, the balance or the tension — only how many real
     seconds the player spends holding a key with nothing to decide. At 420 a
     3600px plate took 8.6 seconds to cross. At 700 it takes 5.1. The bob is
     driven by distance walked, so the gait speeds up with it and reads as a man
     in a hurry, which he is. */
  WALK_SPEED: 700,

  /* What it costs to come back to a hiding place you have already turned over
     once you finally understand it. Half: you are not searching any more, you
     are collecting. */
  KNOWN_DISCOUNT: 0.5,

  /* Standing in a doorway getting somebody to tell you about their neighbour
     takes time, and time is the only resource this game has. Without this,
     talking is free and the three-day clock stops meaning anything — which is
     exactly what happened: a whole run finished on day one.

     Only substantive topics cost. Asking why everyone is masked, or walking
     away, is free; it is the asking FOR something that burns the afternoon. */
  TALK_COST: 6,

  /* How much nearer an object has to be than a person before E reaches for
     the object instead. A person still wins a tie and still wins when you
     are genuinely between the two — that instinct was right — but before
     this they won on presence alone, so the widow at 1050 owned every press
     from 900 to 1200, the bucket windlass included. */
  PERSON_BIAS: 40,

  /* HOW LONG YOU HAVE TO STAY STILL TO SEARCH SOMETHING.

     A tap on E is not a decision, which is why searching never felt like
     anything. This is a decision: for a second and a bit you are crouched over
     a crate with both hands busy, and paintLight() pulls the lantern in to
     roughly half its reach while you are down there. You can let go at any
     point and keep your daylight. Finishing is the thing you choose. */
  HOLD_SEC: 1.15,
  HOLD_PULL: 0.52,      // how far the light comes in at a full hold
};

/* --- THREE SCENES, IN A LINE --------------------------------------------- */
const SCENES = {

  /* HOME, SHELTER, AND THE FINISH LINE. Everything passes through here. */
  church: {
    name: 'The Church',
    aspect: 2, zoom: 1.45, ground: 0.93,
    actorH: 0.093,
    ridge: false,
    shelter: true,
    art: '../../art/locations/church/',
    blurb: 'Thick walls, a barred door, and your wagon slumped outside with its axle in pieces.',
    /* EVERY `art` BELOW IS MEASURED, NOT GUESSED. The alpha of each plate was
       scanned column by column for ink standing above the ground band, and
       the runs it found are the props; `art.x` is the centre of the run and
       `art.depth` is the plate it was found in. `x` — where you stand — is
       then solved from it, so that the prop is overhead when the camera has
       centred you there, and nudged apart afterwards wherever two of them
       landed inside one REACH of each other. */
    objects: [
      /* fore 232-599: the crate stack. Was 360, the left edge of it. */
      { id:'crate', x: 416, name:'the stacked crates',  cost: 6,
        art:{ x: 416, depth:68 } },
      /* THE CHURCH IS ON THE MID PLATE (759-1579), three planes back, moving
         at 0.35 of the camera. No value of `x` could have put a fore-plane
         prompt on it. */
      { id:'door',  x:1721, name:'the church door',     cost: 5, shelter:true,
        art:{ x:1120, depth:24 } },
      /* near 1122-1242: the hatched gate panel in the churchyard fence.
         Solved to 1458, then pulled to 1310 because the thresher stands at
         1500 and a person outranks an object in interact() — at 1458 the
         gate could never have been searched at all. The 148 of slack costs
         92 source pixels of offset, six percent of the width of the screen. */
      { id:'gate',  x:1310, name:'the churchyard gate', cost: 6,
        art:{ x:1182, depth:42 } },
      /* fore 1697-2124: the broken cart, drawn in two pieces (pole and front
         wheel, then body and rear wheel). Centre of the pair. */
      { id:'wagon', x:1910, name:'your wagon',          cost: 0, wagon:true,
        art:{ x:1910, depth:68 } },
    ],
    exits: [
      { x:  120, to:'well',      cost: 7 },
      { x: 2340, to:'graveyard', cost: 6 },
    ],
  },

  /* WEST. The end of the line, and where two of the three pieces ended up. */
  well: {
    name: 'The Dry Well',
    aspect: 3, zoom: 1, ground: 0.92,
    ridge: false,
    art: '../../art/locations/well/',
    blurb: 'No water in it for a long time. The bucket rope still runs down into the dark.',
    objects: [
      /* WAS "the cracked trough", which is drawn nowhere in this valley —
         every plate was scanned and there is no trough on any of them. The
         mid plate, though, carries an unused timber-framed mill at 0-811
         with a cart track curving away from it, and the miller is a person
         you can stand and talk to two thousand pixels east of it. So the
         lamp oil lives in the mill now. It is three planes back, which is
         exactly why it needs `art`. */
      /* AND IT IS THE ROOF THE WELL NEVER HAD.

         This is the change that makes the valley playable. The well holds
         two of the five people and two of the three parts, and it had no
         shelter — so every trip there was a round trip, and the round trip
         alone is 51 light out of a 95 light day before you say one word to
         anybody. 54% of a day spent walking meant you could do the widow or
         the miller, never both, and getting that wrong cost the run. That
         is not difficulty, it is a gotcha with a three-day fuse.

         A mill is a building with a door, it is already drawn, and the
         miller is standing nine hundred pixels away. Sleeping here turns
         the well from a day-trip into a place you can work out of.

         It cost its oil to do it: shelter short-circuits before the hold in
         interact(), so a shelter cannot also be searched. Oil was 18
         seconds of a slightly wider lantern and is still in the random find
         table, which is the cheapest thing in the game to give up. */
      { id:'mill',    x: 406, name:'the old mill',        cost: 0,
        shelter:true, art:{ x: 406, depth:24 } },
      /* near ~821-984: the crank arm with the bucket hanging off it. Was
         1620, which is the roofed wellhead further along — the two had been
         swapped. Standing point pulled 80 left of the art to clear the
         widow, who is at 1050 and outranks an object at the same spot. */
      { id:'windlass',x: 780, name:'the bucket windlass', cost: 6,
        art:{ x: 900, depth:42 } },
      /* near ~1331-1760: the capped wellhead under its pointed roof.
         Eleven light, split. You cannot see the bottom of a dry shaft by
         leaning over it, so the shaft needs the windlass first: six to get
         the lamp down there and five to go through what it lights. The total
         is what it always was; the difference is that both halves now mean
         something instead of one of them being a dice roll. */
      { id:'shaft',   x:1841, name:'down the shaft',      cost: 5, needs:'windlass',
        art:{ x:1545, depth:42 } },
      /* near ~2777-3260: the collapsed barn. Was 3260 — its right-hand edge,
         and far enough along that the prompt sat past the end of it. */
      { id:'shed',    x:3380, name:'the collapsed shed',  cost: 6,
        art:{ x:3020, depth:42 } },
    ],
    exits: [ { x: 3540, to:'church', cost: 7 } ],
  },

  /* EAST. The other end, the second shelter, and the paper trail. */
  graveyard: {
    name: 'The Graveyard',
    aspect: 3, zoom: 1, ground: 0.92,
    ridge: false,
    shelter: true,
    art: '../../art/locations/graveyard/',
    blurb: 'Older stones than the church. Several have been moved recently.',
    objects: [
      /* WAS "the sexton's shed" at 520, where the drawing is bare railings.
         There is no shed in this graveyard.

         It went to the iron arch on the near plate first, and that was the
         wrong call twice over: the arch is the darkest thing in the scene
         and nearly unreadable at playing brightness, and the railed grave
         two hundred pixels along is the brightest — so the caption named the
         one you cannot see while standing next to the one you can. This is
         the bright one, fore 2166-2334, on the walker's own plane, which
         also means no parallax to correct for. */
      { id:'railings', x:2250, name:'the iron railings', cost: 6,
        art:{ x:2250, depth:68 } },
      /* fore 807-913: the leaning slab, the one thing in this scene standing
         on the walker's own plane. Standing point pulled 100 left of it so
         the sexton at 950 does not swallow the prompt — a person outranks an
         object in interact(). */
      { id:'moved', x: 760, name:'the stones that moved', cost: 8,
        art:{ x: 860, depth:68 } },
      /* near 0-618: the mausoleum — pediment, arched door, cross on the
         roof. That is the family vault, and it is at the far west end, not
         at 2400 where this used to point (bare railings). */
      { id:'vault', x: 309, name:'the family vault',    cost: 9,
        art:{ x: 309, depth:42 } },
      /* near ~2898-2952: the arched opening at the base of the chapel, NOT
         the chapel's centre at 3183. The centre is unusable — at full pan it
         sits at source 2277 in a 2133-wide window, i.e. off the right edge of
         the screen, so the caption would have been clipped every time. The
         arch is the thing you walk down into anyway. */
      { id:'crypt', x:3486, name:'the crypt steps',     cost: 5, shelter:true,
        art:{ x:2925, depth:42 } },
    ],
    exits: [ { x: 60, to:'church', cost: 6 } ],
  },
};

const V2_PARTS = [
  { id:'axle',    name:'Iron Axle' },
  { id:'wheel',   name:'Cartwheel' },
  { id:'harness', name:'Leather Harness' },
];

/* Where the pieces actually are. Unchanged from F — the art already supports
   these three spots and there is no reason to move them. */
/* EMPTY ON PURPOSE. Nothing is buried in this build. Every part is in
   somebody's hand, and the only way to get one is to stand in front of a mask
   and ask. That is the whole experiment: searching becomes asking.

   The search spots and their notes are still here and still readable — they are
   what you use to CHECK what people tell you, which is the other half of the
   deduction. See MASKS in v2-talk.js for where the parts actually are. */
const V2_PLACEMENT = {};

/* --- WHAT EACH PIECE NEEDS BEFORE IT WILL COME UP ------------------------
   The shape of this object IS the level design.

   Two of the three need one piece of paper each, which teaches the rule. The
   wheel needs TWO, found in two different scenes, and that is what turns the
   back-and-forth from a loop into a route: you cannot finish the wheel without
   having been to the graveyard AND the church, and the hiding place is at the
   well, so all three scenes are load-bearing for one object.
-------------------------------------------------------------------------- */
/* Empty here. G gated buried parts behind tokens; in this build nothing is
   buried, so there is nothing to gate. The notes below survive as OBSERVATIONS
   — things you can hold up against what a mask tells you. */
const V2_LEADS = {};

/* --- THE PAPER ------------------------------------------------------------
   Keyed 'scene:spot'. `token` is what reading it gives you.

   NOTHING HERE NAMES A SPOT BY ITS ID. "hung on the rope where the bucket
   should be" has to be matched to the bucket windlass by the player, and if
   they guess the shaft instead they get a handful of nothing. The moment a note
   says "search the windlass" this stops being a mystery and becomes a quest
   marker with better prose.
-------------------------------------------------------------------------- */
/* NOT ONE OF THESE SIX IS REACHABLE IN THIS BUILD, and that is worth knowing
   before anybody edits them. doSearch() checks V2_WORK, then V2_STOCK, then
   V2_PROOF, and only then V2_NOTES — and every key below is also a key in one
   of those three. The stock spots return before they get here and the proof
   spots mark themselves searched on the way out, so the second visit is
   refused at the hold.

   They are also older than the build they sit in. Three of them point at
   wagon parts hidden in the ground — "took the leather up to the stones they
   moved", "long iron off the cart is at the well" — and V2_PLACEMENT is empty
   now, so nothing is buried anywhere. Making them reachable as they stand
   would send the player digging for things that are in people's hands.

   Left intact rather than deleted: the writing is good, the Ilinca thread in
   two of them is load-bearing in the story document, and the vault's line has
   been lifted into V2_WORK where it can actually be read. */
const V2_NOTES = {
  /* The opener. No token: it does not unlock anything, it explains why there is
     anything to unlock. Sitting in the church, which is where you wake up, so
     day one always has an obvious first move. */
  'church:crate': {
    token: null,
    text: 'A carter\'s bill of lading, water-blotted, in a hand that is not yours. ' +
          'Across the back, hurried: <i>took her to pieces myself. Three bits, three places, ' +
          'none of them together. If it cannot roll it cannot carry him.</i>',
  },

  'well:mill': {
    token: null,
    text: 'A strap-end, cut through rather than worn through. Folded inside it, a scrap: ' +
          '<i>took the leather up to the stones they moved. Ground will hold it better than we will.</i>',
  },

  'graveyard:railings': {
    token: null,
    text: 'The sexton kept a ledger, and kept it well until the last page. ' +
          '<i>Long iron off the cart is at the well, hung on the rope where the bucket should be.</i> ' +
          'Nothing after that, and the pen is still on the floor.',
  },

  /* The wheel's two halves. Neither is any use alone, and they sit at opposite
     ends of the valley. */
  'graveyard:vault': {
    token: null,
    text: 'The family name is worn to nothing, and the door has been mortared shut from the ' +
          'outside, recently and badly. Someone scratched two words into the wet mortar before ' +
          'it set: <i>ask Ilinca.</i>',
  },
  'church:gate': {
    token: null,
    text: 'The parish register, left open and rained on. Under the last burial, in the same ' +
          'hurried hand as the bill of lading: <i>Ilinca would not have it in the ground with her. ' +
          'Said drop it where the water was and let it rust.</i>',
  },

  /* One honest dead end. It exists so that the four note spots are not findable
     by elimination, and so that searching sometimes simply costs you. */
  'well:shed': {
    token: null,
    text: 'The beams are stacked, not fallen. Someone pulled this down on purpose and in ' +
          'daylight. There is a scythe here with the blade ground off to a stub.',
  },
};

/* What you say when you reach a hiding place without the paper that explains
   it. Each one describes the piece without naming it, so that when the matching
   note turns up later the two halves click together in the player's head rather
   than being announced. */
const V2_BLANK = {};

/* Said the moment the last required piece of paper lands, instead of the note's
   own text. This is the only place the game spells a connection out, and it is
   the payoff of the whole structure, so it gets to be explicit. */
const V2_CLICK = {};

const V2_FINDS = [
  { id:'clipping', weight:3, text:'Newsprint, water-stained. It names a place.' },
  { id:'oil',      weight:2, text:'A little oil. The lantern will reach further for a while.' },
  { id:'stake',    weight:1, text:'Cut and sharpened by someone who knew what was coming.' },
  { id:'nothing',  weight:4, text:'Nothing but dust and your own breathing.' },
];

/* ---------------------------------------------------------------------------
   WHAT THE GROUND KNOWS

   Every villager's memory now exists in two places: in a neighbour's mouth and
   in a thing you can find. Asking is quick and cheap. Finding costs more
   daylight, needs the hold, and puts you in the dark for the length of it.

   So why would anyone ever search? Because THE THING CANNOT GOSSIP. It does not
   know these people's lives — ask it about a neighbour and it changes the
   subject, same as when you put a memory to it. Which means the ring of five
   breaks exactly once per run, in a place you cannot predict, and the person on
   the far side of that break can only be reached through the ground.

   Nobody's proof is in their own scene. Every one of these is a walk.
--------------------------------------------------------------------------- */
const V2_PROOF = {
  'well:shed': { who:'thresher',
    text:'A coat, folded and put away by somebody tidy. The right sleeve is burned off it at the shoulder and the left one is not even marked.' },

  'well:shaft': { who:'boy',
    text:'Forty feet down, on the ledge where the water turns: a woman\u2019s shoe, and the other one further in. Nobody has been down for them.' },

  'church:gate': { who:'miller',
    text:'A dog collar nailed to the gatepost, the way they do it here. HANU, cut in with a knife by someone who was not in a hurry.' },

  'graveyard:moved': { who:'widow',
    text:'Somebody has been steadying themselves on these stones for years. The moss is worn off in the shape of a left hand, and the hand is two fingers short.' },

  'church:crate': { who:'sexton',
    text:'The burial book, in among the hymnals. Every name down the page has a bell struck beside it in the margin. One name this spring has the sexton\u2019s own surname and no bell, and the ink is the same ink.' },
};

/* ---------------------------------------------------------------------------
   THE TWO STANDING SUPPLIES

   Everything else in the valley is a one-shot: you go through it, it is spent.
   These two are not. They cost daylight every time and they never run out,
   which makes them ERRANDS rather than luck.

   That distinction is load-bearing. Taking a part out of the thing's hand
   needs whitethorn, and a night out in the open eats whitethorn too, so one
   run can easily want two or three. Leaving that to a one-in-ten roll on the
   find table meant the knowing reach — the only thing standing between the
   player and three unwinnable runs in five — was a lottery. Now it is a walk
   to the graveyard, which is a cost you can plan against.
--------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------
   SEARCHES THAT ARE WORK, NOT PAPER

   Two objects used to fall all the way through doSearch to the random find
   table: the bucket windlass at 6 light and the family vault at 9. The vault
   is the single most expensive action in the game and seven outcomes in ten
   did nothing at all — scripted runs turned both over and got "nothing but
   dust" for fifteen light between them.

   These two now do a definite thing each. Neither hands you paper; one opens
   a place and the other states the rule the whole deduction runs on, which
   until now the game expected every player to infer unaided in ten minutes.
-------------------------------------------------------------------------- */
const V2_WORK = {
  'well:windlass': {
    text: 'The rope is sound and the crank still turns. You let the bucket ' +
          'down with the lamp wired into it until the light is sitting on ' +
          'the bottom of the shaft, and leave it there.',
    opens: 'shaft',
  },

  /* THIS TEXT IS LOUDON'S, restored. The first version of this entry was a
     paraphrase I wrote without noticing that V2_NOTES already had a vault
     note saying the same thing better — and the two words it ends on are,
     per the story document, the cruellest line in the game. Wording back to
     his; the mortar is on the OUTSIDE, which is a different and worse fact
     than the inside, and that was his too.

     What is added is only the last sentence, which is what makes this nine
     light rather than a dead end: it is the one place the game states the
     rule the whole deduction runs on. Not a hint about who — the rule. The
     thing has the face and the coat of somebody buried here and none of the
     life that went with them, which is exactly why a question about a dog's
     name works and a question about the masks does not. */
  'graveyard:vault': {
    text: 'The family name is worn to nothing, and the door has been ' +
          'mortared shut from the outside, recently and badly. Two words ' +
          'scratched into the wet mortar before it set: <i>ask Ilinca.</i> ' +
          'Whatever came back up out of here has a face and a coat and none ' +
          'of the life that went with them.',
    rule: true,
  },
};

const V2_STOCK = {
  'graveyard:railings': { id:'stake',
    text:'Whitethorn, cut green and bundled, stacked the length of the railings and laid over the top of them \u2014 more than one man would ever need, around one grave and no other. The sexton has been busy. You take one and leave the rest where they are.' },

  /* The mill is the well's shelter now and a shelter cannot be searched, so
     there is no guaranteed oil in the valley any more — only the random find
     table, where it has always also lived. See the note on the mill. */
};

const THREAT = {
  START: 4,
  SIGHT: { 3:'far', 2:'mid', 1:'near' },
  TELL: {
    3: { hiss:0.10, drop:false, line:'Something on the ridge that was not there before.' },
    2: { hiss:0.30, drop:true,  line:'The birds have stopped.' },
    1: { hiss:0.62, drop:true,  line:'It is at the edge of the light.' },
  },
};

/* MASKS is defined in v2-talk.js, which loads first — this file only needs it
   to exist for the validator. */
