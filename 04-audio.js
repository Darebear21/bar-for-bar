
/* ================= audio engine ================= */
const A = { ctx: null };
let V = null; // current session voice routing
function softCurve(k) { const n = 1024, c = new Float32Array(n); const t = Math.tanh(k); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / t; } return c; }
function initAudio() {
  if (A.ctx) return A.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = A.ctx = new AC({ latencyHint: 'interactive' });
  A.master = ctx.createGain(); A.master.gain.value = SETTINGS.volume;
  // final safety limiter: only touches the top ~1.5 dB so loud beats never clip the speakers
  A.limit = ctx.createDynamicsCompressor(); A.limit.threshold.value = -1.5; A.limit.knee.value = 0; A.limit.ratio.value = 20; A.limit.attack.value = 0.001; A.limit.release.value = 0.08;
  A.master.connect(A.limit); A.limit.connect(ctx.destination);
  A.comp = ctx.createDynamicsCompressor();
  A.comp.threshold.value = -16; A.comp.knee.value = 12; A.comp.ratio.value = 3.2; A.comp.attack.value = 0.005; A.comp.release.value = 0.18;
  A.comp.connect(A.master);
  A.clickOut = ctx.createGain(); A.clickOut.gain.value = 0.45; A.clickOut.connect(A.master);
  // noise
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  A.noise = nb;
  // reverb impulse
  const len = Math.floor(ctx.sampleRate * 2.0); const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  A.ir = ir;
  A.curve = softCurve(1.8);
  return ctx;
}
function makeSession() {
  const ctx = A.ctx;
  const out = ctx.createGain(); out.gain.value = 1; out.connect(A.comp);
  const trackOut = ctx.createGain(); trackOut.gain.value = 1; trackOut.connect(A.master);
  const drive = ctx.createWaveShaper(); drive.curve = A.curve; drive.oversample = '2x';
  const driveIn = ctx.createGain(); driveIn.gain.value = 0.9; driveIn.connect(drive); drive.connect(out);
  const duck = ctx.createGain(); duck.connect(out);           // music bus that dips under each kick on punchy beats
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 20000; tone.Q.value = 0.9; tone.connect(duck); // swept during builds
  const clean = ctx.createGain(); clean.connect(tone);
  const rev = ctx.createConvolver(); rev.buffer = A.ir; const revIn = ctx.createGain(); const revOut = ctx.createGain(); revOut.gain.value = 0.42;
  revIn.connect(rev); rev.connect(revOut); revOut.connect(out);
  // echo bus for dub-style beats: feedback delay with a darkening filter in the loop
  const dlyIn = ctx.createGain(), dly = ctx.createDelay(2), fb = ctx.createGain(), dlp = ctx.createBiquadFilter();
  dly.delayTime.value = 0.3; fb.gain.value = 0.38; dlp.type = 'lowpass'; dlp.frequency.value = 2400;
  dlyIn.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dlp.connect(out);
  return { out, trackOut, drive: driveIn, clean, tone, duck, hats: out, revIn, dlyIn, dly, dlyAmt: 0, last808: null, riser: null };
}
function killSession(s, fade = 0.12) {
  if (!s || !A.ctx) return;
  const now = A.ctx.currentTime;
  for (const g of [s.out.gain, s.trackOut.gain]) { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + fade); }
  setTimeout(() => { try { s.out.disconnect(); s.trackOut.disconnect(); } catch { } }, (fade + 0.4) * 1000);
}
const nodes = {
  osc(type, f) { const o = A.ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; },
  filt(type, f, q = 0.7) { const b = A.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; },
  gain(v = 1) { const g = A.ctx.createGain(); g.gain.value = v; return g; },
  loopNoise(t, dur) { const s = A.ctx.createBufferSource(); s.buffer = A.noise; s.loop = true; s.start(t, Math.random() * 1.5); s.stop(t + dur); return s; },
  noise(t, dur) { const s = A.ctx.createBufferSource(); s.buffer = A.noise; s.start(t, Math.random() * 1.4); s.stop(t + dur); return s; },
  env(t, peak, a, d, dest) { const g = A.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(dest); return g; },
  send(src, amt) { if (!amt) return; const s = A.ctx.createGain(); s.gain.value = amt; src.connect(s); s.connect(V.revIn); }
};

