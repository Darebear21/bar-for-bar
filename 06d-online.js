
/* ================= online battles =================
   Friends on a voice call each open the same battle link instead of sharing a screen. The link carries the setup, a word
   seed and a start time, so every device runs the same battle in lockstep off its own clock; there's no server.
   Whoever is rapping hears their beat with no delay. Every other device plays that turn late by the call's delay, so the
   voice coming through the call lands on its beat. The delay switches at the start of each changeover, when the mic passes
   to the other team: the beat makes a short gap or skip while the "Next up" card shows. A player's device keeps one delay
   (for the other team); a watcher's keeps one per team. A sound check sets them: one team counts along to a click while
   everyone else slides their delay until the counting lines up. */
const NET = {
  on: false, data: null, role: null, delay: [200, 200], localCfg: null, len: Infinity, err: '', note: '',
  armed: false,   // pressed Join in this visit to the lobby: needed to jump into a battle that's already going
  starting: false, raf: 0, timer: 0, offs: [], off: null, sampledAt: 0, lastSet: null, chip: '', status: '', wake: null,
  check: { on: false, team: 0, timer: 0, lastW: -Infinity, big: '' },
};
const NET_KEY = 'bfb.online', NET_MIN = -1000, NET_MAX = 3000;   // delay range, ms
const NET_SLIP = 0.015;   // s the audio clock may slip against the wall clock before the beat is put back (at a bar line)
const NET_LINK_MAX = 8000, NET_JSON_MAX = 65536;   // real battle links are under 2,000 characters
const NET_BROKEN = 'That battle link is broken. Ask for it again.';

/* ---- battle links: "#battle=" + "j" and base64url JSON, or "z" and base64url deflated JSON for a long setup ---- */
const b64u = {
  enc: u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec: str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
};
async function packBattle(d) {
  const raw = new TextEncoder().encode(JSON.stringify(d)), plain = 'j' + b64u.enc(raw);
  if (plain.length < 1400 || typeof CompressionStream !== 'function') return plain;
  try { return 'z' + b64u.enc(new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())); }
  catch { return plain; }
}
async function unpackBattle(str) {
  if (str.length > NET_LINK_MAX) throw new Error('too long');
  const k = str[0], bytes = b64u.dec(str.slice(1));
  let raw;
  if (k === 'j') raw = bytes;
  else if (k === 'z') {
    // inflate a chunk at a time and give up past 64 KB, so a short link can't unpack into something huge
    const rd = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = [];
    let n = 0;
    for (; ;) {
      const { done, value } = await rd.read(); if (done) break;
      n += value.length; if (n > NET_JSON_MAX) { rd.cancel().catch(() => { }); throw new Error('too big'); }
      parts.push(value);
    }
    raw = new Uint8Array(n); let o = 0; for (const p of parts) { raw.set(p, o); o += p.length; }
  } else throw new Error('bad link');
  if (raw.length > NET_JSON_MAX) throw new Error('too big');
  return JSON.parse(new TextDecoder().decode(raw));
}
const battleUrl = p => location.href.split('#')[0] + '#battle=' + p;
const netStartIn = sec => Math.ceil((Date.now() + sec * 1000) / 1000) * 1000;

