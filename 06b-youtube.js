
/* ================= YouTube beats =================
   A YouTube beat plays in YouTube's own (visible) player. The page can't read its audio, so the tempo and
   bar 1 are set by hand, and the stage follows the video's clock instead of the audio engine's. */
const YT_KEY = 'bfb.ytBeats';
const YTB = { list: ls.get(YT_KEY, []).filter(v => v && /^[\w-]{11}$/.test(v.videoId) && v.bpm > 0), state: 'idle', waiters: [] };
const saveYT = () => ls.set(YT_KEY, YTB.list);
function ytBeats() {
  return YTB.list.map(v => ({ id: 'yt:' + v.id, kind: 'yt', name: v.name, style: 'YouTube', bpm: v.bpm, color: '#ff4e45', meta: { ...v, downbeat: v.bar1, rapStartBar: 1 } }));
}
function ytId(url) {
  const s = String(url || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let u; try { u = new URL(/^https?:/i.test(s) ? s : 'https://' + s); } catch { return null; }
  const h = u.hostname.replace(/^(www|m|music)\./, '');
  if (h === 'youtu.be') return (u.pathname.slice(1).match(/^[\w-]{11}/) || [])[0] || null;
  if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v'); if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/); return m ? m[1] : null;
  }
  return null;
}
const ytBlockedMsg = () => window.claude ? 'YouTube is blocked inside this preview. Open the Hackweek site to use YouTube links.' : 'Could not reach YouTube. Check the internet connection and try again.';
function loadYTApi() {
  if (YTB.state === 'ready') return Promise.resolve(window.YT);
  return new Promise((res, rej) => {
    YTB.waiters.push([res, rej]);
    if (YTB.state === 'loading') return;
    YTB.state = 'loading';
    const done = ok => { YTB.state = ok ? 'ready' : 'idle'; YTB.waiters.splice(0).forEach(([a, b]) => ok ? a(window.YT) : b(new Error(ytBlockedMsg()))); };
    if (window.YT && window.YT.Player) { done(true); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { try { prev && prev(); } catch { } done(true); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = () => { s.remove(); done(false); };
    document.head.appendChild(s);
    setTimeout(() => { if (YTB.state === 'loading') done(false); }, 12000);
  });
}
const YT_ERR = {
  2: 'That link doesn’t point to a video.',
  5: 'This video can’t play in a browser player.',
  100: 'That video was removed or is private.',
  101: 'The owner of this video doesn’t allow it to play on other sites. Try another upload of the same beat.',
  150: 'The owner of this video doesn’t allow it to play on other sites. Try another upload of the same beat.',
};
function makePlayer(host, videoId, on = {}) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('YouTube took too long to load.')), 15000);
    const p = new YT.Player(host, {
      videoId, width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, iv_load_policy: 3, origin: location.origin },
      events: { onReady: () => { clearTimeout(t); res(p); }, onError: e => on.error && on.error(e.data), onStateChange: e => on.state && on.state(e.data) },
    });
  });
}
/* Maps the video's clock onto the stage clock: T0 is the moment song position pos0 is heard.
   Samples are only taken while the video time is actually moving (not during ads, buffering or pauses). */
function ytClock(player, pos0) {
  const C = { pos0, T0: null, samples: [], loops: 0, loopLen: 0, lastVt: null };
  C.reset = () => { C.samples.length = 0; C.lastVt = null; };
  C.update = () => {
    let vt, st;
    try { st = player.getPlayerState(); vt = player.getCurrentTime(); } catch { return C.T0 !== null; }
    const moving = st === 1 && C.lastVt !== null && vt > C.lastVt; C.lastVt = vt;
    if (!moving) { C.samples.length = 0; return C.T0 !== null; }
    const cand = heardTime() + SETTINGS.syncMs / 1000 - (vt + C.loops * C.loopLen - C.pos0);
    C.samples.push(cand); if (C.samples.length > 24) C.samples.shift();
    if (C.samples.length < 6) return C.T0 !== null;
    const med = [...C.samples].sort((a, b) => a - b)[C.samples.length >> 1];
    if (C.T0 === null || Math.abs(med - C.T0) > 0.12) C.T0 = med; else C.T0 += (med - C.T0) * 0.06;
    return true;
  };
  return C;
}

