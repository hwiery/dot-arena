# Dot Arena

**Watching the Shorts game → playing it.** A live party-game room where a creator hosts and thousands of viewers join from their phones with a 6-digit code. No install, no account.

Built for **GodDot (디네임, @d_name0)** at *Hack the Audience 2026* (Extriver, Nov 5 – Dec 5).

> 보던 쇼츠 게임, 이제 같이 한다 — 진행자가 방을 열면 시청자 수천 명이 폰으로 같은 판에 들어오는 라이브 심리 게임.

## Why this, for this creator

GodDot's channel is 51 Shorts and about 97M views (yt-dlp listing, Nov 12, 2026). Almost every video follows one format: a few people join a Minecraft game for prize money, and everyone else watches. The most repeated formats are social dilemmas: *"If you're not greedy, I'll give you money"*, *"If you trust each other"*, *"Take less than the person next to you"*. These are 12 videos and 25.3M views. Next is the forbidden-letter game *"If you don't say ㄹ, 100,000 won"*, whose top video has 5.5M views.

At 269K subscribers, only a handful can play each video. Dot Arena lets the whole audience play the same dilemma at once, live. The aggregate result then becomes the next video's punchline: *"38% of 10,000 viewers betrayed their partner."*

Details: [docs/AUDIENCE.md](docs/AUDIENCE.md) · [docs/BUSINESS.md](docs/BUSINESS.md) · [docs/TECH.md](docs/TECH.md)

## What works today

| | |
|---|---|
| **Host screen** `/host` | Creates a room, shows the code, live answer count, results chart and leaderboard. Has a "+50 bots" button for demos. |
| **Player screen** `/play` | Phone-first. Join with code + nickname, answer, see points and rank. Reconnects automatically. |
| **4 games** | **Greed:** all get their claim only if the total fits the pot. **Trust:** split or steal with a random partner. **Lowest unique number.** **Forbidden consonant:** answer a topic without spelling ㄹ/ㄴ/ㄱ/ㅁ/ㅅ, checked by Hangul jamo decomposition. |
| **Broadcast recap** | After the show, a **Render Workflow** analyzes each round in parallel and returns a 1080×1920 Shorts-size result card. |
| **Ops** | `/healthz`, Prometheus `/metrics`, JSON logs, rate limits, graceful SIGTERM, CI with a 500-player load test gating deploys. |

Points only. There is no money and no paid entry, so no gambling exposure for a young audience.

## Run locally

```bash
npm ci
npm start                 # http://localhost:3000  (host: /host, player: /play)
npm test                  # 9 unit tests
npm run load -- http://localhost:3000 2000   # 2,000 WebSocket players play one round
```

Measured on a laptop (Apple Silicon, server and bots on the same machine):

| Players | Join all | Answer ack p99 | Round result p99 |
|---|---|---|---|
| 2,000 | 0.7 s | 39 ms | 89 ms |
| 5,000 | 3.3 s | 103 ms | 185 ms |

These numbers are not from Render. Re-measure on the deployed instance before launch.

## Deploy on Render

`render.yaml` deploys **`dot-arena`**, a web service (Node, Singapore). It uses health check `/healthz` and auto-deploys only after CI passes. The prototype runs on the free plan, which sleeps after 15 idle minutes, so the first visit can take about a minute.

The recap is written for a **Render Workflow** (`workflows/index.js`): task `sessionRecap` fans out one `analyzeRound` run per round, then builds the card. It was tested with `render workflows dev`. The commented block in `render.yaml` turns it on, together with a paid plan for launch. Until then, the recap runs in-process and the recap page says which path ran.

## Project layout

```
server.js            HTTP + WebSocket server, room registry, timers, metrics
src/games.js         rules and scoring for the 4 games (pure functions)
src/hangul.js        jamo decomposition for the forbidden-consonant game
src/room.js          room state machine, ranking, session history
src/recap.js         round headlines + Shorts card SVG (shared by workflow and fallback)
src/recap-runner.js  triggers the Render Workflow, falls back to local
workflows/index.js   Render Workflow task definitions
public/              landing, host and player pages (vanilla JS)
scripts/load.js      WebSocket load test
```

## Notes

- This project is not affiliated with Mojang or Minecraft. It uses no Minecraft assets. The creator name is used only to describe the hackathon pairing.
- Built during the hackathon (Nov 2026) with AI assistance (Claude) for code and docs. All data in the docs comes from public sources cited there.
- MIT License.
