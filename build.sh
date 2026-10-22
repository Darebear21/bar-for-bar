#!/bin/sh
# Builds the app from the sources in this folder:
#   bar-for-bar.html  the page body, as published to claude.ai (Claude adds the <html>/<head> wrapper)
#   index.html        a standalone page you can open directly or host anywhere
cd "$(dirname "$0")"
{ cat 01-head.html 02-body.html; echo '<script>'; cat 03-data.js 04-audio.js 05-analyze.js 06-app.js 06b-youtube.js 06c-bracket.js 06d-online.js 06e-speech.js 07-game.js 08-init.js; echo '</script>'; } > bar-for-bar.html
python3 standalone.py
wc -c bar-for-bar.html index.html