/* ---- setup sheet: tempo, bar 1, and a click to check them ---- */
const YTT = { open: false, player: null };
const ytStatus = (t, err = false) => { const el = $('#ytStatus'); el.textContent = t; el.classList.toggle('err', err); };
function ytBar1Label() { const t = YTT.bar1; $('#ytBar1').textContent = t == null ? 'not set' : Math.floor(t / 60) + ':' + (t % 60).toFixed(2).padStart(5, '0'); }
async function addYouTube() {
  const inp = $('#ytUrl'); const id = ytId(inp && inp.value);
  if (!id) { setBeatStatus('That doesn’t look like a YouTube link. Copy it from the address bar or the Share button.', true); return; }
  setBeatStatus('');
  openYT({ mode: 'new', videoId: id, name: '', bpm: null, bar1: null });
}
async function openYT(o) {
  stopPreview();
  Object.assign(YTT, { open: true, taps: [], checking: false, titled: !!o.name }, o);
  $('#ytName').value = YTT.name || ''; $('#ytBpm').value = YTT.bpm ? fmtBpm(YTT.bpm) : '';
  $('#ytTap').textContent = 'Tap'; ytBar1Label();
  $('#ytTitle').textContent = YTT.mode === 'new' ? 'Set up a YouTube beat' : 'Tune ' + (YTT.name || 'YouTube beat');
  $('#ytSave').textContent = YTT.mode === 'new' ? 'Save beat' : 'Save changes';
  $('#ytSheet').hidden = false;
  ytStatus('Loading the video…');
  try {
    await loadYTApi();
    if (!YTT.player) YTT.player = await makePlayer($('#ytTunePlayer'), YTT.videoId, { error: c => ytStatus(YT_ERR[c] || 'This video can’t be played here.', true), state: ytTunerState });
    else YTT.player.cueVideoById(YTT.videoId);
    if (!YTT.open) return;
    ytStatus(YTT.mode === 'new' ? 'Play the video, tap the tempo, then press Mark bar 1 on a downbeat.' : 'Press play from bar 1 to check the click still lines up.');
    if (o.autoCheck) ytCheck();
  } catch (e) { ytStatus(e.message || ytBlockedMsg(), true); }
}
function ytTunerState(s) {
  if (!YTT.titled) { try { const d = YTT.player.getVideoData(); if (d && d.title) { YTT.titled = true; if (!$('#ytName').value.trim()) $('#ytName').value = d.title.replace(/\s*[\[(].*?(free|type beat|prod).*?[\])]\s*/ig, ' ').trim().slice(0, 60); } } catch { } }
  if (s !== 1 && YTT.checking && s !== 3) ytCheckStop();
}
function closeYT() {
  ytCheckStop();
  try { YTT.player && YTT.player.pauseVideo(); } catch { }
  YTT.open = false; $('#ytSheet').hidden = true;
}
function ytSetBpm(b) { if (!(b > 0)) return; while (b < 50) b *= 2; while (b > 200) b /= 2; YTT.bpm = Math.round(b * 100) / 100; $('#ytBpm').value = fmtBpm(YTT.bpm); ytRecheck(); }
function ytTap() {
  const p = YTT.player; let vt; try { vt = p.getCurrentTime(); } catch { return; }
  if (!p || p.getPlayerState() !== 1) { ytStatus('Play the video first, then tap along with the beat.'); return; }
  if (YTT.taps.length && (vt - YTT.taps[YTT.taps.length - 1] > 2.2 || vt < YTT.taps[YTT.taps.length - 1])) YTT.taps = [];
  YTT.taps.push(vt); if (YTT.taps.length > 16) YTT.taps.shift();
  const n = YTT.taps.length;
  $('#ytTap').textContent = n < 4 ? `Tap ${'•'.repeat(n)}` : 'Tap ✓';
  if (n >= 4) {
    // least-squares slope through the taps: steadier than first-to-last
    const xs = YTT.taps.map((_, i) => i), mx = (n - 1) / 2, my = YTT.taps.reduce((a, b) => a + b, 0) / n;
    const slope = xs.reduce((a, x, i) => a + (x - mx) * (YTT.taps[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    let bpm = 60 / slope; if (Math.abs(bpm - Math.round(bpm)) < 0.35) bpm = Math.round(bpm);
    ytSetBpm(bpm);
  }
}
// the beat grid's phase from recent taps (circular mean), so Mark lands exactly on a beat
function tapPhase(spb) {
  if (YTT.taps.length < 4) return null;
  let sx = 0, sy = 0; for (const t of YTT.taps) { const a = 2 * Math.PI * (t / spb); sx += Math.cos(a); sy += Math.sin(a); }
  return ((Math.atan2(sy, sx) / (2 * Math.PI)) * spb + spb) % spb;
}
function ytMark() {
  const p = YTT.player; if (!p) return;
  let vt; try { vt = p.getCurrentTime(); } catch { return; }
  if (p.getPlayerState() !== 1) { ytStatus('Play the video, then press Mark right on a downbeat.'); return; }
  if (YTT.bpm) { const spb = 60 / YTT.bpm, ph = tapPhase(spb); if (ph != null) vt = Math.round((vt - ph) / spb) * spb + ph; }
  YTT.bar1 = Math.max(0, Math.round(vt * 1000) / 1000); ytBar1Label();
  ytStatus(YTT.bpm ? 'Bar 1 set. Press play from bar 1 to check it with the click.' : 'Bar 1 set. Now set the tempo.');
}
function ytNudge(v) {
  if (YTT.bar1 == null) { ytStatus('Mark bar 1 first.'); return; }
  const d = v === 'b' ? 60 / (YTT.bpm || 90) : v === '-b' ? -60 / (YTT.bpm || 90) : +v;
  YTT.bar1 = Math.max(0, Math.round((YTT.bar1 + d) * 1000) / 1000); ytBar1Label(); ytRecheck();
}
function ytRecheck() { if (YTT.checking && YTT.clock) { YTT.clock.pos0 = ytCountPos(); YTT.clock.reset(); ytClicks(); } }
const ytCountPos = () => YTT.bar1 - 2 * 240 / YTT.bpm;
function ytClicks() {
  const ctx = initAudio();
  startPlayback({ bpm: YTT.bpm, T0: ctx.currentTime + 1e5, click: true });
}
async function ytCheck() {
  if (YTT.checking) { ytCheckStop(); try { YTT.player.pauseVideo(); } catch { } return; }
  const bpm = +$('#ytBpm').value; if (bpm > 0) YTT.bpm = bpm;
  if (!YTT.bpm) { ytStatus('Set the tempo first: tap along or type the BPM.', true); return; }
  if (YTT.bar1 == null) { ytStatus('Mark bar 1 first: play the video and press Mark on a downbeat.', true); return; }
  const ctx = initAudio(); try { await ctx.resume(); } catch { }
  const p = YTT.player; if (!p) return;
  YTT.checking = true; $('#ytCheck').innerHTML = '<svg width="14" height="14"><use href="#i-stop"/></svg>Stop';
  YTT.clock = ytClock(p, ytCountPos());
  ytClicks();
  p.seekTo(Math.max(0, ytCountPos()), true); p.playVideo();
  const leds = $$('#ytLeds i');
  const loop = () => {
    if (!YTT.checking) return; YTT.raf = requestAnimationFrame(loop);
    if (YTT.clock.update()) S.T0 = YTT.clock.T0;
    const T0 = YTT.clock.T0; if (T0 == null) return;
    const beat = Math.floor((heardTime() - T0) / (60 / YTT.bpm));
    leds.forEach((l, i) => { const on = beat >= 0 && ((beat % 4) + 4) % 4 === i; l.classList.toggle('on', on); l.classList.toggle('one', on && i === 0); });
  };
  loop();
}
function ytCheckStop() {
  if (!YTT.checking) return;
  YTT.checking = false; cancelAnimationFrame(YTT.raf); stopPlayback(0.05);
  $('#ytCheck').innerHTML = '<svg width="14" height="14"><use href="#i-play"/></svg>Play from bar 1 with click';
  $$('#ytLeds i').forEach(l => l.className = '');
}
function ytSave() {
  const bpm = +$('#ytBpm').value;
  if (!(bpm >= 40 && bpm <= 220)) { ytStatus('Set a tempo between 40 and 220 BPM.', true); return; }
  const name = $('#ytName').value.trim() || 'YouTube beat';
  const bar1 = YTT.bar1 == null ? 0 : YTT.bar1;
  if (YTT.mode === 'new') {
    const id = Date.now().toString(36);
    YTB.list.unshift({ id, videoId: YTT.videoId, name, bpm, bar1, createdAt: Date.now() });
    CFG.beat = 'yt:' + id; saveCfg();
    const u = $('#ytUrl'); if (u) u.value = '';
  } else {
    const v = YTB.list.find(x => x.id === YTT.id); if (v) Object.assign(v, { name, bpm, bar1 });
  }
  saveYT(); closeYT(); setBeatStatus(YTT.bar1 == null ? `Saved “${esc(name)}”. Bar 1 is at the very start, so the count-in may be short. Tune it to set bar 1.` : `Saved “${esc(name)}”.`); renderBeats(); renderSummary();
}
function deleteYT(id) { YTB.list = YTB.list.filter(v => 'yt:' + v.id !== id); saveYT(); }

/* ---- on stage ---- */
const YTS = { player: null };
async function ytStageBegin(b, cb) {
  const tm = trackTiming(b.meta, cb);
  const y = G.yt = { waiting: true, since: performance.now(), tm, clock: null, player: null, loopEnd: null, seeking: false };
  $('#ytDock').hidden = false; $('#ytWait').hidden = true; ytFitDock();
  startPlayback({ bpm: b.bpm, T0: A.ctx.currentTime + 1e5, click: SETTINGS.click });   // clicks only; re-anchored to the video below
  const start = Math.max(0, tm.countPos);
  try {
    if (!YTS.player) YTS.player = await makePlayer($('#ytStagePlayer'), b.meta.videoId, { state: ytStageState, error: c => { const w = $('#ytWait'); w.textContent = YT_ERR[c] || 'This video can’t be played here.'; w.hidden = false; } });
    if (!G || G.yt !== y) return;
    const p = YTS.player;
    p.setVolume(Math.round(SETTINGS.volume * 100)); p.unMute();
    p.loadVideoById({ videoId: b.meta.videoId, startSeconds: start });
    y.player = p; y.clock = ytClock(p, tm.countPos);
  } catch (e) { const w = $('#ytWait'); w.textContent = e.message || ytBlockedMsg(); w.hidden = false; }
}
// pausing or playing from the video itself pauses or resumes the battle
function ytStageState(s) {
  if (!G || !G.yt || G.ended || G.yt.waiting) { if (G && G.yt && s === 0 && !G.ended && !G.yt.loopEnd) finish('track'); return; }
  if (s === 2 && !G.paused && !G.yt.seeking) togglePause();
  else if (s === 1 && G.paused) togglePause();
  else if (s === 0 && !G.yt.loopEnd) finish('track');
}
// keep the video beside the board: as wide as the space to its left allows (240 to 356 px)
function ytFitDock() {
  const d = $('#ytDock'); if (d.hidden) return;
  d.style.width = '';
  const padsLeft = $('#board').getBoundingClientRect().left + (G && G.L ? G.L.numW + G.L.gap : 0);
  const room = padsLeft - d.getBoundingClientRect().left - 14;
  if (room < 356) d.style.width = Math.max(240, Math.floor(room)) + 'px';
}
function ytTick() {
  const y = G.yt; if (!y || !y.player || !y.clock) return;
  const p = y.player;
  if (y.loopEnd === null) {
    let dur = 0; try { dur = p.getDuration(); } catch { }
    if (dur > 0) { const bars = Math.floor((dur - y.tm.rapPos - 0.6) / y.tm.barS); y.loopEnd = bars >= 4 ? y.tm.rapPos + bars * y.tm.barS : 0; y.clock.loopLen = bars >= 4 ? bars * y.tm.barS : 0; }
  }
  let vt = 0; try { vt = p.getCurrentTime(); } catch { }
  if (y.seeking) { if (vt < y.loopEnd - 1) { y.seeking = false; y.clock.reset(); } else return; }
  // loop back a whole number of bars before the video ends, so the battle can outlast the beat
  if (y.loopEnd && vt >= y.loopEnd - 0.03 && !G.paused) { y.seeking = true; y.clock.loops++; p.seekTo(y.tm.rapPos + Math.max(0, vt - y.loopEnd), true); return; }
  if (y.clock.update()) {
    if (y.waiting) { y.waiting = false; $('#ytWait').hidden = true; }
    G.T0 = y.clock.T0; S.T0 = y.clock.T0;
  } else if (y.waiting && performance.now() - y.since > 3500) $('#ytWait').hidden = false;
}
function ytStageStop(fade) {
  const p = YTS.player; if (!p) return;
  if (G && G.yt) G.yt.stopped = true;
  if (!fade) { try { p.stopVideo(); } catch { } return; }
  let v = 100; try { v = p.getVolume(); } catch { }
  const steps = 12, iv = setInterval(() => { v *= 0.72; try { p.setVolume(Math.round(v)); } catch { } if (--YTS.fadeLeft <= 0) { clearInterval(iv); try { p.pauseVideo(); p.setVolume(Math.round(SETTINGS.volume * 100)); } catch { } } }, fade * 1000 / steps);
  YTS.fadeLeft = steps;
}
