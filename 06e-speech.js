
/* ================= transcripts: the browser's own speech recognition =================
   With Transcribe on, the page listens through the microphone while you rap and keeps the text for each turn, which the
   end screen shows under that turn's words. It uses the speech service built into the browser (Chrome sends the audio to
   Google for this, Edge to Microsoft; Safari uses Apple's). Recognition reports phrases, not exact word times, so each phrase goes to
   the turn where it started: a phrase that starts in a changeover belongs to the turn before it. */
const SPEECH = window.SpeechRecognition || window.webkitSpeechRecognition || null;
// seen: the bar each phrase started in; wip: words not final yet; last: each session's latest phrase (see micCommit)
const MIC = { rec: null, sess: 0, seen: new Map(), done: new Set(), wip: new Map(), last: new Map(), live: '', liveAt: 0, began: 0, fails: 0, gaveUp: false, timer: 0,
  cumulative: /Android/i.test(navigator.userAgent) };

// online battles: this mic only hears this device's own team; a watcher has nothing to transcribe
const micAllowed = () => !!SPEECH && !!G && !(G.net && NET.role === 'w');
function micStart() {
  clearTimeout(MIC.timer);
  if (!micAllowed() || G.ended || G.paused || MIC.rec || !SETTINGS.transcribe || MIC.gaveUp) { micUI(); return; }
  const rec = new SPEECH(), g = G, sess = ++MIC.sess;
  // the word lists are English, so listen for English (keeping the browser's own accent setting when it is English)
  rec.continuous = true; rec.interimResults = true; rec.lang = /^en\b/i.test(navigator.language) ? navigator.language : 'en-US';
  rec.onresult = e => micResult(e, g, sess);
  rec.onerror = e => { if (MIC.rec === rec) micError(e); };
  rec.onend = () => {
    // a session that ends before its last words were final (a dropped connection, say) keeps them as they were heard
    for (const [k, t] of MIC.wip) if (k.startsWith(sess + ':')) micCommit(k, g, t);
    if (MIC.rec !== rec) return;   // stopped on purpose
    MIC.rec = null; MIC.live = '';
    // the service ends a session now and then (a long silence, a dropped connection): start a new one, backing off if it keeps
    // failing. If it never comes back, stop for this battle; the next one tries again
    MIC.fails = performance.now() - MIC.began < 2000 ? MIC.fails + 1 : 0;
    if (MIC.fails > 6) { MIC.gaveUp = true; micUI(); netToast('Transcribing stopped: the speech service isn’t responding. Press Transcribe to try again.', true); return; }
    MIC.timer = setTimeout(micStart, MIC.fails ? Math.min(4000, 250 * 2 ** MIC.fails) : 0);
    micUI();
  };
  MIC.began = performance.now();
  try { rec.start(); MIC.rec = rec; } catch (e) { console.warn(e); MIC.rec = null; }
  micUI();
}
function micStop() {
  clearTimeout(MIC.timer);
  const rec = MIC.rec; MIC.rec = null; MIC.live = '';
  if (rec) try { rec.stop(); } catch { }   // stop() still delivers the phrase being finished
  micUI();
}
const micOn = () => !!SETTINGS.transcribe && !MIC.gaveUp;
function micToggle() {
  if (!SPEECH) { netToast('This browser can’t transcribe. Try Chrome, Edge or Safari.', true); return; }
  if (!micAllowed() || G.ended) return;
  const on = !micOn();
  SETTINGS.transcribe = on; saveSettings(); MIC.gaveUp = false; MIC.fails = 0;
  if (on) { micStart(); netToast('Transcribing. Your rap shows up as text on the end screen.'); }
  else { micStop(); netToast('Transcribing off.'); }
}
function micError(e) {
  if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
    SETTINGS.transcribe = false; saveSettings(); micStop();
    netToast(e.error === 'audio-capture' ? 'No microphone found, so transcribing is off.'
      : e.error === 'not-allowed' ? 'Transcribing needs the microphone. Allow it for this site, then turn it back on.'
      : 'This browser’s speech recognition is off or blocked, so transcribing is off.', true);
  } else if (e.error === 'network' && MIC.fails >= 2) netToast('Can’t reach the speech service right now. Still trying.', true);
}
// the bar being heard right now
const micRow = g => Math.floor(beatAt(g.paused ? g.pauseT : heardTime()) / g.rowBeats - COUNTIN);
function micResult(e, g, sess) {
  if (!g.tx) return;
  // a phrase first heard after End belongs where the battle stopped
  const row = G === g && !g.ended ? micRow(g) : g.endNow;
  let live = '';
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const r = e.results[i], key = sess + ':' + i, text = r[0].transcript;
    if (MIC.done.has(key)) continue;
    if (!MIC.seen.has(key)) MIC.seen.set(key, row);
    if (!r.isFinal) { MIC.wip.set(key, text); live += text; continue; }
    micCommit(key, g, text);
    live = text;
  }
  if (G === g) { MIC.live = live.trim(); MIC.liveAt = performance.now(); micLiveUI(); }
}
function micCommit(key, g, text) {
  MIC.wip.delete(key); MIC.done.add(key);
  text = (text || '').trim();
  // Chrome on Android starts each new phrase with every word already heard in that session: keep only the new part
  if (MIC.cumulative) {
    const sess = key.split(':')[0], prev = MIC.last.get(sess);
    if (text) MIC.last.set(sess, text);
    if (prev && text.toLowerCase().startsWith(prev.toLowerCase()) && !/\w/.test(text[prev.length] || '')) text = text.slice(prev.length).replace(/^[\s,.;:!?]+/, '');
  }
  micAdd(g, MIC.seen.get(key), text);
}
function micAdd(g, row, text) {
  text = (text || '').trim(); if (!text) return;
  let turn = null;
  for (const s of g.segs) if (s.kind === 'turn') { if (s.start <= row || !turn) turn = s; if (s.start > row) break; }
  if (!turn || (g.net && turn.who && turn.who.team !== NET.role)) return;
  if (!g.tx.has(turn.k)) g.tx.set(turn.k, []);
  g.tx.get(turn.k).push(text);
  if (g.ended && G === g) renderEndWords(g.endNow, true);   // a phrase that finished after End
}
// the transcript as plain text, for copying
function micText(g) {
  const out = [];
  for (const s of g.segs) {
    const said = s.kind === 'turn' && g.tx.get(s.k); if (!said) continue;
    out.push((g.mode === 'battle' && s.who ? `${teamLabel(s.who.name)}, turn ${s.i + 1}` : 'Practice') + '\n' + said.join(' '));
  }
  return out.join('\n\n');
}
function micUI() {
  const b = $('#micBtn'); if (!b) return;
  b.hidden = !micAllowed();
  b.setAttribute('aria-pressed', String(micOn()));
  b.classList.toggle('live', !!MIC.rec);
  b.title = micOn() ? 'Transcribing your rap (M to stop)' : 'Transcribe your rap with the browser’s speech recognition (M). Chrome sends the audio to Google to do this, and Edge to Microsoft.';
  micLiveUI();
}
function micLiveUI() {
  const el = $('#micLive'); if (!el) return;
  // the last few words heard, so you can tell it's listening; a finished phrase clears after a few seconds. The space stays
  // while Transcribe is on so the bar doesn't jump around as words come and go
  const t = MIC.rec && MIC.live && performance.now() - MIC.liveAt < 4000 ? MIC.live : '';
  el.hidden = !(micAllowed() && micOn());
  el.firstChild.textContent = t.length > 90 ? t.slice(-90) : t;
}
setInterval(() => { if (MIC.live && performance.now() - MIC.liveAt > 4000) { MIC.live = ''; micLiveUI(); } }, 1000);