const voice = {
  kick(t, v, soft, punch) {
    if (punch) {
      // body: fast pitch drop, long sub tail; knock: short mid thump; click: beater transient
      const o = nodes.osc('sine', 200); o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.045);
      const g = A.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.0 * v, t + 0.002);
      g.gain.setTargetAtTime(0.42 * v, t + 0.018, 0.045); g.gain.setTargetAtTime(0.0001, t + 0.1, 0.11);
      o.connect(g); g.connect(V.drive); o.start(t); o.stop(t + 0.8);
      const k = nodes.osc('triangle', 130); k.frequency.setValueAtTime(140, t); k.frequency.exponentialRampToValueAtTime(70, t + 0.03);
      const kg = nodes.env(t, 0.5 * v, 0.001, 0.07, V.drive); k.connect(kg); k.start(t); k.stop(t + 0.12);
      const n = nodes.noise(t, 0.03); const hp = nodes.filt('highpass', 3200); const ng = nodes.env(t, 0.38 * v, 0.0008, 0.012, V.drive); n.connect(hp); hp.connect(ng);
      return;
    }
    const dec = soft ? 0.32 : 0.45;
    const o = nodes.osc('sine', 150);
    o.frequency.setValueAtTime(soft ? 120 : 160, t); o.frequency.exponentialRampToValueAtTime(soft ? 48 : 45, t + (soft ? 0.09 : 0.075));
    const g = nodes.env(t, 0.95 * v, 0.003, dec, V.drive); o.connect(g); o.start(t); o.stop(t + dec + 0.05);
    if (!soft) { const n = nodes.noise(t, 0.03); const hp = nodes.filt('highpass', 2600); const ng = nodes.env(t, 0.22 * v, 0.001, 0.016, V.drive); n.connect(hp); hp.connect(ng); }
  },
  snare(t, v, o = {}) {
    const dec = o.dec || 0.19;
    const n = nodes.noise(t, dec + 0.05); const hp = nodes.filt('highpass', o.hp || 900); const bp = nodes.filt('bandpass', o.bp || 2300, 0.55);
    const g = nodes.env(t, 0.5 * v, 0.002, dec, V.drive); n.connect(hp); hp.connect(bp); bp.connect(g); nodes.send(g, o.rev ?? 0.22);
    const f = o.tone || 190; const b = nodes.osc('triangle', f); b.frequency.setValueAtTime(f * 1.45, t); b.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    const bg = nodes.env(t, 0.42 * v, 0.002, 0.085, V.drive); b.connect(bg); b.start(t); b.stop(t + 0.14);
  },
  clap(t, v) {
    const n = nodes.noise(t, 0.4); const hp = nodes.filt('highpass', 700); const bp = nodes.filt('bandpass', 1250, 1.0);
    const g = A.ctx.createGain(); const p = 0.55 * v;
    g.gain.setValueAtTime(0.0001, t);
    for (const d of [0, 0.011, 0.022]) { g.gain.setValueAtTime(p, t + d); g.gain.exponentialRampToValueAtTime(p * 0.15, t + d + 0.0095); }
    g.gain.setValueAtTime(p, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.033 + 0.21);
    n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(V.drive); nodes.send(g, 0.3);
  },
  hat(t, v, open, metal) {
    const dec = open ? 0.26 : 0.042;
    if (metal) {
      const sum = nodes.gain(0.16); const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
      for (const r of ratios) { const o = nodes.osc('square', 40 * r); o.connect(sum); o.start(t); o.stop(t + dec + 0.05); }
      const bp = nodes.filt('bandpass', 10000, 0.9); const hp = nodes.filt('highpass', 7200); const g = nodes.env(t, 0.32 * v, 0.001, dec, V.hats);
      sum.connect(bp); bp.connect(hp); hp.connect(g);
    } else {
      const n = nodes.noise(t, dec + 0.05); const hp = nodes.filt('highpass', 7000); const bp = nodes.filt('bandpass', 10500, 0.7);
      const g = nodes.env(t, 0.3 * v, 0.001, dec, V.hats); n.connect(hp); hp.connect(bp); bp.connect(g);
    }
  },
  duck(t, depth = 0.4) { const g = V.duck.gain; g.setTargetAtTime(depth, t, 0.003); g.setTargetAtTime(1, t + 0.035, 0.09); },
  piano(t, midi, dur, v) {
    const f = mtof(midi);
    const a = nodes.osc('triangle', f), b = nodes.osc('sine', f * 2), c = nodes.osc('sine', f * 3.01);
    const bg = nodes.gain(0.35), cg = nodes.gain(0.1);
    const lp = nodes.filt('lowpass', 3200, 0.6); lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(1300, t + 0.6);
    const g = A.ctx.createGain(); const peak = 0.13 * v;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.setTargetAtTime(peak * 0.25, t + 0.01, 0.35); g.gain.setTargetAtTime(0.0001, t + Math.max(0.2, dur), 0.15);
    a.connect(lp); b.connect(bg); bg.connect(lp); c.connect(cg); cg.connect(lp); lp.connect(g); g.connect(V.clean); nodes.send(g, 0.3);
    const end = t + dur + 1.0; for (const o of [a, b, c]) { o.start(t); o.stop(end); }
  },
  rim(t, v) {
    const a = nodes.osc('triangle', 1750), b = nodes.osc('square', 520); const bg = nodes.gain(0.25); const bp = nodes.filt('bandpass', 1650, 2.5);
    const g = nodes.env(t, 0.32 * v, 0.001, 0.035, V.clean); a.connect(bp); b.connect(bg); bg.connect(bp); bp.connect(g); nodes.send(g, .15);
    if (V.dlyAmt) { const s = nodes.gain(V.dlyAmt); g.connect(s); s.connect(V.dlyIn); }
    a.start(t); b.start(t); a.stop(t + 0.08); b.stop(t + 0.08);
  },
  sub(t, midi, dur, v, glideFrom) {
    const f = mtof(midi);
    const prev = V.last808;
    if (prev) { try { const g = prev.g.gain; if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else g.cancelScheduledValues(t); g.setTargetAtTime(0.0001, t, 0.01); prev.o.stop(t + 0.08); } catch { } }
    const o = nodes.osc('sine', f);
    if (glideFrom) { o.frequency.setValueAtTime(mtof(glideFrom), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.1); }
    else { o.frequency.setValueAtTime(f * 2.3, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.035); }
    const len = Math.max(0.15, dur); const peak = 0.9 * v; const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.setTargetAtTime(peak * 0.55, t + 0.06, len * 0.5); g.gain.setTargetAtTime(0.0001, t + len, 0.05);
    o.connect(g); g.connect(V.drive); o.start(t); o.stop(t + len + 0.4);
    V.last808 = { o, g };
  },
  bass(t, midi, dur, v) {
    const f = mtof(midi); const a = nodes.osc('sine', f), b = nodes.osc('triangle', f * 2); const bg = nodes.gain(0.18); const lp = nodes.filt('lowpass', 520);
    const g = A.ctx.createGain(); const peak = 0.62 * v; const len = Math.max(0.1, dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.008); g.gain.setTargetAtTime(peak * 0.5, t + 0.02, len * 0.6); g.gain.setTargetAtTime(0.0001, t + len, 0.03);
    a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(g); g.connect(V.drive);
    a.start(t); b.start(t); a.stop(t + len + 0.25); b.stop(t + len + 0.25);
  },
  fbass(t, midi, dur, v) {
    const f = mtof(midi); const a = nodes.osc('sawtooth', f), s = nodes.osc('sine', f); const lp = nodes.filt('lowpass', 1500, 7);
    lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.16);
    const g = A.ctx.createGain(); const peak = 0.3 * v; const len = Math.max(0.08, dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.006); g.gain.setTargetAtTime(peak * 0.6, t + 0.02, 0.2); g.gain.setTargetAtTime(0.0001, t + len, 0.025);
    const sg = nodes.gain(0.9); a.connect(lp); lp.connect(g); s.connect(sg); sg.connect(g); g.connect(V.drive);
    a.start(t); s.start(t); a.stop(t + len + 0.2); s.stop(t + len + 0.2);
  },
  keys(t, notes, dur, v, cut, rev = 0.2) {
    const lp = nodes.filt('lowpass', cut || 2600, 0.5); lp.connect(V.clean); nodes.send(lp, rev);
    const per = 0.12 * v / Math.sqrt(notes.length / 3);
    for (const m of notes) {
      const f = mtof(m);
      const car = nodes.osc('sine', f), mod = nodes.osc('sine', f);
      const mg = A.ctx.createGain(); mg.gain.setValueAtTime(f * 1.5 * v, t); mg.gain.setTargetAtTime(f * 0.08, t, 0.25);
      mod.connect(mg); mg.connect(car.frequency);
      const tine = nodes.osc('sine', f * 4.02); const tg = nodes.env(t, per * 0.35, 0.002, 0.12, lp); tine.connect(tg);
      const g = A.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(per, t + 0.006);
      g.gain.setTargetAtTime(per * 0.32, t + 0.01, 0.6); g.gain.setTargetAtTime(0.0001, t + dur, 0.12);
      car.connect(g); g.connect(lp);
      const end = t + dur + 0.7;
      car.start(t); mod.start(t); tine.start(t); car.stop(end); mod.stop(end); tine.stop(t + 0.2);
    }
  },
  bell(t, midi, dur, v) {
    const f = mtof(midi); const car = nodes.osc('sine', f), mod = nodes.osc('sine', f * 3.5);
    const mg = A.ctx.createGain(); mg.gain.setValueAtTime(f * 2.2 * v, t); mg.gain.setTargetAtTime(0, t, 0.08); mod.connect(mg); mg.connect(car.frequency);
    const g = A.ctx.createGain(); const peak = 0.11 * v; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.004, 0.32);
    const lp = nodes.filt('lowpass', 5200); car.connect(g); g.connect(lp); lp.connect(V.clean); nodes.send(lp, 0.4);
    car.start(t); mod.start(t); car.stop(t + 1.8); mod.stop(t + 1.8);
  },
  pad(t, notes, dur, v) {
    const lp = nodes.filt('lowpass', 820, 0.4); const g = A.ctx.createGain(); const peak = 0.045 * v;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(0.7, dur * 0.4)); g.gain.setTargetAtTime(0, t + dur - 0.1, 0.25);
    lp.connect(g); g.connect(V.clean); nodes.send(g, 0.5);
    for (const m of notes) for (const d of [-7, 7]) { const o = nodes.osc('sawtooth', mtof(m)); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 1.2); }
  },
  lead(t, midi, dur, v, prev) {
    const f = mtof(midi); const o = nodes.osc('sine', f);
    if (prev) { o.frequency.setValueAtTime(mtof(prev), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07); }
    const lfo = nodes.osc('sine', 5.6); const lg = A.ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.009, t + 0.4);
    lfo.connect(lg); lg.connect(o.frequency);
    const g = A.ctx.createGain(); const peak = 0.085 * v; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.035); g.gain.setTargetAtTime(0, t + dur - 0.02, 0.05);
    o.connect(g); g.connect(V.clean); nodes.send(g, 0.38);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.4); lfo.stop(t + dur + 0.4);
  },
  stab(t, notes, dur, v, cut) {
    const lp = nodes.filt('lowpass', 3200, 2.2); lp.frequency.setValueAtTime(cut || 3400, t); lp.frequency.exponentialRampToValueAtTime(650, t + 0.2);
    const g = A.ctx.createGain(); const peak = 0.07 * v; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.005); g.gain.setTargetAtTime(0.0001, t + 0.01, Math.max(0.06, dur * 0.45));
    lp.connect(g); g.connect(V.clean); nodes.send(g, 0.32);
    for (const m of notes) for (const d of [-9, 9]) { const o = nodes.osc('sawtooth', mtof(m)); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.8); }
  },
  // build-up: noise sweep + rising detuned saws; returns a handle so a drop that lands early can cut it
  riser(t, dur, v) {
    const ctx = A.ctx, end = t + dur, out = nodes.gain(1); out.connect(V.out); nodes.send(out, 0.35);
    const n = nodes.loopNoise(t, dur + 0.05); const bp = nodes.filt('bandpass', 400, 1.1);
    bp.frequency.setValueAtTime(320, t); bp.frequency.exponentialRampToValueAtTime(9500, end);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.45 * v, end); ng.gain.linearRampToValueAtTime(0, end + 0.02);
    n.connect(bp); bp.connect(ng); ng.connect(out);
    const lp = nodes.filt('lowpass', 900, 1.5); lp.frequency.setValueAtTime(700, t); lp.frequency.exponentialRampToValueAtTime(7000, end);
    const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.11 * v, end); sg.gain.linearRampToValueAtTime(0, end + 0.02);
    lp.connect(sg); sg.connect(out);
    const oscs = [-12, 12].map(d => { const o = nodes.osc('sawtooth', mtof(48)); o.detune.value = d; o.frequency.setValueAtTime(mtof(48), t); o.frequency.exponentialRampToValueAtTime(mtof(84), end); o.connect(lp); o.start(t); o.stop(end + 0.05); return o; });
    return { end, stop(at) { if (at >= end) return; out.gain.cancelScheduledValues(at); out.gain.setValueAtTime(out.gain.value, at); out.gain.linearRampToValueAtTime(0, at + 0.015); try { n.stop(at + 0.02); oscs.forEach(o => o.stop(at + 0.02)); } catch { } } };
  },
  // the drop: deep falling boom + a burst of dark noise
  impact(t, v) {
    const ctx = A.ctx;
    const o = nodes.osc('sine', 90); o.frequency.setValueAtTime(96, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.85 * v, t + 0.006); g.gain.setTargetAtTime(0.0001, t + 0.08, 0.42);
    o.connect(g); g.connect(V.out); o.start(t); o.stop(t + 2.6);
    const n = nodes.loopNoise(t, 1.6); const lp = nodes.filt('lowpass', 2600, 0.8); lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(160, t + 1.0);
    const ng = nodes.env(t, 0.42 * v, 0.003, 1.1, V.out); n.connect(lp); lp.connect(ng); nodes.send(ng, 0.6);
  },
  crash(t, v) {
    const n = nodes.loopNoise(t, 2.4); const hp = nodes.filt('highpass', 5200); const g = nodes.env(t, 0.24 * v, 0.002, 1.7, V.out);
    n.connect(hp); hp.connect(g); nodes.send(g, 0.3);
    const sum = nodes.gain(0.1); for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) { const o = nodes.osc('square', 63 * r); o.connect(sum); o.start(t); o.stop(t + 1.8); }
    const bp = nodes.filt('bandpass', 8200, 0.8); const mg = nodes.env(t, 0.16 * v, 0.002, 1.3, V.out); sum.connect(bp); bp.connect(mg);
  },
  /* ---- genre instruments ---- */
  // drawbar organ: stacked sine partials, a little vibrato and a key click
  organ(t, notes, dur, v) {
    const out = nodes.gain(1), lp = nodes.filt('lowpass', 5200, 0.5); out.connect(lp); lp.connect(V.clean); nodes.send(lp, 0.25);
    const end = t + dur + 0.12;
    const vib = nodes.osc('sine', 6.1), vg = nodes.gain(7); vib.connect(vg); vib.start(t); vib.stop(end);
    const per = 0.05 * v / Math.sqrt(notes.length), g = A.ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(per, t + 0.008); g.gain.setValueAtTime(per, t + Math.max(0.02, dur)); g.gain.linearRampToValueAtTime(0, t + dur + 0.07); g.connect(out);
    for (const m of notes) for (const [h, a] of [[1, 1], [2, 0.55], [3, 0.32], [4, 0.2], [6, 0.08]]) { const o = nodes.osc('sine', mtof(m) * h); vg.connect(o.detune); const og = nodes.gain(a); o.connect(og); og.connect(g); o.start(t); o.stop(end); }
    const n = nodes.noise(t, 0.012), hp = nodes.filt('highpass', 2500), cg = nodes.env(t, 0.025 * v, 0.0005, 0.006, out); n.connect(hp); hp.connect(cg);
  },
  // plucked strings (Karplus-Strong): guitar, muted guitar, banjo, sitar, pizzicato; chords strum
  pluck(t, notes, dur, v, kind = 'guitar') {
    const arr = Array.isArray(notes) ? notes : [notes];
    const tone = { mute: 2000, guitar: 3600, banjo: 6500, sitar: 5200, pizz: 2600 }[kind] || 3600;
    const out = nodes.gain(1), lp = nodes.filt('lowpass', tone, 0.6); out.connect(lp); lp.connect(V.clean);
    nodes.send(lp, { sitar: 0.35, pizz: 0.45, banjo: 0.18 }[kind] ?? 0.2);
    if (V.dlyAmt) { const s = nodes.gain(V.dlyAmt); lp.connect(s); s.connect(V.dlyIn); }
    const per = ({ mute: 0.42, banjo: 0.3, sitar: 0.34, pizz: 0.36 }[kind] || 0.32) * v / Math.sqrt(arr.length);
    arr.forEach((m, i) => {
      const st = t + i * (kind === 'mute' ? 0.005 : 0.011);
      const s = A.ctx.createBufferSource(); s.buffer = ksBuf(m, kind);
      const hold = kind === 'mute' ? Math.min(dur, 0.09) : Math.max(0.08, dur);
      const g = A.ctx.createGain(); g.gain.setValueAtTime(per, st); g.gain.setTargetAtTime(0, st + hold, kind === 'mute' ? 0.012 : 0.09);
      if (kind === 'sitar') { s.playbackRate.setValueAtTime(0.982, st); s.playbackRate.exponentialRampToValueAtTime(1, st + 0.1); }
      s.connect(g); g.connect(out); s.start(st); s.stop(Math.min(st + s.buffer.duration, st + hold + 0.8));
    });
  },
  // string section: three detuned saws per note, slow bow, delayed vibrato
  strings(t, notes, dur, v) {
    const lp = nodes.filt('lowpass', 2700, 0.6), g = A.ctx.createGain(), per = 0.03 * v / Math.sqrt(notes.length / 3), hold = Math.max(0.25, dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(per, t + 0.22); g.gain.setValueAtTime(per, t + hold); g.gain.setTargetAtTime(0, t + hold, 0.25);
    lp.connect(g); g.connect(V.clean); nodes.send(g, 0.55);
    const end = t + hold + 1.3;
    const vib = nodes.osc('sine', 5.2), vg = A.ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(7, t + 0.6); vib.connect(vg); vib.start(t); vib.stop(end);
    for (const m of notes) for (const d of [-11, 0, 11]) { const o = nodes.osc('sawtooth', mtof(m)); o.detune.value = d; vg.connect(o.detune); o.connect(lp); o.start(t); o.stop(end); }
  },
  // distorted power chords
  power(t, notes, dur, v) {
    const pre = nodes.gain(1.3), sh = A.ctx.createWaveShaper(); sh.curve = A.hardCurve || (A.hardCurve = softCurve(6)); sh.oversample = '2x';
    const hp = nodes.filt('highpass', 85), lp = nodes.filt('lowpass', 3100, 0.8), g = A.ctx.createGain(), pk = 0.09 * v, hold = Math.max(0.05, dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + 0.004); g.gain.setTargetAtTime(pk * 0.7, t + 0.02, 0.2); g.gain.setTargetAtTime(0.0001, t + hold, 0.035);
    pre.connect(sh); sh.connect(hp); hp.connect(lp); lp.connect(g); g.connect(V.clean); nodes.send(g, 0.16);
    for (const m of notes) for (const d of [-7, 7]) { const o = nodes.osc('sawtooth', mtof(m)); o.detune.value = d; const og = nodes.gain(0.32); o.connect(og); og.connect(pre); o.start(t); o.stop(t + hold + 0.3); }
  },
  // 8-bit pulse and triangle waves
  chip(t, midi, dur, v, wave = 'p25') {
    const o = A.ctx.createOscillator(); o.frequency.value = mtof(midi);
    if (wave === 'tri') o.type = 'triangle'; else o.setPeriodicWave(pulseWave(wave === 'p12' ? 0.125 : wave === 'p50' ? 0.5 : 0.25));
    const g = A.ctx.createGain(), pk = (wave === 'tri' ? 0.3 : 0.07) * v, hold = Math.max(0.03, dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + 0.003); g.gain.setTargetAtTime(pk * 0.65, t + 0.01, 0.08); g.gain.setTargetAtTime(0.0001, t + hold, 0.012);
    o.connect(g); g.connect(wave === 'tri' ? V.drive : V.clean); if (wave !== 'tri') nodes.send(g, 0.12); o.start(t); o.stop(t + hold + 0.2);
  },
  // wooden mallet (marimba / kalimba / vibes)
  mallet(t, midi, dur, v) {
    const f = mtof(midi), a = nodes.osc('sine', f), b = nodes.osc('sine', f * 3.93), pk = 0.16 * v;
    const g = A.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + 0.002); g.gain.setTargetAtTime(0.0001, t + 0.004, Math.min(0.32, 0.12 + dur * 0.3));
    const bg = A.ctx.createGain(); bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(pk * 0.3, t + 0.001); bg.gain.setTargetAtTime(0.0001, t + 0.002, 0.025);
    a.connect(g); b.connect(bg); g.connect(V.clean); bg.connect(V.clean); nodes.send(g, 0.3);
    a.start(t); b.start(t); a.stop(t + 1.4); b.stop(t + 0.3);
  },
  // afro log drum: pitched, woody, short glide
  log(t, midi, dur, v) {
    const f = mtof(midi), o = nodes.osc('sine', f), o2 = nodes.osc('triangle', f * 2);
    o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    const g = A.ctx.createGain(), pk = 0.6 * v; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.01, Math.min(0.22, 0.06 + dur * 0.4));
    const g2 = nodes.env(t, 0.12 * v, 0.002, 0.08, V.drive);
    o.connect(g); g.connect(V.drive); o2.connect(g2); o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 0.2);
  },
  // hand percussion
  perc(t, v, kind) {
    const H = V.hats;
    if (kind === 'congaHi' || kind === 'congaLo') {
      const f = kind === 'congaHi' ? 345 : 228, o = nodes.osc('sine', f * 1.15); o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
      const g = nodes.env(t, 0.4 * v, 0.002, 0.16, H); o.connect(g); o.start(t); o.stop(t + 0.3);
      const n = nodes.noise(t, 0.02), bp = nodes.filt('bandpass', 2400, 1.2), ng = nodes.env(t, 0.1 * v, 0.001, 0.014, H); n.connect(bp); bp.connect(ng);
    } else if (kind === 'shaker' || kind === 'tamb') {
      const n = nodes.noise(t, 0.16), hp = nodes.filt('highpass', kind === 'tamb' ? 5200 : 4200), bp = nodes.filt('bandpass', kind === 'tamb' ? 9000 : 7000, 0.9);
      const g = A.ctx.createGain(), pk = (kind === 'tamb' ? 0.2 : 0.15) * v; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + (kind === 'tamb' ? 0.003 : 0.016)); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'tamb' ? 0.13 : 0.075));
      n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(H);
    } else if (kind === 'cowbell') {
      const s = nodes.gain(0.5); for (const f of [562, 845]) { const o = nodes.osc('square', f); o.connect(s); o.start(t); o.stop(t + 0.35); }
      const bp = nodes.filt('bandpass', 1500, 1.4), g = nodes.env(t, 0.16 * v, 0.001, 0.26, H); s.connect(bp); bp.connect(g);
    } else if (kind === 'tablaNa') {
      const o = nodes.osc('sine', 523), o2 = nodes.osc('sine', 523 * 2.02), g = nodes.env(t, 0.26 * v, 0.001, 0.22, H), g2 = nodes.env(t, 0.1 * v, 0.001, 0.07, H);
      o.connect(g); o2.connect(g2); o.start(t); o2.start(t); o.stop(t + 0.4); o2.stop(t + 0.2);
    } else if (kind === 'tablaGe') {
      const o = nodes.osc('sine', 88); o.frequency.setValueAtTime(82, t); o.frequency.exponentialRampToValueAtTime(128, t + 0.2);
      const g = nodes.env(t, 0.42 * v, 0.003, 0.34, V.drive); o.connect(g); o.start(t); o.stop(t + 0.55);
    }
  },
  // phonk cowbell: a pitched 808-style cowbell (two detuned squares), band-passed and driven into distortion
  cowmel(t, midi, dur, v) {
    const f = mtof(midi), s = nodes.gain(0.5), hold = Math.max(0.05, dur);
    for (const r of [1, 1.4836]) { const o = nodes.osc('square', f * r); o.connect(s); o.start(t); o.stop(t + hold + 0.4); }
    const hp = nodes.filt('highpass', f * 0.9), bp = nodes.filt('bandpass', f * 2.1, 1.1);
    const env = A.ctx.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(1, t + 0.002); env.gain.setTargetAtTime(0.4, t + 0.01, 0.07); env.gain.setTargetAtTime(0.0001, t + hold, 0.05);
    const pre = nodes.gain(2.2), sh = A.ctx.createWaveShaper(); sh.curve = A.hardCurve || (A.hardCurve = softCurve(6)); sh.oversample = '2x';
    const out = nodes.gain(0.085 * v), lp = nodes.filt('lowpass', 7000, 0.7);
    s.connect(hp); hp.connect(bp); bp.connect(env); env.connect(pre); pre.connect(sh); sh.connect(lp); lp.connect(out); out.connect(V.clean); nodes.send(out, 0.3);
  },
  click(t, accent) {
    const o = nodes.osc('square', accent ? 2000 : 1400); const g = nodes.env(t, accent ? 0.5 : 0.32, 0.001, 0.03, A.clickOut); o.connect(g); o.start(t); o.stop(t + 0.06);
  },
};

