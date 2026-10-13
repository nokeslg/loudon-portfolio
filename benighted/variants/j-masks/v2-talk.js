/* ============================================================================
   J — THE RING OF MEMORIES

   Five masked villagers. Each one knows one small, checkable thing about one
   other, and they form a closed ring. So the loop is:

       talk to A  ->  A tells you a memory about B  ->  go and ask B
       B answers it correctly, and you know B is a person
       B does not, and you know what B is

   WHO IT IS CHANGES EVERY RUN. Nothing in the data marks the thing; one of the
   five is picked at random in newRun(). That matters for testing — it means
   neither of us can learn the answer and then judge the loop on a run where we
   already knew.

   THE TELL IS A DEFLECTION, NOT A WRONG FACT. It does not say "the right hand"
   when the answer is the left. It changes the subject, or asks why you want to
   know. A creature that gets details wrong is a quiz; a creature that will not
   be pinned down is a person you are starting to be afraid of.

   Three of the five hold a wagon part and will hand it over once you have
   checked them. The thing will offer its part too, unverified, and taking it
   is how you lose.
   ========================================================================== */

const MASKS = [
  { id:'thresher', img:'thresher', name:'the thresher',  scene:'church',    x:1500, part:null,
    knows:'widow' },
  { id:'widow',    img:'widow', name:'the widow',     scene:'well',      x:1050, part:'harness',
    knows:'miller' },
  { id:'miller',   img:'miller', name:'the miller',    scene:'well',      x:2950, part:'axle',
    knows:'sexton' },
  { id:'sexton',   img:'sexton', name:'the sexton',    scene:'graveyard', x: 950, part:'wheel',
    knows:'boy' },
  { id:'boy',      img:'boy', name:'the boy',       scene:'graveyard', x:2800, part:null,
    knows:'thresher' },
];

/* What each one tells you about the next in the ring, and what the subject says
   when you put it to them. Every memory is a small physical fact a neighbour
   would know and a stranger could not invent. */
const MEMORY = {
  widow: {
    told:  'She lost two fingers in the year of the late frost. Ask her which hand, if you want to know her.',
    ask:   'Which hand was it. The frost year.',
    right: 'The left. Two fingers and the top of a third. You can hold the lamp closer if you like, I have stopped minding.',
  },
  miller: {
    told:  'He kept a dog that went into the race and did not come out. Ask him what he called it.',
    ask:   'The dog that went into the race. What was it called.',
    right: 'Hanu. He was deaf as a post, that was the trouble, he never heard the water come up.',
  },
  sexton: {
    told:  'He buried his own brother in the spring and would not ring the bell over him. Ask him why not.',
    ask:   'Your brother, in the spring. Why no bell.',
    right: 'Because a bell is to tell the valley a man has died, and I was not sure that he had. I am still not sure.',
  },
  boy: {
    told:  'He has not said a word since his mother went. Not one, not to anybody.',
    ask:   'They tell me you do not speak.',
    right: 'I do not. Not to them. You are not from here, so it does not count.',
  },
  thresher: {
    told:  'He has a burn the length of his arm from the night the barn went up. Ask him which arm.',
    ask:   'The burn from the barn. Which arm.',
    right: 'The right, from the wrist to here. I went back in for the horses and I got one of the two out.',
  },
};

/* Four deflections, picked at random so the same creature does not use the same
   dodge twice in a run. None of them is a wrong answer — that is the point. */
const DEFLECT = [
  'Why would you want to know a thing like that.',
  '...That was a long time ago now. Longer than you would think.',
  'Who has been talking to you about me.',
  'Does it matter. You have what you came for, or you have not.',
];

function isThing(S, m) { return S.thing === m.id; }

/* One place where a part changes hands, because there are two routes to it now
   and they must not drift apart. `mark` is whether it watched you do it. */
