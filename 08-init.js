
/* ================= events ================= */
function upd(fn, parts = 'all') {
  fn(); saveCfg();
  if (parts === 'all') renderSetup();
  else parts.forEach(p => ({ lineup: renderLineup, words: renderWords, beats: renderBeats, summary: renderSummary, order: renderOrder })[p]());
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, v = el.dataset.v, i = +el.dataset.i, id = el.dataset.id;
  switch (act) {
    case 'mode': upd(() => CFG.mode = v, ['lineup', 'summary']); break;
    case 'bars': upd(() => CFG.barsPerTurn = +v, ['lineup', 'summary']); break;
    case 'rounds': upd(() => CFG.rounds = +v, ['lineup', 'summary']); break;
    case 'change': upd(() => CFG.changeBars = +v, ['lineup', 'summary']); break;
    case 'pbars': upd(() => CFG.practiceBars = +v, ['lineup', 'summary']); break;
    case 'list': previewBlock = null; upd(() => CFG.list = v, ['words']); renderAccSums(); break;
    case 'scheme': previewBlock = null; upd(() => CFG.scheme = v, ['words']); renderAccSums(); break;
    case 'reveal': previewBlock = null; upd(() => CFG.reveal = v, ['words']); renderAccSums(); break;
    case 'shuffle': previewBlock = null; renderWords(); break;
    case 'wb-list': WB.list = v; renderWordbank(); $('#wbFams').scrollTop = 0; break;
    case 'wb-word': case 'wb-pack': {
      const field = act === 'wb-word' ? 'disabledWords' : 'disabledPacks', k = act === 'wb-word' ? el.dataset.w : el.dataset.k;
      const s = new Set(CFG[field]); s.has(k) ? s.delete(k) : s.add(k); CFG[field] = [...s];
      saveCfg(); renderWordbank(); refreshMini(); refreshMem(); break;
    }
    case 'mem-ask': memConfirm = true; refreshMem(); break;
    case 'mem-no': memConfirm = false; refreshMem(); break;
    case 'mem-yes': memConfirm = false; forgetUsed(); previewBlock = null; renderWords(); break;
    case 'wb-reset': CFG.disabledWords = []; CFG.disabledPacks = []; saveCfg(); renderWordbank(); refreshMini(); refreshMem(); break;
    case 'team-color': upd(() => { const other = CFG.teams[1 - i].color; let c = CFG.teams[i].color; do { c = (c + 1) % PALETTE.length; } while (c === other); CFG.teams[i].color = c; }, ['lineup']); break;
    case 'mc-del': upd(() => CFG.lineup.splice(i, 1), ['lineup', 'summary']); if (WB.open) renderWordbank(); break;
    case 'mc-add': {
      if (CFG.lineup.length >= 24) break;
      upd(() => CFG.lineup.push({ name: '', team: +v === 1 ? 1 : 0 }), ['lineup', 'summary']);
      const inp = $('#mc' + (CFG.lineup.length - 1)); if (inp) inp.focus();
      break;
    }
    case 'first': upd(() => CFG.firstTeam = +v === 1 ? 1 : 0, ['lineup', 'summary']); break;
    case 'pick-beat': if (CFG.beat !== id) { upd(() => CFG.beat = id, ['beats', 'summary']); const b = currentBeat(); if (b && b.kind === 'track') loadTrackBuffer(b.meta).catch(() => { }); } break;
    case 'prev-beat': togglePreview(id); break;
    case 'tune': openTuneFor(id); break;
    case 'del': LIB.confirmDel = id; renderBeats(); break;
    case 'del-no': LIB.confirmDel = null; renderBeats(); break;
    case 'del-yes': deleteBeat(id); break;
    case 'bpm-reset': { const b = currentBeat(); if (b && b.kind === 'synth') { upd(() => delete CFG.synthBpm[b.preset.id], ['beats', 'summary']); if (PREV.id === b.id) { PREV.id = null; togglePreview(b.id); } } break; }
    case 'start': startGame(); break;
    // tournament bracket
    case 'go-bracket': showBracket(); break;
    case 'br-back': hideBracket(); break;
    case 'br-edit': TOUR.editing = true; TOUR.draft = null; renderBracket(); break;
    case 'br-cancel': TOUR.editing = false; TOUR.draft = null; renderBracket(); break;
    case 'br-ask': TOUR.confirm = v; renderBracket(); break;
    case 'br-no': TOUR.confirm = null; renderBracket(); break;
    case 'br-yes': if (TOUR.confirm === 'reset') { TOUR.s = newBracket(TOUR.s.teams); saveTour(); } else { TOUR.s = null; saveTour(); TOUR.editing = true; TOUR.draft = null; } TOUR.confirm = null; renderBracket(); break;
    case 'br-win': setWinner(+el.dataset.r, +el.dataset.m, +el.dataset.t); renderBracket(); break;
    case 'br-play': loadMatch(+el.dataset.r, +el.dataset.m); break;
    case 'br-result': recordResult(+v); break;
    case 'bt-add': draftFrom().push({ name: '', crew: '' }); renderBracket(); break;
    case 'bt-del': draftFrom().splice(i, 1); renderBracket(); break;
    case 'bt-up': { const d = draftFrom(); if (i > 0) [d[i - 1], d[i]] = [d[i], d[i - 1]]; renderBracket(); break; }
    case 'bt-shuffle': TOUR.draft = shuffle(draftFrom()); renderBracket(); break;
    case 'bt-save': saveTourForm(); break;
    case 'open-acc': { const d = $('#acc-' + v); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (v === 'teams') setTimeout(() => $('#team0') && $('#team0').focus({ preventScroll: true }), 350); } break; }
    // youtube beats
    case 'yt-add': addYouTube(); break;
    case 'yt-close': closeYT(); break;
    case 'yt-half': ytSetBpm((+$('#ytBpm').value || YTT.bpm || 0) / 2); break;
    case 'yt-double': ytSetBpm((+$('#ytBpm').value || YTT.bpm || 0) * 2); break;
    case 'yt-tap': ytTap(); break;
    case 'yt-mark': ytMark(); break;
    case 'yt-nudge': ytNudge(v); break;
    case 'yt-check': ytCheck(); break;
    case 'yt-save': ytSave(); break;
    case 'open-settings': applySettingsUI(); $('#settings').hidden = false; $('#syncMs').focus(); break;
    case 'close-settings': $('#settings').hidden = true; break;
    case 'pace': SETTINGS.pace = v; saveSettings(); applySettingsUI(); renderSummary(); break;
    // tuner
    case 't-half': tSetBpm(T.bpm / 2); break;
    case 't-double': tSetBpm(T.bpm * 2); break;
    case 't-tap': {
      const now = performance.now(); if (T.taps.length && now - T.taps[T.taps.length - 1] > 2000) T.taps = [];
      T.taps.push(now); if (T.taps.length > 9) T.taps.shift();
      $('#tTap').textContent = T.taps.length < 4 ? `Tap ${'•'.repeat(T.taps.length)}` : 'Tap ✓';
      if (T.taps.length >= 4) { const d = (T.taps[T.taps.length - 1] - T.taps[0]) / (T.taps.length - 1); tSetBpm(60000 / d); }
      break;
    }
    case 't-shift': { const spb = 60 / T.bpm; tShift(v === 'b' ? spb : v === '-b' ? -spb : +v); break; }
    case 't-bar': T.rapStartBar += +v; tNormalize(); tunerChanged(); break;
    case 't-preview': T.playing ? tunerStop() : tunerPlay(); break;
    case 't-cancel': closeTuner(); break;
    case 't-local': tunerSave('local'); break;
    case 't-save': tunerSave('library'); break;
    // stage
    case 'pause': togglePause(); break;
    case 'look': lookBy(+v); break;
    case 'skip': skipTurn(); break;
    case 'end': finish('early'); break;
    case 'fullscreen': toggleFullscreen(); break;
    case 'again': startGame(); break;
    case 'exit': exitStage(); break;
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.bind === 'team') { const k = +t.dataset.i; CFG.teams[k].name = t.value; saveCfg(); const fb = $(`[data-act=first][data-v="${k}"]`); if (fb) fb.textContent = teamName(k); renderOrder(); renderHero(); renderSummary(); if (WB.open) renderWordbank(); }
  else if (t.dataset.bind === 'mc') { CFG.lineup[+t.dataset.i].name = t.value; saveCfg(); renderHero(); if (WB.open) renderWordbank(); }
  else if (t.id === 'wbSearch') { WB.q = t.value; renderWordbank(); }
  else if (t.id === 'bpmRange') { const b = currentBeat(); if (b && b.kind === 'synth') { CFG.synthBpm[b.preset.id] = +t.value; $('#bpmOut').textContent = t.value + ' BPM'; renderSummary(); } }
  else if (t.id === 'syncMs') { SETTINGS.syncMs = +t.value; $('#syncOut').textContent = t.value + ' ms'; saveSettings(); }
  else if (t.id === 'vol') { SETTINGS.volume = +t.value; if (A.master) A.master.gain.value = SETTINGS.volume; try { YTS.player && YTS.player.setVolume(Math.round(SETTINGS.volume * 100)); } catch { } saveSettings(); }
  else if (t.dataset.bind === 'bt-name') draftFrom()[+t.dataset.i].name = t.value;
  else if (t.dataset.bind === 'bt-crew') draftFrom()[+t.dataset.i].crew = t.value;
  else if (t.id === 'ytBpm') { const b = +t.value; if (b >= 40 && b <= 220) { YTT.bpm = b; ytRecheck(); } }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.bind === 'double') { previewBlock = null; upd(() => CFG.double = t.checked, ['words']); renderAccSums(); }
  else if (t.dataset.bind === 'allNames') { previewBlock = null; upd(() => CFG.allNames = t.checked, ['words']); renderAccSums(); }
  else if (t.id === 'bpmRange') { saveCfg(); renderBeats(); const b = currentBeat(); if (b && PREV.id === b.id) { PREV.id = null; togglePreview(b.id); } }
  else if (t.id === 'clickTgl') { SETTINGS.click = t.checked; saveSettings(); }
  else if (t.id === 'brFresh') TOUR.fresh = t.checked;
  else if (t.id === 'hideTgl') { SETTINGS.autohide = t.checked; saveSettings(); }
  else if (t.id === 'tBpm') tSetBpm(+t.value);
  else if (t.id === 'fileIn') { const f = t.files && t.files[0]; t.value = ''; handleFile(f); }
});
document.addEventListener('dragover', e => { const d = e.target.closest && e.target.closest('#p-beat'); if (d && !$('#setup').hidden) { e.preventDefault(); $('#drop')?.classList.add('over'); } });
document.addEventListener('dragleave', e => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('#p-beat')) $('#drop')?.classList.remove('over'); });
document.addEventListener('drop', e => {
  const d = e.target.closest && e.target.closest('#p-beat'); if (!d) return;
  e.preventDefault(); $('#drop')?.classList.remove('over');
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; handleFile(f);
});
document.addEventListener('keydown', e => {
  const stage = !$('#stage').hidden;
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.bind === 'mc' && e.target.value.trim()) { e.preventDefault(); const tm = CFG.lineup[+e.target.dataset.i].team; $(`[data-act=mc-add][data-v="${tm}"]`)?.click(); return; }
  if (e.key === 'Enter' && e.target.id === 'ytUrl') { e.preventDefault(); addYouTube(); return; }
  if (e.target.matches && e.target.matches('input[type=text],input[type=number],input[type=search],input[type=url]') && e.key !== 'Escape') return;
  if (stage) {
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if ($('#endcard').hidden) togglePause(); }
    else if (e.key === 'n' || e.key === 'N' || e.key === 'ArrowRight') { skipTurn(); }
    else if (G && G.paused && (e.key === 'ArrowUp' || e.key === 'PageUp')) { e.preventDefault(); lookBy(e.key === 'PageUp' ? 4 : 1); }
    else if (G && G.paused && (e.key === 'ArrowDown' || e.key === 'PageDown')) { e.preventDefault(); lookBy(e.key === 'PageDown' ? -4 : -1); }
    else if (G && G.paused && (e.key === 'Home' || e.key === 'End')) { e.preventDefault(); lookBy(e.key === 'Home' ? 1e6 : -1e6); }
    else if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
    else if (e.key === 'Escape') { if (!$('#endcard').hidden) exitStage(); else if (!document.fullscreenElement) finish('early'); }
    poke();
    return;
  }
  if (e.key === 'Escape' && !$('#bracket').hidden && !e.target.matches('input')) { if (TOUR.editing && TOUR.s) { TOUR.editing = false; TOUR.draft = null; renderBracket(); } else hideBracket(); return; }
  if (e.key === 'Escape') { if (YTT.open) closeYT(); else if (T.open) closeTuner(); else $('#settings').hidden = true; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('li.beat')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('toggle', e => {
  if (e.target.id === 'wordbank') { WB.open = e.target.open; if (WB.open && !WB.list) { WB.list = CFG.list; renderWordbank(); } }
  else if (e.target.classList && e.target.classList.contains('acc-item')) { const st = ls.get('bfb.acc', {}); st[e.target.dataset.acc] = e.target.open; ls.set('bfb.acc', st); }
}, true);
(() => { const st = ls.get('bfb.acc', {}); $$('.acc-item').forEach(d => { if (st[d.dataset.acc]) d.open = true; }); })();
try {
  new IntersectionObserver(([e]) => $('#startbar').classList.toggle('show', !e.isIntersecting), { threshold: 0 }).observe($('#heroGo'));
} catch { $('#startbar').classList.add('show'); }
['mousemove', 'pointerdown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { if (G) poke(); }, { passive: true }));
$('#settings').addEventListener('click', e => { if (e.target.id === 'settings') $('#settings').hidden = true; });
$('#ytSheet').addEventListener('click', e => { if (e.target.id === 'ytSheet') closeYT(); });
$('#tZoom').addEventListener('click', e => {
  if (!T.open) return;
  const r = e.currentTarget.getBoundingClientRect(); const [a, b] = zoomWindow(); const t = a + (e.clientX - r.left) / r.width * (b - a);
  const { barS, countPos } = tTiming(); const k = Math.round((t - countPos) / barS); const line = countPos + k * barS;
  tShift(t - line);
});
$('#tOver').addEventListener('click', e => {
  if (!T.open) return;
  const r = e.currentTarget.getBoundingClientRect(); const t = (e.clientX - r.left) / r.width * T.buffer.duration;
  const { barS } = tTiming(); T.rapStartBar = Math.floor((t - T.downbeat) / barS) + 1; tNormalize(); tunerChanged();
});
// paused: mouse wheel, trackpad or a drag on the board scrolls back through earlier bars
$('#stage').addEventListener('wheel', e => {
  if (!G || !G.paused || G.ended) return;
  e.preventDefault();
  const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
  G.look.acc += dy;
  while (G.look.acc <= -90) { G.look.acc += 90; lookBy(1); }
  while (G.look.acc >= 90) { G.look.acc -= 90; lookBy(-1); }
}, { passive: false });
let lookDrag = null;
$('#boardWrap').addEventListener('pointerdown', e => { if (!G || !G.paused || G.ended || !G.L) return; lookDrag = { y: e.clientY, t0: G.look.target }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { } });
$('#boardWrap').addEventListener('pointermove', e => { if (!lookDrag || !G || !G.paused) return; const d = Math.round((e.clientY - lookDrag.y) / G.L.rowH); const tg = clamp(lookDrag.t0 + d, 0, maxLook()); if (tg !== G.look.target) { G.look.target = tg; lookLabel(); } });
['pointerup', 'pointercancel'].forEach(ev => $('#boardWrap').addEventListener(ev, () => { lookDrag = null; }));
let rsz = 0;
window.addEventListener('resize', () => { cancelAnimationFrame(rsz); rsz = requestAnimationFrame(() => { if (G) layoutBoard(); if (T.open) { T.cache = null; drawTuner(); } }); });
document.addEventListener('fullscreenchange', () => setTimeout(() => G && layoutBoard(), 60));

function applySettingsUI() {
  $('#syncMs').value = SETTINGS.syncMs; $('#syncOut').textContent = SETTINGS.syncMs + ' ms';
  $('#vol').value = SETTINGS.volume; $('#clickTgl').checked = SETTINGS.click; $('#hideTgl').checked = SETTINGS.autohide;
  $$('#paceSeg .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === SETTINGS.pace)));
}
function grain() {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 140; const g = c.getContext('2d'); const im = g.createImageData(140, 140);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255 | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = Math.random() * 12 | 0; }
    g.putImageData(im, 0, 0); document.documentElement.style.setProperty('--grain', `url(${c.toDataURL()})`);
  } catch { }
}
grain();
applySettingsUI();
renderSetup();
initCaps();
