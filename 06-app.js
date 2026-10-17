
/* ================= settings + config ================= */
const SETTINGS = Object.assign({ syncMs: 0, pace: 'auto', volume: 0.9, click: false, autohide: true }, ls.get('bfb.settings', {}));
const saveSettings = () => ls.set('bfb.settings', SETTINGS);
const DEFAULT_CFG = {
  mode: 'battle', list: 'basic', scheme: 'AABB', double: false, reveal: 'all',
  beat: 'synth:basement', synthBpm: {}, practiceBars: 16,
  teams: [{ name: 'East', color: 0 }, { name: 'West', color: 1 }],
  lineup: [{ name: 'East MC 1', team: 0 }, { name: 'West MC 1', team: 1 }, { name: 'East MC 2', team: 0 }, { name: 'West MC 2', team: 1 }],
  barsPerTurn: 16, rounds: 2, changeBars: 2, firstTeam: 0, disabledWords: [], disabledPacks: [], allNames: false,
};
function normalizeCfg(c) {
  const d = JSON.parse(JSON.stringify(DEFAULT_CFG));
  if (!c || typeof c !== 'object') return d;
  for (const k of Object.keys(d)) if (c[k] !== undefined && typeof c[k] === typeof d[k] && Array.isArray(c[k]) === Array.isArray(d[k])) d[k] = c[k];
  if (d.list === 'names' || d.list === 'grant') d.list = 'namedrop';
  const strs = v => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string').map(x => x.slice(0, 200)))].slice(0, 3000) : [];
  d.disabledWords = strs(c.disabledWords); d.disabledPacks = strs(c.disabledPacks);
  if (!Object.prototype.hasOwnProperty.call(LISTS, d.list)) d.list = 'basic';
  if (!SCHEMES.some(s => s.id === d.scheme)) d.scheme = 'AABB';
  if (!REVEALS.some(r => r.id === d.reveal)) d.reveal = 'all';
  d.teams = [0, 1].map(i => ({ name: String(d.teams[i]?.name ?? DEFAULT_CFG.teams[i].name).slice(0, 18), color: clamp(d.teams[i]?.color | 0, 0, 5) }));
  d.lineup = d.lineup.filter(m => m && typeof m === 'object').slice(0, 24).map(m => ({ name: String(m.name ?? '').slice(0, 24), team: m.team === 1 ? 1 : 0 }));
  if (!d.synthBpm || typeof d.synthBpm !== 'object' || Array.isArray(d.synthBpm)) d.synthBpm = {};
  d.firstTeam = d.firstTeam === 1 ? 1 : 0;
  return d;
}
let CFG = normalizeCfg(ls.get('bfb.config', null));
const teamColor = t => PALETTE[CFG.teams[t]?.color ?? t];
const teamName = t => (CFG.teams[t]?.name || '').trim() || (t ? 'Team B' : 'Team A');

const LIB = { db: null, assets: null, tracks: [], locals: [], localSeq: 0, buffers: new Map(), loading: new Map(), status: '', statusErr: false, confirmDel: null, dbReady: false };
let cfgTimer = 0, lastLocalEdit = 0, cfgWriting = false, cfgDirty = false;
function saveCfg() {
  if (NET.on) return;   // an online battle's setup comes from its link; this device's own setup stays as it was
  ls.set('bfb.config', CFG); lastLocalEdit = Date.now();
  clearTimeout(cfgTimer); cfgTimer = setTimeout(pushCfg, 900);
}
async function pushCfg() {
  if (!LIB.db) return;
  if (cfgWriting) { cfgDirty = true; return; }
  cfgWriting = true;
  const beat = /^(local|yt):/.test(CFG.beat) ? (LIB.lastShared || DEFAULT_CFG.beat) : CFG.beat; LIB.lastShared = beat;
  try { await LIB.db.doc('config/battle').set({ ...CFG, beat, updatedAt: Date.now() }); } catch (e) { console.warn('config not saved', e && e.code); }
  cfgWriting = false;
  if (cfgDirty) { cfgDirty = false; pushCfg(); }
}
function onRemoteCfg(snap) {
  if (!snap.exists || snap.metadata.hasPendingWrites || NET.on) return;
  if (Date.now() - lastLocalEdit < 4000) return;
  const next = normalizeCfg(snap.data());
  LIB.lastShared = next.beat;
  if (/^(local|yt):/.test(CFG.beat)) next.beat = CFG.beat;
  if (JSON.stringify(next) === JSON.stringify(CFG)) return;
  const ae = document.activeElement; if (ae && ae.matches && ae.matches('#setup input[type=text]')) return;
  CFG = next; ls.set('bfb.config', CFG); previewBlock = null; renderSetup();
}
async function initCaps() {
  if (!window.claude || typeof window.claude.use !== 'function') { LIB.dbReady = true; renderBeats(); return; }
  let db = null, assets = null;
  try { [db, assets] = await Promise.all([window.claude.use('db').catch(() => null), window.claude.use('assets').catch(() => null)]); } catch { }
  LIB.db = db; LIB.assets = assets;
  if (db) {
    try {
      db.collection('tracks').onSnapshot(snap => {
        LIB.tracks = snap.docs.filter(d => d.exists).map(d => ({ id: d.id, ...d.data() })).filter(t => t.assetId && t.bpm > 0)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        LIB.dbReady = true; renderBeats(); renderSummary();
      }, err => { console.warn('tracks', err && err.code); LIB.dbReady = true; renderBeats(); });
      db.doc('config/battle').onSnapshot(onRemoteCfg, err => console.warn('config', err && err.code));
    } catch (e) { console.warn(e); LIB.dbReady = true; }
  } else LIB.dbReady = true;
  renderBeats(); renderSummary();
}