function takePart(S, m, mark) {
  if (!m.part || S.parts.includes(m.part)) return;
  S.parts.push(m.part);
  S.gave[m.part] = m.id;              // so the night knows where to send it back
  if (mark) S.marked = true;
  stepThreat(`You take the ${V2_PARTS.find(x => x.id === m.part).name}.`);
}
function verified(S, id) { return !!S.verified[id]; }

/* --------------------------------------------------------------------------
   THE TREES
-------------------------------------------------------------------------- */
function firstNode() { return 'root'; }

/* One tree, shared by all five and parameterised by who they are. Five
   hand-written trees would drift apart and the differences would leak the
   answer. */
const SHARED = {
  nolight: {
    text: 'Not now. Look at the sky and then look at me and tell me you have time for this.',
    choices: [{ say: 'You are right.', to: 'leave' }],
  },

  root: {
    text: (S, m) => {
      if (S.met[m.id] > 1 && verified(S, m.id))
        return 'You again. Keep the lamp where I can see it and we will get on.';
      if (S.met[m.id] > 1)
        return 'You again.';
      return 'Do not come any closer with that lamp than you have to. I know what I look like. We all look like this now, and we have our reasons.';
    },
    choices: [
      { say: 'Why the masks.', to: 'masks' },
      { say: (S, m) => `What do you know about ${MASKS.find(x => x.id === m.knows).name}?`,
        cost: () => V2.TALK_COST, to: 'gossip' },
      { say: (S, m) => MEMORY[m.id].ask,
        if: (S, m) => S.heard[m.id] && !verified(S, m.id),
        cost: () => V2.TALK_COST, to: 'check' },
      /* FREE, and it used to cost six.

         You pay for what you RECEIVE, not for what you ask. Gossip and the
         memory question both cost, because in both cases the other person
         does something for you. Asking for the part does not, because most
         of the time the answer is no — and the refusal is the only place
         the game ever explains its own rule: tell me something about myself
         first, and here is who to ask. Charging for that meant a player
         working out how the valley functions paid for the lesson every
         time, and a player who had not worked it out yet was being billed
         for their own confusion. That is the thing that was making this
         feel punishing. */
      { say: 'I need what you are holding.',
        if: (S, m) => !!m.part && !S.parts.includes(m.part),
        to: 'part' },
    ],
  },

  masks: {
    text: 'It comes back for the people it knew. That is the whole of it. It walks up to a face it remembers and it calls the name, and the face answers, and that is that. So we have no faces. It has been three weeks and it has not taken anyone since we started.',
    choices: [{ say: 'Go on.', to: 'root' }],
  },

  /* IT DOES NOT KNOW THESE PEOPLE. It has their face and their coat and it can
     hold a conversation, but it never sat in anybody's kitchen. So it cannot
     pass on a memory, and the ring of five breaks at exactly one place per run.

     That break is the whole reason to search. Whoever the thing was supposed to
     tell you about is now unreachable by talking, and their proof is lying in a
     shed or a vault in another scene. */
  gossip: {
    text: (S, m) => isThing(S, m)
      ? DEFLECT[S.deflect % DEFLECT.length]
      : MEMORY[m.knows].told,
    choices: [
      { say: (S, m) => isThing(S, m)
          ? 'You have lived beside them your whole life.'
          : 'I will ask them.',
        do: (S, m) => {
          if (isThing(S, m)) { S.deflect++; S.suspect[m.id] = true; }
          else S.heard[m.knows] = true;
        },
        to: (S, m) => isThing(S, m) ? 'nothingtotell' : 'root' },
    ],
  },

  nothingtotell: {
    text: 'Half a mile of valley and everybody in it, and not one thing worth repeating. You will have to go and look for yourself.',
    choices: [{ say: 'I will.', to: 'root' }],
  },

  check: {
    text: (S, m) => isThing(S, m)
      ? DEFLECT[S.deflect % DEFLECT.length]
      : MEMORY[m.id].right,
    choices: [
      { say: (S, m) => isThing(S, m) ? 'That is not an answer.' : 'Good. That is all I wanted.',
        do: (S, m) => {
          if (isThing(S, m)) { S.deflect++; S.suspect[m.id] = true; }
          else S.verified[m.id] = true;
        },
        to: 'root' },
    ],
  },

  /* THE OFFER IS THE TELL.

     A person will not put a wagon part in the hand of a stranger in a mask
     until that stranger has proved they know who they are talking to. So every
     human refuses until you have checked them, and checking takes a memory you
     can only get from somebody else, in another scene.

     The thing has no such caution. It hands the part straight over, gladly, to
     anyone. Which means by the third part the player has learned a rule —
     everybody makes me prove myself — and the one who does not is the one
     standing in front of them being helpful.

     This is also what fixes the pacing. Before, you could walk the valley and
     take all three in one afternoon because asking was optional. Now each part
     costs two journeys: hear the memory somewhere, carry it to its owner. */
  part: {
    text: (S, m) => {
      if (verified(S, m.id))
        return 'Take it. I have no cart to put it on and no road I would use if I had.';
      if (isThing(S, m))
        return 'This? Take it, take it, I have no use for it. Go on. Nobody here will miss it and I will not ask you for anything.';
      return 'No. Not out of my hand into yours, not until you tell me something about myself that only somebody from this valley would know. That is how it works now. That is how we are all still alive.';
    },
    choices: [
      /* YOU KNOW, AND YOU REACH ANYWAY.

         Without this the run is unwinnable in three cases out of five. The
         culprit is drawn at random, and when it is one of the three who hold a
         wagon part you have to take that part to finish — which marks you,
         which loses it again in the night, forever. The whitethorn is what
         makes the reach survivable, and this is the only moment in J where
         something you found by searching decides an ending. */
      { say: 'I know what you are. Hand it over.',
        if: (S, m) => !!m.part && !S.parts.includes(m.part) &&
                      S.suspect[m.id] && S.stakes > 0,
        do: (S, m) => { S.stakes--; takePart(S, m, false); },
        to: 'tookknowing' },

      { say: 'Take it.',
        if: (S, m) => verified(S, m.id) || isThing(S, m),
        /* Taking something out of a hand you have not checked is the losing
           move, and the game does not say so. It marks you, and the night does
           the rest. */
        do: (S, m) => takePart(S, m, !verified(S, m.id) && isThing(S, m)),
        to: 'took' },
      { say: 'Then tell me who to ask about you.',
        if: (S, m) => !verified(S, m.id) && !isThing(S, m),
        do: (S, m) => {
          /* Who in the ring holds this one's memory — so being refused still
             moves you forward instead of leaving you stuck. */
          const holder = MASKS.find(x => x.knows === m.id);
          if (holder) S.pointed[m.id] = holder.id;
        },
        to: 'pointed' },
      { say: 'Not yet.', to: 'root' },
    ],
  },

  pointed: {
    text: (S, m) => {
      const holder = MASKS.find(x => x.knows === m.id);
      return holder
        ? `Ask ${holder.name}. We grew up in the same half-mile, all of us. Whatever ${holder.name} tells you about me will be true, and if you come back with it I will know you have been listening.`
        : 'There is nobody left who could tell you. That is my bad luck and yours.';
    },
    choices: [{ say: 'I will go and ask.', to: 'root' }],
  },

  tookknowing: {
    text: 'It stops. For about as long as it takes to breathe in, nothing behind that mask is pretending to be anybody, and then it is again. It puts the thing down at your feet rather than in your hand, and steps back from it, and watches the whitethorn instead of you.',
    choices: [{ say: 'Pick it up and go.', to: 'leave' }],
  },

  took: {
    text: (S, m) => verified(S, m.id)
      ? 'Go on then. Go before the light does.'
      : 'There. That was not so bad, was it.',
    choices: [{ say: 'Leave.', to: 'leave' }],
  },
};

const TALK = {
  thresher: SHARED, widow: SHARED, miller: SHARED, sexton: SHARED, boy: SHARED,
};