/* Karplus-Strong: a burst of filtered noise circulating in a short delay line becomes a plucked string */
const KS = new Map();
function ksBuf(midi, kind) {
  const key = kind + ':' + midi; if (KS.has(key)) return KS.get(key);
  const ctx = A.ctx, sr = ctx.sampleRate, f = mtof(midi);
  const [secs, rho, bright] = { guitar: [1.8, 0.996, 0.5], mute: [0.3, 0.98, 0.32], banjo: [1.2, 0.992, 0.92], sitar: [2.4, 0.998, 0.75], pizz: [0.7, 0.99, 0.42] }[kind] || [1.6, 0.995, 0.5];
  const len = Math.floor(sr * secs), N = Math.max(2, Math.round(sr / f - 0.5));
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), ring = new Float32Array(N);
  let lp = 0; for (let i = 0; i < N; i++) { lp += bright * ((Math.random() * 2 - 1) - lp); ring[i] = lp; }
  for (let i = 0, j = 0; i < len; i++) { const cur = ring[j], nx = ring[(j + 1) % N]; d[i] = cur; ring[j] = rho * 0.5 * (cur + nx); j = (j + 1) % N; }
  if (kind === 'sitar') for (let i = 0; i < len; i++) d[i] += 0.6 * d[i] * Math.abs(d[i]);   // buzzy bridge
  let pk = 0; for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(d[i]));
  if (pk > 0) for (let i = 0; i < len; i++) d[i] *= 0.9 / pk;
  KS.set(key, buf); return buf;
}
const PULSE = new Map();
function pulseWave(duty) {
  if (PULSE.has(duty)) return PULSE.get(duty);
  const n = 64, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) { re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI); im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI); }
  const w = A.ctx.createPeriodicWave(re, im); PULSE.set(duty, w); return w;
}
/* ---- scheduler: one clock for synth beats, uploaded tracks, and the click ---- */
const S = { running: false, timer: 0 };
// timeOf(k): optional context time for step k (NaN skips it), for online battles that move the beat at changeovers.
// startStep: first step to schedule, so joining an online battle midway doesn't walk through every step already gone
function startPlayback({ preset, bpm, track, T0, songPos0 = 0, loop = true, click = false, phrase = null, timeOf = null, startStep = 0 }) {
  const ctx = initAudio();
  stopPlayback(0.06);
  V = makeSession();
  if (preset && preset.drive) V.drive.gain.value = 0.9 * preset.drive;
  if (preset && preset.echo) { V.dly.delayTime.value = preset.echo.steps * (60 / bpm) / (preset.steps / 4); V.dlyAmt = preset.echo.send; }
  // punchy beats: slower compressor attack lets each kick transient through before the glue clamps down
  const pc = !!(preset && preset.punch);
  V.out.gain.value = preset && preset.outGain ? preset.outGain : pc ? 0.82 : 1;
  A.comp.attack.value = pc ? 0.024 : 0.005; A.comp.threshold.value = pc ? -13 : -16; A.comp.ratio.value = pc ? 4 : 3.2; A.comp.release.value = pc ? 0.12 : 0.18;
  const spb = 60 / bpm;
  S.running = true; S.T0 = T0; S.spb = spb; S.click = click; S.preset = preset || null; S.session = V;
  S.steps = preset ? preset.steps : 16; S.spbeat = S.steps / 4; S.stepDur = spb / S.spbeat; S.swing = preset ? preset.swing : 0.5;
  S.next = startStep; S.timeOf = timeOf; S.lead = null; S.src = null; S.trackEnd = Infinity; S.phrase = phrase;
  if (track) {
    const src = ctx.createBufferSource(); src.buffer = track.buffer;
    const bar = 4 * spb;
    const loopStart = track.loopStart;
    const bars = Math.floor((track.buffer.duration - loopStart) / bar);
    if (loop && bars >= 4) { src.loop = true; src.loopStart = loopStart; src.loopEnd = loopStart + bars * bar; }
    src.connect(V.trackOut);
    let when = T0, off = songPos0;
    if (off < 0) { when = T0 - off; off = 0; }
    src.start(Math.max(when, ctx.currentTime), off);
    S.src = src;
    if (!src.loop) S.trackEnd = T0 + (track.buffer.duration - songPos0);
  }
  S.timer = setInterval(schedTick, 25);
  schedTick();
}
function stopPlayback(fade = 0.15) {
  S.running = false; clearInterval(S.timer);
  if (!A.ctx) return;
  const now = A.ctx.currentTime;
  try { S.src && S.src.stop(now + fade + 0.02); } catch { }
  killSession(S.session, fade);
  S.src = S.session = null;
}
function schedTick() {
  if (!S.running || !A.ctx) return;
  const ctx = A.ctx; const horizon = ctx.currentTime + 0.16;
  for (let guard = 0; guard < 2048; guard++) {
    const k = S.next; const t0 = S.timeOf ? S.timeOf(k) : S.T0 + k * S.stepDur;
    if (t0 > horizon) break;
    if (t0 !== t0) { S.next++; continue; }   // NaN: a re-anchor skipped this step
    let t = t0;
    if (S.swing > 0.5 && S.spbeat === 4 && (k & 1)) t += (S.swing - 0.5) * 2 * S.stepDur;
    if (t >= ctx.currentTime - 0.005) { try { playStep(k, t); } catch (e) { console.warn(e); } }
    S.next++;
  }
}
function patVel(pat, bar, st) { if (!pat) return 0; const s = pat[bar % pat.length]; return VEL[s[st]] || 0; }
function playStep(k, t) {
  const P = S.preset; const spbar = S.steps; const bar = Math.floor(k / spbar); const st = k % spbar;
  if (S.click && st % S.spbeat === 0) voice.click(t, st === 0);
  if (!P) return;
  const m = P.mix; const sd = S.stepDur;
  // beats with drops: pattern bars count from the last drop so every drop lands on the first chord
  let pb = bar, on = () => true;
  if (P.drops) {
    const sec = sectionOf(bar);
    if (sec.kind === 'build') { dropBuild(P, sec, bar, st, t); return; }
    if (sec.since === 0 && st === 0) dropHit(P, t);
    if (sec.kind === 'intro' && st === 0) setTone(t, 900);
    if (sec.since !== Infinity) pb = sec.since;
    on = part => sec.kind === 'drop' || (sec.kind === 'ride' ? !P.dropOnly.includes(part) : P.introParts.includes(part));
  }
  let v;
  if (on('kick') && (v = patVel(P.kick, pb, st))) { voice.kick(t, v * m.kick, P.kickSoft, P.punch); if (P.duck) voice.duck(t); }
  if (on('snare') && (v = patVel(P.snare, pb, st))) voice.snare(t, v * m.snare, P.snareOpts ? P.snareOpts : P.id === 'lofi' ? { tone: 220, dec: 0.12, bp: 3000, rev: .3 } : P.id === 'rooftop' ? { rev: .34, dec: .22 } : {});
  if (on('clap') && (v = patVel(P.clap, pb, st))) voice.clap(t, v * (m.clap || m.snare));
  if ((v = patVel(P.rim, pb, st))) voice.rim(t, v * m.rim);
  if (on('hat') && (v = patVel(P.ohat, pb, st))) voice.hat(t, v * m.hat, true, P.hatMetal);
  else if (on('hat') && (v = patVel(P.hat, pb, st))) voice.hat(t, v * m.hat, false, P.hatMetal);
  const each = (arr, fn, part) => { if (!arr || (part && !on(part))) return; const list = arr[pb % arr.length]; for (const n of list) if (n[0] === st) fn(n); };
  each(P.bass, n => voice.bass(t, n[1], n[2] * sd, (n[3] || 1) * m.bass));
  each(P.sub, n => voice.sub(t, n[1], n[2] * sd, (n[3] || 1) * m.sub, n[4]), 'sub');
  each(P.fbass, n => voice.fbass(t, n[1], n[2] * sd, (n[3] || 1) * m.fbass));
  each(P.keys, n => voice.keys(t, n[1], n[2] * sd, (n[3] || 1) * m.keys, P.keysCut));
  each(P.bell, n => voice.bell(t, n[1], n[2] * sd, (n[3] || 1) * m.bell), 'bell');
  each(P.pad, n => voice.pad(t, n[1], n[2] * sd, (n[3] || 1) * m.pad), 'pad');
  each(P.stab, n => voice.stab(t, n[1], n[2] * sd, (n[3] || 1) * m.stab, P.stabCut), 'stab');
  each(P.piano, n => voice.piano(t, n[1], n[2] * sd, (n[3] || 1) * m.piano));
  each(P.lead, n => { voice.lead(t, n[1], n[2] * sd, (n[3] || 1) * m.lead, S.lead); S.lead = n[1]; });
  const arr = x => Array.isArray(x) ? x : [x];
  each(P.organ, n => voice.organ(t, arr(n[1]), n[2] * sd, (n[3] || 1) * m.organ));
  each(P.pluck, n => voice.pluck(t, n[1], n[2] * sd, (n[3] || 1) * m.pluck, P.pluckKind));
  each(P.strings, n => voice.strings(t, arr(n[1]), n[2] * sd, (n[3] || 1) * m.strings));
  each(P.power, n => voice.power(t, arr(n[1]), n[2] * sd, (n[3] || 1) * m.power));
  each(P.chip, n => voice.chip(t, n[1], n[2] * sd, (n[3] || 1) * m.chip, P.chipWave || 'p25'));
  each(P.chipLead, n => voice.chip(t, n[1], n[2] * sd, (n[3] || 1) * m.chipLead, 'p50'));
  each(P.chipBass, n => voice.chip(t, n[1], n[2] * sd, (n[3] || 1) * m.chipBass, 'tri'));
  each(P.mallet, n => voice.mallet(t, n[1], n[2] * sd, (n[3] || 1) * m.mallet));
  each(P.log, n => voice.log(t, n[1], n[2] * sd, (n[3] || 1) * m.log));
  each(P.cowbell, n => voice.cowmel(t, n[1], n[2] * sd, (n[3] || 1) * m.cowbell));
  if (P.perc) for (const k in P.perc) if ((v = patVel(P.perc[k], pb, st))) voice.perc(t, v * (m.perc || 1) * ((P.percMix && P.percMix[k]) || 1), k);
  if ((v = patVel(P.crashPat, pb, st))) voice.crash(t, v * (m.crash || 0.7));
}
/* ---- drops: a 2-bar build, half a beat of silence, then the drop ---- */
const DROP_EVERY = 16, BUILD_BARS = 2;
// where a bar sits relative to drops. The game passes its own (drops on each turn); otherwise build first, then drop every 16 bars
function phraseAt(bar) {
  if (S.phrase) return S.phrase(bar);
  if (bar < BUILD_BARS) return { since: Infinity, until: BUILD_BARS - bar };
  const since = (bar - BUILD_BARS) % DROP_EVERY; return { since, until: DROP_EVERY - since };
}
function sectionOf(bar) {
  const p = phraseAt(bar);
  if (p.until <= BUILD_BARS && p.since >= 2) return { kind: 'build', ...p };
  if (p.since === Infinity) return { kind: 'intro', ...p };
  return { kind: p.since < 8 ? 'drop' : 'ride', ...p };
}
function setTone(t, f) { const q = V.tone.frequency; q.cancelScheduledValues(t); q.setValueAtTime(f, t); }
function dropBuild(P, sec, bar, st, t) {
  const spbar = S.steps, sd = S.stepDur, m = P.mix, u = sec.until;
  const gapSteps = spbar / 8;                       // last half beat before the drop is silent
  const dropT = t + (u * spbar - st) * sd, gapT = dropT - gapSteps * sd;
  if (st === 0 && (!V.riser || V.riser.end <= t + 0.01)) {
    V.riser = voice.riser(t, gapT - t, m.riser || 1);
    const q = V.tone.frequency; q.cancelScheduledValues(t); q.setValueAtTime(500, t); q.exponentialRampToValueAtTime(6500, gapT);
    const c = V.clean.gain; c.cancelScheduledValues(t); c.setValueAtTime(1, t);
  }
  if (st === 0 && u === 1) V.clean.gain.setTargetAtTime(0, gapT, 0.015);
  if (u === 1 && st >= spbar - gapSteps) return;
  if (st === 0) voice.pad(t, P.buildPad, (u === 1 ? spbar - gapSteps : spbar) * sd + 0.1, m.pad);
  // snare roll: quarters, eighths, sixteenths, then thirty-seconds, rising in pitch and volume
  const q32 = spbar / 32, half = st < spbar / 2;
  const every = (u >= 2 ? (half ? 8 : 4) : (half ? 2 : 1)) * q32;
  if (st % every === 0) {
    const prog = Math.min(1, ((BUILD_BARS - u) * spbar + st) / (BUILD_BARS * spbar));
    voice.snare(t, (0.45 + 0.75 * prog) * m.snare, { tone: 190 + 240 * prog, dec: 0.085, bp: 2100 + 1800 * prog, rev: 0.34 });
  }
  if (u === 1 && st % (2 * q32) === 0) voice.hat(t, 0.35 * m.hat, false, P.hatMetal);
}
function dropHit(P, t) {
  const m = P.mix;
  if (V.riser) { V.riser.stop(t); V.riser = null; }
  setTone(t, 20000);
  const c = V.clean.gain; c.cancelScheduledValues(t); c.setValueAtTime(1, t);
  voice.impact(t, m.impact || 1); voice.crash(t, m.crash || 1);
}
/* what the listener hears right now, in context time */
function heardTime() {
  const ctx = A.ctx; if (!ctx) return 0;
  let t = ctx.currentTime - (ctx.outputLatency || 0);
  if (ctx.getOutputTimestamp && ctx.state === 'running') {
    const ts = ctx.getOutputTimestamp();
    if (ts && ts.contextTime > 0 && ts.performanceTime > 0) {
      const est = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
      if (est <= ctx.currentTime + 0.01 && est > ctx.currentTime - 0.6) t = est;
    }
  }
  return t - SETTINGS.syncMs / 1000;
}