/* ================= beats ================= */
function synthBeats() { return PRESETS.map(p => ({ id: 'synth:' + p.id, kind: 'synth', name: p.name, style: p.style, bpm: CFG.synthBpm[p.id] || p.bpm, color: p.color, preset: p })); }
function uploadBeats() {
  return [
    ...ytBeats(),
    ...LIB.locals.map(t => ({ id: 'local:' + t.id, kind: 'local', name: t.name, style: 'This device', bpm: t.bpm, duration: t.buffer.duration, color: '#8c809a', meta: t })),
    ...LIB.tracks.map(t => ({ id: 'track:' + t.id, kind: 'track', name: t.name, style: 'Library', bpm: t.bpm, duration: t.duration, color: '#f7efe3', meta: t })),
  ];
}
function currentBeat() { return [...synthBeats(), ...uploadBeats()].find(b => b.id === CFG.beat) || null; }
function paceFor(bpm) { return SETTINGS.pace === 'half' ? 2 : SETTINGS.pace === 'normal' ? 1 : (bpm > 120 ? 2 : 1); }
function decode(ctx, ab) { return new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }); }
async function loadTrackBuffer(t) {
  if (LIB.buffers.has(t.id)) return LIB.buffers.get(t.id);
  if (LIB.loading.has(t.id)) return LIB.loading.get(t.id);
  const p = (async () => {
    const res = await fetch('/_blob/' + t.assetId);
    if (!res.ok) throw new Error('This track is missing from the library.');
    const txt = await res.text();
    const nl = txt.indexOf('\n');
    const bin = atob(txt.slice(nl + 1).replace(/\s+/g, ''));
    const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const buf = await decode(initAudio(), u8.buffer);
    LIB.buffers.set(t.id, buf); return buf;
  })();
  LIB.loading.set(t.id, p);
  p.then(() => LIB.loading.delete(t.id), () => LIB.loading.delete(t.id));
  return p;
}
async function bufferFor(b) { return b.kind === 'local' ? b.meta.buffer : loadTrackBuffer(b.meta); }
function trackTiming(m, cb = 1) {
  const spb = 60 / m.bpm, barS = 4 * spb;
  const rapPos = m.downbeat + (m.rapStartBar - 1) * barS;
  return { spb, barS, rapPos, countPos: rapPos - 2 * 4 * cb * spb };
}
const PREV = { id: null };
async function togglePreview(id) {
  if (PREV.id === id) { stopPreview(); return; }
  stopPreview();
  const b = [...synthBeats(), ...uploadBeats()].find(x => x.id === id); if (!b) return;
  if (b.kind === 'yt') { openYT({ mode: 'edit', id: b.meta.id, videoId: b.meta.videoId, name: b.meta.name, bpm: b.meta.bpm, bar1: b.meta.bar1, autoCheck: true }); return; }
  const ctx = initAudio(); try { await ctx.resume(); } catch { }
  PREV.id = id; renderBeats();
  if (b.kind === 'synth') { startPlayback({ preset: b.preset, bpm: b.bpm, T0: ctx.currentTime + 0.06, click: SETTINGS.click }); return; }
  try {
    setBeatStatus('<span class="spinner"></span>Loading ' + esc(b.name) + '…');
    const buf = await bufferFor(b); if (PREV.id !== id) return;
    setBeatStatus('');
    const tm = trackTiming(b.meta);
    startPlayback({ bpm: b.bpm, track: { buffer: buf, loopStart: tm.rapPos }, T0: ctx.currentTime + 0.06, songPos0: Math.max(0, tm.countPos), click: SETTINGS.click });
  } catch (e) { PREV.id = null; setBeatStatus(esc(e.message || 'Could not load that track.'), true); renderBeats(); }
}
function stopPreview() { if (PREV.id) { PREV.id = null; stopPlayback(0.2); renderBeats(); } }
function setBeatStatus(html, err = false) { LIB.status = html; LIB.statusErr = err; const el = $('#beatStatus'); if (el) { el.innerHTML = html; el.classList.toggle('err', err); } }

