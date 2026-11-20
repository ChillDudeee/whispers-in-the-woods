# Whispers in the Woods — Solo + Multiplayer

A visual browser-based choose-your-own-adventure game with individual play and shared voting rooms.

## Run locally (Windows / macOS / Linux)

Install Node.js 20 or later. In VS Code, open this folder, then open Terminal:

```sh
npm install
npm start
```

Open **http://localhost:3000**. No Python needed. To test multiplayer, open two browser windows or use two devices that can reach the same server, create a room, and join using its five-character code.

## Playing

- **Solo:** Each choice immediately changes the scene. Restart whenever you want.
- **Multiplayer:** Create a room, share its code, and have friends join. Each connected player casts one vote per scene. Once *all connected players* have voted, the winning choice advances the room. Ties go to the first tied choice in the JSON. The host can restart. If the host leaves, the next player becomes host.
- A room supports up to 12 players. Room state is held in memory; restarting the server resets all rooms. If your connection drops, rejoin the room with the code and your name.

## Playing with friends over the internet

Running on `localhost` **does not** make the game publicly accessible. Deploy this Node.js app to a hosting provider that supports persistent Node servers and WebSocket connections (e.g., a Node web service on Render or Railway). Run build/install `npm install` and start `npm start`, expose the provider's `PORT`, and share its HTTPS URL. A static-only GitHub Pages deployment can host solo mode but **cannot host this multiplayer server**. For testing on your home Wi-Fi, friends may use your computer's LAN IP and port 3000 if local firewall/network settings permit; do not expose your home router publicly for this demo.

## Project layout

- `index.html`, `css/style.css`: lobby and visual game interface
- `js/main.js`, `js/ui.js`, `js/engine.js`: browser client and solo story engine
- `story/chapter1.json`: story scenes and choices
- `server.js`: Express static server and Socket.IO room/voting logic
- `assets/`: backgrounds

## Scope and limitations

This is a starter prototype, not a production-hardened public service. No accounts, saved games, chat, moderation, rate limiting, persistent rooms, or cross-server scaling. Player names are display-only and not authenticated. Use a single Node server instance for shared room state. Add input/rate limits, monitoring, persistence, and abuse controls before broad public launch.

## Host-decides voting (updated)
Guests vote for one option per scene. All players can see each guest's selected option and live totals. The host does not vote: their choice buttons say **Decide**, and selecting one advances everyone immediately, regardless of the vote totals. Votes reset for the next scene. If the host disconnects, the next connected player becomes host.

To update an existing Render deployment, replace the source files in your GitHub repository with the contents of this folder, commit the changes, and wait for Render to deploy. Do not upload `node_modules`.
