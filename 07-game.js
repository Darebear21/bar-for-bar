
/* ================= stage ================= */
const COUNTIN = 2;          // rows of count-in before bar 1
const TOPZ = 1.75, VIS = 5.1; // board height in rows: ball zone above the active row + visible rows
let G = null;
const easeIO = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

function buildTimeline(turnAt, endless) {
  const segs = [];
  if (CFG.mode === 'practice') {
    segs.push({ kind: 'countin', start: -COUNTIN, len: COUNTIN, next: null });
    const n = CFG.practiceBars || Infinity;
    segs.push({ kind: 'turn', start: 0, len: n, who: null, i: 0 });
    if (isFinite(n)) segs.push({ kind: 'end', start: n, len: Infinity });
  } else {
    // an endless battle starts with four rounds laid out; extendTimeline() adds more as it goes
    const n = endless ? 8 : CFG.rounds * 2;
    segs.push({ kind: 'countin', start: -COUNTIN, len: COUNTIN, next: turnAt(0), nextIdx: 0 });
    let r = 0;
    for (let i = 0; i < n; i++) {
      const prev = segs[segs.length - 1];
      segs.push({ kind: 'turn', start: r, len: CFG.barsPerTurn, who: prev.kind === 'change' || prev.kind === 'countin' ? prev.next : turnAt(i), i });
      r += CFG.barsPerTurn;
      if ((endless || i < n - 1) && CFG.changeBars > 0) { segs.push({ kind: 'change', start: r, len: CFG.changeBars, next: turnAt(i + 1), nextIdx: i + 1 }); r += CFG.changeBars; }
    }
    if (!endless) segs.push({ kind: 'end', start: r, len: Infinity });
  }
  segs.forEach((s, k) => s.k = k);
  return segs;
}
// beats with drops: drop on the first bar of every turn (and every 16 bars inside long turns); the build fills the bars before it
function gamePhrase(bar) {
  let since = Infinity, until = Infinity;
  if (!G) return { since, until };
  for (const s of G.segs) {
    if (s.kind !== 'turn') continue;
    const b0 = (s.start + COUNTIN) * G.cb, len = s.len * G.cb;
    for (let j = 0; j === 0 || (j < len - 4 && j < 4096); j += DROP_EVERY) {
      const x = b0 + j;
      if (x <= bar) since = Math.min(since, bar - x); else { until = Math.min(until, x - bar); break; }
    }
  }
  return { since, until };
}
// endless battles: keep at least 48 bars of turns laid out past the board
function extendTimeline(row) {
  const segs = G.segs;
  for (let guard = 0; guard < 64; guard++) {
    const last = segs[segs.length - 1], end = last.start + last.len;
    if (end > row + 48) return;
    const i = G.nextTurn++;
    segs.push({ kind: 'turn', start: end, len: G.turnBars, who: last.kind === 'change' ? last.next : G.turnAt(i), i, k: segs.length });
    if (G.changeBars > 0) segs.push({ kind: 'change', start: end + G.turnBars, len: G.changeBars, next: G.turnAt(i + 1), nextIdx: i + 1, k: segs.length });
  }
}
function segAt(r) { const s = G.segs; for (let i = s.length - 1; i >= 0; i--) if (r >= s[i].start) return s[i]; return s[0]; }
const gColor = t => PALETTE[G.teams[t]?.color ?? t];
const gTeam = t => (G.teams[t]?.name || '').trim() || (t ? 'Team B' : 'Team A');
// always read as a team on stage, even when a team is named after a person
const teamLabel = n => /^team\b/i.test(n) ? n : 'Team ' + n;

