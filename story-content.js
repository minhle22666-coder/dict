/* ============================================================
   FOCCI STORY — content data, Arc 1–4
   Flat file at repo root (same rule as every other Focci asset/script).

   SCHEMA per scene:
   { id, title, bg, mascot, props:[...], en, variantIf/variantEn (alt text
     when a flag matches "key=value"), comp:{q,options,correct},
     iq:{q,options:[{label,tag:'opt'|'ok'|'bad',delta,flag,note}]},
     dec:{q,pivot,options:[{label,delta,setFlags,item,requireItem,
       consumeItem,goto,outcome}]}, presence:[{text,weight}], hint }

   Stat keys in `delta`: COU CAR CLA AGE (shown to the user) and
   COLOR GREY WGT IQS (never shown anywhere — see story.js).

   Sealed twist flags keep the script's own ⟦D-xx⟧ tags verbatim as
   flags.flags['D-0x']=true. Their meaning is never interpreted here —
   that mirrors how the script itself keeps them sealed.

   EDITORIAL NOTE for MPT — two spots where the given script doesn't
   supply exact wording for a structurally-implied branch:
   1) Chapter 2, scene 2.2 option A ("the chapter shortens to 4 scenes") — the
      short bridging text at scene "2.2b" below is a placeholder stand-in
      Claude wrote to keep the branch playable; swap in your real line
      whenever you're ready (search this file for EDITORIAL to find it).
   2) The D6 "envelope text" callback names "Ch1.4" but the given Ch1.4
      ("The stream") has no envelope-writing beat, and scene 1.2 (which
      DOES hold the envelope) has no such interaction either. No
      envelope-text capture is wired up yet — the engine has a generic
      hook (state.flags.envelopeText) ready for it, it's just not attached
      to any scene until you point to the right one.
   ============================================================ */