// the parts of the setup a battle needs; switched-off words are trimmed to the ones this list has
function battleCfg() {
  const c = CFG, words = new Set(), packs = new Set();
  for (const f of (LISTS[c.list] || LISTS.basic).fams) { packs.add(famKey(f)); for (const w of f) words.add(bare(w).toLowerCase()); }
  return {
    list: c.list, scheme: c.scheme, double: c.double, reveal: c.reveal, allNames: c.allNames,
    teams: c.teams, lineup: c.lineup.filter(m => (m.name || '').trim()), firstTeam: c.firstTeam,
    // online battles always get a changeover: that's when the beat moves to the next team's delay
    barsPerTurn: c.barsPerTurn, rounds: c.rounds, changeBars: Math.max(1, c.changeBars),
    disabledWords: c.disabledWords.filter(w => words.has(w)), disabledPacks: c.disabledPacks.filter(k => packs.has(k)),
  };
}
const netCfgOf = d => normalizeCfg({ ...d.c, mode: 'battle', beat: 'synth:' + d.b, synthBpm: { [d.b]: d.bpm } });
// a short hash of the words a battle can deal: a device running an older copy of the page would deal different ones
function battlePrint(cfg) {
  const keep = CFG; CFG = cfg;
  try {
    const s = JSON.stringify([activeFams(cfg.list), SCHEMES.map(x => [x.id, x.rows, x.dbl])]);
    let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  } finally { CFG = keep; }
}
const ownKey = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
// links are typed in by anyone: only accept setups the page itself could have made
function netCheckData(d) {
  if (!d || typeof d !== 'object' || d.v !== 1 || !d.c || typeof d.c !== 'object') return NET_BROKEN;
  if (!PRESETS.some(p => p.id === d.b) || !ownKey(LISTS, d.c.list)) return 'This battle needs a newer version of the page. Reload, then open the link again.';
  const c = d.c, int = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
  if (typeof d.bpm !== 'number' || !(d.bpm >= 50 && d.bpm <= 200) || ![1, 2].includes(d.cb) || !int(d.s, 0, 2 ** 32 - 1)) return NET_BROKEN;
  if (!int(c.barsPerTurn, 4, 32) || !int(c.rounds, 0, 12) || !int(c.changeBars, 1, 8) || !Array.isArray(c.teams) || !Array.isArray(c.lineup)) return NET_BROKEN;
  if (!Number.isFinite(d.at) || Math.abs(d.at - Date.now()) > 7 * 86400e3) return 'That battle link is too old. Ask for a new one.';
  return '';
}

