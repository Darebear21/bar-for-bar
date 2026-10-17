
/* ================= tournament bracket =================
   Single elimination for 2-16 teams. Seeds follow the list order (1 v 8, 4 v 5, 2 v 7, 3 v 6); when the team
   count isn't a power of two the top seeds get byes. Saved on this device. */
const TOUR_KEY = 'bfb.tourney';
const TOUR = { s: ls.get(TOUR_KEY, null), editing: false, draft: null, fresh: true, confirm: null };
if (TOUR.s && (!Array.isArray(TOUR.s.teams) || !Array.isArray(TOUR.s.res))) TOUR.s = null;
const saveTour = () => ls.set(TOUR_KEY, TOUR.s);
function seedOrder(size) { let a = [1, 2]; while (a.length < size) { const n = a.length * 2 + 1; a = a.flatMap(s => [s, n - s]); } return a; }
const brRounds = s => Math.log2(s.size);
function roundName(s, r) { const k = brRounds(s) - r; return k === 1 ? 'Final' : k === 2 ? 'Semifinals' : k === 3 ? 'Quarterfinals' : `Round of ${2 ** k}`; }
function matchName(s, r, m) { const k = brRounds(s) - r; return k === 1 ? 'Final' : k === 2 ? `Semifinal ${m + 1}` : k === 3 ? `Quarterfinal ${m + 1}` : `Round of ${2 ** k} · ${m + 1}`; }
// team index (or null) in a slot; first-round slots come from the seeds, later ones from winners
function slotTeam(s, r, m, side) {
  if (r === 0) { const seed = seedOrder(s.size)[2 * m + side]; return seed <= s.teams.length ? seed - 1 : null; }
  return brWinner(s, r - 1, 2 * m + side);
}
function brWinner(s, r, m) {
  const w = s.res[r][m]; if (w != null) return w;
  if (r === 0) { const a = slotTeam(s, 0, m, 0), b = slotTeam(s, 0, m, 1); if (a == null && b != null) return b; if (b == null && a != null) return a; }
  return null;
}
function matchInfo(s, r, m) {
  const a = slotTeam(s, r, m, 0), b = slotTeam(s, r, m, 1), w = brWinner(s, r, m);
  const bye = r === 0 && (a == null || b == null);
  return { r, m, a, b, w, bye, ready: a != null && b != null && w == null, done: w != null && !bye };
}
function nextMatch(s) {
  for (let r = 0; r < brRounds(s); r++) for (let m = 0; m < s.size >> (r + 1); m++) { const i = matchInfo(s, r, m); if (i.ready) return i; }
  return null;
}
const champion = s => brWinner(s, brRounds(s) - 1, 0);
// picking (or un-picking) a winner clears any later result that depended on the old one
function setWinner(r, m, t) {
  const s = TOUR.s, old = s.res[r][m];
  s.res[r][m] = old === t ? null : t;
  let rr = r, mm = m;
  while (old != null && rr + 1 < brRounds(s)) { rr++; mm >>= 1; if (s.res[rr][mm] === old) s.res[rr][mm] = null; else break; }
  saveTour();
}
function newBracket(teams) {
  const size = Math.max(2, 2 ** Math.ceil(Math.log2(Math.max(2, teams.length))));
  const res = []; for (let r = 0, n = size / 2; n >= 1; r++, n /= 2) res.push(Array(n).fill(null));
  return { teams, size, res, current: null, createdAt: Date.now() };
}
const teamLine = t => t.members.length ? t.members.map(esc).join(' · ') : '';
// is the battle on the landing screen the bracket match we loaded?
function tourCurrent() {
  const s = TOUR.s; if (!s || !s.current) return null;
  const i = matchInfo(s, s.current.r, s.current.m);
  if (i.a == null || i.b == null || CFG.mode !== 'battle') return null;
  if (teamName(0) !== s.teams[i.a].name || teamName(1) !== s.teams[i.b].name) return null;
  return i;
}
function loadMatch(r, m) {
  const s = TOUR.s, i = matchInfo(s, r, m); if (i.a == null || i.b == null) return;
  const A = s.teams[i.a], B = s.teams[i.b];
  const ca = A.color % PALETTE.length, cb = B.color % PALETTE.length === ca ? (ca + 1) % PALETTE.length : B.color % PALETTE.length;
  CFG.mode = 'battle';
  CFG.teams = [{ name: A.name.slice(0, 18), color: ca }, { name: B.name.slice(0, 18), color: cb }];
  CFG.lineup = [...A.members.map(n => ({ name: n.slice(0, 24), team: 0 })), ...B.members.map(n => ({ name: n.slice(0, 24), team: 1 }))].slice(0, 24);
  CFG.firstTeam = 0;
  s.current = { r, m }; saveTour(); saveCfg(); previewBlock = null;
  hideBracket();
}
function recordResult(side) {
  const i = tourCurrent(); if (!i) return;
  setWinner(i.r, i.m, side ? i.b : i.a);
  TOUR.s.current = null; saveTour();
  exitStage(); showBracket();
}

