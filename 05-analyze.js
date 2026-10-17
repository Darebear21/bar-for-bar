
/* ================= tempo + downbeat detection for uploaded beats ================= */
async function analyzeBuffer(buf) {
  const SR = 11025, HOP = 128, fps = SR / HOP;
  const dur = Math.min(buf.duration, 150);
  const len = Math.max(SR, Math.ceil(dur * SR));
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new OAC(2, len, SR);
  const src = off.createBufferSource(); src.buffer = buf;
  const mk = (type, f) => { const b = off.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = 0.7; b.channelCount = 1; b.channelCountMode = 'explicit'; b.channelInterpretation = 'speakers'; return b; };
  const lp = mk('lowpass', 160), hp = mk('highpass', 2500);
  const mer = off.createChannelMerger(2);
  src.connect(lp); src.connect(hp); lp.connect(mer, 0, 0); hp.connect(mer, 0, 1); mer.connect(off.destination);
  src.start(0);
  const r = await off.startRendering();
  const nF = Math.floor(len / HOP);
  const envOf = x => { const e = new Float32Array(nF); for (let i = 0; i < nF; i++) { let s = 0; const o = i * HOP; for (let j = 0; j < HOP; j++) { const v = x[o + j]; s += v * v; } e[i] = Math.log(1 + 1000 * Math.sqrt(s / HOP)); } return e; };
  const eL = envOf(r.getChannelData(0)), eH = envOf(r.getChannelData(1));
  const fluxOf = e => { const o = new Float32Array(nF); let m = 0; for (let i = 1; i < nF; i++) { o[i] = Math.max(0, e[i] - e[i - 1]); m += o[i]; } m = m / nF || 1; for (let i = 0; i < nF; i++) o[i] /= m; return o; };
  const smooth = o => { const s = new Float32Array(nF); for (let i = 1; i < nF - 1; i++) s[i] = 0.25 * o[i - 1] + 0.5 * o[i] + 0.25 * o[i + 1]; return s; };
  const oL = smooth(fluxOf(eL)), oH = smooth(fluxOf(eH));
  const O = new Float32Array(nF); for (let i = 0; i < nF; i++) O[i] = oL[i] * 1.2 + oH[i];
  // remove slow trend
  let mean = 0; for (let i = 0; i < nF; i++) mean += O[i]; mean /= nF;
  const Oc = new Float32Array(nF); for (let i = 0; i < nF; i++) Oc[i] = O[i] - mean;
  // autocorrelation
  const minL = Math.floor(fps * 60 / 190), maxL = Math.ceil(fps * 60 / 55);
  const top = Math.min(nF - 2, maxL * 2 + 2);
  const ac = new Float32Array(top + 1);
  for (let L = minL >> 1; L <= top; L++) { let s = 0; for (let i = 0; i + L < nF; i++) s += Oc[i] * Oc[i + L]; ac[L] = s / (nF - L); }
  let best = -Infinity, bestL = Math.round(fps * 60 / 95);
  for (let L = minL; L <= maxL; L++) {
    const bpm = 60 * fps / L;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 100) / 0.85, 2));
    const s = (ac[L] + 0.5 * (ac[2 * L] || 0) + 0.25 * (ac[Math.round(L / 2)] || 0)) * prior;
    if (s > best) { best = s; bestL = L; }
  }
  let Lf = bestL; { const a = ac[bestL - 1], b = ac[bestL], c = ac[bestL + 1]; const den = a - 2 * b + c; if (den < 0) Lf = bestL + 0.5 * (a - c) / den; }
  const at = (arr, x) => { const i = x | 0; const f = x - i; return i + 1 < arr.length ? arr[i] * (1 - f) + arr[i + 1] * f : 0; };
  const comb = (arr, P, ph) => { let s = 0, n = 0; for (let x = ph; x < nF - 1; x += P) { s += at(arr, x); n++; } return n ? s / n : 0; };
  const bestPhase = (arr, P) => { let bs = -1, bp = 0; for (let ph = 0; ph < P; ph += 0.5) { const s = comb(arr, P, ph); if (s > bs) { bs = s; bp = ph; } } return [bp, bs]; };
  // fine tempo search
  let P = Lf, bestS = -1;
  for (let k = -12; k <= 12; k++) { const cand = Lf * (1 + k * 0.0015); const [, s] = bestPhase(O, cand); if (s > bestS) { bestS = s; P = cand; } }
  let bpm = 60 * fps / P;
  while (bpm >= 135) bpm /= 2;
  while (bpm < 65) bpm *= 2;
  if (Math.abs(bpm - Math.round(bpm)) < 0.12) bpm = Math.round(bpm);
  bpm = Math.round(bpm * 100) / 100;
  P = 60 * fps / bpm;
  // beat phase (favor kicks), then which beat is "1"
  const KS = new Float32Array(nF); for (let i = 0; i < nF; i++) KS[i] = oL[i] * 1.5 + oH[i] * 0.5;
  const [ph] = bestPhase(KS, P);
  const near = (arr, x) => { let m = 0; for (let i = Math.max(0, Math.floor(x) - 2); i <= Math.min(nF - 1, Math.ceil(x) + 2); i++) if (arr[i] > m) m = arr[i]; return m; };
  const per = j => { let k = 0, h = 0, n = 0; for (let x = ph + j * P; x < nF - 1; x += 4 * P) { k += near(oL, x); h += near(oH, x); n++; } return [k / (n || 1), h / (n || 1)]; };
  const B = [0, 1, 2, 3].map(per);
  let bj = 0, bjs = -Infinity;
  for (let j = 0; j < 4; j++) {
    const s = B[j][0] + 0.5 * B[(j + 2) % 4][0] - 0.35 * (B[(j + 1) % 4][0] + B[(j + 3) % 4][0]) + 0.45 * (B[(j + 1) % 4][1] + B[(j + 3) % 4][1]) - 0.3 * (B[j][1] + B[(j + 2) % 4][1]);
    if (s > bjs) { bjs = s; bj = j; }
  }
  const spb = 60 / bpm, barS = 4 * spb;
  let db = (ph + bj * P) / fps + HOP / (2 * SR);
  db = db - Math.floor(db / barS) * barS;
  // first bar with sound
  const tot = new Float32Array(nF); let mx = 0; for (let i = 0; i < nF; i++) { tot[i] = eL[i] + eH[i]; if (tot[i] > mx) mx = tot[i]; }
  let first = 0; for (let i = 0; i < nF; i++) { if (tot[i] > mx * 0.2) { first = i / fps; break; } }
  const firstBar = Math.max(0, Math.round((first - db) / barS));
  let rapStartBar = firstBar + 3;
  const lastBar = Math.floor((buf.duration - db) / barS);
  if (rapStartBar > lastBar - 4) rapStartBar = Math.max(1, Math.min(firstBar + 1, lastBar - 4));
  return { bpm, downbeat: Math.round(db * 1000) / 1000, rapStartBar: Math.max(1, rapStartBar) };
}
function peaksOf(buf, n) {
  const ch = buf.getChannelData(0); const ch2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch;
  const per = Math.max(1, Math.floor(ch.length / n)); const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let m = 0; const o = i * per; for (let j = 0; j < per; j += 4) { const v = Math.abs(ch[o + j] || 0) + Math.abs(ch2[o + j] || 0); if (v > m) m = v; } out[i] = m / 2; }
  return out;
}