/* ================= setup rendering ================= */
let previewBlock = null;
const chip = (act, v, on, label, extra = '') => `<button class="chip small" data-act="${act}" data-v="${v}" aria-pressed="${on}" ${extra}>${label}</button>`;
const teamMembers = t => CFG.lineup.filter(m => m.team === t).map(m => (m.name || '').trim()).filter(Boolean);
// one turn per team per round; teams alternate, rappers inside a team decide who raps what.
// rounds 0 = endless: the teams keep trading turns until someone presses End.
// turnMaker() freezes the names, so a running battle isn't changed by later edits
function turnMaker() {
  const first = CFG.firstTeam, names = [teamName(0), teamName(1)], crews = [teamMembers(0), teamMembers(1)];
  return i => { const t = i % 2 ? 1 - first : first; return { name: names[t], team: t, members: crews[t], round: Math.floor(i / 2) + 1 }; };
}
// every turn of a battle; an endless one just gives its first n turns
function battleOrder(n = 4) {
  const turn = turnMaker();
  return Array.from({ length: CFG.rounds > 0 ? CFG.rounds * 2 : n }, (_, i) => turn(i));
}
function renderSetup() { renderLineup(); renderWords(); renderBeats(); renderSummary(); }
function renderLineup() { renderTeams(); renderFormat(); renderHero(); }
function renderTeams() {
  const c = CFG, el = $('#p-lineup');
  $('#acc-teams').hidden = c.mode !== 'battle';
  if (c.mode !== 'battle') { el.innerHTML = ''; return; }
  const team = i => `<div class="team-in"><button class="swatch" style="--c:${teamColor(i)}" data-act="team-color" data-i="${i}" aria-label="Change ${esc(teamName(i))} color" title="Change color"></button><input type="text" id="team${i}" data-bind="team" data-i="${i}" value="${esc(c.teams[i].name)}" maxlength="18" aria-label="Team ${i + 1} name" autocomplete="off"></div>`;
  const roster = t => {
    const mem = c.lineup.map((m, i) => [m, i]).filter(([m]) => m.team === t);
    return `<section class="roster" style="--c:${teamColor(t)}" aria-label="${esc(teamName(t))} team">
      ${team(t)}
      <ul class="crew">${mem.map(([m, i], k) => `<li><input type="text" id="mc${i}" data-bind="mc" data-i="${i}" value="${esc(m.name)}" maxlength="24" placeholder="Rapper ${k + 1}" aria-label="${esc(teamName(t))} rapper ${k + 1}" autocomplete="off"><button class="x-btn" data-act="mc-del" data-i="${i}" aria-label="Remove ${esc(m.name || 'rapper ' + (k + 1))}"><svg><use href="#i-x"/></svg></button></li>`).join('')}</ul>
      <button class="chip ghost small add-mc" data-act="mc-add" data-v="${t}"><svg width="14" height="14"><use href="#i-plus"/></svg>Add rapper</button>
    </section>`;
  };
  el.innerHTML = `<div class="rosters-wrap"><div class="rosters">${roster(0)}<span class="vs">VS</span>${roster(1)}</div></div>
    <p class="hint">Click a color square to change a team's color. Press Enter in a name to add the next rapper.</p>`;
}
function renderFormat() {
  const c = CFG, el = $('#p-format');
  $('#acc-format .acc-h b').textContent = c.mode === 'battle' ? 'Battle format' : 'Practice length';
  if (c.mode === 'battle') {
    el.innerHTML = `<div class="grid2">
      <div class="field"><span class="label">First up</span><div class="chips">${[0, 1].map(t => chip('first', t, c.firstTeam === t, esc(teamName(t)), `style="--c:${teamColor(t)}"`)).join('')}</div></div>
      <div class="field"><span class="label">Bars per turn</span><div class="chips">${[4, 8, 16, 24, 32].map(n => chip('bars', n, c.barsPerTurn === n, n)).join('')}</div></div>
      <div class="field"><span class="label">Rounds</span><div class="chips">${[1, 2, 3, 4, 6, 0].map(n => chip('rounds', n, c.rounds === n, n || 'Endless')).join('')}</div></div>
      <div class="field"><span class="label">Changeover</span><div class="chips">${[[0, 'None'], [1, '1 bar'], [2, '2 bars'], [4, '4 bars']].map(([n, l]) => chip('change', n, c.changeBars === n, l)).join('')}</div></div>
    </div>
    <div class="field"><span class="label">Running order</span><ol class="order" id="order"></ol>
      <p class="hint">Turns alternate between the teams and the beat never stops.${c.rounds ? '' : ' <b>Endless:</b> the teams keep trading turns until you press End.'} Each team decides who raps which bars, so swap the mic inside your team whenever you like. ${c.changeBars >= 2 ? 'Between turns a "Next up" card shows, then a 1-2-3-4 count-in on the pads.' : c.changeBars === 1 ? 'Between turns there is one bar of 1-2-3-4 count-in.' : 'Teams switch with no break between turns.'}</p></div>`;
  } else {
    el.innerHTML = `<p class="blurb">Solo reps: no turns, no splash screens. Just the ball, the words and the beat.</p>
    <div class="field"><span class="label">Length</span><div class="chips">${[8, 16, 32, 64, 0].map(n => chip('pbars', n, c.practiceBars === n, n ? n + ' bars' : 'Endless')).join('')}</div></div>
    <ol class="lineup" style="gap:12px">
      ${[['Follow the ball.', 'It bounces on every beat, four beats to a bar.'], ['Land the rhyme.', 'Say the colored word right as the ball hits it.'], ['Fill the blanks.', 'Freestyle the rest of each bar however you like.']]
        .map(([a, b], i) => `<li class="mc" style="grid-template-columns:22px minmax(0,1fr)"><span class="n">${i + 1}</span><span><b>${a}</b> <span class="hint" style="display:inline">${b}</span></span></li>`).join('')}
    </ol>`;
  }
  renderOrder();
}
// the landing hero: who's battling, battle/practice, and one big start button
function renderHero() {
  const c = CFG;
  $('#modeSeg').innerHTML = chip('mode', 'battle', c.mode === 'battle', 'Battle') + chip('mode', 'practice', c.mode === 'practice', 'Practice');
  if (c.mode === 'battle') {
    const t = i => { const m = teamMembers(i); return `<button class="mu-team" style="--c:${teamColor(i)}" data-act="open-acc" data-v="teams" title="Edit teams"><span class="mu-name">${esc(teamName(i))}</span><span class="mu-crew">${m.length ? m.map(esc).join(' · ') : 'Add rappers'}</span></button>`; };
    $('#matchup').innerHTML = `${t(0)}<span class="mu-vs">VS</span>${t(1)}`;
  } else $('#matchup').innerHTML = '<span class="mu-solo">Solo practice</span>';
  // online battles need a page friends can open from a link, so not inside claude.ai
  $('#netNewBtn').hidden = c.mode !== 'battle' || !!(window.claude && typeof window.claude.use === 'function');
  // a bracket match is loaded: say which one, with a way back to the bracket
  const tc = typeof tourCurrent === 'function' ? tourCurrent() : null, bd = $('#muBadge');
  if (tc) { bd.innerHTML = `<svg width="14" height="14" aria-hidden="true"><use href="#i-trophy"/></svg>${esc(matchName(TOUR.s, tc.r, tc.m))} <button data-act="go-bracket">View bracket</button>`; bd.hidden = false; }
  else bd.hidden = true;
  renderAccSums();
}
// one-line summaries on each collapsed settings row
function renderAccSums() {
  const c = CFG, set = (k, v) => { const el = $('#sum-' + k); if (el) el.textContent = v; };
  const n = t => { const k = teamMembers(t).length; return `${k} rapper${k === 1 ? '' : 's'}`; };
  set('teams', `${teamName(0)} (${n(0)}) vs ${teamName(1)} (${n(1)})`);
  set('format', c.mode === 'battle' ? `${c.rounds ? `${c.rounds} round${c.rounds === 1 ? '' : 's'}` : 'Endless'} · ${c.barsPerTurn} bars a turn · ${c.changeBars ? c.changeBars + '-bar changeover' : 'no changeover'} · ${teamName(c.firstTeam)} first` : (c.practiceBars ? c.practiceBars + ' bars' : 'Endless'));
  const b = currentBeat(); set('beat', b ? `${b.name} · ${b.style} · ${fmtBpm(b.bpm)} BPM` : 'Pick a beat');
  const sc = SCHEMES.find(x => x.id === c.scheme), rv = REVEALS.find(x => x.id === c.reveal);
  const th = c.list === 'namedrop' ? themeLeft('namedrop') : null;
  set('words', `${LISTS[c.list].name} · ${sc ? sc.name : ''}${c.double ? ' + beat 2' : ''} · ${rv ? rv.name.toLowerCase() : ''}${th && th.total ? ` · ${th.left}/${th.total} streamer tags left` : ''}${c.list === 'namedrop' && c.allNames ? ' · every name pack' : ''}`);
}
function renderOrder() {
  const el = $('#order'); if (!el) return;
  const o = battleOrder(); let last = 0;
  el.innerHTML = o.map(p => { let s = ''; if (CFG.rounds !== 1 && p.round !== last) { last = p.round; s = `<li class="round">Round ${p.round}</li>`; } return s + `<li><i style="--c:${teamColor(p.team)}"></i>${esc(p.name)}</li>`; }).join('')
    + (CFG.rounds ? '' : '<li class="round">and so on, until you press End</li>');
}
function renderWords() {
  const c = CFG, el = $('#p-words');
  const sc = SCHEMES.find(s => s.id === c.scheme);
  if (!previewBlock) previewBlock = makeWordGen(c.list, c.scheme, c.double, c.reveal)();
  el.innerHTML = `<div class="panel-head"><h2>Words &amp; scheme</h2></div>
    <div class="field"><span class="label">Word list</span>
      <div class="chips">${Object.entries(LISTS).map(([k, l]) => chip('list', k, c.list === k, esc(l.name))).join('')}</div>
      <p class="blurb">${esc(LISTS[c.list].blurb)}</p>
      ${c.list === 'namedrop' ? `<div class="names-row"><label class="toggle"><input type="checkbox" id="namesTgl" data-bind="allNames" ${c.allNames ? 'checked' : ''}> Every name pack</label><span class="hint">${c.allNames ? `All ${PEOPLE_FAMS.length} name packs can come up, whoever is on the teams.` : 'Off: only rappers on the teams get their name pack.'}</span></div>` : ''}
      <p class="hint mem" id="memLine" aria-live="polite">${memHtml()}</p></div>
    <div class="field"><span class="label">Rhyme scheme</span>
      <div class="scheme-row"><div class="chips">${SCHEMES.map(s => chip('scheme', s.id, c.scheme === s.id, s.name)).join('')}</div>
      <label class="toggle"><input type="checkbox" id="dblTgl" data-bind="double" ${c.double ? 'checked' : ''}> Extra rhyme on beat 2</label></div></div>
    <div class="preview">
      <div class="scheme-row"><p class="hint" style="color:var(--ink-2)"><b style="color:var(--ink)">${sc.name}${c.double ? ' doubled' : ''}.</b> ${esc(sc.desc)}${c.double ? ' Plus an inside rhyme on beat 2.' : ''}</p>
        <button class="chip small ghost" data-act="shuffle"><svg width="14" height="14"><use href="#i-dice"/></svg>New words</button></div>
      <div class="mini" id="miniGrid" aria-label="Example of four bars">${miniHtml()}</div>
      <div class="scheme-row"><span class="label">Show on the pads</span>
        <div class="seg" role="group" aria-label="Which words to show">${REVEALS.map(r => chip('reveal', r.id, c.reveal === r.id, r.name)).join('')}</div></div>
    </div>
    ${wordbankHtml()}`;
  renderWordbank();
}