/* ---- screens ---- */
function showBracket() {
  stopPreview();
  $('#setup').hidden = true; $('#stage').hidden = true; $('#bracket').hidden = false;
  if (!TOUR.s) { TOUR.editing = true; TOUR.draft = null; }
  window.scrollTo(0, 0); renderBracket();
}
function hideBracket() { TOUR.editing = false; TOUR.confirm = null; $('#bracket').hidden = true; $('#setup').hidden = false; window.scrollTo(0, 0); renderSetup(); }
function renderBracket() {
  if (TOUR.editing || !TOUR.s) renderTourForm(); else renderTourBracket();
}
function draftFrom() {
  if (TOUR.draft) return TOUR.draft;
  if (TOUR.s) return (TOUR.draft = TOUR.s.teams.map(t => ({ name: t.name, crew: t.members.join(', ') })));
  // a fresh tournament starts from the two teams on the battle screen plus six empty slots
  const d = [0, 1].map(t => ({ name: teamName(t), crew: teamMembers(t).join(', ') }));
  while (d.length < 8) d.push({ name: '', crew: '' });
  return (TOUR.draft = d);
}
function renderTourForm() {
  const d = draftFrom(), editing = !!TOUR.s;
  $('#brActions').innerHTML = editing ? '<button class="chip ghost" data-act="br-cancel">Cancel</button>' : '';
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, d.length))), byes = size - d.length;
  $('#brBody').innerHTML = `<div class="br-form">
    <div class="br-form-head"><h2>${editing ? 'Edit teams' : 'Set up the bracket'}</h2>
      <p class="hint">List the teams in seed order: seed 1 plays the last seed in the first round. Rappers are separated by commas.${byes ? ` With ${d.length} teams, the top ${byes} seed${byes === 1 ? ' gets a bye' : 's get byes'} into round 2.` : ''}</p></div>
    <ol class="br-teams">${d.map((t, i) => `<li style="--c:${PALETTE[i % PALETTE.length]}">
      <span class="br-seed">${i + 1}</span>
      <input type="text" data-bind="bt-name" data-i="${i}" value="${esc(t.name)}" placeholder="Team ${i + 1}" maxlength="18" aria-label="Seed ${i + 1} team name" autocomplete="off">
      <input type="text" data-bind="bt-crew" data-i="${i}" value="${esc(t.crew)}" placeholder="Rappers, separated by commas" aria-label="Seed ${i + 1} rappers" autocomplete="off">
      <span class="br-move"><button class="x-btn" data-act="bt-up" data-i="${i}" aria-label="Move up" ${i ? '' : 'disabled'}><svg><use href="#i-up"/></svg></button><button class="x-btn" data-act="bt-del" data-i="${i}" aria-label="Remove seed ${i + 1}" ${d.length > 2 ? '' : 'disabled'}><svg><use href="#i-x"/></svg></button></span>
    </li>`).join('')}</ol>
    <div class="br-form-tools">
      <button class="chip ghost small" data-act="bt-add" ${d.length >= 16 ? 'disabled' : ''}><svg width="14" height="14"><use href="#i-plus"/></svg>Add team</button>
      <button class="chip ghost small" data-act="bt-shuffle"><svg width="14" height="14"><use href="#i-dice"/></svg>Shuffle seeds</button>
      <span class="hint">${d.length} teams · ${Math.log2(size)} rounds · ${size - 1 - byes} battles</span>
    </div>
    ${editing ? `<p class="hint">${d.length !== TOUR.s.teams.length ? '<b>Changing the number of teams restarts the bracket.</b> ' : ''}Renaming keeps every result.</p>` : `<label class="toggle"><input type="checkbox" id="brFresh" ${TOUR.fresh ? 'checked' : ''}> Start with fresh words (forget every word used so far, including practice runs)</label>`}
    <div class="br-form-go"><button class="go" data-act="bt-save"><svg><use href="#i-trophy"/></svg><span>${editing ? 'Save teams' : 'Create bracket'}</span></button></div>
  </div>`;
}
function saveTourForm() {
  const d = draftFrom();
  const teams = d.map((t, i) => ({ name: (t.name.trim() || `Team ${i + 1}`).slice(0, 18), members: t.crew.split(/[,\n]/).map(x => x.trim()).filter(Boolean).slice(0, 12), color: i % PALETTE.length }));
  if (TOUR.s && teams.length === TOUR.s.teams.length) { TOUR.s.teams = teams; saveTour(); }
  else {
    TOUR.s = newBracket(teams); saveTour();
    if ($('#brFresh') && $('#brFresh').checked) forgetUsed();
  }
  TOUR.editing = false; TOUR.draft = null; renderBracket();
}
function renderTourBracket() {
  const s = TOUR.s, R = brRounds(s), champ = champion(s), nxt = nextMatch(s);
  const conf = TOUR.confirm;
  $('#brActions').innerHTML = conf ? `<span class="hint">${conf === 'reset' ? 'Clear every result?' : 'Delete this tournament?'}</span><button class="chip small" data-act="br-yes" style="background:var(--danger);color:#1c0a0d">${conf === 'reset' ? 'Clear results' : 'Delete'}</button><button class="chip small ghost" data-act="br-no">Keep</button>`
    : `<button class="chip ghost small" data-act="br-edit">Edit teams</button><button class="chip ghost small" data-act="br-ask" data-v="reset">Reset results</button><button class="chip ghost small" data-act="br-ask" data-v="new">New tournament</button>`;
  const slot = (i, side) => {
    const t = side ? i.b : i.a, team = t != null ? s.teams[t] : null;
    if (!team) return `<div class="br-slot empty">${i.bye ? 'Bye' : 'Winner of ' + matchName(s, i.r - 1, 2 * i.m + side)}</div>`;
    const cls = i.w == null ? '' : i.w === t ? ' win' : ' lose';
    const clickable = !i.bye && i.a != null && i.b != null;
    return `<${clickable ? 'button' : 'div'} class="br-slot${cls}" style="--c:${PALETTE[team.color % PALETTE.length]}" ${clickable ? `data-act="br-win" data-r="${i.r}" data-m="${i.m}" data-t="${t}" title="${i.w === t ? 'Undo winner' : 'Mark ' + esc(team.name) + ' as the winner'}"` : ''}>
      <span class="br-dot"></span><span class="br-name">${esc(team.name)}</span>${i.w === t && !i.bye ? '<span class="br-tick">WIN</span>' : ''}${team.members.length ? `<span class="br-crew">${teamLine(team)}</span>` : ''}
    </${clickable ? 'button' : 'div'}>`;
  };
  const card = i => `<div class="br-match${i.ready ? ' ready' : ''}${i.done ? ' done' : ''}${i.bye ? ' bye' : ''}${nxt && nxt.r === i.r && nxt.m === i.m ? ' next' : ''}">
      <div class="br-mhead"><span>${matchName(s, i.r, i.m)}</span>${i.ready ? `<button class="chip small" data-act="br-play" data-r="${i.r}" data-m="${i.m}"><svg width="12" height="12"><use href="#i-play"/></svg>Battle</button>` : i.bye ? '<span class="hint">advances</span>' : ''}</div>
      ${slot(i, 0)}${slot(i, 1)}
    </div>`;
  let cols = '';
  for (let r = 0; r < R; r++) {
    const n = s.size >> (r + 1), cells = [];
    for (let m = 0; m < n; m++) cells.push(`<div class="br-cell">${card(matchInfo(s, r, m))}</div>`);
    const body = n === 1 ? cells[0] : Array.from({ length: n / 2 }, (_, p) => `<div class="br-pair">${cells[2 * p]}${cells[2 * p + 1]}</div>`).join('');
    cols += `<div class="br-round"><h3>${roundName(s, r)}</h3><div class="br-col">${body}</div></div>`;
  }
  const ct = champ != null ? s.teams[champ] : null;
  cols += `<div class="br-round champ-col"><h3>Champion</h3><div class="br-col"><div class="br-cell"><div class="br-champ${ct ? ' won' : ''}" style="--c:${ct ? PALETTE[ct.color % PALETTE.length] : 'var(--ink-3)'}">
    <svg aria-hidden="true"><use href="#i-trophy"/></svg><span class="br-name">${ct ? esc(ct.name) : 'TBD'}</span>${ct && ct.members.length ? `<span class="br-crew">${teamLine(ct)}</span>` : ''}</div></div></div></div>`;
  const banner = ct ? `<div class="br-banner champ" style="--c:${PALETTE[ct.color % PALETTE.length]}"><span class="label">Champion</span><b>${esc(ct.name)}</b><span class="hint">${teamLine(ct)}</span></div>`
    : nxt ? `<div class="br-banner"><span class="label">Up next · ${matchName(s, nxt.r, nxt.m)}</span><b><span style="color:${PALETTE[s.teams[nxt.a].color % PALETTE.length]}">${esc(s.teams[nxt.a].name)}</span> <i>vs</i> <span style="color:${PALETTE[s.teams[nxt.b].color % PALETTE.length]}">${esc(s.teams[nxt.b].name)}</span></b><button class="go" data-act="br-play" data-r="${nxt.r}" data-m="${nxt.m}"><svg><use href="#i-play"/></svg><span>Set up this battle</span></button></div>` : '';
  $('#brBody').innerHTML = `${banner}<div class="br-scroll"><div class="br-grid" style="--cells:${s.size / 2}">${cols}</div></div>
    <p class="hint br-help">Click <b>Battle</b> to load a match onto the battle screen. When it ends you'll be asked who won, or click a team here to mark the winner (click again to undo).</p>`;
}
