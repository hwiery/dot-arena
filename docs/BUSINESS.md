# Business model

## Customer and job

| Who | Job | Pays? |
|---|---|---|
| GodDot's viewers | "Let me actually play the game I watch, against everyone else." | Small amounts, for status and for playing with friends |
| GodDot | Fresh video material each week, and a reason for viewers to come back between uploads | Through revenue share, no fee |
| Brands that target Korean teens (snacks, convenience stores, mobile games) | Put a product inside a game thousands are playing live | Yes, per sponsored round |
| Smaller creators (later) | The same audience-game kit for their own community | Yes, monthly |

## Revenue streams

Play is always free. There is no paid entry and no cash prize funded by players. This keeps the product clear of Korea's rules on gambling-like games (사행성) and keeps it safe for a young audience.

None of the paid features below are built yet. The prototype is the free core they sit on.

| Stream | Price (to test) | Notes |
|---|---|---|
| **Dot Pass** (cosmetic) | ₩3,900 / month | Name colour and badge on the leaderboard, your name on the recap card, play history, priority entry when a room is full |
| **Party Room** | ₩2,900 per room for one night | A private room for friends or a class, using the same games. The free tier would cap rooms at 8 players. |
| **Sponsored round** | ₩500K–1M per round | A brand funds the prize (e.g. chicken coupons for the top 10), the same way the channel already gives prizes. The prize is free to enter, with no purchase needed. |
| **Creator kit** (phase 2) | ₩9,900 / month | Other creators host their own rooms and get their own recap cards. |

## Scenario (all inputs are assumptions)

Monthly, after launch with GodDot promoting one live session per week:

| Input | Assumption |
|---|---|
| Viewers who play at least once a month | 2% of 269K subscribers = **5,400** |
| Pass conversion | 3% of players = 162 × ₩3,900 = **₩632K** |
| Party rooms | 300 / month × ₩2,900 = **₩870K** |
| Sponsored rounds | 2 / month × ₩700K = **₩1.4M** |
| **Gross** | **≈ ₩2.9M / month** |

The scenario has no creator-kit revenue. That stream is where the product can scale beyond one channel.

## Costs

| Item | Monthly |
|---|---|
| Render web service (Starter, then Standard for live nights) | $7–25 |
| Render Workflow runs (a few seconds of compute per recap) | under $1 at 4 shows/month |
| Payment fees (PG via Extriver) | ~3–4% of revenue |
| Domain (.xyz, free year 1) | 0 |

Infrastructure is under 2% of the scenario revenue. The real cost is the creator's airtime, which the revenue share pays for.

## Competition

| | Players per room | Built for | Korean wordplay | Result as video content |
|---|---|---|---|---|
| Kahoot | Large | Classrooms, quizzes | No | No |
| Jackbox | 8 + audience | Living rooms, paid packs | No | No |
| YouTube live polls | Unlimited | One question, no game | No | No |
| Discord activities | Small | Friends | No | No |
| **Dot Arena** | **Thousands** | **One creator's audience and formats** | **Yes (jamo game)** | **Yes (recap card)** |

## Growth loop

Live session → the recap card ("38% of 10,000 viewers stole") → a new Short → new viewers → the next live session. Each loop makes content for the creator, and it costs the creator nothing to make.

## Risks and answers

- **Young audience and payments:** There are no accounts. The pass and party rooms need guardian payment consent through the PG.
- **Cheating with bots or multiple tabs:** There are per-socket rate limits now. Next come per-IP join caps and Turnstile on join for sponsored rounds.
- **Novelty fades:** Add a new game every two weeks, each one taken from the creator's newest Short.