// word memory line: how many words earlier battles used, and how many fresh ones the list has left
let memConfirm = false;
function memHtml() {
  const n = USED.size, left = freshLeft(CFG.list), name = esc(LISTS[CFG.list].name);
  if (memConfirm) return `<span>Forget all ${n.toLocaleString()} used words so they can come up again?</span><button class="chip small" data-act="mem-yes">Yes, start fresh</button><button class="chip small ghost" data-act="mem-no">Cancel</button>`;
  const th = themeLeft(CFG.list), themes = th.total ? ` ${th.left} of ${th.total} streamer tags still unused (each shows once per tournament; names can repeat).` : '';
  if (!n) return `<span><b>No repeats.</b> Words shown in a battle are remembered on this device, so later battles get fresh ones. ${left.toLocaleString()} fresh words in ${name}.${themes}</span>`;
  return `<span><b>${n.toLocaleString()} word${n === 1 ? '' : 's'} used</b> in earlier battles won’t come back until the list runs low. ${left.toLocaleString()} fresh words left in ${name}.${themes}</span><button class="chip small ghost" data-act="mem-ask">Reset used words</button>`;
}
function refreshMem() { const el = $('#memLine'); if (el) el.innerHTML = memHtml(); }
const miniHtml = () => previewBlock.map(row => row.map(cell => cell ? `<div class="p rh c${cell.c}${cell.show ? '' : ' blank'}">${cell.show ? esc(cell.w) : ''}</div>` : '<div class="p"></div>').join('')).join('');
function refreshMini() { const el = $('#miniGrid'); if (!el) return; previewBlock = makeWordGen(CFG.list, CFG.scheme, CFG.double, CFG.reveal)(); el.innerHTML = miniHtml(); }
/* ---- word browser: every rhyme family in every list ---- */
const WB = { open: false, list: null, q: '' };
const LIST_STATS = Object.fromEntries(Object.entries(LISTS).map(([k, l]) => [k, { fams: l.fams.length, words: l.fams.reduce((n, f) => n + f.length, 0) }]));
function wordbankHtml() {
  const lists = Object.keys(LISTS).length;
  const fams = Object.values(LIST_STATS).reduce((n, s) => n + s.fams, 0);
  const words = Object.values(LIST_STATS).reduce((n, s) => n + s.words, 0);
  return `<details class="wordbank" id="wordbank"${WB.open ? ' open' : ''}>
    <summary><span class="wb-head"><span class="wb-title">Browse every word</span><span class="wb-meta">${lists} lists · ${fams} rhyme families · ${words.toLocaleString()} words</span></span><svg class="wb-chev" aria-hidden="true"><use href="#i-chev"/></svg></summary>
    <div class="wb-body">
      <div class="wb-tools">
        <div class="chips" id="wbChips" role="group" aria-label="Word list to browse"></div>
        <input type="search" id="wbSearch" placeholder="Find a word in any list" value="${esc(WB.q)}" autocomplete="off" aria-label="Find a word">
      </div>
      <p class="hint" id="wbSum" aria-live="polite"></p>
      <div class="wb-offbar" id="wbOff"></div>
      <div class="wb-fams" id="wbFams"></div>
    </div>
  </details>`;
}
function renderWordbank() {
  if (!$('#wbFams')) return;
  const sel = WB.list && LISTS[WB.list] ? WB.list : CFG.list;
  const q = WB.q.trim().toLowerCase();
  const match = f => !q || f.some(w => bare(w).toLowerCase().includes(q));
  const hits = Object.fromEntries(Object.entries(LISTS).map(([k, l]) => [k, l.fams.filter(match).length]));
  $('#wbChips').innerHTML = Object.entries(LISTS).map(([k, l]) =>
    `<button class="chip small" data-act="wb-list" data-v="${k}" aria-pressed="${k === sel}">${esc(l.name)}<span class="ct">${q ? hits[k] : activeFams(k).length}</span>${k === CFG.list ? '<span class="sr"> (in use)</span>' : ''}</button>`).join('');
  let fams = LISTS[sel].fams.map((f, i) => [f, i]).filter(([f]) => match(f));
  const st = LIST_STATS[sel];
  const names = rosterNames();
  const off = f => sel === 'namedrop' && PEOPLE.has(f) && !personActive(f, names);
  if (sel === 'namedrop') fams = fams.filter(([f]) => !off(f)).concat(fams.filter(([f]) => off(f)));
  let sum;
  if (!q && sel === 'namedrop') {
    const swo = switchedOff();
    const on = LISTS.namedrop.fams.filter(f => PEOPLE.has(f) && personActive(f, names) && !packOff(f, swo)).map(f => bare(f[0]));
    sum = `<b>Name drop</b>${sel === CFG.list ? ' (the list you’re playing with)' : ''}: ${activeFams('namedrop').length} rhyme families in play. ` +
      (CFG.allNames ? `<b>Every name pack is on</b> (${on.length}), whoever is on the teams.` : (on.length ? `Name packs on for <b>${on.map(esc).join(', ')}</b>, because they’re on a team.` : 'No name packs are on yet: add rappers to the teams and their packs switch on.') +
      ` Dimmed packs belong to people who aren’t on a team, so they won’t come up.`) + ` Light chips are the words that always show when their pack comes up.`;
  } else if (!q) sum = `<b>${esc(LISTS[sel].name)}</b>${sel === CFG.list ? ' (the list you’re playing with)' : ''}: ${st.fams} rhyme families, ${st.words} words. Every word on a row rhymes with the others on that row.`;
  else if (fams.length) sum = `${fams.length} famil${fams.length === 1 ? 'y' : 'ies'} in <b>${esc(LISTS[sel].name)}</b> with “${esc(WB.q.trim())}”.`;
  else {
    const elsewhere = Object.entries(hits).filter(([k, n]) => n && k !== sel).map(([k, n]) => `${esc(LISTS[k].name)} (${n})`);
    sum = `No “${esc(WB.q.trim())}” in <b>${esc(LISTS[sel].name)}</b>.${elsewhere.length ? ' Found in ' + elsewhere.join(', ') + '.' : ' It isn’t in any list.'}`;
  }
  $('#wbSum').innerHTML = sum;
  const sw = switchedOff();
  const nOff = sw.words.size + sw.packs.size;
  $('#wbOff').innerHTML = `<span>Click a word to turn it off (in every list), or a row's box to turn off the whole pack.${USED.size ? ' <span class="wb-key"></span>Faded words were used in an earlier battle.' : ''}${nOff ? ` <b>${sw.packs.size} pack${sw.packs.size === 1 ? '' : 's'} and ${sw.words.size} word${sw.words.size === 1 ? '' : 's'} off.</b>` : ''}</span>${nOff ? '<button class="chip small ghost" data-act="wb-reset">Turn everything back on</button>' : ''}`;
  const box = $('#wbFams'); const top = box.scrollTop;
  box.innerHTML = fams.length ? fams.map(([f], i) => {
    const key = famKey(f), userOff = packOff(f, sw), roster = off(f), label = bare(f[0]);
    return `<div class="fam${roster ? ' off' : ''}${userOff ? ' user-off' : ''}"${roster ? ' title="Not on a team, so this pack won’t come up"' : ''}>
      <button class="pack-tgl" data-act="wb-pack" data-k="${esc(key)}" aria-pressed="${!userOff}" aria-label="${userOff ? 'Turn on' : 'Turn off'} the ${esc(label)} pack" title="${userOff ? 'Turn this pack back on' : 'Turn this whole pack off'}"></button>
      <div class="fam-w">${f.map(w => { const bw = bare(w), wOff = sw.words.has(bw.toLowerCase());
        return `<button class="w rh c${(i % 6) + 1}${w[0] === '*' ? ' anchor' : ''}${wOff ? ' w-off' : ''}${w[0] !== '*' && USED.has(bw.toLowerCase()) ? ' used' : ''}${q && bw.toLowerCase().includes(q) ? ' hit' : ''}" data-act="wb-word" data-w="${esc(bw.toLowerCase())}" aria-pressed="${!wOff}" title="${wOff ? `Turn “${esc(bw)}” back on` : `Turn “${esc(bw)}” off`}${w[0] === '*' ? ' (the name always shows, so this turns off the whole pack)' : ''}">${esc(bw)}</button>`; }).join('')}${roster ? '<span class="fam-note">not on a team</span>' : ''}</div></div>`;
  }).join('') : '<p class="wb-empty">Nothing here matches. Try another list or a shorter search.</p>';
  box.scrollTop = top;
}
const fmtBpm = b => (Math.round(b * 100) / 100).toString();
function beatItem(b) {
  const sel = CFG.beat === b.id, playing = PREV.id === b.id;
  const up = b.kind !== 'synth';
  const meta = `${esc(b.style)} · ${fmtBpm(b.bpm)} BPM${b.duration ? ' · ' + fmtTime(b.duration) : ''}`;
  const confirm = LIB.confirmDel === b.id ? `<div class="confirm"><span>${b.kind === 'track' ? 'Delete for everyone?' : 'Delete this beat?'}</span><button class="chip small" data-act="del-yes" data-id="${b.id}" style="background:var(--danger);color:#1c0a0d">Delete</button><button class="chip small ghost" data-act="del-no">Keep</button></div>` : '';
  return `<li class="beat${playing ? ' playing' : ''}" role="option" aria-selected="${sel}" data-act="pick-beat" data-id="${b.id}" tabindex="0">
    <span class="vinyl" style="--lab:${b.color}"></span>
    <div style="min-width:0"><div class="beat-name">${esc(b.name)}</div><div class="beat-meta">${meta}</div></div>
    <div class="beat-actions">
      <button class="mini-btn" data-act="prev-beat" data-id="${b.id}" aria-label="${playing ? 'Stop preview' : 'Preview'} ${esc(b.name)}"><svg><use href="#i-${playing ? 'stop' : 'play'}"/></svg></button>
      ${up ? `<button class="mini-btn" data-act="tune" data-id="${b.id}" aria-label="Tune ${esc(b.name)}" title="Tempo and timing"><svg><use href="#i-sliders"/></svg></button>` : ''}
      ${(b.kind === 'track' && LIB.assets) || b.kind === 'local' || b.kind === 'yt' ? `<button class="mini-btn" data-act="del" data-id="${b.id}" aria-label="Delete ${esc(b.name)}" title="Delete"><svg><use href="#i-trash"/></svg></button>` : ''}
    </div>${confirm}</li>`;
}
function renderBeats() {
  const el = $('#p-beat'); if (!el) return;
  const cur = currentBeat(); const ups = uploadBeats();
  const canSave = !!LIB.assets;
  const tempo = cur && cur.kind === 'synth' ? `<div class="tempo"><span class="label">Tempo</span><input type="range" id="bpmRange" min="60" max="150" step="1" value="${Math.round(cur.bpm)}" aria-label="Tempo"><output id="bpmOut">${Math.round(cur.bpm)} BPM</output><button class="chip small ghost" data-act="bpm-reset" ${cur.bpm === cur.preset.bpm ? 'disabled' : ''}>Reset</button></div>` : '';
  el.innerHTML = `<div class="panel-head"><h2>Beat</h2><span class="hint">Click a record to pick it</span></div>
    <ul class="beats" role="listbox" aria-label="Hip-hop beats">${synthBeats().filter(x => !x.preset.genre).map(beatItem).join('')}</ul>
    <div class="field"><span class="label">Genre flips · hip-hop drums on top</span>
      <ul class="beats" role="listbox" aria-label="Genre beats">${synthBeats().filter(x => x.preset.genre).map(beatItem).join('')}</ul></div>
    ${tempo}
    <div class="field"><span class="label">Your beats</span>
      ${ups.length ? `<ul class="beats" role="listbox" aria-label="Uploaded beats">${ups.map(beatItem).join('')}</ul>` : (LIB.dbReady ? '' : '<p class="hint"><span class="spinner"></span>Loading the shared library…</p>')}
      <label class="drop" id="drop" for="fileIn">
        <span class="plus"><svg><use href="#i-plus"/></svg></span>
        <span><strong>Add your own beat</strong><small>${canSave ? 'Drop an MP3, M4A or WAV up to 15 MB. It finds the tempo, then saves to this page so everyone can use it.' : 'Drop an MP3, M4A or WAV. It finds the tempo and plays on this device.'}</small></span>
      </label>
      <div class="yt-add"><input type="url" id="ytUrl" placeholder="Or paste a YouTube link to a beat" aria-label="YouTube link" autocomplete="off" spellcheck="false"><button class="chip small" data-act="yt-add">Add</button></div>
      <p class="status${LIB.statusErr ? ' err' : ''}" id="beatStatus">${LIB.status}</p>
    </div>`;
}
function heroSum(h) { const el = $('#heroSum'); if (el) el.innerHTML = h; }
function renderSummary() {
  const el = $('#summary'); if (!el) return;
  const b = currentBeat(); const go = $('#goBtn');
  const bpm = b ? b.bpm : 90; const cb = paceFor(bpm); const rowDur = 4 * cb * 60 / bpm;
  const beatTxt = b ? `${esc(b.name)} @ ${fmtBpm(bpm)} BPM${cb === 2 ? ' (half-time ball)' : ''}` : (LIB.dbReady ? 'Pick a beat' : 'Loading beats…');
  if (CFG.mode === 'battle') {
    const order = battleOrder(), endless = !CFG.rounds;
    const rows = order.length * CFG.barsPerTurn + Math.max(0, order.length - 1) * CFG.changeBars + 2;
    const fmt = endless ? `endless, ${CFG.barsPerTurn} bars a turn` : `${CFG.rounds} round${CFG.rounds === 1 ? '' : 's'} of ${CFG.barsPerTurn} bars`;
    el.innerHTML = `<b>${esc(teamName(0))} vs ${esc(teamName(1))} · ${fmt}</b><span>≈ ${fmtTime(CFG.barsPerTurn * rowDur)} per turn · ${endless ? 'until you press End' : fmtTime(rows * rowDur) + ' total'} · ${beatTxt}</span>`;
    heroSum(endless ? `<b>Endless battle · ${CFG.barsPerTurn} bars a turn</b> · ≈ ${fmtTime(CFG.barsPerTurn * rowDur)} per turn · ${beatTxt}`
      : `<b>${fmt}</b> · ≈ ${fmtTime(rows * rowDur)} · ${beatTxt}`);
    go.querySelector('span').textContent = 'Start battle';
    go.disabled = !b;
  } else {
    const n = CFG.practiceBars;
    el.innerHTML = `<b>${n ? n + ' bars' : 'Endless'} of practice</b><span>${n ? '≈ ' + fmtTime(n * rowDur) + ' · ' : ''}${beatTxt}</span>`;
    heroSum(`<b>${n ? n + ' bars' : 'Endless'} of practice</b>${n ? ' · ≈ ' + fmtTime(n * rowDur) : ''} · ${beatTxt}`);
    go.querySelector('span').textContent = 'Start practice';
    go.disabled = !b;
  }
  const hg = $('#heroGo'); if (hg) { hg.querySelector('span').textContent = go.querySelector('span').textContent; hg.disabled = go.disabled; }
  renderAccSums();
}

