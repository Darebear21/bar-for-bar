# Bar for Bar

A freestyle rap battle trainer. A ball bounces across four pads every bar, and rhyme words light up where the rhyme should land. Pick a beat, set up two teams, and battle.

## Features

- **Battle mode:** two teams with rosters, alternating turns, a "Next up" card and a 1-2-3-4 count-in between turns. Play 1 to 6 rounds, or **Endless** until you press End.
- **Online battles:** battle friends who are somewhere else over a voice call, with no screen sharing. See [Play online](#play-online).
- **Tournament bracket:** single elimination with byes, results carried from round to round.
- **Practice mode:** solo reps for a set number of bars, or endless.
- **Beats:** 20 built-in synth beats (boom bap, trap, drill, genre flips, phonk) with a tempo slider. You can also upload your own MP3/M4A/WAV, which detects the tempo, or use a YouTube link.
- **Words:** eleven word lists (Everyday, One-syllable, Two-syllable, One + two syllable, Rapper's toolkit, Office hours, Gaming, Internet slang, Food, Sports and Name drop), four rhyme schemes (AABB, AAAA, ABAB, AA·A), an optional extra rhyme on beat 2, and options for how many words show on the pads.
  - The **Name drop** list has rhyme packs for about 200 first names and the tags of the most-followed streamers (plus Ludwig and Atrioc). A pack only comes up when that rapper or streamer is on a team, so a rapper named "Kai Cenat" gets the KaiCenat tag.
  - **Every name pack** turns on all the name and streamer packs, not just the rappers on the teams. To use just a few, press **Turn on** next to those names in **Browse every word**.
- **No repeats:** words shown in a battle are remembered on the device, so later battles get fresh ones. Names can repeat.
- **Word browser:** search every list and turn off single words or whole packs.
- **Look back:** pause and scroll up to see earlier bars.

Keyboard: `Space` pause, `N` next team, `Esc` end, `F` fullscreen, `↑` / `↓` look back while paused. Online: `[` / `]` play the team that's on 10 ms sooner or later.

## Play online

Battle friends in other places over Discord (or any voice call) without sharing a screen.

1. Set up the battle and press **Play online**. That copies a battle link that starts in three minutes. Post it in the call's chat.
2. Everyone opens the link on their own device and picks their team, or **Watching**.
3. **Sound check:** one team counts out loud along with the clicks while everyone else slides their delay until the counting lands on their clicks. Then swap. Each device remembers its delays.
4. The battle starts on every screen at the same moment. Someone who joins late jumps straight into the right bar.

The link carries the setup, the words and the start time, so every device runs the same battle off its own clock. There is no server. Whoever is rapping hears their beat with no delay. Every other device plays that turn late by the call's delay, so the rapper's voice coming through the call lands on its beat. The delay switches during the changeover, when the mic passes to the other team, so online battles always have at least a one-bar changeover.

- Rappers wear headphones, so the call carries voices and not the beat.
- A watcher keeps a delay for each team. To stream a battle on Twitch or YouTube, pick **Watching** and capture that window plus the call audio in OBS. Viewers watch the stream and stay out of the call.
- Online battles use the built-in beats. Pause and Next team are off. End only stops your device, and **Rejoin** puts you back in.
- Every device's clock should be set automatically, so the countdowns match.
- The page has to be online (GitHub Pages works) for friends to open the link. A new start time makes a new link that everyone has to open.

## Run it

Open `index.html` in a browser. It is one self-contained page with no dependencies or server.

Settings, teams and the word memory are saved in the browser's local storage. On claude.ai the page also uses the artifact's shared database and file storage, so uploaded beats and the setup are shared with everyone who opens it. Anywhere else, uploaded beats stay on the device that added them.

## Build

The app is split into source files that `build.sh` joins in order:

| File | What it holds |
|---|---|
| `01-head.html` | Styles |
| `02-body.html` | Page markup and icons |
| `03-data.js` | Word lists, name and streamer packs, rhyme schemes, beat presets, word memory |
| `04-audio.js` | Synth engine and beat playback |
| `05-analyze.js` | Tempo detection for uploaded beats |
| `06-app.js` | Settings, setup screen, beat library |
| `06b-youtube.js` | YouTube beats |
| `06c-bracket.js` | Tournament bracket |
| `06d-online.js` | Online battles: battle links, lobby, sound check, timing |
| `07-game.js` | Battle stage: timeline, ball, pads, HUD |
| `08-init.js` | Event handlers and startup |

```sh
./build.sh
```

This writes:

- `bar-for-bar.html`: the page body as published to claude.ai, where Claude adds the `<html>` wrapper.
- `index.html`: a standalone page.

Commit both after changing the sources.
