# Bar for Bar

A freestyle rap battle trainer. A ball bounces across four pads every bar, and rhyme words light up where the rhyme should land. Pick a beat, set up two teams, and battle.

## Features

- **Battle mode:** two teams with rosters, alternating turns, a "Next up" card and a 1-2-3-4 count-in between turns. Play 1 to 6 rounds, or **Endless** until you press End.
- **Tournament bracket:** single elimination with byes, results carried from round to round.
- **Practice mode:** solo reps for a set number of bars, or endless.
- **Beats:** 20 built-in synth beats (boom bap, trap, drill, genre flips, phonk) with a tempo slider. You can also upload your own MP3/M4A/WAV, which detects the tempo, or use a YouTube link.
- **Words:** six word lists, four rhyme schemes (AABB, AAAA, ABAB, AA·A), an optional extra rhyme on beat 2, and options for how many words show on the pads.
  - The **Name drop** list adds the tags of the most-followed streamers and rhyme packs for about 200 first names. Rappers on the teams always get their name pack.
  - **Every name pack** turns on all the name packs, not just the rappers on the teams.
- **No repeats:** words shown in a battle are remembered on the device, so later battles get fresh ones. Streamer tags show once per tournament.
- **Word browser:** search every list and turn off single words or whole packs.
- **Look back:** pause and scroll up to see earlier bars.

Keyboard: `Space` pause, `N` next team, `Esc` end, `F` fullscreen, `↑` / `↓` look back while paused.

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
| `07-game.js` | Battle stage: timeline, ball, pads, HUD |
| `08-init.js` | Event handlers and startup |

```sh
./build.sh
```

This writes:

- `bar-for-bar.html`: the page body as published to claude.ai, where Claude adds the `<html>` wrapper.
- `index.html`: a standalone page.

Commit both after changing the sources.
