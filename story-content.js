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
   1) Chapter 2, scene 2.2 option A ("chapter rút còn 4 scene") — the
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
{ id:1, title:'Cánh Đồng', bg:'bg-peaceful-field-arc-1',
  chapters:[

  { id:1, title:'Waking', mood:'BRIGHT',
    lifeLesson:"Không nhớ mình là ai thì phải bắt đầu bằng việc quyết định mình làm gì.",
    scenes:[
      { id:'1.1', title:"The sky is too big", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wander',
        props:['other-bag'], propsFront:['fg-tall-grass'] /* suggested extra asset — front-of-Focci depth, optional */,
        en:"Focci opened his eyes and the sky was too big. There was no roof above him and no name inside him. Only grass that went on until it stopped being grass and started being sky. A red bandana was tied at his throat. His arms were bare. A canvas bag lay beside him and it was still warm, as if someone had been holding it a minute ago. He did not remember lying down. That was the first thing. The second thing was that he was not frightened, and that bothered him more.",
        comp:{ q:"What bothered Focci most?", options:["the size of the sky","that he wasn't frightened","the warm bag"], correct:1 },
        dec:{ q:"Cái túi còn ấm. Focci nên làm gì?", options:[
          { label:'Gọi to "Anyone there?"', delta:{COU:1}, outcome:"Không ai đáp; một con ve ngừng kêu rồi kêu to hơn." },
          { label:"Ngồi im chờ người đó quay lại", delta:{}, outcome:"Nó ngồi tới trưa." },
          { label:"Nhặt túi, đi ngay, không quan tâm", delta:{AGE:1}, outcome:"Nó đi 20 bước rồi quay lại. Nó không thừa nhận là đã quay lại." }
        ]},
        presence:[{ text:"Tap vào giọt sương trên một cọng cỏ trước mặt — không liên quan gì." }],
      },
      { id:'1.2', title:"What's in the bag", bg:'bg-peaceful-field-arc-1', mascot:'mascot-compass',
        props:['other-hourglass','other-envelope','other-counter'],
        en:"An hourglass. The sand inside was falling upward. He turned it over. The sand kept falling upward. An envelope. White, sealed, no address, no name. It weighed almost nothing. A small brass machine with a dial and a window. The window showed a number, and the number was 0.",
        iq:{ q:"Cái đồng hồ cát chảy ngược. Cách kiểm tra hợp lý nhất?", options:[
          { label:"Lắc mạnh", tag:'bad', delta:{IQS:-1}, note:"Cát dồn một góc, không biết thêm gì." },
          { label:"Đặt xuống đất phẳng và nhìn kỹ chỗ nối thuỷ tinh", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, flag:'D-01', note:"Tối ưu." },
          { label:"Hỏi người đầu tiên gặp được", tag:'accept', delta:{}, note:"Chấp nhận được." }
        ]},
        presence:[{ text:"Tap vào quai túi bị sờn — nó sờn theo kiểu đeo lâu năm, không phải túi mới." }],
      },
      { id:'1.3', title:"The road with two ends", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wander',
        props:['other-path-map'],
        en:"There was a road. Not a built road — a worn one, the kind that appears because enough feet chose the same line. It came from behind him and it went ahead of him and he could not tell which end was the beginning. He tried to decide by looking at the grass. The grass had no opinion.",
        dec:{ q:"Đi hướng nào?", options:[
          { label:"Hướng đường mòn hơn — nhiều người đi", delta:{}, outcome:"" },
          { label:"Hướng ít mòn hơn — phải tự vạch cỏ", delta:{COU:1}, outcome:"" },
          { label:"Ngồi xuống, vẽ một mũi tên lên đất, rồi đi theo mũi tên mình vừa vẽ", delta:{AGE:1}, setFlags:{arrow:true}, outcome:"" }
        ]},
        presence:[{ text:'Nằm ngửa xem một đám mây đi hết bầu trời ("Watch it" — không có gì xảy ra).' }],
      },
      { id:'1.4', title:"The stream", bg:'bg-peaceful-field-arc-1', mascot:'mascot-chilling',
        props:['other-river-landscape'],
        en:"The stream was too small to have a name. It was the width of his arm and it made a sound like someone deciding not to say something. He drank. The water was cold enough to hurt his teeth, which felt honest. On the far bank, half in the mud, something white.",
        comp:{ q:'Why does the story say the water "felt honest"?', options:["it was clean","it hurt, and the hurt was real","it tasted of nothing"], correct:1 },
        presence:[{ text:"Thò chân xuống suối, không vì lý do gì." }],
      },
      { id:'1.5', title:"The postcard", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wow',
        props:['other-lantern-card'],
        en:'It was a postcard. The picture showed a lantern hanging from a pole, and under it, printed: THE KEEPER\'S STATION — 400 MILES. On the back, one line, in blue ink that glowed faintly even in daylight: "If you found this, you\'re already further than I got." There was no signature. There was a small tear in one corner, the shape of a beak.',
        iq:{ q:"Ai để tấm bưu thiếp ở đây?", options:[
          { label:"Nó trôi theo suối tới", tag:'bad', delta:{}, note:"Không đúng." },
          { label:"Ai đó đánh rơi khi đi qua", tag:'bad', delta:{}, note:"Không đúng." },
          { label:"Ai đó đặt nó ở chỗ dễ thấy — mặt chữ ngửa lên, không dính bùn", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, flag:'D-02', note:"Tối ưu." }
        ]},
        dec:{ q:"Làm gì với tấm bưu thiếp?", options:[
          { label:"Bỏ túi, coi như của mình", delta:{}, outcome:"" },
          { label:"Cắm lại xuống bùn cho người sau, chỉ chép lại dòng chữ lên cát", delta:{CAR:1}, outcome:"" },
          { label:"Lật đi lật lại tìm thêm dấu vết trước khi quyết", delta:{CLA:1}, outcome:"" }
        ]},
      },
      { id:'1.6', title:"The number moved", bg:'bg-peaceful-field-arc-1', mascot:'mascot-compass',
        props:['other-counter-machine'],
        en:"He took out the brass machine again. The window no longer said 0. It said a number, and the number was exactly the number of new things he had learned to name that day. Focci did not find this strange, because he did not yet know that machines are not supposed to do that.",
        counterScene:true,
        presence:[{ text:"Lắc cái máy cho vui, ba lần." }],
        hint:"Someone was here before you, and they didn't finish.",
      },
    ]},

  { id:2, title:"Seventeen Years of Singing", mood:'BRIGHT',
    lifeLesson:"Việc không ai trả công, không ai nhìn thấy, vẫn có thể là việc quan trọng nhất em làm hôm đó.",
    scenes:[
      { id:'2.1', title:"The noise", bg:'bg-peaceful-field-arc-1', mascot:'mascot-chilling',
        props:['other-cicada-1','other-tree-trunk'],
        en:'The sound started at noon and did not stop. It came from one dry stalk near the road and it was far too loud for the size of the thing making it. Focci walked around the stalk three times before he saw it: a cicada, brown, wings like dirty glass. "You\'re very loud." "I have to be," said the cicada. "I\'ve only got today."',
        comp:{ q:"Why must Sil be loud?", options:["he is angry","he has only one day left","the field is noisy"], correct:1 },
      },
      { id:'2.2', title:"Seventeen", bg:'bg-peaceful-field-arc-1', mascot:'mascot-meditate',
        props:['other-tree-trunk'],
        en:'"Seventeen years underground," said Sil. "I came up four days ago. We get about a week up here. So — today." "What do you do with a week?" "You sing." He said it the way you say something obvious. "You sing and you wait for one to sing back." Focci looked at the empty field. "Has one sung back?" Sil kept singing. That was the answer.',
        dec:{ q:"Mặt trời còn cao. Đường còn dài. Con ve này sẽ chết trước sáng mai.", options:[
          { label:"Đi tiếp — đây không phải việc của mình", delta:{}, setFlags:{arc1LeftSil:true}, goto:'2.2b', outcome:"" },
          { label:"Ở lại tới tối", delta:{CAR:1}, setFlags:{arc1StayedNight:true}, outcome:"" },
          { label:"Ở lại, nhưng vừa ở vừa liếc ra đường", delta:{CAR:1}, setFlags:{arc1StayedNight:true,arc1Glanced:true}, outcome:"Sil biết. Sil không nói gì cho tới scene sau." }
        ]},
        presence:[{ text:"Ngồi xuống hẳn (không phải \"đứng nói chuyện\")." }],
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
        en:'"Sing something else. You\'ve done that one nine times." "It isn\'t for you." "Then who\'s it for?" "Whoever\'s left." A pause. "Do you want me to sing back? I\'d get it wrong." "You would," said Sil. "Do it anyway."',
        dec:{ q:"", options:[
          { label:"Hát. Sai hoàn toàn. Rất tệ", delta:{COU:1}, outcome:'Sil: "That was terrible. Do it again."' },
          { label:"Không hát, chỉ ngồi nghe", delta:{CAR:1}, outcome:"Sil hát nhỏ hơn, vì đã có người nghe." },
          { label:"Đi tìm một con ve khác cho Sil", delta:{COU:1}, outcome:"Đi hai tiếng, không có con nào, quay lại tay không." }
        ]},
      },
      { id:'2.4', title:"The caravan", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wander',
        onlyIf:'arc1LeftSil!=true',
        props:['other-wagon','other-badger'],
        en:'In the late afternoon a line of carts came up the road, six of them, lamps already lit, moving north where the sky was the colour of a bruise. A badger on the last cart called out: "Station road! Room for one!" Focci stood up. Sil did not stop singing.',
        dec:{ q:"", options:[
          { label:"Lên xe. Đi", delta:{AGE:1}, setFlags:{arc1CaravanLeft:true}, goto:'2.7', outcome:"Tới Arc 2 nhanh hơn, có nước, có bạn đồng hành. Không bao giờ biết Sil chết lúc nào." },
          { label:"Để xe đi", delta:{CAR:1}, outcome:"Mất cơ hội, phải đi bộ vào sa mạc." },
          { label:"Hỏi bác lửng có chở được cả con ve không", delta:{CAR:1}, outcome:'"It\'s a bug, kid." Xe đi. Focci ở lại vì đã lỡ hỏi.' }
        ]},
      },
      { id:'2.5', title:"The hours that don't count", bg:'bg-peaceful-field-arc-1', mascot:'mascot-meditate',
        onlyIf:'arc1LeftSil!=true',
        props:['other-beetle'],
        en:"Nothing happened for four hours. Sil sang. Focci watched the light move across the grass. A beetle walked over his foot and he let it. He learned the shapes of three clouds and forgot two. This is the part of the story a story would normally skip.",
        comp:{ q:"Why would a story normally skip this part?", options:["it is unimportant","nothing dramatic happens, but it still matters","Focci slept"], correct:1 },
        waitScene:3,
        presence:[{ text:"Để con bọ đi hết bàn chân thay vì gạt nó ra." }],
      },
      { id:'2.6', title:"What Sil actually wanted", bg:'bg-peaceful-field-arc-1', mascot:'mascot-cry',
        onlyIf:'arc1LeftSil!=true',
        props:['other-moon-clouds'],
        en:'"If nobody ever sings back — what was the point of seventeen years?" "You think I spent seventeen years waiting." "Didn\'t you?" "I spent seventeen years eating roots in the dark and getting bigger. That wasn\'t waiting. That was the job." A pause. "The singing is only the last part. Everyone thinks the last part is the whole thing."',
        variantIf:'arc1Glanced=true',
        variantEn:'"You\'ve been looking at the road all evening." "I haven\'t." "It\'s all right. Most people who stay, stay halfway." Two more bars. "Halfway is still more than none."',
        dec:{ q:"", options:[
          { label:'"Then I\'ve been doing the last part first."', delta:{CLA:1}, outcome:"" },
          { label:'"That\'s a sad way to look at it."', delta:{}, outcome:'Sil: "It\'s the only way that doesn\'t cost anything."' },
          { label:"Không nói gì. Ngồi im tới khi trời tối", delta:{}, outcome:"" }
        ]},
        presence:[{ text:'Nói thật một chuyện về mình khi Sil hỏi "What are you looking for?" (né được duyên hơn: "Trouble, mostly.")' }],
      },
      { id:'2.7', title:"Morning", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wow',
        props:['other-cicada-2','other-tree-trunk'],
        en:"He woke because the field was silent. The stalk was empty. Beneath it lay a shell — a perfect, hollow, see-through copy of Sil, split down the back, still holding the shape of something that had left. He picked it up. It weighed nothing at all, like the envelope.",
        variantIf:'arc1StayedNight=true',
        variantEn:'And under the shell, flat against the grass, half-hidden in dew, lay a second postcard. Older. The same handwriting. One line more than the first: "I turned back at the pines. Don\'t."',
        variantFlag:'D-03',
        dec:{ q:"Làm gì với vỏ ve?", options:[
          { label:"Giữ vỏ ve trong túi", delta:{CAR:1}, item:'cicadaShell', outcome:"Item: Cicada Shell — dùng ở Arc 12." },
          { label:"Đặt lại lên thân cây, ngay ngắn", delta:{CAR:1}, setFlags:{'D-04':true}, outcome:"" },
          { label:"Vùi xuống đất", delta:{CLA:1}, outcome:"" }
        ]},
        hint:"There were two of them. You only picked up one.",
      },
    ]},

  { id:3, title:"The Crow Who Was Already There", mood:'SHOCK',
    lifeLesson:"Người tử tế với em có thể đồng thời đang cần gì đó ở em. Cả hai điều đó đều thật.",
    onEnterFlags:{'D-CH03':true},
    scenes:[
      { id:'3.1', title:"Something on the milestone", bg:'bg-peaceful-field-arc-1', mascot:'mascot-wander',
        props:['other-notebook'],
        en:'A stone by the road, waist-high, numbers cut into it, most worn away. The only one left was a 4 and half a 0. On top of the stone sat a crow, black, one leg slightly crooked, going through a small pile of paper with the concentration of an accountant. "You\'re in my light," said the crow, without looking up.',
      },
      { id:'3.2', title:"Owen", bg:'bg-peaceful-field-arc-1', mascot:'mascot-owen-worries-hidding',
        en:'"Owen," said the crow. "I\'d shake, but." He lifted the crooked leg an inch and put it down again. "Where are you headed?" "The Keeper\'s Station." Owen\'s head tilted, a small motion, gone in half a second. "Course you are. Everyone is, this time of year." "Have you been?" "I\'ve been near it," said Owen. "Near\'s a big word. Covers a lot of ground."',
        comp:{ q:"What does Owen actually answer?", options:["yes, he has been there","no, never","he answers without answering"], correct:2 },
        iq:{ q:'Owen vừa nghe "Keeper\'s Station" và nghiêng đầu nửa giây. Nghĩa là gì?', options:[
          { label:"Ông ta không biết chỗ đó", tag:'bad', delta:{IQS:-1}, note:"" },
          { label:"Ông ta biết rõ, và đang quyết định nói bao nhiêu", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Tối ưu." },
          { label:"Ông ta bị đau chân", tag:'accept', delta:{}, note:"" }
        ]},
      },
      { id:'3.3', title:"The paper", bg:'bg-peaceful-field-arc-1', mascot:'mascot-owen-worries-hidding',
        props:['other-notebook'],
        en:'The pile was letters. Not new ones — soft, foxed at the edges, some still folded shut. "Are those yours?" "They\'re in my possession," said Owen. "That\'s a different sentence and I chose it on purpose." He held one up to the light, read something, made a small noise like a laugh with the funny part removed, and put it in a bag.',
        dec:{ q:"", options:[
          { label:'Hỏi thẳng: "Did you steal those?"', delta:{CLA:1}, outcome:'Owen: "Stole is loud. I intercept."' },
          { label:"Không hỏi — chuyện của người ta", delta:{}, outcome:"" },
          { label:"Xin đọc một lá", delta:{}, outcome:"Owen đưa một lá đã mở sẵn (không phải lá ông ta vừa đọc)." }
        ]},
        presence:[{ text:"Hỏi Owen tại sao chân ông ta lệch — và nghe hết câu trả lời." }],
      },
      { id:'3.4', title:"Bread and quail", bg:'bg-peaceful-field-arc-1', mascot:'mascot-owen-worries-hidding',
        props:['other-bird-nest','other-bread-bag'],
        en:'A family of quail asked where he was from. "The station," Focci said. He said it easily. He said it before he decided to. They were impressed. They gave him bread. He ate the bread and felt the shape of the lie sitting next to the bread inside him. Owen watched all of it from the stone and said nothing, which was somehow worse.',
        dec:{ q:"", options:[
          { label:"Đính chính ngay, trả lại bánh", delta:{CLA:1,CAR:1}, outcome:"" },
          { label:"Im. Ăn. Đi tiếp", delta:{}, outcome:"" },
          { label:"Không đính chính, nhưng để lại vỏ ve sầu cho lũ trẻ", delta:{CAR:1}, requireItem:'cicadaShell', consumeItem:'cicadaShell', missingNote:"You don't have anything like that to give.", outcome:"" }
        ]},
        presence:[{ text:'Trả lời câu hỏi vặt của con chim cút nhỏ nhất: "Do foxes have birthdays?"' }],
      },
      { id:'3.5', title:"What Owen gives", bg:'bg-peaceful-field-arc-1', mascot:'mascot-owen-happy-crow',
        onEnterFlags:{'D-05':true},
        props:['other-bag'],
        en:'At dusk Owen dropped something into Focci\'s bag from above, mid-flight, without slowing down. It was a waterskin. Full. "The desert\'s four days," he called back. "You\'d have found out on day two." "Why?" "Because I\'ll be seeing you again," said Owen, "and it\'s boring talking to a corpse."',
        dec:{ q:"", options:[
          { label:"Nhận, cảm ơn", delta:{}, item:'waterskinFull', outcome:"" },
          { label:'Nhận, nhưng hỏi "What do you want?"', delta:{CLA:1}, item:'waterskinFull', outcome:'Owen: "Nothing **yet**."' },
          { label:"Từ chối, trả lại", delta:{AGE:1}, outcome:"" }
        ]},
        presence:[{ text:"Nhận món quà thay vì từ chối cho lịch sự." }],
      },
      { id:'3.6', title:"The signpost", bg:'bg-peaceful-field-arc-1', mascot:'mascot-superhero',
        props:['other-signpost'],
        en:'At the edge of the field stood a signpost with two arms. One said KEEPER\'S STATION and pointed at a flat, pale haze on the horizon — the desert, though nothing about the word "desert" was visible yet from here. The other arm had been broken off. The stump pointed east, at a strip of low green hills. The hills didn\'t look like a different destination so much as a detour — a way of arriving at the same flat, pale haze from a slower, greener angle. A note was nailed to the post, ruined by rain. Three words were readable: "...not the only..."',
        dec:{ q:"⭐ PIVOT ARC 1", pivot:true, options:[
          { label:"Đi sa mạc, theo biển chỉ đường — vào ngay, không vòng vo", delta:{COU:1}, setFlags:{arc1Pivot:'A'}, outcome:"Arc 2 mở đầu với Focci đã mệt và khát sẵn." },
          { label:"Đi về phía đồi xanh, tìm hiểu cái tay biển bị gãy trước", delta:{AGE:2,CLA:1}, setFlags:{arc1Pivot:'B'}, outcome:"Chậm hơn một ngày, nhưng Arc 2 mở đầu với Focci còn nước, còn sức." },
          { label:"Tháo cái tay biển gãy, mang theo, rồi vẫn đi vào sa mạc", delta:{COU:1}, setFlags:{arc1Pivot:'C'}, item:'signpostArm', outcome:"Item: Broken Signpost Arm." }
        ]},
      },
    ]},
  ]},

{ id:2, title:'Sa Mạc', bg:'bg-desert-and-cactus-arc-2',
  chapters:[

  { id:4, title:"Thirst", mood:'BRIGHT',
    lifeLesson:"Từ chối cũng có thể là lòng tốt.",
    scenes:[
      { id:'4.1', title:"Flat and Loud", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        props:['other-red-rocks'],
        en:"The desert did not wait for him to catch his breath. His throat was already dry from the walk in, and the first night made that worse before it made anything better. The desert was not quiet, either way. It ticked — stones cooling and cracking all night, one after another, like something counting down from a number nobody had told Focci. He lay on his back and tried to guess which stone would go next. He was wrong four times before he stopped trying and just listened.",
        variantIf:'arc1Pivot=B',
        variantEn:"The green hills had given him one more day than the desert would have, and he still had most of a waterskin to prove it. He'd found, on the far side of the hills, a broken fence post with the same handwriting as the signpost — someone else had come this way, wondering about the same broken arm. The desert, when it finally started, ticked the same regardless of how well-rested he was to hear it — stones cooling and cracking all night, one after another, like something counting down from a number nobody had told him.",
        comp:{ q:"Why does the desert make cracking sounds at night?", options:["animals moving between rocks","stones that heated up all day contract sharply as the night cools them, and crack","the desert is collapsing"], correct:1 },
        dec:{ q:"Đêm đầu tiên trong sa mạc, ngủ ở đâu?", options:[
          { label:"Ngủ giữa bãi cát trống, thoáng", delta:{COU:1}, outcome:"" },
          { label:"Ngủ dựa vào một tảng đá lớn, tránh gió", delta:{}, outcome:"" },
          { label:"Trèo lên một mô đất cao để quan sát trước khi ngủ", delta:{CLA:1}, outcome:"" }
        ]},
        presence:[{ text:"Tap vào tiếng đá nứt, nghe hết 10 giây." }],
      },
      { id:'4.2', title:"Two Cacti", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-challenge',
        props:['other-cactus'],
        en:"There were two kinds of cactus on this stretch of the flats, and the difference mattered more than Focci expected it to. The first grew low, in pairs, spines thick and blunt, and a small brown finch was working one of them over with its beak, unbothered, pulling out something wet. The second grew alone, tall, spines like glass needles catching the light — and nothing, not the finch, not the ants working the sand nearby, went anywhere near it.",
        comp:{ q:"What is the finch doing to the first cactus?", options:["attacking it","feeding on moisture inside it, safely","building a nest"], correct:1 },
        iq:{ q:"Focci tìm thấy một cây xương rồng khác, mọc một mình, nhưng có một con kiến đang bò lên nó không hề tránh. Đây là loại nào?", options:[
          { label:"Chắc chắn là loại độc, vì nó mọc một mình như cây thứ hai", tag:'bad', delta:{IQS:-1}, note:"Sai: bỏ qua manh mối con kiến." },
          { label:"Loại chứa nước — vì dấu hiệu đáng tin nhất là hành vi của sinh vật khác", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Tối ưu." },
          { label:"Không xác định được, tránh xa cho an toàn", tag:'accept', delta:{}, note:"An toàn nhưng không có nước." }
        ]},
        presence:[{ text:"Ngồi quan sát con chim mổ xương rồng thêm một lúc." }],
      },
      { id:'4.3', title:"Smoke on the hill", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-challenge',
        props:['other-sand-dunes','other-smoke'],
        en:"Two things caught Focci's eye at once: a dry riverbed curving off to his left, cracked into a mosaic of pale plates, and — much further, over a low ridge to his right — a thin thread of smoke, grey against the white sky. Riverbeds were supposed to lead to water. That was the whole idea of a riverbed. But this one was crusted with something that caught the light like salt, not like a place water had been recently.",
        comp:{ q:"What does the crust on the riverbed suggest?", options:["water passed here very recently","the riverbed likely leads to a dry salt lake, not fresh water","nothing — it's just sand"], correct:1 },
        iq:{ q:"Đi theo lòng sông cạn hay trèo lên đồi xem khói?", options:[
          { label:"Đi theo lòng sông", tag:'bad', delta:{IQS:-1}, note:"Dẫn tới một hồ muối đã chết, không có nước, mất nửa ngày." },
          { label:"Trèo lên đồi nhìn khói trước khi quyết", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Tối ưu." },
          { label:"Đợi tới tối cho mát rồi mới quyết", tag:'accept', delta:{}, note:"An toàn nhưng mất cả buổi chiều." }
        ]},
      },
      { id:'4.4', title:"Bones", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-wow',
        props:['other-skeleton'],
        en:"The skeleton was large, clean, bleached white by years of sun — and arranged. Not scattered the way a skeleton falls when something dies where it stands, but laid out, ribs in order, skull facing east, the way you'd set a table. Somebody had done this on purpose, a long time ago, and had never come back to see if it still looked the way they'd left it.",
        comp:{ q:"What does the arrangement of the bones suggest?", options:["the animal died naturally in this position","someone deliberately arranged the bones, likely as a mark of respect","scavengers arranged them by accident"], correct:1 },
        dec:{ q:"", options:[
          { label:"Xếp lại vài chỗ đã xô lệch, cho ngay ngắn hơn", delta:{CAR:1}, outcome:"" },
          { label:"Lấy một cái xương làm gậy chống đi", delta:{}, outcome:"" },
          { label:"Để nguyên, không chạm vào gì cả", delta:{}, outcome:"" }
        ]},
        presence:[{ text:"Xếp lại bộ xương cho ngay ngắn dù chẳng ai nhìn thấy hành động đó." }],
      },
      { id:'4.5', title:"Closer to the smoke", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        props:['other-bucket','other-smoke'],
        en:"The smoke came from behind a low outcrop, steady, not the panicked kind of smoke that means something is burning wrong. Focci could hear, faintly, the particular clink of a bucket against stone.",
        dec:{ q:"", options:[
          { label:"Đi thẳng tới, gọi to trước khi tới gần", delta:{COU:1}, outcome:"Tới nhanh, nhưng Vask đã đứng cảnh giác sẵn." },
          { label:"Đi vòng, quan sát từ xa trước khi lộ mặt", delta:{CLA:1}, outcome:"Tới chậm hơn, nhưng thấy Vask đang chia nước cho một đứa trẻ." },
          { label:"Gọi to từ xa, đợi phản hồi rồi mới tới", delta:{}, outcome:"An toàn, trung tính." }
        ]},
      },
      { id:'4.6', title:"The well", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        props:['other-well'],
        en:'The well was old stone, round, with a low wall worn smooth by generations of forearms leaning on it exactly the same way. A vulture sat on that wall now, wings folded, watching Focci approach with the particular patience of someone who has already decided how this conversation is going to go. "Water," Focci said, trying to sound like a request and not a demand. The vulture didn\'t move. "Manners first," she said. "Then water. Maybe."',
        dec:{ q:"", options:[
          { label:"Chào hỏi lịch sự trước, không vội xin nước ngay", delta:{CAR:1}, outcome:"" },
          { label:"Xin nước ngay, giải thích mình đang rất khát", delta:{CLA:1}, outcome:"" },
          { label:"Đề nghị làm việc gì đó đổi lấy nước", delta:{AGE:1}, outcome:"" }
        ]},
        presence:[{ text:"Chào hỏi tử tế trước khi xin nước, không hấp tấp." }],
        hint:"Water is not the hardest thing to find out here.",
      },
    ]},

  { id:5, title:"The Well That Says No", mood:'SHOCK',
    lifeLesson:"Công bằng và tử tế không phải lúc nào cũng đi cùng một hướng.",
    scenes:[
      { id:'5.1', title:"No", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-frozen-in-shock',
        en:'"No," said Vask. "I\'ve got money." "I know. No." "I\'ll work for it." "There\'s no work here that pays in water. There\'s a well, and there\'s forty families behind that ridge, and there\'s about nine weeks of water left in it if nobody\'s greedy." She still hadn\'t blinked. "You are not one of the forty."',
        comp:{ q:"Why does Vask refuse Focci water?", options:["she doesn't like foxes","the well has limited water and she's protecting it for forty dependent families","she wants more money"], correct:1 },
      },
      { id:'5.2', title:"The maths of nine weeks", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-confused',
        props:['other-notebook'],
        en:'"Nine weeks doesn\'t sound like much," Focci said. "It\'s not. It\'s what\'s left after I already cut every family\'s ration twice this year." Vask finally moved, just enough to gesture at a thick, water-stained ledger sitting on the wall beside her. "You want to argue fairness with me, look at the book first. Then argue."',
        dec:{ q:"", options:[
          { label:"Xin xem sổ ngay", delta:{CLA:1}, outcome:"" },
          { label:"Không xem — tin lời Vask, đi tìm nước ở nơi khác", delta:{AGE:1}, outcome:"" },
          { label:"Hỏi Vask đã cắt phần của chính mình chưa", delta:{CLA:1}, outcome:"" }
        ]},
      },
      { id:'5.3', title:"The ledger", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-challenge',
        props:['other-notebook'],
        en:'The ledger listed forty households by a symbol, not a name — a hoofprint, a leaf, a spiral — next to columns of dates and a tally of gourds drawn each visit. Most rows showed draws every four or five days, recent, tidy. One row, near the middle, showed a last draw dated far earlier than any other entry — and beside it, someone had drawn a single, careful line through the whole row. Not scratched out. Not erased. Just crossed, once, cleanly. Underneath, in smaller writing: still allotted.',
        comp:{ q:'What does "still allotted" written under the crossed-out row mean?', options:["that household's water ration was cancelled","that household still has water set aside for them, despite the row being marked","it's a warning label"], correct:1 },
        iq:{ q:'Dòng bị gạch có lần lấy nước cách rất lâu, nhưng bên dưới ghi "still allotted". Vask làm gì với phần nước đó mỗi ngày?', options:[
          { label:"Bà giữ riêng nó, dành phần đó cho chính mình", tag:'bad', delta:{IQS:-1}, note:"Không khớp." },
          { label:"Bà bán lại phần đó cho gia đình khác lấy tiền", tag:'bad', delta:{IQS:-1}, note:"Không khớp." },
          { label:"Bà vẫn múc đúng phần nước đó ra mỗi ngày và đổ trở lại vào giếng, không dùng cho ai", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, flag:'D-06', note:"Tối ưu." }
        ]},
        presence:[{ text:"Hỏi Vask tên loài của gia đình bị gạch, và ngồi nghe hết câu trả lời." }],
      },
      { id:'5.4', title:"What Focci is offered", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        props:['other-bucket'],
        en:'"You can\'t have well water," Vask said, closing the ledger. "But you\'re not the first thirsty thing to come over that ridge, and I\'m not made of stone either, whatever I look like." She nodded at a smaller barrel, half in shade. "Rain catch. Not the well\'s. That, I can spare a cupful of."',
        dec:{ q:"", options:[
          { label:"Nhận đúng một cốc, cảm ơn, không xin thêm", delta:{CAR:1}, outcome:"" },
          { label:"Lấy thêm khi Vask quay đi", delta:{WGT:1}, outcome:"" },
          { label:"Đề nghị ở lại một giờ giúp Vask khuấy đều lớp cát lọc, đổi lại một cốc đầy hơn", delta:{AGE:1,CAR:1}, outcome:"" }
        ]},
      },
      { id:'5.5', title:"What's lying in the channel", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-confused',
        en:'As Focci turned to leave, Vask spoke again, almost as an afterthought, in the tone of someone passing along information she wasn\'t sure was her business to pass along. "There\'s something big lying in the old river channel, an hour east. Alive, when I last heard, day before yesterday. Nobody\'s gone to check since." A pause. "Not my problem. Might be yours."',
        comp:{ q:"What does Vask tell Focci before he leaves?", options:["there's danger to the west","something large and alive is stuck in the dry river channel to the east","the well will run dry tomorrow"], correct:1 },
      },
      { id:'5.6', title:"Leaving the well", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-wander',
        props:['other-well'],
        en:"Focci looked back once. Vask had already returned to her post on the wall, patient, unmoved, the ledger closed under one wing.",
        presence:[{ text:"Nói lời cảm ơn thật lòng trước khi rời đi, không chỉ vì lịch sự." }],
        hint:"Something is lying in the old river channel and it is still breathing.",
      },
    ]},

  { id:6, title:"The Long Drag", mood:'DARK',
    lifeLesson:"Em không bao giờ biết đủ để tính đúng hậu quả của việc mình giúp.",
    scenes:[
      { id:'6.1', title:"Ghar", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-scared',
        props:['other-crocodile-1'],
        en:'The crocodile was lying in a channel that had been a river three months ago. Its skin had cracked into a map of a place nobody wanted to go. "You could roll me," it said, very calmly. "Six kilometres. Downhill, mostly." "You could also eat me." "I could. I\'d rather not. I\'ve been honest so far and I\'d hate to spoil it."',
        comp:{ q:"What has happened to Ghar?", options:["he's sleeping","he's stranded in a dried-up river channel, six kilometres from water","he's guarding treasure"], correct:1 },
      },
      { id:'6.2', title:"What Ghar's name means", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-chilling',
        props:['other-crocodile-1'],
        en:'"Ghar," it said, when asked. "It means \'late arrival,\' more or less, in the old tongue. My mother had a sense of humour about the timing of my birth. I was born three weeks after everyone expected me." A dry, cracked sound that might have been a laugh. "Story of my life, apparently."',
        presence:[{ text:"Hỏi tên Ghar và nghe hết câu chuyện phía sau nó." }],
      },
      { id:'6.3', title:"The maths", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-challenge',
        props:['other-rope','other-sand-dunes'],
        en:"Focci weighed, by his own rough guess, about six kilos. Ghar weighed closer to a hundred and twenty. Between them and the river: six kilometres of soft sand, a gentle downhill slope, and half a waterskin left. The sand itself told part of the story, if you looked at it right — long, low ripples running in one consistent direction, carved by a wind that had clearly been blowing the same way for a very long time.",
        comp:{ q:"What do the consistent ripples in the sand indicate?", options:["recent rain","a wind that has blown steadily in one direction for a long time, shaping the sand's texture","buried treasure"], correct:1 },
        iq:{ q:"Cách di chuyển Ghar hiệu quả nhất, dựa vào chính cái sa mạc đang bày ra trước mắt?", options:[
          { label:"Kéo bằng dây quấn quanh người, đi thẳng theo đường ngắn nhất", tag:'bad', delta:{IQS:-1}, note:"Cắt ngang gợn cát, ma sát lớn, hỏng vai, mất thêm 1 ngày." },
          { label:"Lăn Ghar theo trục dọc, đi theo đúng hướng gợn cát, nghỉ mỗi 200m", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Tối ưu." },
          { label:"Đợi mưa để cát mềm hơn", tag:'bad', delta:{IQS:-1}, note:"Không có dấu hiệu mưa nào." }
        ]},
      },
      { id:'6.4', title:"Day one of three", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        en:'They made it perhaps a kilometre before the light went. Ghar talked the whole way, unprompted, about a flood he remembered from decades back, when the channel had been a real river for almost a full season and he\'d eaten better than he had since. "Best year of my life," he said. "Water everywhere. Frogs everywhere. Then it stopped, the way everything here stops eventually, and I was slow enough not to notice until I was the last one left in it."',
        presence:[{ text:"Ngủ lại thêm một chút giữa đường dù còn có thể đi tiếp trong bóng tối." }],
      },
      { id:'6.5', title:"Day two of three", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        en:'"Do you regret staying?" Focci asked, on the second day, sand in every joint of him by now. "Every crocodile regrets something. Mine\'s smaller than most people\'s." Ghar considered it. "I regret not moving on the day the water dropped below my knees. I told myself it would come back. It came back for everyone except me."',
        comp:{ q:"What does Ghar regret?", options:["eating too much during the flood","not leaving the channel while he still could, when the water first started dropping","being born late"], correct:1 },
      },
      { id:'6.6', title:"Day three: the last of the water", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-tired-sweaty',
        en:'The waterskin ran dry with maybe two kilometres left. Focci offered the last swallow to Ghar without quite deciding to, the way you sometimes do things before your reasons catch up. "You didn\'t have to," Ghar said. "I know."',
        presence:[{ text:"Chia phần nước cuối cùng cho Ghar." }],
      },
      { id:'6.7', title:"DEC", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-superhero',
        en:"The river was close now, close enough to smell — a mineral, green smell that Focci hadn't realised he'd missed until it arrived. The last stretch was the hardest, and the choice of whether to finish it was, in the end, entirely his to make or not make.",
        dec:{ q:"⭐ PIVOT ARC 2", pivot:true, options:[
          { label:"Kéo tới sông. Ghar sống", delta:{CAR:3,COU:2}, outcome:"" },
          { label:"Không kéo nữa. Ngồi lại với Ghar tới khi trời tối, rồi đi, để Ghar tự quyết", delta:{CLA:2,CAR:1}, outcome:"" },
          { label:"Kéo được nửa đường còn lại rồi bỏ, vì đã quá mệt", delta:{WGT:2}, outcome:"" }
        ]},
      },
      { id:'6.8', title:"After", bg:'bg-desert-and-cactus-arc-2', mascot:'mascot-cry',
        onEnterFlags:{'D-07':true},
        props:['other-footprints'],
        en:"Whatever happened at the river, the desert did not comment on it. The sand simply closed back up behind them, indifferent, ready for the next thing that would or wouldn't make it across. On the riverbank — wet, this time, undeniably — a single set of small footprints led away, fresh, headed in exactly the direction Focci was about to walk.",
        gotoChapter:7,
      },
    ]},
  ]},

{ id:3, title:'Rừng Rậm', bg:'bg-forest-mountain-arc-3',
  chapters:[

  { id:7, title:"Green Everything", mood:'BRIGHT',
    lifeLesson:"Lạc không nguy hiểm bằng giả vờ mình không lạc.",
    scenes:[
      { id:'7.1', title:"In", bg:'bg-forest-mountain-arc-3', mascot:'mascot-wander',
        props:['other-droplet','other-fern'], propsFront:['fg-mist-layer'] /* suggested extra asset, optional */,
        en:"The forest did not have a doorway, exactly, but it had a moment — one step where the light changed completely, and after that moment the sky was a rumour, glimpsed occasionally through gaps that closed again as soon as Focci looked away from them. Water dripped from somewhere above at irregular intervals, landing on leaves, on stone, once directly on his nose.",
        comp:{ q:"How does the story describe entering the forest?", options:["through a clear, marked doorway","as a single moment where the light abruptly changes, without an obvious threshold","gradually, over several hours"], correct:1 },
        presence:[{ text:"Tap vào giọt nước rơi từ lá xuống mũi." }],
      },
      { id:'7.2', title:"No Landmarks", bg:'bg-forest-mountain-arc-3', mascot:'mascot-compass',
        props:['other-rock-formation','other-vine'],
        en:"Focci walked for what felt like a long, purposeful while, and arrived back at a rock he was fairly sure he'd already passed — a rock with a particular crack shaped like a lightning bolt, which was not a shape two different rocks tended to share. The canopy was too thick here to see the sun directly. But moss grew thicker on one side of most of the tree trunks than the other, and the ground itself sloped, gently but consistently, in one direction — the direction, presumably, the stream he'd crossed that morning had been flowing away from.",
        iq:{ q:"Không thấy mặt trời, không có mốc rõ ràng. Cách xác định hướng đáng tin nhất ở đây?", options:[
          { label:"Đi theo cảm giác, cứ đi thẳng theo trực giác", tag:'bad', delta:{IQS:-1}, note:"Chính là cách đã khiến nó đi vòng hai lần." },
          { label:"Kết hợp hướng rêu dày hơn trên thân cây VÀ hướng dốc mặt đất — nếu cả hai đồng thuận, đi theo hướng đó", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Tối ưu." },
          { label:"Đi theo dốc lên cao, vì núi thường là mốc dễ thấy nhất", tag:'accept', delta:{}, note:"Không sai nhưng chậm hơn vì phải trèo." }
        ]},
        comp:{ q:"What two independent natural signs does Focci use to find direction?", options:["the sun and stars","moss growth pattern on tree trunks, and the slope of the ground relative to the stream","footprints and smoke"], correct:1 },
      },
      { id:'7.3', title:"The Counter Has a Name", bg:'bg-forest-mountain-arc-3', mascot:'mascot-wow',
        props:['other-chameleon','other-counter-machine'],
        en:'A gecko was hanging, upside down, from a low branch, apparently untroubled by the arrangement, and eyed the brass machine in Focci\'s bag with sudden, focused interest. "Lexicon counter," it said. "Haven\'t seen one of those since the old survey routes were still running. Explorers carried them — counts what you can actually name, not just what you\'ve seen."',
        comp:{ q:"What did explorers use the lexicon counter for, according to Odd?", options:["counting distance travelled","counting how many things they could actually name, not just see","telling time"], correct:1 },
        counterScene:true,
        presence:[{ text:"Hỏi Odd tại sao nó treo ngược, và nghe hết câu trả lời." }],
      },
      { id:'7.4', title:"Admitting It", bg:'bg-forest-mountain-arc-3', mascot:'mascot-confused',
        en:'"You\'re lost," Odd said. Not a question. Focci opened his mouth to deny it, out of some reflex he hadn\'t examined closely, and then didn\'t. "Yes," he said instead. "I\'m lost." It came out easier than he expected, which was itself worth noticing.',
        dec:{ q:'Cách nói ra sự thật ("mình đang lạc")', options:[
          { label:'Nói thẳng: "Yes. I\'m lost."', delta:{CLA:1}, outcome:"" },
          { label:'Nói đùa cho nhẹ đi: "Lost, or exploring aggressively."', delta:{}, outcome:"" },
          { label:"Không nói ra bằng lời — chỉ gật đầu", delta:{}, outcome:"" }
        ]},
        presence:[{ text:'Nói thẳng "I\'m lost", không né bằng câu đùa.' }],
      },
      { id:'7.5', title:"Fireflies at Noon", bg:'bg-forest-mountain-arc-3', mascot:'mascot-chilling',
        props:['other-fireflies'],
        en:"A patch of forest floor, oddly, glowed faintly even in daylight — a cluster of fireflies asleep against the underside of a fallen leaf, rare enough at this hour that Odd himself stopped talking to look at it.",
        presence:[{ text:"Ngồi xem đám đom đóm ngủ ban ngày trong 30 giây, không nói gì." }],
      },
      { id:'7.6', title:"The Marks", bg:'bg-forest-mountain-arc-3', mascot:'mascot-wow',
        props:['other-carved-tree-trunk'],
        en:"Deep in the bark of a wide old tree, someone had cut a set of symbols — not decoration, not graffiti, but something with the deliberate spacing of a system. Eight marks, evenly placed, each one clearly meant to be read rather than admired.",
        comp:{ q:"What suggests the marks are a system rather than decoration?", options:["they are colourful","they are evenly spaced with deliberate intent, meant to be read","they are very old"], correct:1 },
        hint:"Someone built a whole language into this bark, a long time before you got lost in front of it.",
      },
    ]},

  { id:8, title:"What Odd Sells", mood:'BRIGHT',
    lifeLesson:"Mọi lối tắt đều có giá, và giá thường không ghi trên bảng.",
    scenes:[
      { id:'8.1', title:"Odd's stall", bg:'bg-forest-mountain-arc-3', mascot:'mascot-chilling',
        props:['other-parchment'],
        en:"Odd had, somehow, a stall — three planks balanced on two stumps, and a hand-lettered board too small for how much it was trying to say.",
      },
      { id:'8.2', title:"The price list", bg:'bg-forest-mountain-arc-3', mascot:'mascot-challenge',
        props:['other-parchment'],
        en:'Odd sold directions. His prices were strange and non-negotiable: One shortcut = one true thing about yourself. One map = one object you\'d be sad to lose. One warning = free, but you have to listen to all of it. "Why those prices?" Focci asked. "Because information\'s only worth what it costs you to get it," said Odd. "Free advice, people ignore. Advice that cost something, people remember."',
        comp:{ q:"Why does Odd charge unusual prices instead of money?", options:["he doesn't understand money","he believes advice is only valued if it costs the listener something meaningful","he's testing Focci's honesty"], correct:1 },
        dec:{ q:"", options:[
          { label:"Mua shortcut — nói thật một chuyện về mình", delta:{CLA:1,COU:1}, outcome:"" },
          { label:"Mua map — mất vỏ ve sầu", delta:{COU:1}, requireItem:'cicadaShell', consumeItem:'cicadaShell', missingNote:"Then you've got nothing sad enough to trade. Try the warning instead.", outcome:"" },
          { label:"Lấy warning miễn phí — nghe hết, không skip", delta:{CLA:1}, setFlags:{'arc3Warning':true}, outcome:"" }
        ]},
        presence:[{ text:"Nói thật một chuyện về mình (nếu chọn mua shortcut)." }],
      },
      { id:'8.3', title:"The warning, if taken", bg:'bg-forest-mountain-arc-3', mascot:'mascot-challenge',
        onlyIf:'arc3Warning=true',
        en:'"Fine. Free warning, full version, no skipping." Odd cleared his throat with theatrical seriousness. "Somewhere ahead there\'s a tree with a mark on it that means safe crossing. It isn\'t lying, exactly. It just isn\'t telling the whole truth anymore. Marks don\'t update themselves when the world changes underneath them. Remember that when you\'re standing on the edge of something and the wood says it\'s fine."',
        comp:{ q:"What is the free warning actually about?", options:["dangerous animals ahead","an outdated trail mark that may no longer reflect current, changed conditions","Odd's own untrustworthiness"], correct:1 },
      },
      { id:'8.4', title:"The eight symbols", bg:'bg-forest-mountain-arc-3', mascot:'mascot-challenge',
        props:['other-carved-tree-trunk','other-parchment'],
        en:'Odd spread a worn cloth with the eight symbols redrawn larger, and beside them, eight words, out of order: water · danger · turn back · shelter · edible · already travelled · nothing here · steep. "Match them," he said. "I\'m not telling you how. But look at the shapes properly before you guess." A wavy line. An upward-pointing arrow. A single slash. A circle with a dot inside. A leaf shape. Two parallel lines. An empty circle. A cross.',
        iq:{ q:"Ghép 8 ký hiệu với nghĩa — dựa vào hình dạng logic, không phải đoán ngẫu nhiên", options:[
          { label:"Đoán theo thứ tự xuất hiện trong danh sách chữ", tag:'bad', delta:{IQS:-1}, note:"Sai gần hết." },
          { label:"Đọc hình dạng theo logic biểu tượng (sóng=nước, mũi tên lên=dốc, chéo đơn=quay đầu, vòng có điểm=trú, lá=ăn được, hai đường song song=đã đi qua, vòng trống=không có gì, dấu cộng=nguy hiểm)", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Tối ưu." },
          { label:"Hỏi Odd đáp án luôn", tag:'accept', delta:{}, note:"Odd từ chối." }
        ]},
        comp:{ q:"What method does Odd suggest for matching the symbols?", options:["memorize them in order","look carefully at each shape's visual logic before guessing","ask him directly for the answers"], correct:1 },
        presence:[{ text:"Sau khi ghép xong, khắc thêm ký hiệu thứ 9 của riêng mình lên một gốc cây gần đó." }],
      },
      { id:'8.5', title:"What Odd doesn't sell", bg:'bg-forest-mountain-arc-3', mascot:'mascot-chilling',
        en:'"You don\'t sell the way out," Focci noticed. "Just shortcuts, maps, warnings. Never the actual way out." "Nobody\'s ever asked for that specifically." Odd tilted his head, genuinely considering it for the first time. "Might be because everyone assumes the way out is free. It usually isn\'t, they just don\'t notice what they paid."',
        dec:{ q:"", options:[
          { label:'Hỏi Odd nghĩ mình đã trả gì cho "đường ra" của chính nó', delta:{CLA:1}, outcome:"" },
          { label:"Không hỏi thêm — cảm ơn rồi đi", delta:{}, outcome:"" },
          { label:'Đề nghị mua "đường ra" với một cái giá tự đặt ra', delta:{AGE:1}, outcome:"" }
        ]},
      },
      { id:'8.6', title:"Leaving the stall", bg:'bg-forest-mountain-arc-3', mascot:'mascot-wander',
        en:'Odd waved him off with one clawed foot, still upside down, already turning back to whatever ledger or nonsense he kept in that stall of his. "Ravine\'s ahead," he called out, almost as an afterthought. "Big tree, deep cut mark. Don\'t trust wood older than you are without checking it first."',
        hint:"A mark doesn't lie. It just stops being updated.",
      },
    ]},

  { id:9, title:"The Ravine", mood:'SHOCK',
    lifeLesson:"Bản đồ của người khác được vẽ ở một mùa khác.",
    scenes:[
      { id:'9.1', title:"The big tree", bg:'bg-forest-mountain-arc-3', mascot:'mascot-frozen-in-shock',
        props:['other-carved-tree-trunk'],
        en:"The tree was, as promised, big — wide enough that three foxes holding paws couldn't have circled it, and cut into the bark at eye height, a single deep symbol: two parallel lines, the mark for already travelled, safe. It had been cut carefully, by somebody who was not in a hurry, and clearly not recently.",
        comp:{ q:"What does the mark on the tree mean?", options:["danger ahead","this path has already been travelled safely","turn back"], correct:1 },
      },
      { id:'9.2', title:"Following it", bg:'bg-forest-mountain-arc-3', mascot:'mascot-frozen-in-shock',
        en:"Focci followed the mark's direction for what felt like two hundred confident metres, and then, without warning, the ground simply stopped being there.",
      },
      { id:'9.3', title:"The mark that lies", bg:'bg-forest-mountain-arc-3', mascot:'mascot-challenge',
        props:['other-tree','other-vine'],
        en:"The ravine was forty feet down, and at the bottom, grey and half-sunk into moss, lay the shape of a fallen log — long enough, once, to have reached both sides. The log's surface, where it caught the light, still showed the faint groove-marks of old rope wound tightly around it in several places — the unmistakable pattern of handrails, lashed on for people who needed to cross it safely, again and again. Thick, healthy moss covered most of the log now — the kind that only grows during long wet seasons.",
        iq:{ q:"Ký hiệu không sai khi được khắc. Điều gì đã thay đổi giữa lúc khắc và bây giờ?", options:[
          { label:"Có người cố tình sửa ký hiệu để hại người đi sau", tag:'bad', delta:{IQS:-1}, note:"Không có bằng chứng nào." },
          { label:"Ký hiệu được khắc vào mùa khô, khi cây đổ còn là cầu có tay vịn; mùa ẩm hiện tại làm rêu phủ dày, và lũ có thể đã đánh sập cây khỏi vị trí cầu", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, flag:'D-08', note:"Tối ưu." },
          { label:"Focci đọc nhầm ký hiệu ngay từ đầu", tag:'bad', delta:{IQS:-1}, note:"Không đúng — ký hiệu rõ ràng là an toàn." }
        ]},
        comp:{ q:"What do the rope-marks on the fallen log suggest?", options:["it was always just a fallen tree","it was once deliberately used as a bridge, with handrails lashed to it","someone tried to burn it"], correct:1 },
      },
      { id:'9.4', title:"Getting across anyway", bg:'bg-forest-mountain-arc-3', mascot:'mascot-challenge',
        en:"Forty feet was a long way to fall for the sake of trusting a tree. Focci looked for another way — and found one, eventually, a narrower crossing further upstream where two boulders leaned close enough together to jump between.",
        iq:{ q:"Chọn cách qua vực", options:[
          { label:"Nhảy qua khe hẹp giữa hai tảng đá", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Mạo hiểm nhưng có kiểm soát — tối ưu." },
          { label:"Cố trèo xuống cây đổ và đi qua bằng nó", tag:'bad', delta:{IQS:-1}, note:"Rêu trơn — nguy hiểm hơn nhiều so với vẻ ngoài." },
          { label:"Đi vòng rất xa để tìm một chỗ cạn hơn", tag:'accept', delta:{}, note:"An toàn tuyệt đối, mất nửa ngày." }
        ]},
      },
      { id:'9.5', title:"Note", bg:'bg-forest-mountain-arc-3', mascot:'mascot-confused',
        en:"On the far side, Focci looked back once at the old mark on the tree, still confidently declaring a crossing that hadn't existed in years, possibly decades. Whoever cut it had never come back to check on it. Maybe they couldn't. Maybe they just hadn't thought to.",
      },
      { id:'9.6', title:"DEC", bg:'bg-forest-mountain-arc-3', mascot:'mascot-superhero',
        en:"The choice ahead was less about this one mark and more about how Focci meant to treat every mark he'd meet from here on — Odd's whole system, the eight symbols, the language carved into every trunk in this forest.",
        dec:{ q:"⭐ PIVOT ARC 3", pivot:true, options:[
          { label:"Tiếp tục tin bộ ký hiệu, đi hết rừng theo nó như trước", delta:{CLA:-1,AGE:-1}, outcome:"" },
          { label:"Bỏ hẳn bộ ký hiệu cũ, tự khắc dấu của riêng mình cho người sau", delta:{AGE:3,COU:2}, outcome:"" },
          { label:"Vẫn đi theo bộ ký hiệu, nhưng sửa lại những dấu đã sai khi phát hiện", delta:{AGE:2,CAR:2,CLA:1}, outcome:"Chậm nhất, khó nhất — thưởng cao nhất." }
        ]},
      },
      { id:'9.7', title:"Marking it", bg:'bg-forest-mountain-arc-3', mascot:'mascot-wander',
        props:['other-carved-tree-trunk'],
        en:"Whatever he chose, Focci went back to the big tree one more time before leaving the ravine behind, and did something to the old mark — added to it, covered it, or left it exactly as it was, depending on what kind of traveller he'd just decided to be.",
        presence:[{ text:"Quay lại gốc cây có ký hiệu sai, và khắc thêm một vạch cảnh báo nhỏ bên cạnh." }],
      },
    ]},
  ]},

{ id:4, title:'Đồng Hoa Dại', bg:'bg-wildflowers-field-arc-4',
  chapters:[

  { id:10, title:"The Field of Purple", mood:'BRIGHT',
    lifeLesson:"Cái đẹp không cần em phải làm gì với nó.",
    scenes:[
      { id:'10.1', title:"Out of the trees", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-wow',
        props:['other-wildflowers'], propsFront:['fg-wildflower-blur'] /* suggested extra asset, optional */,
        en:"The forest ended the way good things sometimes do — all at once, without a transition, so that one step Focci was in green shadow and the next he was standing in an entire valley of wildflowers, stretching further than made immediate sense after weeks of trees.",
        comp:{ q:"How does the story describe the transition from forest to field?", options:["slow and gradual","abrupt, happening in a single step","it happens over several days"], correct:1 },
        presence:[{ text:'Không làm gì trong 20 giây — nút duy nhất trên màn hình là "Look".' }],
      },
      { id:'10.2', title:"Butterflies", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-chilling',
        props:['other-butterflies'],
        en:"Butterflies moved through the flowers in numbers that stopped being countable almost immediately, and one — pale orange, methodical — landed on Focci's ear and stayed there for a surprisingly long time, apparently satisfied with its choice of resting place.",
        presence:[{ text:"Không đuổi con bướm đi, để nó ở lại bao lâu nó muốn." }],
      },
      { id:'10.3', title:"Talla", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-chilling',
        props:['other-seed-bag','other-potted-flowers'],
        en:'An old bird — feathers more grey than whatever colour they\'d started as — knelt in the dirt at the field\'s centre, sorting seed envelopes into a wooden box with the slow, careful motion of someone doing something they\'d done ten thousand times and never once rushed. "You\'re standing on the chamomile," she said, without looking up. "It doesn\'t mind. Just so you know for next time."',
        comp:{ q:"What does Talla ask Focci to be mindful of?", options:["not touching her tools","where he steps, regarding a specific flower (chamomile)","staying quiet"], correct:1 },
        presence:[{ text:"Hỏi Talla loài hoa nào bà thích nhất." }],
      },
      { id:'10.4', title:"Lunch", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-chilling',
        props:['other-potted-flowers'],
        en:"\"Sit. Eat something before you ask me anything else.\" Talla didn't wait for an answer before setting down a second bowl.",
        dec:{ q:"", options:[
          { label:"Ngồi xuống ăn cùng bà", delta:{CAR:1}, outcome:"" },
          { label:"Cảm ơn nhưng nói mình phải đi tiếp", delta:{AGE:1}, grey:true, outcome:"" },
          { label:"Ở lại nhưng đứng ăn, không ngồi hẳn xuống", delta:{}, outcome:"" }
        ]},
        presence:[{ text:"Ngồi xuống ăn thay vì chỉ đứng lịch sự." }],
      },
      { id:'10.5', title:"The trampled patch", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-challenge',
        props:['other-pinecone-branch'],
        en:"At the edge of the field, under the largest of the tall pines, a patch of ground had been pressed flat — not by an animal passing through, but by something that had sat there, in the same spot, for a very long time. The indentation was deep, deeper than a brief rest would leave. A scattering of dry pine needles had drifted across the flattened patch since, settling into the impression the way needles settle over days, not hours.",
        iq:{ q:"Ước lượng ai đó đã ngồi ở đây bao lâu, và bao lâu trước", options:[
          { label:"Vài phút, mới hôm nay", tag:'bad', delta:{IQS:-1}, note:"Vết lún quá sâu cho một lần ngồi ngắn." },
          { label:"Ngồi rất lâu (nhiều giờ, có thể vài ngày), và người đó rời đi một thời gian trước rồi", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Tối ưu." },
          { label:"Không thể đoán được gì từ vết lún", tag:'accept', delta:{}, note:"Bỏ lỡ hai manh mối rõ ràng." }
        ]},
        comp:{ q:"What do the pine needles scattered across the flattened patch indicate?", options:["someone is sitting there right now","time has passed since whoever sat there left","the patch was always like this"], correct:1 },
        hint:"Somebody sat under that tree a long time, and left a while before you got here.",
      },
    ]},

  { id:11, title:"Talla's Rules", mood:'SHOCK',
    lifeLesson:"Giữ nguyên quá khứ là cách giết nó chậm nhất.",
    scenes:[
      { id:'11.1', title:"The garden's shape", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-frozen-in-shock',
        props:['other-wildflowers'],
        en:"The garden itself, once Focci looked properly, was a strict rectangle — flowers only inside its lines, nothing spilling past an edge that had clearly once been marked with string and had stayed that way out of habit long after the string rotted away.",
        comp:{ q:"What kept the garden's rectangular shape even after the original markers were gone?", options:["a fence","habit — the shape was simply maintained by routine","natural growth patterns"], correct:1 },
      },
      { id:'11.2', title:"Seven rules", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-confused',
        en:'Talla had rules. She recited them the way you recite something you\'ve stopped actually hearing: Nothing new in the west bed. Nothing yellow, anywhere. The stones stay where they are. No digging past the third row. Water at dusk only. Nobody prunes the hibiscus. Nothing gets moved, ever. "Who made the rules?" "We did," said Talla, and did not say who we was for another two days.',
        comp:{ q:'For how long does Talla avoid explaining who "we" refers to?', options:["she never explains it","two days","she explains immediately"], correct:1 },
      },
      { id:'11.3', title:"Watching the rules bend nothing", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-confused',
        en:"Focci spent an afternoon quietly testing which rules actually mattered and which had simply calcified into ritual. The stones, when nudged an inch, didn't seem to mind. Talla noticed anyway, and put them back exactly where they'd been, without comment, which told him more than an explanation would have.",
        dec:{ q:"", options:[
          { label:"Hỏi thẳng Talla tại sao bà đặt lại đúng vị trí cũ", delta:{CLA:1}, outcome:"" },
          { label:"Không hỏi — để bà giữ thói quen đó", delta:{CAR:1}, outcome:"" },
          { label:"Cố ý dịch một viên đá khác để xem phản ứng của bà", delta:{COU:1}, outcome:"" }
        ]},
      },
      { id:'11.4', title:"Forty envelopes", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-frozen-in-shock',
        props:['other-seed-bag','other-scattered-seeds'],
        en:'The seeds lived in envelopes, one species each, labelled in handwriting that had gotten shakier over the years. There were forty envelopes, and thirty-nine had never been opened. "Why keep seeds you don\'t plant?" "Because if I plant them, the garden changes. Then it isn\'t the garden she saw." "She saw it eleven years ago." "Yes." "It doesn\'t look like that now anyway." Talla didn\'t answer, which meant she knew.',
        comp:{ q:"What does Talla's silence at the end suggest?", options:["she didn't hear the question","she knows Focci is right, but won't say so out loud","she disagrees completely"], correct:1 },
      },
      { id:'11.5', title:"Why the flowers are shrinking", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-challenge',
        props:['other-sprout'],
        en:"Focci noticed it properly on the third day: this year's blooms were smaller than last year's dried heads still lying in the compost pile, which were smaller, by the look of the oldest pressed flowers Talla kept in a book, than the ones from years before that. The soil itself, where he dug an experimental inch near the west bed (against rule one, quietly), was pale and fine, almost powdery — nothing like the dark, clumping soil near the treeline just outside the garden's strict rectangle. Worms, he realised once he started looking for them, were completely absent from the garden bed. There were plenty, turning easily, in the wild soil three steps outside it.",
        iq:{ q:"Vì sao hoa mỗi năm một nhỏ dần?", options:[
          { label:"Thiếu nước — Talla tưới không đủ", tag:'bad', delta:{IQS:-1}, note:'Không khớp — quy tắc "water at dusk only" vẫn được tuân thủ nghiêm ngặt.' },
          { label:"Đất đã kiệt vì trồng đúng một khu vực, đúng vài loài, suốt mười một năm không luân canh — hết giun, bạc màu so với đất hoang ngoài vườn", tag:'ok', delta:{CLA:1,AGE:1,IQS:1}, note:"Tối ưu." },
          { label:"Khí hậu vùng này đang thay đổi", tag:'accept', delta:{}, note:"Không có manh mối nào chỉ ra điều này." }
        ]},
        comp:{ q:"What comparison reveals the soil problem?", options:["comparing this year's flowers to last year's","comparing the pale, worm-free garden soil to the darker, worm-rich soil just outside the garden's boundary","comparing flower colours"], correct:1 },
        presence:[
          { text:"Hỏi Talla tên người bạn của bà, và ngồi nghe hết." },
          { text:"Ngủ lại đêm thứ hai dù không cần thiết, chỉ vì Talla có vẻ muốn có người ở lại." }
        ],
      },
      { id:'11.6', title:"What Talla almost says", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-cry',
        props:['other-seed-bag'],
        en:'On the second night, unprompted, Talla started a sentence about her friend and didn\'t finish it. "She used to say the garden would tell you when it was tired, if you—" She stopped. Started sorting envelopes again instead.',
        dec:{ q:"", options:[
          { label:"Đợi bà nói tiếp, không hỏi", delta:{CAR:1}, outcome:"" },
          { label:'Hỏi nhẹ: "If you what?"', delta:{CLA:1}, outcome:"" },
          { label:"Đổi chủ đề, để bà thoải mái hơn", delta:{CAR:1}, outcome:"" }
        ]},
        hint:"The garden is telling her something. She has spent eleven years choosing not to translate it.",
      },
    ]},

  { id:12, title:"Envelope Number Forty", mood:'DARK',
    lifeLesson:"Có những thay đổi tốt mà em không được ở đó để chứng kiến.",
    scenes:[
      { id:'12.1', title:"The evidence, laid out", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-cry',
        en:"Focci laid it all out for her plainly, one afternoon, without meaning to make it a confrontation: the soil comparison, the missing worms, the shrinking blooms year over year. Talla listened to all of it without interrupting, which was somehow worse than if she'd argued.",
      },
      { id:'12.2', title:"Talla's answer", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-cry',
        en:'"I know," she said, when he\'d finished. "I\'ve known for at least four years. Knowing isn\'t the same as being able to do anything about it that doesn\'t feel like losing her a second time."',
        comp:{ q:"How long has Talla known about the soil problem?", options:["she just found out today","at least four years","she still doesn't believe it"], correct:1 },
      },
      { id:'12.3', title:"DEC", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-superhero',
        props:['other-seed-bag'],
        en:"The fortieth envelope sat unopened on top of the box, same as it had every day Focci had been here. Talla hadn't touched it once, though her eyes went to it more than to anything else in the garden.",
        dec:{ q:"⭐ PIVOT ARC 4", pivot:true, options:[
          { label:"Trồng một hạt mới, ban đêm, không xin phép Talla", delta:{COU:3,AGE:2,CAR:-1,WGT:1}, setFlags:{arc4Pivot:'A'}, outcome:"" },
          { label:"Không trồng gì. Ngồi nghe Talla kể về người bạn suốt một đêm, không ép bà quyết định gì", delta:{CAR:3,CLA:1}, setFlags:{arc4Pivot:'B'}, outcome:"" },
          { label:"Nói thẳng với Talla rằng đất đang chết, đưa hết bằng chứng, để bà tự quyết ngay lúc đó", delta:{COU:2,CLA:2,AGE:1}, setFlags:{arc4Pivot:'C'}, outcome:"" }
        ]},
      },
      { id:'12.4', title:"What happens next", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-cry',
        variantIf:'arc4Pivot=A',
        en:"The seed went into the soil near midnight, in the one corner of the west bed nobody checked daily. Talla noticed within the week — of course she did — and said nothing about it directly, ever, though something in how she moved around that corner changed, carefully, deliberately, like stepping around a sleeping animal she wasn't sure she trusted yet.",
        variant2If:'arc4Pivot=B',
        variant2En:"Talla talked until well past midnight, about a friend who used to read to her from books she couldn't finish herself, about an argument neither of them had ever properly resolved before it stopped mattering. She did not plant anything. She did not decide anything, out loud. But something in her shoulders had loosened by the time she stopped talking.",
        variant3If:'arc4Pivot=C',
        variant3En:'Talla was quiet for a long time after Focci finished. Then she picked up the fortieth envelope — finally — and turned it over twice without opening it. "Not tonight," she said. "But thank you for saying it plainly. Nobody\'s said it plainly before."',
      },
      { id:'12.5', title:"Leaving", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-wander',
        en:"Focci left at dawn, the way he'd arrived — through the treeline, past the trampled patch under the pines, out into whatever came next. The garden looked, from the ridge above it, exactly as small and exactly as purple as it had the first time he'd seen it.",
      },
      { id:'12.6', title:"D-09", bg:'bg-wildflowers-field-arc-4', mascot:'mascot-withflag-1',
        onEnterFlags:{'D-09':true},
        props:['other-scattered-seeds'],
        en:"Somewhere between the ridge and the next stretch of road, Focci stopped to shake out his bag — pollen and loose seed-fluff from three days in a flower field had worked their way into every seam of it, the way that field would, into anything that stayed near it long enough. Among the dust and the fluff, something small and dry rolled out and stayed on the path: a single seed, round, unremarkable, impossible to trace back to any one envelope. He didn't go back for it. It stayed on the path, waiting for whatever came next to decide what to do about it.",
        endOfBuiltContent:true,
      },
    ]},
  ]},
];

window.STORY_CONTENT = { version:1, arcs:ARCS };
})();