// "Play online" on the setup screen: a battle link from the current setup, starting in three minutes
async function netNew() {
  if (CFG.mode !== 'battle') return;
  const b = currentBeat(), synth = b && b.kind === 'synth';
  const preset = synth ? b.preset : PRESETS.find(p => 'synth:' + p.id === DEFAULT_CFG.beat) || PRESETS[0];
  const bpm = Math.round((synth ? b.bpm : preset.bpm) * 100) / 100;
  const d = { v: 1, s: crypto.getRandomValues(new Uint32Array(1))[0], at: netStartIn(180), b: preset.id, bpm, cb: paceFor(bpm), c: battleCfg() };
  d.w = battlePrint(netCfgOf(d));
  const p = await packBattle(d);
  netCopy(battleUrl(p));
  await netGo(p, true);
  NET.note = synth ? '' : `Online battles use the built-in beats, so this one plays ${preset.name}.`;
  renderLobby();
}
// same battle, new start time: a new link everyone has to open
async function netReschedule(sec) {
  if (!NET.on) return;
  const p = await packBattle({ ...NET.data, at: netStartIn(sec) });
  netCopy(battleUrl(p), 'New link copied. Everyone needs to open this one.');
  await netGo(p, false);
}
async function netGo(p, push) {
  const url = location.pathname + location.search + '#battle=' + p;
  try { push ? history.pushState(null, '', url) : history.replaceState(null, '', url); } catch { location.hash = 'battle=' + p; return; }
  await netOpenHash();
}
const clearHash = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch { } };
// the address bar decides: a battle link opens its lobby; going back past it leaves
async function netOpenHash() {
  const h = location.hash, m = /^#battle=([A-Za-z0-9_-]+)/.exec(h);
  if (!m) { if (NET.on) { if (G) exitStage(); else netLeaveToSetup(); } return; }
  let d = null, err = '';
  try { d = await unpackBattle(m[1]); err = netCheckData(d); } catch { err = NET_BROKEN; }
  if (location.hash !== h) return;   // the address changed while this link unpacked; the newer one wins
  if (!err && NET.on && NET.data && NET.data.s === d.s && NET.data.at === d.at) return;
  if (!err) try { netEnter(d); return; } catch (e) { console.warn(e); err = NET_BROKEN; }
  netToast(err, true);
  if (!NET.on) clearHash();
}
function netEnter(d) {
  // work out everything that could fail before touching this device's setup
  const cfg = netCfgOf(d), print = battlePrint(cfg), keep = CFG;
  let end;
  CFG = cfg; try { end = buildTimeline(turnMaker(), !cfg.rounds).find(s => s.kind === 'end'); } finally { CFG = keep; }
  if (G) { cancelAnimationFrame(G.raf); try { G.wake && G.wake.release(); } catch { } G = null; stopPlayback(0.1); ytStageStop(0); }
  stopPreview(); if (T.open) closeTuner(); if (YTT.open) closeYT();
  netStopCheck();
  if (!NET.on) NET.localCfg = CFG;
  NET.on = true; NET.data = d; NET.note = ''; NET.status = ''; NET.armed = false;
  CFG = cfg;
  NET.err = d.w && d.w !== print ? 'This page is a different version from the one that made the link, so your words won’t match. Reload the page, then open the link again.' : '';
  // how long it runs, to tell a late joiner whether there's still a battle to join (endless ones get three hours)
  NET.len = end ? (end.start + COUNTIN) * 4 * d.cb * 60000 / d.bpm : 3 * 3600e3;
  const st = netStore(), saved = (st.b || {})[d.s], guess = Number.isFinite(st.last) ? st.last : 200;
  NET.role = saved && [0, 1, 'w'].includes(saved.role) ? saved.role : null;
  NET.delay = [0, 1].map(t => saved && Array.isArray(saved.delay) && Number.isFinite(saved.delay[t]) ? clamp(saved.delay[t], NET_MIN, NET_MAX) : guess);
  NET.check.team = 0;
  $('#setup').hidden = true; $('#stage').hidden = true; $('#bracket').hidden = true; $('#settings').hidden = true;
  $('#online').hidden = false; document.body.style.overflow = ''; window.scrollTo(0, 0);
  try { if (navigator.wakeLock && !NET.wake) navigator.wakeLock.request('screen').then(l => { if (NET.on && !NET.wake) NET.wake = l; else l.release(); }).catch(() => { }); } catch { }
  renderLobby();
  netLoop();
}
function netLeave() {
  netStopCheck(); cancelAnimationFrame(NET.raf); clearInterval(NET.timer); NET.raf = NET.timer = 0;
  try { NET.wake && NET.wake.release(); } catch { } NET.wake = null;
  if (NET.localCfg) CFG = NET.localCfg;
  NET.localCfg = null; NET.on = false; NET.data = null; previewBlock = null;
  if (/^#battle=/.test(location.hash)) clearHash();
  $('#online').hidden = true;
}
function netLeaveToSetup() { netLeave(); $('#setup').hidden = false; document.body.style.overflow = ''; renderSetup(); }
// back to the lobby from the stage, keeping the battle open (another tab took over, say)
function netToLobby(note) {
  if (G) { cancelAnimationFrame(G.raf); try { G.wake && G.wake.release(); } catch { } G = null; stopPlayback(0.1); }
  netStopCheck();
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch { }
  NET.armed = false; if (note) NET.note = note;
  $('#stage').hidden = true; $('#endcard').hidden = true; $('#online').hidden = false; document.body.style.overflow = '';
  renderLobby(); netLoop();
}

/* ---- delays and the clock ---- */
// ms this device plays team t's turns late: none for your own team
const netDelay = t => NET.role === t ? 0 : NET.delay[t];
const netSetDelay = (t, v) => { NET.delay[t] = NET.lastSet = clamp(Math.round(v), NET_MIN, NET_MAX); netSave(); };
// context time minus wall-clock time: the median of recent readings, so one jittery reading can't move the beat
function netSample() {
  if (!A.ctx || A.ctx.state !== 'running') return;
  NET.offs.push(heardTime() - Date.now() / 1000); if (NET.offs.length > 41) NET.offs.shift();
  const s = NET.offs.slice().sort((a, b) => a - b); NET.off = s[s.length >> 1];
}
// the context time heard at wall-clock time w (ms)
function netCtxAt(w) { if (NET.off == null) netSample(); return w / 1000 + (NET.off ?? heardTime() - Date.now() / 1000); }

/* ---- the battle: the beat is anchored to everyone's clock and moves at each changeover ----
   G.anchors: from beat a.b on, beat k plays at context time a.T0 + k * spb. A mapping that plays later than the one before
   leaves a gap at its first beat; one that plays earlier skips ahead (netStepTime drops the steps it jumps over). */
// beat 0 (the start of the count-in) is heard at the link's start time, plus the delay for whoever goes first
function netFirstAnchor() {
  netSample();
  const team = G.segs[0].next ? G.segs[0].next.team : 0;
  G.anchors = [{ b: -Infinity, T0: netCtxAt(NET.data.at + netDelay(team)), team, key: 'start', off: NET.off }];
  G.netK = 0;   // index of the first segment not yet anchored
  return G.anchors[0].T0;
}
// scheduler hooks. A late joiner starts a little before now (further back than any delay can move the beat) rather than at step 0.
function netTiming() {
  const spbeat = (G.beat.preset ? G.beat.preset.steps : 16) / 4, back = 2 + (NET_MAX - NET_MIN) / 1000 / G.spb;
  return { timeOf: netStepTime, startStep: Math.max(0, Math.floor((beatAt(A.ctx.currentTime) - back) * spbeat)) };
}
function netStepTime(k) {
  const bk = k / S.spbeat;
  netEnsureAnchors(bk + 6 / G.spb);
  let a = G.anchors, i = a.length - 1;
  while (i > 0 && bk < a[i].b) i--;
  // the audio clock slipped (a glitch, or the device paused its audio): put the beat back at this bar line
  if (bk % 4 === 0 && NET.off != null && Math.abs(NET.off - a[i].off) > NET_SLIP) {
    netResync(bk); a = G.anchors; i = a.length - 1; while (i > 0 && bk < a[i].b) i--;
  }
  const t = a[i].T0 + bk * G.spb;
  return i + 1 < a.length && t >= a[i + 1].T0 + a[i + 1].b * G.spb ? NaN : t;
}
// the anchor in effect at beat b
function netRegion(b) { const a = G.anchors; let i = a.length - 1; while (i > 0 && b < a[i].b) i--; return a[i]; }
// T0 that puts beat B on everyone's clock, at this device's delay for that team
const netT0 = (team, B) => netCtxAt(NET.data.at + netDelay(team) + B * G.spb * 1000) - B * G.spb;
// a new anchor at beat B. One that plays earlier than the mapping before it starts a little later in the beat (up to `room`
// beats), so the stretch it skips is the start of the changeover (or bar), not the end of the turn before it.
function netInsertAnchor(B, T0, team, key, room) {
  const prev = netRegion(B), b = T0 < prev.T0 ? B + Math.min(room, (prev.T0 - T0) / G.spb) : B;
  const a = { b, T0, team, key, off: NET.off }, i = G.anchors.findIndex(x => x.b > b);
  if (i < 0) G.anchors.push(a); else G.anchors.splice(i, 0, a);
}
// each changeover restarts the clock at the incoming team's delay. Anchors are worked out a few seconds ahead (more than any
// change of delay), from a fresh clock reading.
function netEnsureAnchors(upto) {
  if (performance.now() - NET.sampledAt > 100) { NET.sampledAt = performance.now(); netSample(); }   // keeps going in a background tab
  if (G.endless) extendTimeline(Math.floor(upto / G.rowBeats - COUNTIN) + 1);
  for (; G.netK < G.segs.length; G.netK++) {
    const s = G.segs[G.netK]; if (s.kind !== 'change') continue;
    const B = (s.start + COUNTIN) * G.rowBeats; if (B > upto) break;
    netInsertAnchor(B, netT0(s.next.team, B), s.next.team, s.k, s.len * G.rowBeats);
  }
}
// after anchors are dropped, pick up again at the first changeover that lost its anchor
function netReseek() { const k = G.segs.findIndex(s => s.kind === 'change' && !G.anchors.some(a => a.key === s.k)); G.netK = k < 0 ? G.segs.length : k; }
// back on everyone's clock from bar line bk: a new anchor here moves the beat (any skip stays clear of the next changeover),
// then the anchors worked out from the old clock reading are redone from it
function netResync(bk) {
  G.anchors = G.anchors.filter(x => x.b < bk);
  netReseek();
  if (G.endless) extendTimeline(Math.floor(bk / G.rowBeats - COUNTIN) + 1);
  const nx = G.segs.find(s => s.kind === 'change' && (s.start + COUNTIN) * G.rowBeats >= bk);
  const r = netRegion(bk), room = Math.min(4, nx ? (nx.start + COUNTIN) * G.rowBeats - bk - 0.5 : 4);
  if (room > 0) netInsertAnchor(bk, netT0(r.team, bk), r.team, 'r' + bk, room);
  netEnsureAnchors(bk + 6 / G.spb);
}
// live fix: play the team on screen a little later or earlier, from the next beat step on
function netNudge(ms) {
  if (!G || !G.net || G.ended || !G.anchors || !G.seg) return;
  const seg = G.seg, team = seg.kind === 'turn' ? seg.who.team : seg.next ? seg.next.team : null;
  if (team == null || team === NET.role) return;
  const was = NET.delay[team]; netSetDelay(team, was + ms); const d = NET.delay[team] - was; if (!d) return;
  const B = S.next / S.spbeat, r = netRegion(B);
  G.anchors = G.anchors.filter(x => x.b <= B);   // later anchors used the old delay; they get worked out again
  if (r.team === team) {
    if (r.b === B && String(r.key)[0] === 'n') r.T0 += d / 1000;   // taps before the next step add up
    else netInsertAnchor(B, r.T0 + d / 1000, team, 'n' + B, 0);
  }
  netReseek();
  NET.chip = '';
}
// stage: keep the clock reading fresh and show whose delay is playing
function netFrame(seg) {
  netSample();
  const team = seg.kind === 'turn' ? seg.who.team : seg.next ? seg.next.team : null;
  const key = `${team}:${team == null ? '' : netDelay(team)}:${NET.role}`;
  if (key === NET.chip) return;
  NET.chip = key;
  const me = NET.role === 'w' ? 'Watching' : `You’re <b style="color:${gColor(NET.role)}">${esc(gTeam(NET.role))}</b>`;
  let now = '';
  if (team != null) now = team === NET.role ? 'your turn, no delay'
    : `<b style="color:${gColor(team)}">${esc(gTeam(team))}</b> ${netDelay(team)} ms late <button data-act="net-nudge" data-v="-10" aria-label="Play ${esc(gTeam(team))} 10 ms sooner" title="10 ms sooner ([)">−</button><button data-act="net-nudge" data-v="10" aria-label="Play ${esc(gTeam(team))} 10 ms later" title="10 ms later (])">+</button>`;
  $('#netChip').innerHTML = `<i class="net-dot"></i><span class="net-me">Online · ${me}</span>${now ? `<span class="net-now">${now}</span>` : ''}`;
}
const netPhase = (now = Date.now()) => now < NET.data.at ? 'wait' : now < NET.data.at + NET.len + 3000 + Math.max(0, ...NET.delay) ? 'live' : 'over';
const netLive = () => NET.on && netPhase() !== 'over';
async function netStartStage() {
  if (!NET.on || (G && !G.ended) || NET.starting || NET.role == null) return;
  NET.starting = true;
  try {
    netStopCheck(); netClaim();
    const ctx = initAudio(); try { await ctx.resume(); } catch { }
    try { NET.wake && NET.wake.release(); } catch { } NET.wake = null;
    NET.chip = ''; NET.note = '';
    await startGame(true);
  } finally { NET.starting = false; }
}

/* ---- sound check: a click on everyone's shared beat grid ----
   The big number reads 1 2 3 4, 2 2 3 4, 3 2 3 4, 4 2 3 4: whoever counts reads it out loud. Everyone else hears the
   counting through the call and slides their delay until it lands on their own clicks and numbers. The four-bar cycle
   means a slightly wrong clock can't make it line up a whole bar off. */
const netPadMs = () => NET.data.cb * 60000 / NET.data.bpm;
const netBigNum = n => { const i = ((n % 16) + 16) % 16; return i % 4 ? i % 4 + 1 : i / 4 + 1; };
function netCheckStart() {
  const ctx = initAudio(); ctx.resume().catch(() => { });
  netClaim();
  NET.check.on = true; NET.check.lastW = -Infinity;
  clearInterval(NET.check.timer); NET.check.timer = setInterval(netCheckTick, 25); netCheckTick();
}
function netStopCheck() { NET.check.on = false; clearInterval(NET.check.timer); NET.check.timer = 0; }
function netCheckTick() {
  if (!NET.check.on || !NET.on || !A.ctx || A.ctx.state !== 'running') return;
  netSample(); if (NET.off == null) return;
  const d = NET.data, p = netPadMs(), D = netDelay(NET.check.team), cur = A.ctx.currentTime;
  // scheduled on the audio clock, like the beat: every click from just ahead of it to 160 ms on, none twice
  const from = Math.max((cur + 0.005 - NET.off) * 1000, NET.check.lastW + p / 2);
  for (let n = Math.ceil((from - d.at - D) / p), w = d.at + D + n * p; netCtxAt(w) < cur + 0.16; n++, w += p) { netClick(netCtxAt(w), n); NET.check.lastW = w; }
}
// a bell on the first 1 of the count, a high tick on each 1, a low tick on 2, 3 and 4
function netClick(t, n) {
  const i = ((n % 16) + 16) % 16, lv = i === 0 ? 2 : i % 4 === 0 ? 1 : 0;
  const o = nodes.osc(lv === 2 ? 'triangle' : 'square', lv === 2 ? 1760 : lv ? 1500 : 1000);
  const g = nodes.env(t, lv ? 0.55 : 0.32, 0.001, lv === 2 ? 0.22 : 0.035, A.clickOut); o.connect(g); o.start(t); o.stop(t + 0.3);
}
function netCheckDraw() {
  const big = $('#netBig'); if (!big) return;
  const n = Math.floor((Date.now() - NET.data.at - netDelay(NET.check.team)) / netPadMs()), key = n + ':' + NET.check.team;
  if (key === NET.check.big) return;
  NET.check.big = key;
  big.textContent = netBigNum(n);
  const i = ((n % 4) + 4) % 4;
  $$('#netLeds i').forEach((d, k) => { d.classList.toggle('on', k === i); d.classList.toggle('one', k === 0); });
  big.parentNode.classList.toggle('one', ((n % 16) + 16) % 16 === 0);
}

/* ---- lobby ---- */
const netTeamLabel = t => esc(teamName(t));
function renderLobby() {
  const el = $('#netBody'); if (!el || !NET.on) return;
  const c = CFG, b = currentBeat(), r = NET.role, ct = NET.check.team;
  const sc = SCHEMES.find(x => x.id === c.scheme);
  const team = t => { const m = teamMembers(t); return `<div class="on-team" style="--c:${teamColor(t)}"><span class="mu-name">${netTeamLabel(t)}</span><span class="mu-crew">${m.length ? m.map(esc).join(' · ') : 'No names listed'}</span></div>`; };
  const role = v => {
    const t = v === 'w' ? null : v, m = t == null ? [] : teamMembers(t);
    return `<button class="on-role" data-act="net-role" data-v="${v}" aria-pressed="${r === v}"${t == null ? '' : ` style="--c:${teamColor(t)}"`}><b>${t == null ? 'Watching' : netTeamLabel(t)}</b><span>${t == null ? 'Not rapping' : m.length ? m.map(esc).join(' · ') : 'Rapping'}</span></button>`;
  };
  const fmt = c.rounds ? `${c.rounds} round${c.rounds === 1 ? '' : 's'} of ${c.barsPerTurn} bars` : `Endless · ${c.barsPerTurn} bars a turn`;
  const counting = r === ct, ms = NET.delay[ct];
  let check;
  if (r == null) check = '<p class="hint">Pick your side first.</p>';
  else if (counting) check = `<p class="blurb"><b>Count out loud with the clicks:</b> read the big number on every click. Keep going until everyone says it lines up.</p>`;
  else check = `<p class="blurb"><b>Listen to ${netTeamLabel(ct)} count.</b> Slide until each number they say lands on your click and matches the big number on your screen. Most calls need 100 to 400 ms.</p>
    <div class="on-delay"><span class="label">${netTeamLabel(ct)}</span><input type="range" id="netDelay" min="${NET_MIN}" max="${NET_MAX}" step="5" value="${ms}" aria-label="How late ${netTeamLabel(ct)} plays on this device"><output id="netDelayOut">${ms} ms late</output></div>
    <div class="row-ctl"><button class="chip small" data-act="net-adj" data-v="-10">−10 ms</button><button class="chip small" data-act="net-adj" data-v="10">+10 ms</button></div>`;
  const delays = r == null ? '' : `<p class="hint on-delays" id="netDelays">${esc(netDelaysTxt())}</p>`;
  const url = battleUrl(location.hash.replace(/^#battle=/, ''));
  const notes = [
    NET.err && `<p class="on-note err">${esc(NET.err)}</p>`,
    NET.note && `<p class="on-note">${esc(NET.note)}</p>`,
    location.protocol === 'file:' && '<p class="on-note">This page is open from a file, so the link only works on this computer. Host the page online (GitHub Pages works) to play with friends.</p>',
  ].filter(Boolean).join('');
  el.innerHTML = `<div class="on-hero">
      <div class="on-match">${team(0)}<span class="mu-vs">VS</span>${team(1)}</div>
      <p class="on-meta">${esc(fmt)} · ${b ? esc(b.name) + ' @ ' + fmtBpm(b.bpm) + ' BPM' : ''} · ${esc(LISTS[c.list].name)} · ${esc(sc ? sc.name : '')}</p>
      <div class="on-clock"><span class="label" id="netClockK"></span><b id="netClock"></b><span class="hint" id="netClockAt"></span></div>
      <div class="on-status" id="netStatus"></div>
      ${notes}
    </div>
    <section class="on-card${r != null ? ' done' : ''}">
      <h2><span class="n">1</span>Your side</h2>
      <div class="on-roles">${role(0)}${role(1)}${role('w')}</div>
      <p class="hint">${r == null ? 'Rapping? Pick your team. Not rapping? Pick Watching.'
        : r === 'w' ? 'Mute your mic on the call. Streaming the battle? Capture this window and the call audio in OBS. Viewers watch your stream instead of joining the call.'
        : 'Rappers wear headphones, so the call hears your voice and not the beat. When it’s your team’s turn your beat plays with no delay.'}</p>
    </section>
    <section class="on-card">
      <h2><span class="n">2</span>Sound check</h2>
      <p class="hint">Do this together on the call. One team counts while everyone else lines up its voice, then swap. A device with a delay already set can skip it.</p>
      <div class="seg" role="group" aria-label="Who is counting">${[0, 1].map(t => chip('net-count', t, ct === t, netTeamLabel(t) + ' counts')).join('')}</div>
      <div class="on-check">
        <div class="on-count" style="--c:${teamColor(ct)}"><b id="netBig">1</b><div class="leds" id="netLeds"><i></i><i></i><i></i><i></i></div></div>
        <div class="on-side">${check}
          ${r == null ? '' : `<div class="row-ctl"><button class="chip" data-act="net-check" aria-pressed="${NET.check.on}"><svg width="14" height="14"><use href="#i-${NET.check.on ? 'stop' : 'play'}"/></svg>${NET.check.on ? 'Stop clicks' : 'Start clicks'}</button></div>`}
          ${delays}</div>
      </div>
    </section>
    <section class="on-card">
      <h2><span class="n">3</span>Share the link</h2>
      <div class="on-link"><input type="text" id="netUrl" readonly value="${esc(url)}" aria-label="Battle link"><button class="chip" data-act="net-copy"><svg width="14" height="14"><use href="#i-copy"/></svg>Copy</button></div>
      <p class="hint">Post it in the call’s chat. Everyone opens it on their own device, no screen sharing, and the battle starts on every screen at once.</p>
      <div class="row-ctl on-resched"><span class="label">New start time</span>${[[30, 'In 30 s'], [60, 'In 1 min'], [180, 'In 3 min'], [300, 'In 5 min']].map(([s, l]) => `<button class="chip small ghost" data-act="net-resched" data-v="${s}">${l}</button>`).join('')}</div>
      <p class="hint">A new start time makes a new link, and everyone has to open that one.</p>
    </section>
    <p class="hint on-foot">Everyone’s countdown should match. If yours is a second or more off, turn on automatic date and time, then reload. Pause and Next team are off online, and End only stops your device.</p>`;
  NET.status = ''; NET.check.big = '';
  netLobbyTick();
}
const netDelaysTxt = () => 'This device: ' + [0, 1].map(t => `${teamName(t)} ${NET.role === t ? 'no delay (your team)' : NET.delay[t] + ' ms late'}`).join(' · ');
function netStatusHtml(ph) {
  if (ph === 'over') return '<p>This battle is over.</p><button class="chip" data-act="net-leave">Back to setup</button>';
  if (NET.role == null) return `<p>${ph === 'live' ? 'The battle has started. Pick your side, then join.' : 'Pick your side below to get ready.'}</p>`;
  const audio = A.ctx && A.ctx.state === 'running';
  // a battle already going needs a press of Join, so a remembered side never drops you in by surprise
  if (ph === 'live' && !(audio && NET.armed)) return '<button class="go" data-act="net-join"><svg><use href="#i-play"/></svg><span>Join the battle</span></button>';
  if (!audio) return '<button class="go" data-act="net-join"><svg><use href="#i-play"/></svg><span>Tap to get ready</span></button>';
  return '<p class="ok">Ready. Your beat starts by itself.</p>';
}
function netLobbyTick() {
  if (!NET.on || G) return;
  const d = NET.data, now = Date.now(), ph = netPhase(now);
  const k = ph === 'wait' ? 'Starts in' : ph === 'live' ? 'Live now' : 'Battle over';
  const big = ph === 'wait' ? fmtTime(Math.ceil((d.at - now) / 1000)) : ph === 'live' ? fmtTime((now - d.at) / 1000) : 'GG';
  const at = new Date(d.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const set = (id, v) => { const e = $(id); if (e && e.textContent !== v) e.textContent = v; };
  set('#netClockK', k); set('#netClock', big); set('#netClockAt', ph === 'wait' ? `at ${at}` : ph === 'live' ? `started at ${at}` : '');
  const st = netStatusHtml(ph);
  if (st !== NET.status) { NET.status = st; const e = $('#netStatus'); if (e) e.innerHTML = st; }
  // open the stage a second before this device's beat starts (right away for someone who pressed Join on a battle under way)
  if (ph !== 'over' && NET.role != null && A.ctx && A.ctx.state === 'running' && (ph === 'wait' || NET.armed)) {
    const first = CFG.firstTeam === 1 ? 1 : 0;
    if (now >= d.at + netDelay(first) - 1000) netStartStage();
  }
}
function netLoop() {
  cancelAnimationFrame(NET.raf); clearInterval(NET.timer);
  NET.timer = setInterval(() => { if (!NET.on || G) { clearInterval(NET.timer); NET.timer = 0; return; } netLobbyTick(); }, 200);
  const draw = () => { if (!NET.on || G) { NET.raf = 0; return; } NET.raf = requestAnimationFrame(draw); netSample(); netCheckDraw(); };
  NET.raf = requestAnimationFrame(draw);
}
// audio can only start from a tap or click; then the lobby starts the battle when it's time
function netUnlock() { const ctx = initAudio(); return ctx.resume().catch(() => { }).then(() => netLobbyTick()); }
function netJoin() { NET.armed = true; netUnlock(); }
function netSetRole(v) { NET.role = v; netSave(); renderLobby(); netUnlock(); }

/* ---- small things ---- */
function netStore() { const s = ls.get(NET_KEY, null); return s && typeof s === 'object' ? s : { b: {} }; }
// remember this battle's side and delays (for a reload) and the last delay set (a good guess for the next battle)
function netSave() {
  if (!NET.data) return;
  const st = netStore(); st.b = st.b && typeof st.b === 'object' ? st.b : {};
  st.b[NET.data.s] = { role: NET.role, delay: NET.delay.slice(), t: Date.now() };
  for (const k of Object.keys(st.b).sort((a, b) => st.b[b].t - st.b[a].t).slice(10)) delete st.b[k];
  if (Number.isFinite(NET.lastSet)) st.last = NET.lastSet;
  ls.set(NET_KEY, st);
}
async function netCopy(text, msg = 'Battle link copied. Paste it in your call’s chat.') {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch { }
  if (!ok) try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
  } catch { }
  netToast(ok ? msg : 'Couldn’t copy. Select the link in the box and copy it.', !ok);
}
let toastTimer = 0;
function netToast(msg, err = false) {
  const el = $('#toast'); if (!el) return;
  el.textContent = msg; el.classList.toggle('err', err); el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.classList.remove('show'); toastTimer = setTimeout(() => { el.hidden = true; }, 300); }, err ? 5200 : 3200);
}
// one battle sound per browser: when another tab starts playing a battle (or its sound check), this tab goes quiet and
// back to its lobby, so two beats never play at once
const NET_TAB = Math.random().toString(36).slice(2);
let netBC = null;
try {
  netBC = new BroadcastChannel('bfb-online');
  netBC.onmessage = e => {
    if (!e.data || e.data.t !== 'claim' || e.data.id === NET_TAB || !NET.on) return;
    if ((G && G.net && !G.ended) || NET.check.on) netToLobby('The battle is playing in another tab now, so it stopped here.');
  };
} catch { }
function netClaim() { try { netBC && netBC.postMessage({ t: 'claim', id: NET_TAB }); } catch { } }
function netInit() {
  window.addEventListener('hashchange', netOpenHash);
  window.addEventListener('popstate', netOpenHash);
  if (/^#battle=/.test(location.hash)) netOpenHash();
}