async function startGame() {
  const b = currentBeat(); if (!b) return;
  stopPreview();
  const ctx = initAudio(); try { await ctx.resume(); } catch { }
  let buffer = null;
  if (b.kind === 'yt') { try { await loadYTApi(); } catch (e) { setBeatStatus(esc(e.message), true); return; } }
  if (b.kind === 'track' || b.kind === 'local') {
    const go = $('#goBtn'); go.disabled = true; go.querySelector('span').textContent = 'Loading beat…';
    try { buffer = await bufferFor(b); }
    catch (e) { setBeatStatus(esc(e.message || 'Could not load that beat.'), true); renderSummary(); return; }
    renderSummary();
  }
  if (G) { cancelAnimationFrame(G.raf); }
  const bpm = b.bpm, spb = 60 / bpm, cb = paceFor(bpm);
  const endless = CFG.mode === 'battle' && !CFG.rounds, turnAt = turnMaker();
  G = {
    beat: b, bpm, spb, cb, rowBeats: 4 * cb, rowDur: 4 * cb * spb, mode: CFG.mode,
    segs: buildTimeline(turnAt, endless), words: new Map(), rows: new Map(),
    endless, turnAt, rounds: CFG.rounds, changeBars: CFG.changeBars, nextTurn: 8,
    gen: makeWordGen(CFG.list, CFG.scheme, CFG.double, CFG.reveal, true),
    teams: JSON.parse(JSON.stringify(CFG.teams)), turns: 0,
    lastCell: null, seg: null, paused: false, ended: false, hud: {}, splashOn: false, litPad: null, look: { cur: 0, target: 0, acc: 0 },
    stageEl: $('#stage'), rowsEl: $('#rows'), glow: $('#glow'),
  };
  G.turns = G.segs.filter(s => s.kind === 'turn').length;
  G.turnBars = CFG.barsPerTurn;
  G.rowsEl.innerHTML = '';
  showStage();
  layoutBoard();
  const T0 = ctx.currentTime + 0.9; G.T0 = T0;
  $('#ytDock').hidden = true;
  if (b.kind === 'synth') startPlayback({ preset: b.preset, bpm, T0, click: SETTINGS.click, phrase: gamePhrase });
  else if (b.kind === 'yt') ytStageBegin(b, cb);
  else {
    const tm = trackTiming(b.meta, cb);
    startPlayback({ bpm, track: { buffer, loopStart: tm.rapPos }, T0, songPos0: tm.countPos, loop: true, click: SETTINGS.click });
  }
  // transport + matchup
  $('#trkName').textContent = b.name;
  $('#trkMeta').textContent = `${fmtBpm(bpm)} BPM · ${b.style}${cb === 2 ? ' · half-time ball' : ''}`;
  $('#trkVinyl').style.setProperty('--lab', b.color);
  $('#matchup').innerHTML = G.mode === 'battle'
    ? `<span class="tchip" style="--c:${gColor(0)}">${esc(gTeam(0))}</span><span class="vs">VS</span><span class="tchip" style="--c:${gColor(1)}">${esc(gTeam(1))}</span>`
    : `<span class="tchip" style="--c:var(--amber)">Practice</span>`;
  $('#skipBtn span').textContent = G.mode === 'battle' ? 'Next team' : 'Finish';
  $('#endcard').hidden = true; $('#pausedTag').hidden = true; G.stageEl.classList.remove('is-paused', 'splash-on'); $('#splash').classList.remove('show');
  $('#pauseBtn').innerHTML = '<svg><use href="#i-pause"/></svg><span>Pause</span>';
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { if (G) G.wake = l; else l.release(); }).catch(() => { }); } catch { }
  poke();
  G.raf = requestAnimationFrame(frame);
}
function showStage() {
  $('#setup').hidden = true; $('#stage').hidden = false;
  $('#settings').hidden = true; if (T.open) closeTuner();
  document.body.style.overflow = 'hidden';
}
function exitStage() {
  if (G) { cancelAnimationFrame(G.raf); try { G.wake && G.wake.release(); } catch { } }
  G = null;
  stopPlayback(0.2);
  ytStageStop(0); $('#ytDock').hidden = true;
  if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch { }
  $('#stage').hidden = true; $('#setup').hidden = false; document.body.style.overflow = '';
  $('#splash').classList.remove('show'); $('#stage').classList.remove('splash-on');
  renderSetup();
}
function layoutBoard() {
  if (!G) return;
  const wrap = $('#boardWrap'); const cs = getComputedStyle(wrap);
  const W0 = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), H0 = wrap.clientHeight - 8;
  const numR = 0.4, gapR = 0.075, cellHR = 0.46, rowGapR = 0.13;
  const wu = 4 + 2 * numR + 5 * gapR, rowHR = cellHR + rowGapR, hu = rowHR * (TOPZ + VIS);
  const cellW = Math.max(36, Math.min(W0 / wu, H0 / hu, 340));
  const L = { cellW, gap: cellW * gapR, numW: cellW * numR, cellH: cellW * cellHR, rowH: cellW * rowHR };
  L.W = wu * cellW; L.H = hu * cellW; L.topZone = TOPZ * L.rowH;
  L.X = [0, 1, 2, 3].map(c => L.numW + L.gap + c * (cellW + L.gap) + cellW / 2);
  L.ballR = Math.max(6, L.cellH * 0.2); L.landY = L.topZone - L.ballR * 0.95; L.arc = L.rowH * 1.05;
  const bd = $('#board');
  const set = (k, v) => bd.style.setProperty(k, v.toFixed(2) + 'px');
  set('--bw', L.W); set('--bh', L.H); set('--cellW', cellW); set('--cellH', L.cellH); set('--gap', L.gap); set('--numW', L.numW); set('--rowH', L.rowH);
  const cv = $('#ballCanvas'); const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(L.W * dpr); cv.height = Math.round(L.H * dpr);
  G.g2d = cv.getContext('2d'); G.g2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  G.L = L;
  if (G.yt) ytFitDock();
}
function rowModel(r) {
  const seg = segAt(r), rel = r - seg.start;
  if (seg.kind === 'turn') {
    const blk = Math.floor(rel / 4), bi = ((rel % 4) + 4) % 4, key = seg.k + ':' + blk;
    let B = G.words.get(key); if (!B) { B = G.gen(); G.words.set(key, B); }
    return { kind: 'turn', cells: B[bi], num: rel + 1 };
  }
  if (seg.kind === 'end') return { kind: 'banner', label: rel === 0 ? "THAT'S TIME" : '', tc: 'var(--amber)' };
  const tc = seg.next ? gColor(seg.next.team) : 'var(--amber)';
  const num = seg.kind === 'countin' ? String(r) : '';
  if (rel === seg.len - 1) return { kind: 'count', tc, num };
  let label;
  if (seg.kind === 'countin') label = seg.next ? 'GET READY' : 'HERE WE GO';
  else label = rel === seg.len - 2 ? teamLabel(seg.next.name).toUpperCase() : 'SWITCH SIDES';
  return { kind: 'banner', label, tc, num };
}
function rowEl(r) {
  const m = rowModel(r); const el = document.createElement('div'); el.className = 'row';
  const num = m.num ?? '';
  let pads = '';
  if (m.kind === 'turn') {
    pads = m.cells.map((c, i) => {
      const col = `grid-column:${i + 2}`;
      if (!c) return `<div class="pad" style="${col}"></div>`;
      const w = c.show ? c.w : '';
      const fs = w ? Math.min(0.175, 1.36 / Math.max(4, w.length)) : 0;
      return `<div class="pad rh c${c.c}${c.show ? '' : ' blank'}" style="${col}${w ? `;font-size:calc(var(--cellW)*${fs.toFixed(4)})` : ''}">${esc(w)}</div>`;
    }).join('');
  } else if (m.kind === 'count') {
    el.style.setProperty('--tc', m.tc);
    pads = [1, 2, 3, 4].map(n => `<div class="pad count" style="grid-column:${n + 1}">${n}</div>`).join('');
  } else {
    el.classList.add('banner'); el.style.setProperty('--tc', m.tc);
    pads = [2, 3, 4, 5].map(n => `<div class="pad" style="grid-column:${n}"></div>`).join('');
    const L = m.label || ''; const fs = Math.min(0.24, 5.1 / Math.max(6, L.length));
    if (L) pads += `<div class="banner-label" style="font-size:calc(var(--cellW)*${fs.toFixed(4)})">${esc(L)}</div>`;
  }
  el.innerHTML = `<span class="num" style="grid-column:1">${num}</span>${pads}<span class="num" style="grid-column:6">${num}</span>`;
  return el;
}
function syncRows(row, scroll, e, look = 0) {
  // look = rows scrolled back while paused; the view slides up the board to earlier bars
  const view = row - look, L = G.L, lo = Math.max(-COUNTIN, Math.floor(view) - 1), hi = Math.ceil(view) + 5;
  const pastOp = (0.3 + 0.62 * Math.min(1, look)).toFixed(3);
  for (const [r, el] of G.rows) if (r < lo || r > hi) { el.remove(); G.rows.delete(r); }
  for (let r = lo; r <= hi; r++) {
    let el = G.rows.get(r);
    if (!el) { el = rowEl(r); G.rowsEl.appendChild(el); G.rows.set(r, el); }
    const y = L.topZone + (r - scroll + look) * L.rowH;
    el.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
    el.style.opacity = r < row ? pastOp : r === row ? (1 - 0.55 * e).toFixed(3) : 1;
    el.classList.toggle('active', r === row);
    el.classList.toggle('past', r < row);
  }
}
function hitCell(row, c) {
  if (G.litPad) G.litPad.classList.remove('lit');
  const el = G.rows.get(row); if (!el) return;
  const pad = el.querySelectorAll('.pad')[c]; if (!pad) return;
  pad.classList.add('lit'); pad.classList.remove('hit'); void pad.offsetWidth; pad.classList.add('hit');
  G.litPad = pad;
}
function ballAt(b) {
  const L = G.L, cb = G.cb;
  if (b < 0) { const tf = clamp(1 + b / cb, 0, 1); return { x: L.X[0], y: L.landY - L.arc * 1.6 * (1 - tf * tf), p: tf >= 1 ? 0 : 0.5 }; }
  const cell = b / cb, ci = Math.floor(cell), p = cell - ci, c = ci % 4, to = (c + 1) % 4;
  const h = L.arc * (to === 0 ? 1.3 : 1);
  return { x: L.X[c] + (L.X[to] - L.X[c]) * p, y: L.landY - h * 4 * p * (1 - p), p };
}
function drawBall(b) {
  const g = G.g2d, L = G.L; if (!g) return;
  g.clearRect(0, 0, L.W, L.H);
  // comet tail: one tapered ribbon along the last ~200 ms of flight
  const N = 22, dt = 0.2 / N / G.spb, pts = [];
  for (let i = 0; i <= N; i++) pts.push(ballAt(b - i * dt));
  const q = pts[0], tail = pts[N];
  if (Math.hypot(q.x - tail.x, q.y - tail.y) > L.ballR * 0.8) {
    const left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], c = pts[Math.min(N, i + 1)];
      let dx = c.x - a.x, dy = c.y - a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = L.ballR * 0.92 * Math.pow(1 - i / N, 1.2);
      left.push([p.x - dy * w, p.y + dx * w]); right.push([p.x + dy * w, p.y - dx * w]);
    }
    g.beginPath(); g.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i <= N; i++) g.lineTo(left[i][0], left[i][1]);
    for (let i = N; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
    g.closePath();
    const gr = g.createLinearGradient(q.x, q.y, tail.x, tail.y);
    gr.addColorStop(0, 'rgba(255,176,60,.55)'); gr.addColorStop(0.5, 'rgba(255,140,40,.18)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = gr; g.fill();
  }
  const k = q.p < 0.07 ? 1 - q.p / 0.07 : q.p > 0.95 ? (q.p - 0.95) / 0.05 : 0;
  const r = L.ballR;
  g.save(); g.translate(q.x, q.y + r * 0.2 * k); g.scale(1 + 0.2 * k, 1 - 0.2 * k);
  g.shadowColor = 'rgba(255,170,40,.85)'; g.shadowBlur = r * 1.8;
  const gr = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  gr.addColorStop(0, '#fff6d8'); gr.addColorStop(0.45, '#ffbe45'); gr.addColorStop(1, '#ef8410');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill(); g.restore();
}
function setText(id, v) { if (G.hud[id] !== v) { G.hud[id] = v; const el = document.getElementById(id); if (el) el.textContent = v; } }
function setHtml(id, v) { if (G.hud[id] !== v) { G.hud[id] = v; const el = document.getElementById(id); if (el) el.innerHTML = v; } }
function enterSeg(seg) {
  G.seg = seg;
  const who = seg.kind === 'turn' ? seg.who : seg.next;
  G.stageEl.style.setProperty('--team', who ? gColor(who.team) : 'var(--amber)');
  if (seg.kind === 'turn' && seg.who) { const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  if (seg.kind === 'end') finish('done');
  // up next
  let up = '';
  if (G.mode === 'battle') {
    const nxt = G.segs.find(s => s.kind === 'turn' && s.start > seg.start);
    up = seg.kind === 'turn' ? (nxt ? `Next up <b>${esc(teamLabel(nxt.who.name))}</b>` : 'Last turn') : '';
  } else up = `${esc(LISTS[CFG.list].name)} · ${esc(SCHEMES.find(s => s.id === CFG.scheme).name)}`;
  setHtml('upNext', up);
}
function hud(row, rowF, seg, b) {
  const rd = G.rowDur;
  let label = '', name = '', meta = '', clock = '', bars = '', prog = 0, warn = false;
  const turnNo = s => `Turn ${s.i + 1}${G.endless ? '' : ' of ' + G.turns}${(G.endless || G.rounds > 1) && s.who ? ' · Round ' + s.who.round : ''}`;
  if (G.mode === 'battle') {
    if (seg.kind === 'turn') {
      label = 'On the mic'; name = teamLabel(seg.who.name); meta = turnNo(seg);
      const left = (seg.start + seg.len - rowF) * rd; clock = fmtTime(Math.ceil(left - 0.001));
      bars = `Bar ${Math.min(seg.len, row - seg.start + 1)} / ${seg.len}`; prog = (rowF - seg.start) / seg.len;
      warn = seg.start + seg.len - rowF <= 2;
    } else if (seg.kind === 'countin' || seg.kind === 'change') {
      label = seg.kind === 'countin' ? 'First up' : 'Next up'; name = teamLabel(seg.next.name);
      const ns = G.segs.find(s => s.kind === 'turn' && s.i === seg.nextIdx); meta = ns ? turnNo(ns) : '';
      clock = fmtTime(Math.ceil(Math.max(0, (seg.start + seg.len - rowF) * rd) - 0.001)); bars = seg.kind === 'countin' ? 'Count-in' : 'Switch';
    } else { label = "That's time"; name = 'GG'; clock = '0:00'; bars = 'Done'; prog = 1; }
  } else {
    label = 'Practice';
    if (seg.kind === 'turn') {
      name = 'Bar ' + Math.max(1, row + 1); meta = isFinite(seg.len) ? `${seg.len} bars` : 'Endless';
      clock = isFinite(seg.len) ? fmtTime(Math.ceil((seg.start + seg.len - rowF) * rd - 0.001)) : fmtTime(Math.max(0, rowF) * rd);
      bars = isFinite(seg.len) ? `Bar ${Math.min(seg.len, row + 1)} / ${seg.len}` : `Bar ${row + 1}`;
      prog = isFinite(seg.len) ? rowF / seg.len : 0;
    } else if (seg.kind === 'countin') { name = 'Get ready'; clock = fmtTime(Math.ceil(Math.max(0, -rowF * rd) - 0.001)); bars = 'Count-in'; }
    else { name = 'Done'; clock = '0:00'; bars = 'Done'; prog = 1; }
  }
  const who = seg.kind === 'turn' ? seg.who : seg.next;
  setText('nowCrew', G.mode === 'battle' && who && who.members && who.members.length && seg.kind !== 'end' ? who.members.join('  ·  ') : '');
  setText('nowLabel', label); setText('nowName', name); setText('hudMeta', meta); setText('clock', clock); setText('barCount', bars);
  const pw = (clamp(prog, 0, 1) * 100).toFixed(1) + '%'; if (G.hud.prog !== pw) { G.hud.prog = pw; $('#tprog').style.width = pw; }
  if (G.hud.warn !== warn) { G.hud.warn = warn; $('#clock').classList.toggle('warn', warn); }
  // splash for countin/changeover (all rows except the 1-2-3-4 row)
  const show = G.mode === 'battle' && !G.ended && (seg.kind === 'countin' || seg.kind === 'change') && !!seg.next && row < seg.start + seg.len - 1;
  if (show !== G.splashOn) {
    G.splashOn = show; $('#splash').classList.toggle('show', show); G.stageEl.classList.toggle('splash-on', show);
    if (show) {
      const n = seg.next; const ns = G.segs.find(s => s.kind === 'turn' && s.i === seg.nextIdx);
      $('#splashK').textContent = seg.kind === 'countin' ? 'First up' : 'Next up';
      $('#splashWho').textContent = teamLabel(n.name);
      $('#splashFor').innerHTML = `${n.members && n.members.length ? `<span class="crew-line">${n.members.map(esc).join('  ·  ')}</span>` : ''}<span>${ns ? esc(turnNo(ns)) + ' · ' : ''}${G.turnBars} bars as a team</span><span class="swap-hint">Trade bars inside your team however you like</span>`;
    }
  }
  if (show) {
    const cell = b >= 0 ? Math.floor(b / G.cb) % 4 : -1; const key = 'd' + cell;
    if (G.hud.dots !== key) { G.hud.dots = key; $$('#splashDots i').forEach((d, i) => d.classList.toggle('on', i <= cell)); }
  }
}
function frame() {
  if (!G) return;
  G.raf = requestAnimationFrame(frame);
  if (G.yt) ytTick();
  // a YouTube beat holds the board at the top of the count-in until the video is really playing
  const t = G.paused ? G.pauseT : G.yt && G.yt.waiting ? G.T0 - 0.3 : heardTime();
  const b = (t - G.T0) / G.spb;
  const rowF = b / G.rowBeats - COUNTIN;
  const row = Math.floor(rowF), ph = rowF - row;
  if (G.endless) extendTimeline(row);
  const seg = segAt(row);
  if (seg !== G.seg) enterSeg(seg);
  const e = ph < 0.82 ? 0 : easeIO((ph - 0.82) / 0.18);
  const lk = G.look; lk.cur += (lk.target - lk.cur) * 0.22; if (Math.abs(lk.target - lk.cur) < 0.003) lk.cur = lk.target;
  syncRows(row, row + e, e, lk.cur);
  if (G.hud.lk !== lk.cur) { G.hud.lk = lk.cur; $('#ballCanvas').style.transform = lk.cur ? `translate3d(0,${(lk.cur * G.L.rowH).toFixed(1)}px,0)` : ''; }
  if (b >= 0) { const ci = Math.floor(b / G.cb); if (ci !== G.lastCell) { G.lastCell = ci; hitCell(row, ci % 4); } }
  drawBall(b);
  hud(row, rowF, seg, b);
  const bp = b - Math.floor(b);
  if (G.glow) G.glow.style.opacity = b >= 0 && !G.paused ? (0.35 + 0.65 * Math.exp(-bp * 5)).toFixed(3) : '0.35';
  if (!G.ended && isFinite(S.trackEnd) && t > S.trackEnd) finish('track');
}
function finish(why) {
  if (!G || G.ended) return;
  G.ended = true;
  stopPlayback(why === 'done' ? Math.min(3, G.rowDur * 1.2) : 0.6);
  if (G.yt) ytStageStop(why === 'done' ? Math.min(3, G.rowDur * 1.2) : 0.6);
  $('#splash').classList.remove('show'); G.splashOn = false; G.stageEl.classList.remove('splash-on');
  const recap = $('#recap');
  if (G.mode === 'battle') {
    // count what was actually rapped: an early (or endless) finish stops partway through
    const now = why === 'done' ? Infinity : Math.floor(((G.paused ? G.pauseT : heardTime()) - G.T0) / G.spb / G.rowBeats - COUNTIN);
    const turns = G.segs.filter(s => s.kind === 'turn' && s.start <= now);
    const played = s => Math.max(0, Math.min(s.len, now - s.start + 1));
    recap.innerHTML = [0, 1].map(t => {
      const ts = turns.filter(s => s.who.team === t); const bars = ts.reduce((n, s) => n + played(s), 0);
      const mem = G.turnAt(G.turnAt(0).team === t ? 0 : 1).members;
      return `<section style="--c:${gColor(t)}"><h3>${esc(gTeam(t))}</h3><ul>${mem.length ? mem.map(n => `<li>${esc(n)}</li>`).join('') : '<li>No names listed</li>'}<li><span>${ts.length} turn${ts.length === 1 ? '' : 's'} · ${bars} bars</span></li></ul></section>`;
    }).join('');
    $('#endKicker').textContent = G.endless ? `Endless battle · ${turns.length} turn${turns.length === 1 ? '' : 's'}` : why === 'early' ? 'Battle ended early' : `${gTeam(0)} vs ${gTeam(1)}`;
    $('#endTitle').innerHTML = 'That’s <em>the battle</em>';
  } else {
    recap.innerHTML = '';
    $('#endKicker').textContent = `${G.beat.name} · ${fmtBpm(G.bpm)} BPM`;
    $('#endTitle').innerHTML = 'Nice <em>reps</em>';
  }
  // bracket match: ask who won so the bracket can move on
  const tc = G.mode === 'battle' ? tourCurrent() : null, ew = $('#endWinner');
  if (tc) {
    ew.innerHTML = `<p class="label">${esc(matchName(TOUR.s, tc.r, tc.m))} · who won?</p><div class="ew-btns">${[0, 1].map(t => `<button class="ew-team" style="--c:${gColor(t)}" data-act="br-result" data-v="${t}">${esc(gTeam(t))}</button>`).join('')}</div><button class="chip small ghost" data-act="exit">Decide later</button>`;
    ew.hidden = false;
  } else ew.hidden = true;
  setTimeout(() => { if (G && G.ended) { $('#endcard').hidden = false; (tc ? $('#endWinner .ew-team') : $('#endcard .go')).focus(); } }, why === 'done' ? 900 : 200);
}
function skipTurn() {
  if (!G || G.ended) return;
  const t = G.paused ? G.pauseT : heardTime();
  const row = Math.floor((t - G.T0) / G.spb / G.rowBeats - COUNTIN);
  const seg = segAt(row);
  if (G.mode === 'practice' || seg.kind === 'end') { finish('early'); return; }
  const delta = seg.start + seg.len - (row + 1); if (delta <= 0) return;
  const start = seg.start;
  seg.len -= delta; for (const s of G.segs) if (s.start > start) s.start -= delta;
  for (const [r, el] of G.rows) if (r > row) { el.remove(); G.rows.delete(r); }
}
function togglePause() {
  if (!G || G.ended || !A.ctx) return;
  if (!G.paused) { G.pauseT = G.yt && G.yt.waiting ? G.T0 - 0.3 : heardTime(); G.paused = true; A.ctx.suspend(); }
  else { G.paused = false; A.ctx.resume(); }
  if (G.yt && G.yt.player) { try { G.paused ? G.yt.player.pauseVideo() : G.yt.player.playVideo(); } catch { } }
  G.look.target = 0; G.look.acc = 0; lookLabel();
  $('#pausedTag').hidden = !G.paused; G.stageEl.classList.toggle('is-paused', G.paused);
  $('#pauseBtn').innerHTML = G.paused ? '<svg><use href="#i-play"/></svg><span>Resume</span>' : '<svg><use href="#i-pause"/></svg><span>Pause</span>';
  poke();
}
/* ---- look back while paused ---- */
function maxLook() { if (!G || !G.paused) return 0; return Math.max(0, Math.floor((G.pauseT - G.T0) / G.spb / G.rowBeats - COUNTIN) + COUNTIN); }
function lookBy(n) {
  if (!G || !G.paused || G.ended) return;
  G.look.target = clamp(G.look.target + n, 0, maxLook()); lookLabel(); poke();
}
function lookLabel() {
  const n = G.paused ? G.look.target * G.cb : 0;
  $('#pausedTxt').textContent = n ? `LOOKING BACK ${n} BAR${n === 1 ? '' : 'S'} · ↓ TO COME BACK · SPACE RESUMES` : 'PAUSED · SPACE TO RESUME · ↑ OR SCROLL TO LOOK BACK';
  G.stageEl.classList.toggle('looking', n > 0);
}
async function toggleFullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch { }
}
let idleTimer = 0;
function poke() {
  const st = $('#stage'); st.classList.remove('idle'); clearTimeout(idleTimer);
  if (SETTINGS.autohide && G && !G.paused && !G.ended) idleTimer = setTimeout(() => { if (G && !G.paused && !G.ended) st.classList.add('idle'); }, 2600);
}
