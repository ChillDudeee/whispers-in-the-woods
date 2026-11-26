# Whispers in the Woods — Phase 2 (Host Decides)

Run `npm install` then `npm start`; open http://localhost:3000.

## New Phase 2 features
- Health (0–100), inventory, story flags, and decision history.
- Choices can use `requires.items`, `requires.notItems`, `requires.flags`, and `requires.minHealth`.
- Choice `effects` support `health`, `addItems`, `removeItems`, and `setFlags`.
- Solo progress saves automatically to browser localStorage; Restart resets it.
- Multiplayer shares a single server-controlled game state. Guests vote and see named votes; host decides the final path. The host's choice applies effects to everyone.
- New key/cellar branch demonstrates locked choices and inventory use.

## Deploying to Render
Push the contents of this CYOA-Game folder to the root of your existing GitHub repository. Render can redeploy automatically. Build: `npm install`; start: `npm start`. Existing active rooms will reset on deployment.

## Limitations
Multiplayer rooms are in memory and disappear if the server restarts or sleeps. Solo saves stay on the same browser only. No user accounts or database yet. Voting is not secret. Room code is an invitation, not authentication. Do not share sensitive information in names. No real-time multiplayer browser automation test was run.

## Phase 2 visual update

Health now appears as a 0-100 progress bar (green, amber at 50 or below, red at 25 or below). Multiplayer guest votes appear in a live poll with counts, percentages of votes cast, and voter names. The host still decides the final path; poll bars do not trigger automatic advancement.

## Phase 3 visual and audio additions
- Five locally bundled SVG scene backgrounds (forest, cabin, cave, cellar, ruins), assigned by scene metadata in `story/chapter1.json`.
- Illustrated wolf portrait on wolf-related scenes.
- Scene transition animation, disabled for reduced-motion preferences.
- Optional synthesized scene cue (no external audio downloads); sound is off by default and only starts after clicking the Sound toggle.
- Existing health bar, poll voting, host decision, multiplayer rooms, and solo save system are preserved.
- To customize scenes, change each scene's `background` to one of `forest`, `cabin`, `cave`, `cellar`, `ruins`, or set `portrait` to `wolf`.

## Phase 4 — Saves, validation and deployment readiness
- Solo games still autosave to browser localStorage. In solo mode, use **Export save** to download a portable `whispers-solo-save.json`, and **Import save** to restore one. Import validates the file before replacing your current game; keep backups of important saves.
- `npm test` runs Node's built-in test runner: checks story destinations, graph reachability (ignoring requirements), game state, save round-trips, invalid saves, and locked-choice enforcement.
- `GET /health` returns a small JSON response for hosting health checks.
- For local development: `npm install`, `npm test`, `npm start`, then visit `http://localhost:3000`.
- For Render: commit the **contents** of `CYOA-Game` to your repository root; build command `npm install`, start command `npm start`. Check Render logs and `/health` after deployment. Test a solo save export/import and a two-browser multiplayer room.
- Multiplayer rooms remain **in-memory only**. Server restarts, redeployments, or sleeping free hosting instances erase multiplayer rooms and shared progress. Solo autosaves stay on the same browser; portable JSON saves are manually transferable.
- The tests are automated logic checks, not a substitute for testing two real browsers and mobile layouts. The server has no user authentication or persistent multiplayer database.

## Phase 5: multiplayer persistence and reconnecting

- Rooms now use stable, random player session tokens stored in each player's browser. Refreshing or reconnecting resumes the same identity, including the host role. Use **Resume previous multiplayer room** after reopening the site.
- Offline players remain listed in the room, and the host may transfer ownership to another member using **Transfer host**. The host still has final control over story choices; guests' votes remain visible in the poll.
- For persistence across Render restarts, set `DATABASE_URL` to a PostgreSQL connection string in Render's **Environment** settings. The server creates a `cyoa_rooms` table on startup. Without this variable, rooms work but remain memory-only.
- Use a managed PostgreSQL service with a persistent database. Render's free web service alone does not provide persistent storage. Database plans and retention policies vary; check your provider's pricing.
- If your database requires a custom CA certificate, configure the Node.js trust store appropriately. For a local non-TLS Postgres instance only, set `PGSSL=disable`. Do not disable certificate verification for public production databases.
- Room data includes names, player tokens, votes, and game progress. Treat the database URL as a secret and never commit it to GitHub. Possession of a player's browser token grants control of that player, so do not share browser storage or tokens.
- Rooms persist until all members explicitly leave. Offline members still occupy room slots; an administrator may need to remove abandoned rooms from the database. This version assumes **one running server instance**; do not scale Render to multiple instances without shared Socket.IO coordination and synchronized room updates.
- Install dependencies using `npm install` and run `npm test`, then `npm start`. Render build command: `npm install`; start command: `npm start`.