/* ================= uploads + tuner ================= */
const MAX_LIB_BYTES = 15 * 1024 * 1024;
async function handleFile(file) {
  if (!file) return;
  stopPreview();
  if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|wav|ogg|aac|flac|aif|aiff)$/i.test(file.name)) { setBeatStatus('That file is not audio. Try an MP3, M4A or WAV.', true); return; }
  setBeatStatus('<span class="spinner"></span>Reading ' + esc(file.name) + '…');
  let buf;
  try { buf = await decode(initAudio(), await file.arrayBuffer()); }
  catch { setBeatStatus('This browser could not read that file. Export it as an MP3 and try again.', true); return; }
  if (buf.duration < 8) { setBeatStatus('That clip is under 8 seconds. Use a full beat.', true); return; }
  setBeatStatus('<span class="spinner"></span>Finding the tempo…');
  let an;
  try { an = await analyzeBuffer(buf); } catch (e) { console.warn(e); an = { bpm: 90, downbeat: 0, rapStartBar: 3 }; }
  setBeatStatus('');
  openTuner({ mode: 'new', file, buffer: buf, name: file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').slice(0, 60), ...an });
}
const T = { open: false };
function openTuner(o) {
  if (NET.on) return;   // a file finished reading after an online battle opened: the battle's beat stays as it is
  Object.assign(T, { open: true, taps: [], playing: false, cache: null }, o);
  T.peaks = peaksOf(T.buffer, 1600);
  $('#tName').value = T.name; $('#tBpm').value = fmtBpm(T.bpm);
  const isNew = T.mode === 'new';
  const tooBig = isNew && T.file.size > MAX_LIB_BYTES;
  $('#tSave').hidden = isNew && (!LIB.assets || !LIB.db || tooBig);
  $('#tSave').textContent = isNew ? 'Save to library' : 'Save changes';
  $('#tLocal').hidden = !isNew;
  $('#tLocal').setAttribute('aria-pressed', String($('#tSave').hidden));
  $('#tunerTitle').textContent = isNew ? 'Tune your beat' : 'Tune ' + T.name;
  tStatus(isNew ? (tooBig ? `This file is ${(T.file.size / 1048576).toFixed(1)} MB, over the 15 MB library limit. You can still use it on this device.` : `Tempo found: ${fmtBpm(T.bpm)} BPM. Press play and check the click lines up.`) : '');
  $('#tTap').textContent = 'Tap';
  $('#tuner').hidden = false;
  requestAnimationFrame(() => { drawTuner(); $('#tName').focus(); });
}
function tStatus(t, err = false) { const el = $('#tStatus'); el.textContent = t; el.classList.toggle('err', err); }
function closeTuner() { tunerStop(); T.open = false; $('#tuner').hidden = true; }
function tTiming() { const spb = 60 / T.bpm, barS = 4 * spb, rapPos = T.downbeat + (T.rapStartBar - 1) * barS; return { spb, barS, rapPos, countPos: rapPos - 2 * barS }; }
function tNormalize() {
  const { barS } = tTiming();
  while (T.downbeat < 0) { T.downbeat += barS; T.rapStartBar -= 1; }
  while (T.downbeat >= barS) { T.downbeat -= barS; T.rapStartBar += 1; }
  const lastBar = Math.max(1, Math.floor((T.buffer.duration - T.downbeat) / barS) - 1);
  T.rapStartBar = clamp(T.rapStartBar, 1, lastBar);
}
function tSetBpm(b) {
  b = clamp(Math.round(b * 100) / 100, 40, 220); if (!isFinite(b)) return;
  const { rapPos } = tTiming(); T.bpm = b; const barS = 240 / b;
  T.downbeat = rapPos - (T.rapStartBar - 1) * barS; tNormalize();
  $('#tBpm').value = fmtBpm(T.bpm); tunerChanged();
}
function tShift(delta) { T.downbeat += delta; tNormalize(); tunerChanged(); }
function tunerChanged() { T.cache = null; if (T.playing) tunerPlay(); drawTuner(); }
function sizeCanvas(cv) { const dpr = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(10, cv.clientWidth), h = Math.max(10, cv.clientHeight); if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); } const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return [g, w, h]; }
function zoomWindow() { const { spb, barS, rapPos, countPos } = tTiming(); return [countPos - 0.5 * spb, rapPos + barS + 0.5 * spb]; }
function drawTuner(playPos = null) {
  if (!T.open) return;
  const { spb, barS, rapPos, countPos } = tTiming();
  const sr = T.buffer.sampleRate; const ch = T.buffer.getChannelData(0); const dur = T.buffer.duration;
  // zoom
  {
    const cv = $('#tZoom'); const [g, w, h] = sizeCanvas(cv); const [a, b] = zoomWindow(); const span = b - a; const X = t => (t - a) / span * w;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,177,46,.07)'; g.fillRect(X(countPos), 0, X(rapPos) - X(countPos), h);
    const key = a.toFixed(4) + w;
    if (!T.cache || T.cache.key !== key) {
      const cols = new Float32Array(Math.ceil(w) * 2);
      for (let x = 0; x < w; x++) {
        const t0 = a + x / w * span, t1 = a + (x + 1) / w * span; let mn = 0, mx = 0;
        const i0 = Math.max(0, Math.floor(t0 * sr)), i1 = Math.min(ch.length, Math.floor(t1 * sr)); const st = Math.max(1, Math.floor((i1 - i0) / 80));
        for (let i = i0; i < i1; i += st) { const v = ch[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
        cols[x * 2] = mn; cols[x * 2 + 1] = mx;
      }
      T.cache = { key, cols };
    }
    const cols = T.cache.cols; g.fillStyle = 'rgba(247,239,227,.5)';
    for (let x = 0; x < w; x++) { const y0 = h / 2 - cols[x * 2 + 1] * h * 0.46, y1 = h / 2 - cols[x * 2] * h * 0.46; g.fillRect(x, y0, 1, Math.max(1, y1 - y0)); }
    g.font = '500 11px "DM Mono", monospace'; g.textBaseline = 'top';
    for (let k = -1; k <= 13; k++) {
      const t = countPos + k * spb; if (t < a || t > b) continue; const x = X(t); const isBar = k % 4 === 0;
      const isRap = Math.abs(t - rapPos) < 1e-6;
      g.fillStyle = isRap ? '#ffb12e' : isBar ? 'rgba(247,239,227,.75)' : 'rgba(247,239,227,.18)';
      g.fillRect(Math.round(x) - (isBar ? 1 : 0), 0, isBar ? 2 : 1, h);
      if (isBar) { g.fillStyle = isRap ? '#ffb12e' : 'rgba(247,239,227,.8)'; const lbl = isRap ? 'BAR 1' : k < 8 ? 'COUNT-IN' : 'BAR 2'; g.fillText(lbl, x + 6, 8); }
    }
    if (playPos != null && playPos >= a && playPos <= b) { g.fillStyle = '#ff5f8f'; g.fillRect(X(playPos) - 1, 0, 2, h); }
  }
  // overview
  {
    const cv = $('#tOver'); const [g, w, h] = sizeCanvas(cv); const X = t => t / dur * w; const n = T.peaks.length;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,177,46,.12)'; g.fillRect(X(countPos), 0, X(rapPos) - X(countPos), h);
    g.fillStyle = 'rgba(247,239,227,.38)';
    for (let x = 0; x < w; x++) { const p = T.peaks[Math.floor(x / w * n)] || 0; const hh = Math.max(1, p * h * 0.9); g.fillRect(x, (h - hh) / 2, 1, hh); }
    g.fillStyle = 'rgba(247,239,227,.12)';
    for (let t = T.downbeat; t < dur; t += barS) g.fillRect(Math.round(X(t)), h - 6, 1, 6);
    g.fillStyle = '#ffb12e'; g.fillRect(Math.round(X(rapPos)) - 1, 0, 2, h);
    if (playPos != null) { g.fillStyle = '#ff5f8f'; g.fillRect(X(playPos) - 1, 0, 2, h); }
  }
  $('#tBar').textContent = `Bar ${T.rapStartBar} · ${fmtSec(Math.max(0, rapPos))}`;
}
function tunerPlay() {
  const ctx = initAudio(); ctx.resume();
  const { countPos, rapPos } = tTiming();
  T.T0 = ctx.currentTime + 0.08; T.pos0 = countPos;
  startPlayback({ bpm: T.bpm, track: { buffer: T.buffer, loopStart: rapPos }, T0: T.T0, songPos0: countPos, click: true });
  T.playing = true; $('#tPrev').innerHTML = '<svg width="14" height="14"><use href="#i-stop"/></svg>Stop';
  cancelAnimationFrame(T.raf);
  const leds = $$('#tLeds i');
  const loop = () => {
    if (!T.playing) return; T.raf = requestAnimationFrame(loop);
    const el = heardTime() - T.T0; const spb = 60 / T.bpm; const beat = Math.floor(el / spb);
    const { barS, rapPos } = tTiming();
    let pos = T.pos0 + el;
    const bars = Math.floor((T.buffer.duration - rapPos) / barS);
    if (bars >= 4 && pos > rapPos + bars * barS) pos = rapPos + ((pos - rapPos) % (bars * barS));
    leds.forEach((l, i) => { const on = el >= 0 && ((beat % 4) + 4) % 4 === i; l.classList.toggle('on', on); l.classList.toggle('one', on && i === 0); });
    drawTuner(pos);
  };
  loop();
}
function tunerStop() { if (!T.playing) return; T.playing = false; cancelAnimationFrame(T.raf); stopPlayback(0.15); $('#tPrev').innerHTML = '<svg width="14" height="14"><use href="#i-play"/></svg>Play with click'; $$('#tLeds i').forEach(l => l.className = ''); drawTuner(); }
function fileToB64(file) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => { const s = String(fr.result); res(s.slice(s.indexOf(',') + 1)); }; fr.onerror = () => rej(fr.error); fr.readAsDataURL(file); }); }
const UPLOAD_ERRORS = {
  too_large: 'That file is too big for the library. Export a smaller MP3 (under 15 MB) or use it on this device only.',
  quota_or_state: 'The library is full. Delete a beat nobody uses, then try again.',
  rate_limited: 'Too many uploads in a row. Wait a minute and try again.',
  unsupported_type: 'The library would not accept this file. Use it on this device only.',
};
async function tunerSave(where) {
  T.name = $('#tName').value.trim() || 'Untitled beat';
  const meta = { name: T.name, bpm: T.bpm, downbeat: Math.round(T.downbeat * 10000) / 10000, rapStartBar: T.rapStartBar };
  tunerStop();
  if (T.mode === 'edit-local') { Object.assign(T.local, meta); closeTuner(); renderBeats(); renderSummary(); return; }
  if (T.mode === 'edit-track') {
    try { tStatus('Saving…'); await LIB.db.doc('tracks/' + T.docId).update(meta); closeTuner(); }
    catch (e) { tStatus('Could not save changes' + (e && e.code === 'invalid_argument' ? ': you can view this library but not edit it.' : '. Try again.'), true); }
    return;
  }
  if (where === 'local') {
    const id = ++LIB.localSeq; LIB.locals.unshift({ id, ...meta, buffer: T.buffer });
    CFG.beat = 'local:' + id; saveCfgLocalOnly(); closeTuner(); renderBeats(); renderSummary(); return;
  }
  const btns = [$('#tSave'), $('#tLocal')]; btns.forEach(b => b.disabled = true);
  let up = null;
  try {
    tStatus(`Uploading ${(T.file.size / 1048576).toFixed(1)} MB…`);
    const b64 = await fileToB64(T.file);
    const blob = new Blob(['BFB-AUDIO/1 ' + (T.file.type || 'audio/mpeg') + '\n' + b64], { type: 'text/plain' });
    up = await LIB.assets.upload(blob, { type: 'text/plain' });
    const ref = await LIB.db.collection('tracks').add({ ...meta, duration: Math.round(T.buffer.duration * 100) / 100, assetId: up.id, bytes: T.file.size, mime: T.file.type || 'audio/mpeg', createdAt: Date.now() });
    LIB.buffers.set(ref.id, T.buffer);
    CFG.beat = 'track:' + ref.id; saveCfg();
    closeTuner(); setBeatStatus(`Saved “${esc(T.name)}” to the library.`); renderBeats(); renderSummary();
  } catch (e) {
    console.warn('upload', e);
    if (up && up.id) { try { await LIB.assets.delete(up.id); } catch { } }
    tStatus(UPLOAD_ERRORS[e && e.code] || 'The upload did not go through. Check your connection, or use it on this device only.', true);
  } finally { btns.forEach(b => b.disabled = false); }
}
function saveCfgLocalOnly() { if (!NET.on) ls.set('bfb.config', CFG); }
async function openTuneFor(id) {
  const b = uploadBeats().find(x => x.id === id); if (!b) return;
  stopPreview();
  if (b.kind === 'yt') { openYT({ mode: 'edit', id: b.meta.id, videoId: b.meta.videoId, name: b.meta.name, bpm: b.meta.bpm, bar1: b.meta.bar1 }); return; }
  try {
    setBeatStatus('<span class="spinner"></span>Loading ' + esc(b.name) + '…');
    const buf = await bufferFor(b); setBeatStatus('');
    const m = b.meta;
    openTuner({ mode: b.kind === 'local' ? 'edit-local' : 'edit-track', local: b.kind === 'local' ? m : null, docId: b.kind === 'track' ? m.id : null, buffer: buf, name: m.name, bpm: m.bpm, downbeat: m.downbeat, rapStartBar: m.rapStartBar });
  } catch (e) { setBeatStatus(esc(e.message || 'Could not load that track.'), true); }
}
async function deleteBeat(id) {
  const b = uploadBeats().find(x => x.id === id); LIB.confirmDel = null; if (!b) { renderBeats(); return; }
  if (PREV.id === id) stopPreview();
  if (b.kind === 'local') { LIB.locals = LIB.locals.filter(t => t !== b.meta); }
  else if (b.kind === 'yt') deleteYT(id);
  else {
    try { setBeatStatus('<span class="spinner"></span>Deleting…'); await LIB.db.doc('tracks/' + b.meta.id).delete(); try { await LIB.assets.delete(b.meta.assetId); } catch { } LIB.buffers.delete(b.meta.id); setBeatStatus(''); }
    catch (e) { setBeatStatus('Could not delete that beat. You may not have edit access.', true); }
  }
  if (CFG.beat === id) { CFG.beat = 'synth:basement'; saveCfg(); }
  renderBeats(); renderSummary();
}
