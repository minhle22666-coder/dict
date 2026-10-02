# Focci — XP and reward rules

This file is the source of truth for every number the games award, spend
or count. If you change a value in the code, change it here too. The same
table is shown in the app: **Progress › How XP works** (`xpRulesHtml()` in
`app.js`).

## The idea behind the numbers

- **One good day is 10–15 minutes.** The default daily goal is 20 XP. One
  round of a mini game (about 5 XP), five lookups (5 XP) and one claimed
  quest (10 XP) clear it. Quests alone can add 45 XP, so a keen day goes
  well past the goal without grinding.
- **A level is 100 XP**: about four to five ordinary days.
- **The animals never need to cost you XP.** Each one loses about 3.4
  energy bars a day. One 3-hour sleep restores 5 bars for free. Feeding (2 XP a
  bar) is the fast way, and it also builds the bond.
- **Gifts come from looking after an animal over several days**, not from
  one long session of tapping. Bond is capped per action per day. The
  first gift is reachable on day one. After that, one arrives every one to
  three days.
- **Mistakes cost a little, never everything.** The paragraph hunt pays
  less after a wrong check, but a correct answer always pays something.
  Repeat hunts on the same day still pay, just less.

## Earning XP

| Action | XP | Notes |
|---|---|---|
| Look up a word | +1 | every lookup |
| Save a word | +1 | |
| Letter Trail: find a word on the board | +1 | five words a board |
| Listening: a round at 80% or more | +2 | small slips (I've / I have, a plural -s, a/an/the, words that sound alike) count as right |
| Listening: a round at 50% or more | +1 | |
| Word Pairs: right answer | +1 | asked by an animal on the island |
| Speak Up: a graded answer | +2 | |
| Hot Take: finish an article | +5 | |
| Island: pick up a letter | +1 | |
| Island: complete the hidden word | +3 | |
| Island: open the treasure | +6 | |
| Island: pick up a mushroom | +1 | |
| Paragraph hunt (play together) | +12 / +9 / +6 | right on the 1st / 2nd / later check |
| Paragraph hunt, 3rd and later of the day | +3 | |
| Quest: look up 5 words | +10 | claim in Progress |
| Quest: save a word | +10 | |
| Quest: look after an animal | +10 | pet, feed or talk to one |
| Quest: play a game | +15 | finish any round |

## Spending XP

| Action | XP |
|---|---|
| Feed an animal (one energy bar) | −2 |
| Rescue a rabbit / duck / sheep / cat / wolf | −60 / −80 / −120 / −160 / −240 |

## Looking after an animal

Energy is shown as 10 bars, and each meal fills one. An animal loses
about 34 energy a day. Cleanliness drops by a quarter each day. Happiness
slowly follows energy.

| Action | What it does | Bond | Bond counted per day | Limit |
|---|---|---|---|---|
| Feed | +1 energy bar, −2 XP | +1 | 4 | not when full |
| Pet | +4 happiness, hearts | +1 | 5 | — |
| Talk | +2 happiness per message | +1 | 6 | needs a Gemini key |
| Bath | clean again, +6 happiness | +2 | 1 | only when no longer "fresh" |
| Sleep | 3 h lying down inside a house, then +5 energy bars and +8 happiness | +1 | 2 | 4 h after waking |
| Word Pairs | five questions the animal asks; +1 XP for each right answer, +5 happiness | +2 | 2 | needs a few looked-up words |
| Play together | +5 happiness for each animal you brought | +3 each | 2 | needs 3 or more animals awake |

Actions past the daily count still work. They give +1 happiness but no
bond.

**Gifts.** Gifts come back from a long sleep. Bond has to reach 6, 16,
30, 48, 70, 96, 126 or 160 (then every 40 more) and happiness has to be at
least 50. Then the animal is sent to sleep. It wakes three hours later
with a gift. Each animal gives at most one gift a day. On its own, tapping
pet and feed only fills the bond. Every gift also takes time and a sleep. A gift
holds five real expressions from the animal's field, each with its
meaning, an example and a tip. Gifts are kept in Saved › Gifts and in that
day's Journal, and they play as real YouGlish clips.

**Experts.** Each animal is an expert in one of 24 areas of life:
healing, love, astrology and tarot, survival, office life, careers,
money, family, parenting, self-growth, everyday chemistry, the body,
cooking, life hacks, social skills, mindfulness, dreams, history, nature,
behaviour, tech safety, travel, green living, creativity. No two animals
share an area until all 24 are taken.

## The paragraph hunt

Every awake animal on the island carries one paragraph. With N animals:

| Animals | Parts of the story | Other paragraphs |
|---|---|---|
| 3–4 | 2 | N − 2 |
| 5–6 | 3 | N − 3 |
| 7+ | 4 | N − 4 |

Tap an animal to read its part, then bring the parts that belong together
(they follow Focci). When you check, a wrong answer tells you how many of
your picks belong together. A right answer shows the whole story in order.