(function(){

const ARCS = [
{ id:1, title:'The Field', bg:'bg-peaceful-field-arc-1',
  chapters:[

  { id:1, title:'Waking', mood:'BRIGHT',
    lifeLesson:"When you **don't remember who you are**, you start by **deciding what to do next**.",
    scenes:[
      { id:'1.1', title:"The sky is too big", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wander',
        props:['other-bag'], propsFront:['fg-tall-grass'] /* suggested extra asset — front-of-Focci depth, optional */,
        en:"Focci opened his eyes, and the **sky just felt way too big**. There was **no roof** over him and **not a single name** inside his head. Just grass stretching out until it stopped being green and blurred straight into the blue. A **red bandana** was tied around his neck, and his arms were bare to the breeze. Beside him lay a **canvas bag**, still holding a **faint trace of warmth**, like someone had been holding it just a minute ago. He **didn't remember lying down**. That was the first thing. The second was that he **wasn't scared at all**, and somehow, that bothered him a whole lot more.",
        comp:{ q:"What bothered Focci most?", options:["the size of the sky","that he wasn't frightened","the warm bag"], correct:1 },
        dec:{ q:"The bag is still warm. What should Focci do?", options:[
          { label:'Call out "Anyone there?"', delta:{COU:1}, outcome:"No one answers; a cicada stops singing, then sings louder." },
          { label:"Sit still and wait for them to come back", delta:{}, outcome:"He sits there until noon." },
          { label:"Pick up the bag and just go, no questions asked", delta:{AGE:1}, outcome:"He walks twenty steps, then turns back. He never admits he turned back." }
        ]},
        presence:[{ text:"Tap the dew on a blade of grass nearby — no reason at all." }],
      },
      { id:'1.2', title:"What's in the bag", bg:'bg-peaceful-field-arc-1', mascot:'mascot-compass',
        props:['other-hourglass','other-envelope','other-counter'],
        en:"An **hourglass**. Inside it, the **sand was trickling upward**. He flipped it over in his hand, but the grains **just kept climbing** toward the top bulb. There was an **envelope** too—plain white, sealed shut, with **no address or name** anywhere on it. It **weighed practically nothing**. Lastly, a small **brass counter machine** with a dial and a little glass window. The window showed a single number, and that **number was 0**.",
        iq:{ q:"The hourglass runs backward. What's the most sensible way to check it?", options:[
          { label:"Shake it hard", tag:'bad', delta:{IQS:-1}, note:"The sand just bunches into a corner — tells you nothing." },
          { label:"Set it on flat ground and look closely at the glass seam", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, flag:'D-01', note:"Optimal." },
          { label:"Ask the first person you meet", tag:'accept', delta:{}, note:"Acceptable." }
        ]},
        presence:[{ text:"Tap the worn strap — worn the way years of carrying wears a strap, not the way a new bag looks." }],
      },
      { id:'1.3', title:"The road with two ends", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wander',
        props:['other-path-map'],
        en:"There was a path. Not a paved road—just a **worn trail**, the kind that shows up when **enough wandering feet** happen to choose the **exact same line** through the grass. It stretched out behind him and ran ahead of him, and he couldn't tell **which end was the start**. He looked at the grass on either side for a clue, but the **grass had no opinion** on the matter.",
        dec:{ q:"Which way to go?", options:[
          { label:"The more worn direction — the one more feet have chosen", delta:{}, outcome:"" },
          { label:"The less worn direction — you'd have to part the grass yourself", delta:{COU:1}, outcome:"" },
          { label:"Sit down, draw an arrow in the dirt, then follow the arrow you just drew", delta:{AGE:1}, setFlags:{arrow:true}, outcome:"" }
        ]},
        presence:[{ text:'Lie back and watch one cloud cross the whole sky ("Watch it" — nothing happens).' }],
      },
      { id:'1.4', title:"The stream", bg:'bg-peaceful-field-arc-1', mascot:'mascot-chilling',
        props:['other-river-landscape'],
        en:"The stream was **far too small** to have an actual name. It was barely the width of his arm, trickling with a muted sound like **someone deciding to bite their tongue**. He knelt down and took a drink. The water was **cold enough to hurt**, which **felt remarkably honest**. Over on the far bank, wedged halfway in the mud, **something pale** caught the light.",
        comp:{ q:'Why does the story say the water "felt honest"?', options:["it was clean","it hurt, and the hurt was real","it tasted of nothing"], correct:1 },
        presence:[{ text:"Dip a foot in the stream, for no reason at all." }],
      },
      { id:'1.5', title:"The postcard", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wow',
        props:['other-lantern-card','other-lantern-card-flip'],
        en:'It was an old postcard. The front showed a **lantern hanging from a wooden post**, with text printed below: *THE KEEPER\'S STATION — 400 MILES.* On the back, written in **glowing blue ink** that faintly shone even in daylight, was a single line: *"If you found this, you\'re **already further than I got**."* **No signature**. Just a small, clean tear in one corner, notched out in the **shape of a bird\'s beak**.',
        iq:{ q:"Who left the postcard here?", options:[
          { label:"It drifted here on the stream", tag:'bad', delta:{}, note:"Not quite." },
          { label:"Someone dropped it in passing", tag:'bad', delta:{}, note:"Not quite." },
          { label:"Someone placed it somewhere easy to see — face-up, clean of mud", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, flag:'D-02', note:"Optimal." }
        ]},
        dec:{ q:"What to do with the postcard?", options:[
          { label:"Pocket it, keep it as his own", delta:{}, outcome:"" },
          { label:"Set it back in the mud for whoever comes next, and just copy the line into the sand", delta:{CAR:1}, outcome:"" },
          { label:"Turn it over and over looking for more clues before deciding", delta:{CLA:1}, outcome:"" }
        ]},
      },
      { id:'1.6', title:"The number moved", bg:'bg-peaceful-field-arc-1', mascot:'mascot-compass',
        props:['other-counter-machine'],
        en:"He pulled the little brass counter back out. The display **didn't say 0 anymore**. It showed a number, and that number **matched the exact count** of **new things he had learned to name** today. Focci didn't find this weird at all, mostly because nobody had told him yet that **machines weren't supposed to work that way**.",
        counterScene:true,
        presence:[{ text:"Shake the little machine for fun, three times." }],
        hint:"Someone was here before you, and they didn't finish.",
      },
    ]},

  { id:2, title:"Seventeen Years of Singing", mood:'BRIGHT',
    lifeLesson:"The work **nobody pays you for**, and **nobody sees**, might still be the **most important thing** you do all day.",
    scenes:[
      { id:'2.1', title:"The noise", bg:'bg-peaceful-field-arc-1', mascot:'mascot-chilling',
        props:['other-cicada-1','other-tree-trunk'],
        en:'The racket kicked off around noon and **just wouldn\'t quit**. It was buzzing out from a **single dry weed** by the trail, **way too loud** for the size of whatever was making it. Focci circled the stalk three times before he finally spotted it: a **dusty brown cicada**, wings looking like **smudge-stained glass**. "You\'re awfully loud," Focci said. "Got to be," said the cicada. "**Today\'s pretty much all I get**."',
        comp:{ q:"Why must Sil be loud?", options:["he is angry","he has only one day left","the field is noisy"], correct:1 },
      },
      { id:'2.2', title:"Seventeen", bg:'bg-peaceful-field-arc-1', mascot:'mascot-meditate',
        props:['other-tree-trunk'],
        en:'"**Seventeen years underground**," Sil said. "Crawled out four days back. We only get **about a week up here** in the light. So—today\'s it." "What do you even do with a week?" "**You sing**." He said it plainly, like it was the most obvious thing in the world. "You sing your heart out and **wait for someone to sing back**." Focci looked out over the empty grass. "Has anyone sung back?" Sil **just went right on buzzing**. That was the **whole answer**.',
        dec:{ q:"The sun is still high. The road is still long. This cicada will be dead before morning.", options:[
          { label:"Walk on — this isn't his problem", delta:{}, setFlags:{arc1LeftSil:true}, goto:'2.2b', outcome:"" },
          { label:"Stay until nightfall", delta:{CAR:1}, setFlags:{arc1StayedNight:true}, outcome:"" },
          { label:"Stay, but keep glancing at the road", delta:{CAR:1}, setFlags:{arc1StayedNight:true,arc1Glanced:true}, outcome:"Sil notices. Sil doesn't say anything about it until later." }
        ]},
        presence:[{ text:"Actually sit down (not just \"stand and talk\")." }],
      },
      /* EDITORIAL placeholder — see file header note 1 */
      { id:'2.2b', title:"Down the road", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wander',
        onlyIf:'arc1LeftSil=true',
        en:"Focci kept walking, and the singing got smaller behind him until the field swallowed it whole. He told himself it wasn't his to carry. [Editorial placeholder — MPT to replace with the real short wrap-up line for this branch.]",
        gotoChapter:3,
      },
      { id:'2.3', title:"Sing it wrong", bg:'bg-peaceful-field-arc-1', mascot:'mascot-chilling',
        onlyIf:'arc1LeftSil!=true',
        props:['other-tree-trunk'],
        en:'"Try singing something else," Focci suggested. "You\'ve run through that **same tune about nine times** now." "**It isn\'t for you**." "Then who\'s it for?" "**Whoever\'s still out there**." A quiet beat. "You want to try singing back? You\'ll probably butcher it." "I definitely will," Focci said. "**Do it anyway**," said Sil.',
        dec:{ q:"", options:[
          { label:"Sing it. Completely wrong. Terrible.", delta:{COU:1}, outcome:'Sil: "That was terrible. Do it again."' },
          { label:"Don't sing — just listen", delta:{CAR:1}, outcome:"Sil sings a little softer, now that someone's listening." },
          { label:"Go find another cicada for Sil", delta:{COU:1}, outcome:"Two hours of searching, not one, comes back empty-handed." }
        ]},
      },
      { id:'2.4', title:"The caravan", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wander',
        onlyIf:'arc1LeftSil!=true',
        props:['other-wagon','other-badger'],
        en:'Late in the afternoon, a **string of six wagons** rumbled up the dirt road, **lanterns already swinging** against a bruised evening sky to the north. A badger riding the tail of the last cart called out: "Station road! **Got room for one more!**" Focci got to his feet. Beside him, **Sil never missed a single beat**.',
        dec:{ q:"", options:[
          { label:"Climb aboard. Go.", delta:{AGE:1}, setFlags:{arc1CaravanLeft:true}, goto:'2.7', outcome:"Reaches Arc 2 faster, with water and company — never finds out when Sil dies." },
          { label:"Let the cart go", delta:{CAR:1}, outcome:"Loses the ride, has to walk into the desert." },
          { label:"Ask the badger if the cicada can come too", delta:{CAR:1}, outcome:'"It\'s a bug, kid." The cart leaves. Focci stays, because he already asked.' }
        ]},
      },
      { id:'2.5', title:"The hours that don't count", bg:'bg-peaceful-field-arc-1', mascot:'mascot-meditate',
        onlyIf:'arc1LeftSil!=true',
        props:['other-beetle'],
        en:"For **four straight hours**, **nothing really happened**. Sil sang. Focci watched the golden light stretch and fade across the grass. A little beetle crawled over his foot, and he **just let it go on its way**. He memorized the shapes of three clouds and **promptly forgot two of them**. This is the exact stretch of a story that **most stories would just skip over**.",
        comp:{ q:"Why would a story normally skip this part?", options:["it is unimportant","nothing dramatic happens, but it still matters","Focci slept"], correct:1 },
        waitScene:3,
        presence:[{ text:"Let the beetle finish crossing his foot instead of brushing it off." }],
      },
      { id:'2.6', title:"What Sil actually wanted", bg:'bg-peaceful-field-arc-1', mascot:'mascot-cry',
        onlyIf:'arc1LeftSil!=true',
        props:['other-moon-clouds'],
        en:'"If nobody ever answers your song... what was the point of **seventeen years** in the dark?" "You think I spent seventeen years **just waiting around**?" "Didn\'t you?" "I spent seventeen years eating roots in the dirt and growing up. **That wasn\'t waiting, kid. That was the whole work**." Sil paused. "**Singing is just the tail end of it**. People always think the last part is the whole point."',
        variantIf:'arc1Glanced=true',
        variantEn:'"You\'ve had **one eye on that road** all evening." "I haven\'t." "It\'s fine. Most folks who stay **only ever stay halfway**." Sil droned two more notes. "**Halfway is still better than not at all**."',
        dec:{ q:"", options:[
          { label:'"Then I\'ve been doing the last part first."', delta:{CLA:1}, outcome:"" },
          { label:'"That\'s a sad way to look at it."', delta:{}, outcome:'Sil: "It\'s the only way that doesn\'t cost anything."' },
          { label:"Say nothing. Sit still until dark.", delta:{}, outcome:"" }
        ]},
        presence:[{ text:'Tell the truth about himself when Sil asks "What are you looking for?" (the dodge, more gracefully put: "Trouble, mostly.")' }],
      },
      { id:'2.7', title:"Morning", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wow',
        props:['other-cicada-2','other-tree-trunk'],
        en:"He woke up to **dead silence** in the field. The **stalk was bare**. Resting at its base was an **amber shell**—a delicate, **translucent cast of Sil**, split clean down the spine, still **holding the shape** of something that had moved on. Focci picked it up. It **weighed nothing at all**, just like the envelope.",
        variantIf:'arc1StayedNight=true',
        variantEn:'And right beneath that shell, pressed flat into the dewy grass, lay a **second postcard**. Older. Written in that same handwriting, with one extra line: "**I turned back at the pines. Don\'t.**"',
        variantFlag:'D-03',
        dec:{ q:"What to do with the shell?", options:[
          { label:"Keep the shell in his bag", delta:{CAR:1}, item:'cicadaShell', outcome:"Item: Cicada Shell — used in Arc 12." },
          { label:"Set it back on the stalk, carefully upright", delta:{CAR:1}, setFlags:{'D-04':true}, outcome:"" },
          { label:"Bury it in the ground", delta:{CLA:1}, outcome:"" }
        ]},
        hint:"There were two of them. You only picked up one.",
      },
    ]},

  { id:3, title:"The Crow Who Was Already There", mood:'SHOCK',
    lifeLesson:"Someone **being kind to you** can also **need something from you** at the very same time. Both things can be real.",
    onEnterFlags:{'D-CH03':true},
    scenes:[
      { id:'3.1', title:"Something on the milestone", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wander', npc:'mascot-owen-blunt',
        props:['other-notebook'],
        en:'By the trail stood a waist-high stone marker, its carved numbers **mostly worn away**. The only digits left were a **4 and half of a 0**. Perched on top sat a **glossy black crow** with a **slightly crooked leg**, picking through a small stack of papers with the **cold focus of an accountant**. "**You\'re in my light**," the crow muttered, without looking up.',
      },
      { id:'3.2', title:"Owen", bg:'bg-peaceful-field-arc-1', mascot:'mascot-confused', npc:'mascot-owen-blunt',
        en:'"Owen," the crow said. "I\'d offer a shake, but." He lifted the crooked leg half an inch, then tapped it back down on the stone. "Where\'re you headed?" "The Keeper\'s Station." Owen\'s **head tilted**—a tiny, sharp twitch that was **gone in half a second**. "Course you are. Everybody is, this time of year." "Have you been there?" "I\'ve been **near it**," Owen said. "\'Near\' is a wide word. **Covers a whole lot of ground**."',
        comp:{ q:"What does Owen actually answer?", options:["yes, he has been there","no, never","he answers without answering"], correct:2 },
        iq:{ q:'Owen just heard "Keeper\'s Station" and tilted his head for half a second. What does that mean?', options:[
          { label:"He has no idea where that is", tag:'bad', delta:{IQS:-1}, note:"" },
          { label:"He knows it well, and is deciding how much to say", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Optimal." },
          { label:"His leg is just hurting", tag:'accept', delta:{}, note:"" }
        ]},
      },
      { id:'3.3', title:"The paper", bg:'bg-peaceful-field-arc-1', mascot:'mascot-challenge', npc:'mascot-owen-blunt',
        props:['other-notebook'],
        en:'The stack turned out to be letters. Not fresh ones—the paper was soft and **foxed at the edges**, some **still creased shut**. "Are those yours?" "**They\'re in my possession**," Owen replied. "That\'s a **deliberate choice of words**, kid." He held one up to the fading light, read a few lines, let out a dry sound like a **chuckle with the humor stripped out**, and slipped it into his satchel.',
        dec:{ q:"", options:[
          { label:'Ask outright: "Did you steal those?"', delta:{CLA:1}, outcome:'Owen: "Stole is loud. I intercept."' },
          { label:"Don't ask, not his business", delta:{}, outcome:"" },
          { label:"Ask to read one", delta:{}, outcome:"Owen hands over one already opened — not the one he was just reading." }
        ]},
        presence:[{ text:"Ask Owen why his leg is crooked — and hear the whole answer." }],
      },
      { id:'3.4', title:"Bread and quail", bg:'bg-peaceful-field-arc-1', mascot:'mascot-cry', npc:'mascot-owen-blunt',
        props:['other-bird-nest','other-bread-bag'],
        en:'A family of quail waddled by and politely asked where he was coming from. "**The station**," Focci said. The words **slipped out easily**, long before he had time to think about them. The quail looked impressed and shared a **crust of bread** with him. Focci chewed it slowly, feeling the **weight of the lie** sitting right beside the bread in his stomach. Perched on his milestone, **Owen watched the whole exchange and said nothing at all**, which somehow felt a whole lot worse.',
        dec:{ q:"", options:[
          { label:"Correct it right away, give back the bread", delta:{CLA:1,CAR:1}, outcome:"" },
          { label:"Stay quiet. Eat. Move on.", delta:{}, outcome:"" },
          { label:"Don't correct it, but leave the cicada shell for the kids", delta:{CAR:1}, requireItem:'cicadaShell', consumeItem:'cicadaShell', missingNote:"You don't have anything like that to give.", outcome:"" }
        ]},
        presence:[{ text:"Answer the smallest quail's odd little question: \"Do foxes have birthdays?\"" }],
      },
      { id:'3.5', title:"What Owen gives", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wow', npc:'mascot-owen-happy',
        onEnterFlags:{'D-05':true},
        props:['other-bag'],
        en:'At dusk, Owen swept down and dropped something heavy straight into Focci\'s pack mid-flight, barely slowing his wings. It was a **waterskin, filled to the brim**. "**The desert takes four days!**" he shouted back. "You\'d have figured that out the hard way by day two." "Why help me?" "Because I\'ll be seeing you down the road," Owen called out, "and it\'s terribly boring having a **chat with a corpse**."',
        dec:{ q:"", options:[
          { label:"Accept it, say thanks", delta:{}, item:'waterskinFull', outcome:"" },
          { label:'Accept it, but ask "What do you want?"', delta:{CLA:1}, item:'waterskinFull', outcome:'Owen: "Nothing **yet**."' },
          { label:"Refuse it, hand it back", delta:{AGE:1}, outcome:"" }
        ]},
        presence:[{ text:"Accept the gift instead of politely refusing it." }],
      },
      { id:'3.6', title:"The signpost", bg:'bg-peaceful-field-arc-1', mascot:'mascot-superhero',
        props:['other-signpost'],
        en:'At the edge of the field stood a weathered signpost with two arms. One read *KEEPER\'S STATION*, pointing straight at a **flat, pale haze on the horizon**—the desert, though none of the grit was obvious from here yet. The other arm had been **snapped off**. Its splintered stump pointed east toward a line of **low green hills**. The hills didn\'t look like a different destination so much as a **detour**—a slower, gentler way of arriving at that **exact same pale expanse**. Pinned to the wood was a waterlogged note with only three legible words left: *"...**not the only**..."*',
        dec:{ q:"", pivot:true, options:[
          { label:"Head into the desert, follow the signpost — straight in, no detour", delta:{COU:1}, setFlags:{arc1Pivot:'A'}, outcome:"Arc 2 opens with Focci already tired and thirsty." },
          { label:"Head for the green hills, look into the broken signpost arm first", delta:{AGE:2,CLA:1}, setFlags:{arc1Pivot:'B'}, outcome:"A day slower, but Arc 2 opens with Focci still rested, still carrying water." },
          { label:"Take the broken signpost arm with him, then go into the desert anyway", delta:{COU:1}, setFlags:{arc1Pivot:'C'}, item:'signpostArm', outcome:"Item: Broken Signpost Arm." }
        ]},
      },
    ]},
  ]},

{ id:2, title:'The Desert', bg:'bg-desert-and-cactus-arc-2',
  chapters:[

  { id:4, title:"Thirst", mood:'BRIGHT',
    lifeLesson:"Saying no can be its **own kind of kindness**.",
    scenes:[
      { id:'4.1', title:"Flat and Loud", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        props:['other-red-rocks'],
        en:"The desert **didn't wait around** for him to catch his breath. His throat was already parched from the walk in, and that **first freezing night** made everything worse. The desert wasn't quiet, either. It **ticked constantly**—stones snapping and cracking through the dark as the cold shrank them, like a **timer counting down** from a number nobody had bothered to tell Focci. He lay on his back, trying to guess which rock would pop next. He was **wrong four times** before he quit guessing and just listened.",
        variantIf:'arc1Pivot=B',
        variantEn:"The green hills had **bought him one extra day** of easy walking, and he still had most of a **full waterskin** to prove it. On the back slope of the ridge, he'd spotted an old fence post with the **exact same handwriting** from the sign—someone else had wandered this way before, wondering about that broken signpost too. Still, when the desert finally took over, it **made that same ticking sound**—stones cooling and cracking through the night, ticking down from a number nobody had told him.",
        comp:{ q:"Why does the desert make cracking sounds at night?", options:["animals moving between rocks","stones that heated up all day contract sharply as the night cools them, and crack","the desert is collapsing"], correct:1 },
        dec:{ q:"First night in the desert — where to sleep?", options:[
          { label:"Sleep out in the open sand, exposed", delta:{COU:1}, outcome:"" },
          { label:"Sleep against a big rock, out of the wind", delta:{}, outcome:"" },
          { label:"Climb a rise to look around before settling down", delta:{CLA:1}, outcome:"" }
        ]},
        presence:[{ text:"Tap the cracking-stone sound, listen for the full 10 seconds." }],
      },
      { id:'4.2', title:"Two Cacti", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-challenge',
        props:['other-cactus'],
        en:"Two types of cactus grew along this stretch of the flats, and the **difference mattered a whole lot**. The first grew low in tight pairs, carrying **thick, blunt thorns**; a little brown finch was working one over, **completely unbothered**, pulling out **wet pulp**. The second grew solitary and tall, bristling with **needles like clear glass** catching the sun—and **nothing, not the finch, not even the ants**, went anywhere near it.",
        comp:{ q:"What is the finch doing to the first cactus?", options:["attacking it","feeding on moisture inside it, safely","building a nest"], correct:1 },
        iq:{ q:"Focci finds another cactus, growing alone, but an ant is crawling right up it without avoiding it at all. What kind is this?", options:[
          { label:"Must be the poisonous kind, since it grows alone like the second one did", tag:'bad', delta:{IQS:-1}, note:"Wrong — ignores the ant clue." },
          { label:"The water-bearing kind — because the most reliable sign is how other creatures behave around it", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Optimal." },
          { label:"Can't be sure — steer clear to be safe", tag:'accept', delta:{}, note:"Safe, but no water." }
        ]},
        presence:[{ text:"Sit and watch the bird pecking at the cactus a little longer." }],
      },
      { id:'4.3', title:"Smoke on the hill", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-challenge',
        props:['other-sand-dunes','other-smoke'],
        en:"Two shapes caught Focci's eye at once: a **dry riverbed** curving off to his left, cracked into a mosaic of pale mud plates, and—way out over a low ridge to the right—a **thin thread of grey smoke**. Riverbeds were supposed to lead to water; that was the whole point. But this trench was **caked in a pale crust** that caught the light like **salt**, not like a place that had seen fresh water anytime recently.",
        comp:{ q:"What does the crust on the riverbed suggest?", options:["water passed here very recently","the riverbed likely leads to a dry salt lake, not fresh water","nothing — it's just sand"], correct:1 },
        iq:{ q:"Follow the dry riverbed, or climb the hill to check the smoke?", options:[
          { label:"Follow the riverbed", tag:'bad', delta:{IQS:-1}, note:"Leads to a dead salt lake, no water, half a day lost." },
          { label:"Climb the hill and look at the smoke before deciding", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Optimal." },
          { label:"Wait until evening, when it's cooler, before deciding", tag:'accept', delta:{}, note:"Safe, but loses the whole afternoon." }
        ]},
      },
      { id:'4.4', title:"Bones", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-wow',
        props:['other-skeleton'],
        en:"The skeleton was massive, **bleached bone-white** after years under the sun—and **clearly arranged**. It wasn't scattered the way bones fall when an animal simply drops where it dies; it was **laid out, rib by rib**, with the **skull facing east**, like someone setting a table. Somebody had done this deliberately a long time ago, and had **never come back** to see if it still looked the way they'd left it.",
        comp:{ q:"What does the arrangement of the bones suggest?", options:["the animal died naturally in this position","someone deliberately arranged the bones, likely as a mark of respect","scavengers arranged them by accident"], correct:1 },
        dec:{ q:"", options:[
          { label:"Straighten a few bones that had shifted, tidy it up", delta:{CAR:1}, outcome:"" },
          { label:"Take a bone to use as a walking stick", delta:{}, outcome:"" },
          { label:"Leave it exactly as it is, don't touch anything", delta:{}, outcome:"" }
        ]},
        presence:[{ text:"Straighten the skeleton neatly, even though no one will ever see it." }],
      },
      { id:'4.5', title:"Closer to the smoke", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        props:['other-bucket','other-smoke'],
        en:"The smoke rose steadily from behind a low outcrop—**calm and rhythmic**, not the panicked plume of something burning down. On the hot breeze, Focci could hear the faint, unmistakable **clink of a bucket tapping against stone**.",
        dec:{ q:"", options:[
          { label:"Walk straight up, call out before getting close", delta:{COU:1}, outcome:"Arrives fast, but Vask is already on guard." },
          { label:"Circle around, watch from a distance before showing himself", delta:{CLA:1}, outcome:"Arrives slower, but sees Vask sharing water with a child." },
          { label:"Call out from a distance, wait for a response before approaching", delta:{}, outcome:"Safe, neutral." }
        ]},
      },
      { id:'4.6', title:"The well", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        props:['other-well','other-vulture-arc2'],
        en:'The well was built from heavy stone, its low circular rim **worn smooth by generations of forearms** leaning against it the exact same way. An **old vulture** sat perched on the wall, wings tucked tight, watching Focci approach with the **calm certainty** of someone who already knew how this conversation was going to go. "Water," Focci croaked, trying his best to sound polite rather than demanding. The vulture didn\'t budge. "**Manners first**," she said. "**Then water. Maybe.**"',
        dec:{ q:"", options:[
          { label:"Greet her politely first, no rush to ask for water", delta:{CAR:1}, outcome:"" },
          { label:"Ask for water right away, explain how thirsty he is", delta:{CLA:1}, outcome:"" },
          { label:"Offer to do some work in exchange for water", delta:{AGE:1}, outcome:"" }
        ]},
        presence:[{ text:"Greet her kindly before asking for water, no rush." }],
        hint:"Water is not the hardest thing to find out here.",
      },
    ]},

  { id:5, title:"The Well That Says No", mood:'SHOCK',
    lifeLesson:"**Fairness and kindness** don't always walk down the same road.",
    scenes:[
      { id:'5.1', title:"No", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-frozen-in-shock',
        en:'"**No**," Vask said. "I have coins," Focci pressed. "I know. **Still no**." "I\'ll work for it." "**There\'s no work out here that pays in water**," she said. "There\'s one well, **forty families** living behind that ridge, and barely **nine weeks of water left** if nobody gets greedy." She still hadn\'t blinked once. "**And you aren\'t one of the forty.**"',
        comp:{ q:"Why does Vask refuse Focci water?", options:["she doesn't like foxes","the well has limited water and she's protecting it for forty dependent families","she wants more money"], correct:1 },
      },
      { id:'5.2', title:"The maths of nine weeks", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-confused',
        props:['other-notebook'],
        en:'"Nine weeks doesn\'t sound like much," Focci said. "It isn\'t. And that\'s what\'s left after I **already cut every family\'s share twice** this season." Vask shifted slightly, gesturing with one wing toward a **thick, water-stained ledger** resting on the stone ledge beside her. "You want to lecture me on fairness, **go through the book first**. Then we\'ll argue."',
        dec:{ q:"", options:[
          { label:"Ask to see the ledger right away", delta:{CLA:1}, outcome:"" },
          { label:"Don't look — trust Vask's word, go find water elsewhere", delta:{AGE:1}, outcome:"" },
          { label:"Ask Vask whether she's cut her own share yet", delta:{CLA:1}, outcome:"" }
        ]},
      },
      { id:'5.3', title:"The ledger", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-challenge',
        props:['other-notebook'],
        en:"The ledger listed forty households using **symbols instead of names**—a hoofprint, a leaf, a spiral—alongside tidy rows of dates and hashmarks. Nearly all rows showed regular draws. But one entry near the middle showed a **final draw from months ago**, with a single, steady line **inked straight through the row**. Not scratched out in anger, not erased—just **struck through cleanly once**. Right underneath, written in tiny, neat script: **still allotted**.",
        comp:{ q:'What does "still allotted" written under the crossed-out row mean?', options:["that household's water ration was cancelled","that household still has water set aside for them, despite the row being marked","it's a warning label"], correct:1 },
        iq:{ q:'The crossed-out row shows a draw from long ago, but underneath it reads "still allotted." What does Vask do with that water every day?', options:[
          { label:"She keeps it aside for herself", tag:'bad', delta:{IQS:-1}, note:"Doesn't match — she says she cut her own share first." },
          { label:"She sells that share to another family for money", tag:'bad', delta:{IQS:-1}, note:"Doesn't match — she refused Focci's money too." },
          { label:"She still draws that exact share every day and pours it straight back into the well, unused by anyone", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, flag:'D-06', note:"Optimal." }
        ]},
        presence:[{ text:"Ask Vask what animal the crossed-out family is, and hear the whole answer." }],
      },
      { id:'5.4', title:"What Focci is offered", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        props:['other-bucket'],
        en:'"You can\'t have well water," Vask said, snapping the ledger shut. "Though you\'re hardly the first thirsty thing to drag yourself over that ridge, and **I\'m not carved from flint**, whatever you might think." She nodded toward a small wooden barrel resting in the shade. "**Rain barrel. Doesn\'t belong to the well.** I can spare you a cup of that."',
        dec:{ q:"", options:[
          { label:"Take exactly one cup, say thanks, ask for no more", delta:{CAR:1}, outcome:"" },
          { label:"Take extra when Vask turns away", delta:{WGT:1}, outcome:"" },
          { label:"Offer to stay an hour and help stir the filter sand, in exchange for a fuller cup", delta:{AGE:1,CAR:1}, outcome:"" }
        ]},
      },
      { id:'5.5', title:"What's lying in the channel", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-confused',
        en:'As Focci shouldered his pack to leave, Vask spoke up again, almost like a passing thought she **wasn\'t sure was her place to share**. "There\'s **something massive stuck down in the old wash**, an hour east of here. Alive, two days back when I last caught wind of it. Nobody\'s gone to check since." She paused. "**Not my problem. Might be yours.**"',
        comp:{ q:"What does Vask tell Focci before he leaves?", options:["there's danger to the west","something large and alive is stuck in the dry river channel to the east","the well will run dry tomorrow"], correct:1 },
      },
      { id:'5.6', title:"Leaving the well", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-wander',
        props:['other-well'],
        en:"Focci looked back once. Vask had already settled back onto her stony perch, **unmoved and steady**, the worn ledger **tucked securely under her wing**.",
        presence:[{ text:"Say a real thank-you before leaving, not just out of politeness." }],
        hint:"Something is lying in the old river channel and it is still breathing.",
      },
    ]},

  { id:6, title:"The Long Drag", mood:'DARK',
    lifeLesson:"You never know enough to **calculate the full weight** of the help you offer.",
    scenes:[
      { id:'6.1', title:"Ghar", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-scared',
        props:['other-crocodile-1'],
        en:'The crocodile was lying flat across a river channel that had dried up three months ago. His thick hide had **cracked into a dry map** of a place nobody wanted to visit. "**You could roll me**," he said, his voice flat and calm. "**Six kilometers. Mostly downhill.**" "You could also just eat me." "I could," the crocodile agreed. "Rather not, though. **I\'ve stayed honest this far**, hate to spoil my record now."',
        comp:{ q:"What has happened to Ghar?", options:["he's sleeping","he's stranded in a dried-up river channel, six kilometres from water","he's guarding treasure"], correct:1 },
      },
      { id:'6.2', title:"What Ghar's name means", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-chilling',
        props:['other-crocodile-1'],
        en:'"Ghar," he rasped when asked. "Means \'**late arrival**,\' more or less, in the old tongue. My mother had a bit of a dry sense of humor about when I showed up. **Born three weeks later** than anyone planned." A rough, dry rumble came from his throat—what might have passed for a chuckle. "**Story of my whole life**, apparently."',
        presence:[{ text:"Ask Ghar's name and hear the whole story behind it." }],
      },
      { id:'6.3', title:"The maths", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-challenge',
        props:['other-rope','other-sand-dunes'],
        en:"Focci weighed maybe **six kilos**, soaking wet. Ghar was pushing closer to a **hundred and twenty**. Between where they stood and the nearest flowing water lay **six long kilometers** of soft sand, a gentle downhill grade, and barely half a waterskin. But the desert floor gave away a clue: **long, low ripples** running in **one consistent direction**, carved out by a steady prevailing wind.",
        comp:{ q:"What do the consistent ripples in the sand indicate?", options:["recent rain","a wind that has blown steadily in one direction for a long time, shaping the sand's texture","buried treasure"], correct:1 },
        iq:{ q:"The most effective way to move Ghar, based on what the desert itself is showing right now?", options:[
          { label:"Wrap a rope around him and haul straight along the shortest line", tag:'bad', delta:{IQS:-1}, note:"Cuts across the sand ripples, huge friction, wrecks a shoulder, costs an extra day." },
          { label:"Roll Ghar along his long axis, following the direction of the sand ripples, resting every 200 meters", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Optimal." },
          { label:"Wait for rain to soften the sand", tag:'bad', delta:{IQS:-1}, note:"No sign of rain anywhere." }
        ]},
      },
      { id:'6.4', title:"Day one of three", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        en:'They managed barely a single kilometer before the daylight gave out. Ghar talked the entire afternoon without prompting, reminiscing about a **massive flood from decades back**, when the wash ran deep for an entire season and he\'d eaten better than anytime since. "**Best year of my life**," he muttered. "Water everywhere. Frogs everywhere. Then the water dropped, the way everything eventually does out here, and **I was just too slow to notice until I was the only fool left**."',
        presence:[{ text:"Rest a little longer partway, even though he could still push on in the dark." }],
      },
      { id:'6.5', title:"Day two of three", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        en:'"Do you regret staying behind?" Focci asked on the second grueling day, sand grinding into every joint in his body. "Every crocodile regrets something. Mine\'s smaller than most," Ghar mused quietly. "I just regret not packing up the **day the water dipped below my knees**. I kept telling myself it\'d come back tomorrow. **It came back for everyone else, just not for me.**"',
        comp:{ q:"What does Ghar regret?", options:["eating too much during the flood","not leaving the channel while he still could, when the water first started dropping","being born late"], correct:1 },
      },
      { id:'6.6', title:"Day three: the last of the water", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        en:'The waterskin **ran bone dry** with roughly two kilometers left to go. Focci held out the **very last swallow to Ghar** without really thinking about it—just one of those instinctive gestures you make before your brain has time to weigh the reasons. "You didn\'t have to do that," Ghar said softly. "**I know.**"',
        presence:[{ text:"Share the last of the water with Ghar." }],
      },
      { id:'6.7', title:"DEC", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-superhero',
        en:"The river was right there now, close enough to smell—a **cool, mineral, leafy freshness** that Focci hadn't realized he'd missed until it reached him. That **final stretch was the most brutal part**, and whether they finished it was entirely up to the choice he made right now.",
        dec:{ q:"", pivot:true, options:[
          { label:"Pull him all the way to the river. Ghar lives.", delta:{CAR:3,COU:2}, outcome:"" },
          { label:"Stop pulling. Sit with Ghar until dark, then leave, letting Ghar decide the rest", delta:{CLA:2,CAR:1}, outcome:"" },
          { label:"Pull him halfway, then stop — too exhausted to go on", delta:{WGT:2}, outcome:"" }
        ]},
      },
      { id:'6.8', title:"After", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-cry',
        onEnterFlags:{'D-07':true},
        props:['other-footprints'],
        en:"Whatever happened down by the water, the **desert didn't offer an opinion** on it. The sand simply drifted back over their trail, **cool and indifferent**, waiting for the next thing trying to cross. Down along the damp mud of the riverbank, a **single set of small, fresh footprints** led away, heading in the exact direction Focci was about to walk.",
        gotoChapter:7,
      },
    ]},
  ]},

{ id:3, title:'The Forest', bg:'bg-forest-mountain-arc-3',
  chapters:[

  { id:7, title:"Green Everything", mood:'BRIGHT',
    lifeLesson:"**Being lost** is never as dangerous as **pretending you aren't**.",
    scenes:[
      { id:'7.1', title:"In", bg:'bg-forest-mountain-arc-3', mascot:'mascot-wander',
        props:['other-droplet','other-fern'], propsFront:['fg-mist-layer'] /* suggested extra asset, optional */,
        en:"The forest didn't have a front gate, exactly, but it had a distinct threshold—**one single step where the lighting completely shifted**. Suddenly the sky was **just a rumor**, glimpsed through tiny breaks in the leaves that snapped shut the second Focci looked away. Stray drops of cold water fell from high above at random intervals, tapping against broad leaves, clicking on stone, and once **landing square on the tip of his nose**.",
        comp:{ q:"How does the story describe entering the forest?", options:["through a clear, marked doorway","as a single moment where the light abruptly changes, without an obvious threshold","gradually, over several hours"], correct:1 },
        presence:[{ text:"Tap the water drop falling from a leaf onto his nose." }],
      },
      { id:'7.2', title:"No Landmarks", bg:'bg-forest-mountain-arc-3', mascot:'mascot-compass',
        props:['other-rock-formation','other-vine'],
        en:"Focci walked for what felt like hours with clear intent, only to end up right back in front of a **mossy boulder** he could swear he'd already passed—a rock split by a **jagged crack shaped like a bolt of lightning**. The dense canopy blocked any direct view of the sun. But **thick moss clung heavily to one side** of most tree trunks, and the **ground sloped gently but steadily** in a single direction—the same way the stream he crossed at dawn had been flowing away from.",
        iq:{ q:"No sun visible, no clear landmark. What's the most reliable way to find direction here?", options:[
          { label:"Go by feel, just walk straight on instinct", tag:'bad', delta:{IQS:-1}, note:"The exact method that already sent him in a circle twice." },
          { label:"Combine the direction moss grows thicker on the trunks AND the slope of the ground, if both agree, follow that direction", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Optimal." },
          { label:"Follow the slope uphill, since a mountain is usually the easiest landmark", tag:'accept', delta:{}, note:"Not wrong, but slower, has to climb." }
        ]},
        comp:{ q:"What two independent natural signs does Focci use to find direction?", options:["the sun and stars","moss growth pattern on tree trunks, and the slope of the ground relative to the stream","footprints and smoke"], correct:1 },
      },
      { id:'7.3', title:"The Counter Has a Name", bg:'bg-forest-mountain-arc-3', mascot:'mascot-wow',
        props:['other-chameleon','other-counter-machine'],
        en:'A small gecko hung upside down from a low bough, completely untroubled by the posture, eyeing the brass contraption in Focci\'s pack with sharp curiosity. "**Lexicon counter**," it chimed in. "Haven\'t seen one of those since the old survey routes were running. Old scouts carried them—they **tally the things you can actually put a name to**, not just what you happen to glance at."',
        comp:{ q:"What did explorers use the lexicon counter for, according to Odd?", options:["counting distance travelled","counting how many things they could actually name, not just see","telling time"], correct:1 },
        counterScene:true,
        presence:[{ text:"Ask Odd why he hangs upside down, and hear the whole answer." }],
      },
      { id:'7.4', title:"Admitting It", bg:'bg-forest-mountain-arc-3', mascot:'mascot-confused',
        en:'"**You\'re turned around**," Odd said. It wasn\'t framed as a question. Focci opened his mouth to brush it off, out of some stubborn reflex he hadn\'t fully examined, and then stopped himself. "Yeah," he admitted instead. "**I\'m lost.**" The words rolled off his tongue a whole lot easier than he thought they would, and that in itself felt **worth noticing**.',
        dec:{ q:'How to say the truth out loud ("I am lost")', options:[
          { label:'Say it plainly: "Yes. I am lost."', delta:{CLA:1}, outcome:"" },
          { label:'Joke it off: "Lost, or exploring aggressively."', delta:{}, outcome:"" },
          { label:"Don't say it out loud — just nod", delta:{}, outcome:"" }
        ]},
        presence:[{ text:'Say "I am lost" plainly, without dodging behind a joke.' }],
      },
      { id:'7.5', title:"Fireflies at Noon", bg:'bg-forest-mountain-arc-3', mascot:'mascot-chilling',
        props:['other-fireflies'],
        en:"A patch of the damp forest floor gave off a **soft, eerie glow** right in the middle of the day—a cluster of **fireflies fast asleep** beneath a fallen leaf. It was rare enough to see at noon that even Odd paused his chatter to watch the glow.",
        presence:[{ text:"Sit and watch the daytime-sleeping fireflies for 30 seconds, say nothing.", wait:30 }],
      },
      { id:'7.6', title:"The Marks", bg:'bg-forest-mountain-arc-3', mascot:'mascot-wow',
        props:['other-caved-tree-trunk'],
        en:"Carved deep into the bark of an ancient tree was a set of symbols—neither casual doodles nor graffiti, but notches laid out with the **deliberate spacing of a functional system**. **Eight marks in total**, evenly placed, clearly **meant to be read and understood** rather than admired.",
        comp:{ q:"What suggests the marks are a system rather than decoration?", options:["they are colourful","they are evenly spaced with deliberate intent, meant to be read","they are very old"], correct:1 },
        hint:"Someone built a whole language into this bark, a long time before you got lost in front of it.",
      },
    ]},

  { id:8, title:"What Odd Sells", mood:'BRIGHT',
    lifeLesson:"**Every shortcut has a price**, and the cost is rarely written on the sign.",
    scenes:[
      { id:'8.1', title:"Odd's stall", bg:'bg-forest-mountain-arc-3', mascot:'mascot-chilling',
        props:['other-parchment'],
        en:"Odd had managed to put together an actual shop stall out here—three scrap planks balanced across two tree stumps, topped with a **hand-painted wooden sign** crammed with **far more text than it had room for**.",
      },
      { id:'8.2', title:"The price list", bg:'bg-forest-mountain-arc-3', mascot:'mascot-challenge',
        props:['other-parchment'],
        en:'Odd traded in directions, and his prices were strange and strictly non-negotiable: *One shortcut = **one honest truth about yourself**.* *One map = **one possession you\'d genuinely hate to lose**.* *One warning = **completely free, but you have to sit through the whole thing**.* "Why charge like that?" Focci asked. "Because advice is only worth what it costs you to get it," Odd said. "**Free advice, folks ignore. Advice that stings a little, they remember every word.**"',
        comp:{ q:"Why does Odd charge unusual prices instead of money?", options:["he doesn't understand money","he believes advice is only valued if it costs the listener something meaningful","he's testing Focci's honesty"], correct:1 },
        dec:{ q:"", options:[
          { label:"Buy the shortcut, tell one true thing about himself", delta:{CLA:1,COU:1}, outcome:"" },
          { label:"Buy the map, lose the cicada shell", delta:{COU:1}, requireItem:'cicadaShell', consumeItem:'cicadaShell', missingNote:"Then you've got nothing sad enough to trade. Try the warning instead.", outcome:"" },
          { label:"Take the free warning, hear all of it, no skipping", delta:{CLA:1}, setFlags:{'arc3Warning':true}, outcome:"" }
        ]},
        presence:[{ text:"Tell one true thing about himself (if he buys the shortcut)." }],
      },
      { id:'8.3', title:"The warning, if taken", bg:'bg-forest-mountain-arc-3', mascot:'mascot-challenge',
        onlyIf:'arc3Warning=true',
        en:'"Alright then. Free warning, unabridged, no skipping ahead." Odd cleared his throat with exaggerated seriousness. "Somewhere up ahead, there\'s a big tree marked with a carving that means safe crossing. Now, the mark isn\'t lying on purpose. It\'s just not telling the whole truth anymore. Bark **doesn\'t update its own carvings** when the world changes underneath it. Remember that when you\'re standing on the edge of a drop and **an old piece of wood tells you you\'re fine**."',
        comp:{ q:"What is the free warning actually about?", options:["dangerous animals ahead","an outdated trail mark that may no longer reflect current, changed conditions","Odd's own untrustworthiness"], correct:1 },
      },
      { id:'8.4', title:"The eight symbols", bg:'bg-forest-mountain-arc-3', mascot:'mascot-challenge',
        props:['other-caved-tree-trunk','other-parchment'],
        en:'Odd spread out an old, fraying cloth showing the **eight symbols sketched out large**, beside eight scrambled words: *water · danger · turn back · shelter · edible · already travelled · nothing here · steep.* "Match \'em up," the gecko challenged. "I\'m not dropping hints, but **take a proper look at the shapes** before you start throwing guesses." A wavy line. An upward-pointing arrow. A single diagonal slash. A circle with a dot inside. A leaf shape. Two parallel lines. A hollow circle. A bold cross.',
        iq:{ q:"Match the 8 symbols to their meanings — based on the shape's logic, not random guessing", options:[
          { label:"Guess by the order they appear in the word list", tag:'bad', delta:{IQS:-1}, note:"Wrong almost across the board." },
          { label:"Read each shape's symbolic logic (wave=water, upward arrow=steep or danger, single slash=turn back, dotted circle=shelter, leaf=edible, two parallel lines=already travelled, empty circle=nothing here, cross=danger)", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Optimal." },
          { label:"Just ask Odd for the answers", tag:'accept', delta:{}, note:"Odd refuses." }
        ]},
        comp:{ q:"What method does Odd suggest for matching the symbols?", options:["memorize them in order","look carefully at each shape's visual logic before guessing","ask him directly for the answers"], correct:1 },
        presence:[{ text:"After matching them, carve a 9th symbol of his own onto a nearby stump." }],
      },
      { id:'8.5', title:"What Odd doesn't sell", bg:'bg-forest-mountain-arc-3', mascot:'mascot-chilling',
        en:'"**You don\'t sell the way out of the woods**," Focci pointed out. "You\'ve got shortcuts, trail maps, warnings... but never the exit." "Nobody ever asks for that straight up." Odd tilted his head, turning the thought over. "Might be because folks assume the **way out is supposed to be free**. It rarely is—they just **don\'t notice what they paid** until they\'re through."',
        dec:{ q:"", options:[
          { label:'Ask Odd what he thinks he paid for his own "way out"', delta:{CLA:1}, outcome:"" },
          { label:"Don't ask further — say thanks and go", delta:{}, outcome:"" },
          { label:'Offer to buy the "way out" at a price he sets himself', delta:{AGE:1}, outcome:"" }
        ]},
      },
      { id:'8.6', title:"Leaving the stall", bg:'bg-forest-mountain-arc-3', mascot:'mascot-wander',
        en:'Odd waved him off with a rear claw, still clinging upside down, already busying himself with his scraps and ledgers. "Ravine\'s ahead!" he called out offhandedly. "Massive tree with a deep carving. Just **don\'t trust wood that\'s older than you are** without checking underneath it first."',
        hint:"A mark doesn't lie. It just stops being updated.",
      },
    ]},

  { id:9, title:"The Ravine", mood:'SHOCK',
    lifeLesson:"Someone else's map was **drawn in a different season**.",
    scenes:[
      { id:'9.1', title:"The big tree", bg:'bg-forest-mountain-arc-3', mascot:'mascot-frozen-in-shock',
        props:['other-caved-tree-trunk'],
        en:"The tree was just as promised—massive, its trunk so broad that three foxes holding paws couldn't have circled it. Carved deep into the grey bark at eye level was a single, crisp symbol: **two parallel lines**, the mark for **already travelled, safe**. It had been chiseled carefully by someone with plenty of time, but clearly a very long time ago.",
        comp:{ q:"What does the mark on the tree mean?", options:["danger ahead","this path has already been travelled safely","turn back"], correct:1 },
      },
      { id:'9.2', title:"Following it", bg:'bg-forest-mountain-arc-3', mascot:'mascot-frozen-in-shock',
        en:"Focci followed the direction of the carving for about **two hundred confident paces**. And then, without warning, the **ground simply dropped away into nothing**.",
      },
      { id:'9.3', title:"The mark that lies", bg:'bg-forest-mountain-arc-3', mascot:'mascot-challenge',
        props:['other-tree','other-vine'],
        en:"The ravine plunged **forty feet down**. Resting at the bottom, grey and half-swallowed by moss, was the trunk of a **fallen log that had once bridged both sides**. If you caught the light right, you could still see faint, deep grooves worn into the wood where **thick ropes had once been lashed tight**—the unmistakable pattern of handrails built for travelers crossing again and again. **Thick, healthy moss** covered the log now—the kind that only thrives through long, heavy monsoon seasons.",
        iq:{ q:"The mark wasn't wrong when it was carved. What's changed between then and now?", options:[
          { label:"Someone deliberately altered the mark to hurt whoever came after", tag:'bad', delta:{IQS:-1}, note:"No evidence of that at all." },
          { label:"The mark was carved in a dry season, when this fallen log still worked as a bridge with handrails; the wet season since then has thickened the moss, and a flood may have knocked it out of place", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, flag:'D-08', note:"Optimal." },
          { label:"Focci misread the mark from the start", tag:'bad', delta:{IQS:-1}, note:"Not true, the mark clearly says safe." }
        ]},
        comp:{ q:"What do the rope-marks on the fallen log suggest?", options:["it was always just a fallen tree","it was once deliberately used as a bridge, with handrails lashed to it","someone tried to burn it"], correct:1 },
      },
      { id:'9.4', title:"Getting across anyway", bg:'bg-forest-mountain-arc-3', mascot:'mascot-challenge',
        en:"Forty feet was a terrifying fall for the mistake of **taking a tree at its word**. Focci scouted along the rim for another way across, eventually finding a narrow crossing upstream where **two boulders leaned close enough together to leap across**.",
        iq:{ q:"Choose a way across the ravine", options:[
          { label:"Jump the narrow gap between two boulders", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Risky but controlled, optimal." },
          { label:"Try climbing down onto the fallen log and crossing on it", tag:'bad', delta:{IQS:-1}, note:"The moss is slick, far more dangerous than it looks." },
          { label:"Go the long way around to find a shallower crossing", tag:'accept', delta:{}, note:"Completely safe, costs half a day." }
        ]},
      },
      { id:'9.5', title:"Note", bg:'bg-forest-mountain-arc-3', mascot:'mascot-confused',
        en:"Safe on the other side, Focci looked back at the old carving, **still proudly declaring a safe crossing** that hadn't existed in years, maybe decades. Whoever cut it had **never returned to check on it**. Maybe they couldn't. Or maybe they just never thought to look back.",
      },
      { id:'9.6', title:"DEC", bg:'bg-forest-mountain-arc-3', mascot:'mascot-superhero',
        en:"The choice ahead wasn't just about this one broken trail—it was about **how Focci intended to treat every marker** he encountered from here on out: Odd's entire system, the eight symbols, the language carved into every trunk in this forest.",
        dec:{ q:"", pivot:true, options:[
          { label:"Keep trusting the symbol system, follow it through the rest of the forest as before", delta:{CLA:-1,AGE:-1}, outcome:"" },
          { label:"Abandon the old symbol system, carve his own marks for whoever comes next", delta:{AGE:3,COU:2}, outcome:"" },
          { label:"Keep following the symbols, but correct any he finds wrong along the way", delta:{AGE:2,CAR:2,CLA:1}, outcome:"Slowest, hardest, the highest reward." }
        ]},
      },
      { id:'9.7', title:"Marking it", bg:'bg-forest-mountain-arc-3', mascot:'mascot-wander',
        props:['other-caved-tree-trunk'],
        en:"Whatever he chose, Focci walked back to the great tree one last time before leaving the ravine behind, leaving his mark on the weathered carving—**adding a warning slash, scratching it out, or leaving it untouched**, depending on what kind of traveler he had decided to be.",
        presence:[{ text:"Go back to the tree with the wrong mark, and carve a small warning line beside it." }],
      },
    ]},
  ]},

{ id:4, title:'The Wildflower Field', bg:'bg-wildflowers-field-arc-4',
  chapters:[

  { id:10, title:"The Field of Purple", mood:'BRIGHT',
    lifeLesson:"**Beauty doesn't require** you to do anything with it.",
    scenes:[
      { id:'10.1', title:"Out of the trees", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-wow',
        props:['other-wildflowers'], propsFront:['fg-wildflower-blur'] /* suggested extra asset, optional */,
        en:"The forest came to an end the way good things often do—**all at once, with zero warning**. One second Focci was stepping through dark pine shadows, and the next he was standing in an **entire valley of blooming wildflowers**, stretching farther than made immediate sense after weeks under a cramped canopy.",
        comp:{ q:"How does the story describe the transition from forest to field?", options:["slow and gradual","abrupt, happening in a single step","it happens over several days"], correct:1 },
        presence:[{ text:'Do nothing for 20 seconds — the only button on screen is "Look".', wait:20 }],
      },
      { id:'10.2', title:"Butterflies", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-chilling',
        props:['other-butterflies'],
        en:"Butterflies drifted through the blossoms in **numbers too thick to even count**. One of them—pale orange with slow, methodical wingbeats—**settled right on Focci's ear** and stayed perched there for a surprisingly long time, **apparently content with its resting spot**.",
        presence:[{ text:"Don't shoo the butterfly away — let it stay as long as it wants." }],
      },
      { id:'10.3', title:"Talla", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-chilling', npc:'other-bird-arc4',
        props:['other-seed-bag','other-potted-flowers','other-houser-arc4'],
        en:'An old bird, her feathers faded to a soft, dusty grey, knelt in the dirt near the center of the meadow. She was **sorting paper seed envelopes into a wooden box** with the slow, deliberate rhythm of someone doing something they\'d done **ten thousand times without ever rushing once**. "**You\'re standing on the chamomile**," she said softly, without looking up. "It doesn\'t mind. Just so you know for next time."',
        comp:{ q:"What does Talla ask Focci to be mindful of?", options:["not touching her tools","where he steps, regarding a specific flower (chamomile)","staying quiet"], correct:1 },
        presence:[{ text:"Ask Talla which flower she likes best." }],
      },
      { id:'10.4', title:"Lunch", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-chilling', npc:'other-bird-arc4',
        props:['other-potted-flowers','other-food-bowl'],
        en:'"**Sit down. Eat a bite** before you start peppering me with questions." Talla didn\'t wait for an answer before setting a second wooden bowl firmly on the grass.',
        dec:{ q:"", options:[
          { label:"Sit down and eat with her", delta:{CAR:1}, outcome:"" },
          { label:"Thank her, but say he has to keep moving", delta:{AGE:1}, grey:true, outcome:"" },
          { label:"Stay, but eat standing, without properly sitting down", delta:{}, outcome:"" }
        ]},
        presence:[{ text:"Sit down to eat instead of just standing politely." }],
      },
      { id:'10.5', title:"The trampled patch", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-challenge', npc:'other-bird-arc4',
        props:['other-pinecone-branch'],
        en:"At the edge of the clearing, beneath the largest pine, a patch of ground had been **pressed completely flat**. It wasn't the mark left by an animal passing through, but the **hollow of someone who had sat in that exact spot for a very long time**. The depression was deep, far deeper than a brief rest could make. A **dusting of dry pine needles** had drifted across the packed soil, settling into the groove the way **needles slowly do over days, not hours**.",
        iq:{ q:"Estimate how long someone sat here, and how long ago", options:[
          { label:"A few minutes, just today", tag:'bad', delta:{IQS:-1}, note:"The impression is far too deep for a brief rest." },
          { label:"Sat for a long time (hours, maybe days), and left a while ago", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Optimal." },
          { label:"Can't tell anything from the impression", tag:'accept', delta:{}, note:"Misses two clear clues." }
        ]},
        comp:{ q:"What do the pine needles scattered across the flattened patch indicate?", options:["someone is sitting there right now","time has passed since whoever sat there left","the patch was always like this"], correct:1 },
        hint:"Somebody sat under that tree a long time, and left a while before you got here.",
      },
    ]},

  { id:11, title:"Talla's Rules", mood:'SHOCK',
    lifeLesson:"**Preserving the past unchanged** is the slowest way to kill it.",
    scenes:[
      { id:'11.1', title:"The garden's shape", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-frozen-in-shock', npc:'other-bird-arc4',
        props:['other-wildflowers','other-house-arc4'],
        en:"Once Focci took a proper look around, the garden revealed itself as a **rigid rectangle**. Flowers bloomed strictly within its borders, with **nothing allowed to spill past an edge** that had once been marked with twine and had stayed that way **out of pure habit** long after the string rotted away.",
        comp:{ q:"What kept the garden's rectangular shape even after the original markers were gone?", options:["a fence","habit — the shape was simply maintained by routine","natural growth patterns"], correct:1 },
      },
      { id:'11.2', title:"Seven rules", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-confused', npc:'other-bird-arc4-2',
        en:'Talla lived by rules. She recited them with the flat cadence of someone repeating words they had **long stopped truly hearing**: *Nothing new in the west bed. Nothing yellow, anywhere. The border stones stay where they are. No digging past row three. Water at dusk only. Nobody prunes the hibiscus. **Nothing gets moved, ever.*** "Who made all these rules?" Focci asked. "**We did**," Talla said, and didn\'t say who "we" was for another two full days.',
        comp:{ q:'For how long does Talla avoid explaining who "we" refers to?', options:["she never explains it","two days","she explains immediately"], correct:1 },
      },
      { id:'11.3', title:"Watching the rules bend nothing", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-confused', npc:'other-bird-arc4',
        en:"Focci spent an afternoon quietly observing which rules served a real purpose and which had **simply calcified into ritual**. When he nudged a border stone an inch to the side, nothing in the earth seemed to mind. Talla noticed anyway and **nudged the stone back to its exact spot without saying a word**—which told him far more than any lecture could have.",
        dec:{ q:"", options:[
          { label:"Ask Talla directly why she puts things back exactly where they were", delta:{CLA:1}, outcome:"" },
          { label:"Don't ask — let her keep the habit", delta:{CAR:1}, outcome:"" },
          { label:"Deliberately move another stone to see how she reacts", delta:{COU:1}, outcome:"" }
        ]},
      },
      { id:'11.4', title:"Forty envelopes", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-frozen-in-shock', npc:'other-bird-arc4-2',
        props:['other-seed-bag','other-scattered-seeds'],
        en:'The seeds were kept in paper envelopes, one species per packet, labeled in handwriting that had **grown shaky over the seasons**. There were forty envelopes in total, and **thirty-nine had never been opened**. "Why keep seeds if you\'re never going to plant them?" "Because if I plant them, the layout changes," Talla said softly. "**Then it isn\'t the garden she saw.**" "She saw it eleven years ago." "Yes." "It doesn\'t look like that now anyway." **Talla didn\'t answer**, which meant she already knew.',
        comp:{ q:"What does Talla's silence at the end suggest?", options:["she didn't hear the question","she knows Focci is right, but won't say so out loud","she disagrees completely"], correct:1 },
      },
      { id:'11.5', title:"Why the flowers are shrinking", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-challenge', npc:'other-bird-arc4',
        props:['other-sprout'],
        en:"Focci noticed the real problem on the third morning: this season's blooms were **noticeably smaller** than the dried heads lying in last year's compost pile, which were already smaller than the oldest pressed petals Talla kept in her book. When he turned over an inch of dirt near the west bed (quietly breaking rule number one), the **soil came up pale, powdery, and drained of nutrients**—nothing like the **dark, rich loam** resting just three paces beyond the garden's border. There was **not a single earthworm in the garden plot**, while the wild soil outside was teaming with them.",
        iq:{ q:"Why do the flowers get smaller every year?", options:[
          { label:"Not enough water — Talla isn't watering enough", tag:'bad', delta:{IQS:-1}, note:'Doesn\'t match, the "water at dusk only" rule is still followed strictly.' },
          { label:"The soil is exhausted from growing the same few species in the same bed for eleven years with no rotation, no worms left, paler than the wild soil outside the garden", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Optimal." },
          { label:"The regional climate is changing", tag:'accept', delta:{}, note:"Nothing points to this." }
        ]},
        comp:{ q:"What comparison reveals the soil problem?", options:["comparing this year's flowers to last year's","comparing the pale, worm-free garden soil to the darker, worm-rich soil just outside the garden's boundary","comparing flower colours"], correct:1 },
        presence:[
          { text:"Ask Talla her friend's name, and hear the whole answer." },
          { text:"Stay a second night even though he doesn't need to, just because Talla seems to want the company." }
        ],
      },
      { id:'11.6', title:"What Talla almost says", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-cry', npc:'other-bird-arc4-2',
        props:['other-seed-bag'],
        en:'On their second night by the hearth, unprompted, Talla started a sentence about her old friend and didn\'t finish it. "She used to say... **the soil will always let you know when it\'s exhausted**, if only you\'d—" She stopped. She looked down and went right back to sorting seed packets in silence.',
        dec:{ q:"", options:[
          { label:"Wait for her to continue, don't ask", delta:{CAR:1}, outcome:"" },
          { label:'Ask gently: "If you what?"', delta:{CLA:1}, outcome:"" },
          { label:"Change the subject, let her be comfortable", delta:{CAR:1}, outcome:"" }
        ]},
        hint:"The garden is telling her something. She has spent eleven years choosing not to translate it.",
      },
    ]},

  { id:12, title:"Envelope Number Forty", mood:'DARK',
    lifeLesson:"There are **good changes in this world** that you **won't be around to witness**.",
    scenes:[
      { id:'12.1', title:"The evidence, laid out", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-cry', npc:'other-bird-arc4',
        en:"One quiet afternoon, Focci laid the facts out plainly for her, keeping his tone gentle: the **dead, chalky soil**, the **missing earthworms**, the **blooms shrinking year after year**. Talla listened to the whole explanation **without interrupting once**—which somehow felt a whole lot heavier than if she had argued back.",
      },
      { id:'12.2', title:"Talla's answer", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-cry', npc:'other-bird-arc4-2',
        en:'"**I know**," she murmured when he finished. "**I\'ve known for at least four years now.** But knowing isn\'t the same as being able to do something about it, not when changing it feels like **losing her all over again**."',
        comp:{ q:"How long has Talla known about the soil problem?", options:["she just found out today","at least four years","she still doesn't believe it"], correct:1 },
      },
      { id:'12.3', title:"The fortieth envelope", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-superhero', npc:'other-bird-arc4',
        props:['other-seed-bag'],
        en:"The **fortieth envelope sat unopened** on top of the wooden box, exactly where it had rested every day Focci had been here. Talla hadn't touched it once, even though her eyes wandered to it **more than to anything else in the garden**.",
        dec:{ q:"", pivot:true, options:[
          { label:"Plant a new seed, at night, without asking Talla", delta:{COU:3,AGE:2,CAR:-1,WGT:1}, setFlags:{arc4Pivot:'A'}, outcome:"" },
          { label:"Plant nothing. Sit and listen to Talla talk about her friend all night, without pushing her to decide anything", delta:{CAR:3,CLA:1}, setFlags:{arc4Pivot:'B'}, outcome:"" },
          { label:"Tell Talla plainly that the soil is dying, hand over all the evidence, let her decide right then", delta:{COU:2,CLA:2,AGE:1}, setFlags:{arc4Pivot:'C'}, outcome:"" }
        ]},
      },
      { id:'12.4', title:"What happens next", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-cry', npc:'other-bird-arc4',
        variantIf:'arc4Pivot=A',
        en:"The seed went into the soil near midnight, tucked into the far corner of the west bed that nobody checked daily. Talla **noticed within the week**—of course she did—and **never brought it up out loud**, though the way she moved around that corner changed: careful and quiet, like **walking around a sleeping stray** she wasn't quite sure she trusted yet.",
        variant2If:'arc4Pivot=B',
        variant2En:"Talla talked well past midnight, sharing stories about a friend who used to read aloud to her from books she could never finish on her own, and an **old disagreement that neither had ever managed to resolve** before it simply stopped mattering. She didn't plant a seed. She didn't make any grand declarations out loud. But **something in her shoulders had noticeably eased** by the time she finished speaking.",
        variant3If:'arc4Pivot=C',
        variant3En:'Talla sat in long, heavy silence after Focci finished. Eventually, she reached out, **picked up the fortieth envelope**, and turned it over twice in her claws without breaking the seal. "**Not tonight**," she said softly. "But **thank you for saying it plainly**. Nobody\'s had the courage to say it plainly before."',
      },
      { id:'12.5', title:"Leaving", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-wander',
        en:"Focci set out at first light, leaving the way he'd arrived—slipping past the treeline, walking past the packed earth beneath the pines, out toward whatever lay down the trail. Looking back from the ridge above, the garden looked **just as small and just as purple** as the first time he'd laid eyes on it.",
      },
      { id:'12.6', title:"A stray seed", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-withflag-1',
        onEnterFlags:{'D-09':true},
        props:['other-scattered-seeds'],
        en:"Somewhere between the ridge and the next stretch of road, Focci stopped to shake out his canvas bag. Yellow pollen and loose seed fluff from three days in the meadow had **worked into every seam**—the way that field naturally clung to anything that lingered near it. Out from the dust and fuzz, something small and dry tumbled free and landed on the dirt trail: a **single, plain seed**, impossible to trace back to any one envelope. He **didn't turn back for it**. It just rested there on the trail, **waiting for whatever came next to decide what to do with it**.",
        endOfBuiltContent:true,
      },
    ]},
  ]},
];

window.STORY_CONTENT = { version:1, arcs:ARCS };
})();
