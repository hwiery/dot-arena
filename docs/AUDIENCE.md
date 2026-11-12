# Audience research: GodDot (디네임, @d_name0)

Sources: the YouTube channel page and a `yt-dlp --flat-playlist` listing of the Shorts tab, both taken Nov 12, 2026. Raw rows are in [data/goddot_shorts.csv](data/goddot_shorts.csv). View counts are YouTube's rounded figures. Titles appear as YouTube listed them, and some are auto-translated.

## Channel facts

| | |
|---|---|
| Subscribers | 269K |
| Videos | 51, all Shorts |
| Total views | 98.7M (channel page); 97.2M summed from the listing |
| Median views per Short | 1.7M |
| Joined | Dec 6, 2022 |
| Platforms | YouTube. TikTok @goddot2. The channel description says no other platforms. |
| Participation | A pinned video, "(클릭) 쇼츠 게임에 참가하는 방법", explains how to take part. Viewers join through a Discord invite, `discord.gg/player`. On Nov 12 the public invite API showed a server named "Minecraft Gaming" with about 1,446 members. We could not confirm that this is the creator's server. |

## What the audience watches

We tagged each Short with keyword rules into six formats (see the CSV):

| Format | Videos | Median views | Total views | Share |
|---|---|---|---|---|
| Search / race (find the diamond first, mine ore in 1 min) | 10 | 2.7M | 27.9M | 29% |
| **Social dilemma** (don't be greedy, trust each other, take less than your neighbour, press the button) | **12** | 1.9M | 25.3M | 26% |
| Roulette / survival (lava, Warden, traps) | 10 | 1.65M | 17.6M | 18% |
| Other | 5 | 1.9M | 9.6M | 10% |
| Quiz (guess the block, name the YouTuber) | 10 | 1.03M | 9.3M | 10% |
| **Forbidden letter** (don't say ㄹ/ㄴ/ㄱ) | 4 | 0.78M | 7.5M | 8% |

Top 10 Shorts:

| Views | Title (as listed) | Format |
|---|---|---|
| 5.5M | If you don't say ㄹ, it's 100,000 won! | forbidden letter |
| 5.2M | Find the diamond's location and we'll give you money! | search / race |
| 5.1M | If you're not greedy, I'll give you money! | social dilemma |
| 5.0M | If you get an ore in one minute, money will be awarded! | search / race |
| 4.1M | If you avoid the Warden, I'll give you money! | survival |
| 3.8M | The consequence for a user who used hacks… (KartRider) | other |
| 3.4M | Don't fall into the trap or I'll give you money! | survival |
| 3.3M | If you catch a monster with a random item… | search / race |
| 3.3M | If you're not greedy, I'll give you money! | social dilemma |
| 3.3M | Be the first to mine diamonds and we'll give you money! | search / race |

## What this means

1. **The format is participation, but only a few can play.** Every video stars a handful of players picked from the community, while millions watch. The unmet want is "let me play too."
2. **Social dilemmas carry the channel.** "Don't be greedy" alone appears 5 times. These games need no Minecraft skill and work on a phone in 15 seconds. They also get more interesting as more people play: a greed pot shared by 5,000 people is a better story than one shared by 5.
3. **Korean wordplay travels.** The ㄹ-ban Short is the channel's top video. A jamo game is cheap to build and native to this audience. Global party-game apps don't have one.
4. **Who watches (inference, not measured):** Minecraft and KartRider themes, ₩100,000 and chicken prizes, and ㅋㅋㅋㅋ titles point to Korean teens and young adults on mobile. This matters for two design choices: there are no accounts and no personal data beyond a nickname, and there are no real-money stakes.

## How the product maps to the channel

| Channel format | Dot Arena game |
|---|---|
| 욕심내지 않으면 돈을 드립니다 | Greed: shared pot, everyone gets 0 if the total overflows |
| 서로를 신뢰한다면 / 모르는 사람을 신뢰하면 | Trust: split or steal with a random partner |
| 옆사람보다 적게 가져가면 / 100명 중 1등 | Lowest unique number |
| ㄹ을 말하지 않으면 10만원 | Forbidden consonant, checked by jamo decomposition |
| (next video) | Recap card: "38% of 10,000 viewers stole", in Shorts format |

## Not measured yet

- Real demographics (age, gender, region) are only available in YouTube Studio, which the creator would share.
- Willingness to pay. We will test it with the pass and party-room prices in [BUSINESS.md](BUSINESS.md) during the first live session.
