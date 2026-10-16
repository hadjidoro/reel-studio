/* Pure helpers for the Remotion engine: easing, seeded randomness, text markup, the scene timeline and subtitles.
 * Ported from engine/engine.js so a spec plays the same scenes, timings and transitions under either engine. */
import { Easing } from 'remotion';

/* ---------- math ---------- */
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
// GSAP-style eases expressed with Remotion's Easing: powerN = poly(N+1).
export const E = {
  cubicOut: Easing.out(Easing.cubic),
  back: c => Easing.out(Easing.back(c)),
  p2: { i: Easing.in(Easing.poly(3)), o: Easing.out(Easing.poly(3)), io: Easing.inOut(Easing.poly(3)) },
  p3: { i: Easing.in(Easing.poly(4)), o: Easing.out(Easing.poly(4)), io: Easing.inOut(Easing.poly(4)) },
  p4: { o: Easing.out(Easing.poly(5)) },
  expoOut: p => p >= 1 ? 1 : 1 - 2 ** (-10 * p),
  sineIO: p => (1 - Math.cos(Math.PI * p)) / 2,
};
// Seeded PRNG (mulberry32) and string hash: the only randomness, so every frame is a pure function of time.
export const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
export const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
// Three one-frame impact shake steps, then rest; and a slow sine drift for holds.
const SHAKE = [[0, 0], [4.8, -1.3], [-3.3, .9], [0, 0]];
export const shake = q => { if (q < 0 || q >= .1) return [0, 0]; const f = Math.min(2, Math.floor(q * 30)), k = E.p2.o(q * 30 - f), a = SHAKE[f], b = SHAKE[f + 1]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
export const drift = (q, len, amp) => q <= 0 || len <= 0 ? 0 : -amp * (1 - Math.cos(2 * Math.PI * Math.min(1, q / len))) / 2;
export const makeFmt = B => (n, dec = 0) => {
  const [i, f] = Math.abs(n).toFixed(dec).split('.');
  return (n < 0 ? '− ' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, B.numberGroup ?? ' ') + (f ? (B.decimalSep ?? '.') + f : '');
};

/* ---------- text ---------- */
// **x** accent · !!x!! alert · ++x++ success. Raw HTML is allowed too.
export const md = s => String(s ?? '')
  .replace(/\*\*(.+?)\*\*/g, '<span class="acc">$1</span>')
  .replace(/!!(.+?)!!/g, '<span class="red">$1</span>')
  .replace(/\+\+(.+?)\+\+/g, '<span class="grn">$1</span>');
export const tone = t => ({ accent: 'acc', acc: 'acc', alert: 'red', red: 'red', bad: 'red', good: 'grn', success: 'grn', grn: 'grn' }[t] || '');
export const pair = x => Array.isArray(x) ? x : (typeof x === 'object' && x ? [x.label ?? x.value, x.sub ?? x.label, x.tone] : [x, '']);
export const textOf = html => String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z#0-9]+;/gi, 'x');
// The longest word must fit `width` px at ~0.58 em per glyph (no layout measurement, so it holds before fonts load).
export const fitPx = (html, base, width, em = .58) => Math.min(base, Math.floor(width / (Math.max(1, ...textOf(html).split(/\s+/).map(w => [...w].length)) * em)));
export const voText = vo => !vo ? '' : typeof vo === 'string' ? vo : vo.map(v => v.text).join(' / ');

/* ---------- looks ---------- */
export const BOLD_TYPES = ['hook', 'statement', 'cta', 'number', 'rule', 'promo'];
export const looks = (S, B) => {
  const bg = S.background ?? B.background ?? 'gradient';
  if (!['mesh', 'gradient', 'flat'].includes(bg)) throw new Error(`Unknown background "${bg}". Use: mesh, gradient, flat`);
  return {
    bg, grain: !!(S.grain ?? B.grain ?? bg === 'mesh'),
    bold: sc => (sc.style ?? S.style ?? B.style) === 'bold' && BOLD_TYPES.includes(sc.type),
    brandEnd: sc => (sc.style ?? S.endStyle ?? B.endStyle) === 'brand' && !B.logo,
    reveal: sc => sc.reveal ?? S.reveal,
  };
};

/* ---------- timeline ---------- */
export const photoList = sc => { let t = 0; return (sc.photos || []).map(ph => { const p = typeof ph === 'string' ? { src: ph } : { ...ph }; p.s = t; p.d = p.dur ?? sc.each ?? 3; t += p.d; return p; }); };
export const phoneSteps = sc => { let t = 0; return (sc.steps || []).map((st, i, arr) => { const s = t, d = st.dur ?? 2.8; t += d; return { ...st, s, e: t, last: i === arr.length - 1 }; }); };
export const testimonialTimes = sc => {
  const hasStars = sc.stars != null && sc.stars !== false, n = clamp(+sc.stars, 0, 5);
  const words = String(sc.quote || '').split(/\s+/).length, tq = .3, ts = tq + Math.min(.8, words * .06) + .45;
  return { hasStars, n, words, tq, ts, ta: ts + (hasStars ? .6 : 0) };
};
export const promoTimes = (sc, bold) => {
  const t1 = sc.was != null ? 1.5 : .4, cd = bold ? 1.2 : .9;
  const tBadge = bold ? t1 + cd - .1 : t1 + .8, tCode = bold ? tBadge + .5 : t1 + 1.2;
  return { t1, cd, tBadge, tCode };
};
function baseDur(sc, L) {
  switch (sc.type) {
    case 'hook': return 3.3;
    case 'number': return 3.6;
    case 'statement': return 1.2 + (sc.lines || []).length * .5 + (sc.sub ? 2 : 1);
    case 'list': return .9 + (sc.items || []).length * (sc.step ?? 1.1) + 2;
    case 'facts': return 1 + (sc.facts || []).length * (sc.step ?? .9) + (sc.foot ? 3 : 2);
    case 'calc': return 1 + (sc.rows || []).length * (sc.step ?? .85) + 3 + (sc.foot ? 1.5 : 0);
    case 'chat': return 1.2 + (sc.messages || []).length * (sc.step ?? .65) + 1.3;
    case 'chips': return 1.2 + (sc.chips || []).length * (sc.step ?? .3) + 2.2;
    case 'versus': return 3.2;
    case 'rule': return 3.8;
    case 'cta': return L.bold(sc) ? 3.2 : 2.8;
    case 'end': return L.brandEnd(sc) ? 3.2 : 2.5;
    case 'phone': return (sc.steps || []).reduce((a, st) => a + (st.dur ?? 2.8), 0) + .6;
    case 'photos': return photoList(sc).reduce((a, p) => a + p.d, 0) + .2;
    case 'promo': return (sc.was != null ? 3.8 : 2.8) + (sc.code ? 1.6 : 0) + (sc.countdown != null || sc.until ? .9 : 0) + (L.bold(sc) ? .5 : 0);
    case 'testimonial': { const w = String(sc.quote || '').split(/\s+/).length; return +(.3 + Math.min(.8, w * .06) + 1.4 + Math.max(3, w * .28) + (sc.card === 'proof' ? .8 : 0)).toFixed(2); }
    default: return 4;
  }
}
// The explode reveal lands ~1.3 s after it starts, so headline scenes get extra reading time.
const autoDur = (sc, L) => +(baseDur(sc, L) + (L.reveal(sc) === 'explode' && ['hook', 'number', 'statement', 'rule', 'cta', 'end'].includes(sc.type) ? .7 : 0)).toFixed(2);
export const TRANS = { fade: .3, cut: 0, push: .5, wipe: .5, zoom: .57, whip: .5, chroma: .8, blur: .7 };
export const SCENE_TYPES = ['hook', 'number', 'statement', 'list', 'facts', 'calc', 'chat', 'chips', 'versus', 'rule', 'cta', 'end', 'phone', 'photos', 'promo', 'testimonial', 'html'];

/** Scenes with start/end snapped to the frame grid (so <Sequence> starts on a frame), transitions and storyboard keys. */
export function timeline(S, B, fps = 30) {
  const L = looks(S, B), snap = x => Math.round(x * fps) / fps;
  const scenes = (S.scenes || []).map(x => ({ ...x }));
  if (S.end !== false && !scenes.some(x => x.type === 'end')) scenes.push({ type: 'end', ...(S.end || {}) });
  let clock = 0;
  scenes.forEach((sc, i) => {
    if (!SCENE_TYPES.includes(sc.type)) throw new Error(`Unknown scene type "${sc.type}" (scene ${i + 1})`);
    const tr = i === 0 ? 'cut' : (sc.transition ?? S.transition ?? 'fade');
    sc.tr = typeof tr === 'string' ? tr : tr.type;
    if (TRANS[sc.tr] === undefined) throw new Error(`Unknown transition "${sc.tr}" (scene ${i + 1}). Use: ${Object.keys(TRANS).join(', ')}`);
    sc.td = (typeof tr === 'object' && tr.dur) || TRANS[sc.tr];
    sc.s = snap(clock); clock = snap(clock + +(sc.dur ?? autoDur(sc, L))); sc.e = clock; sc.dur = +(sc.e - sc.s).toFixed(4);
  });
  // tail: how long a scene stays on screen after its end while the next one transitions over it
  scenes.forEach((sc, i) => { const nx = scenes[i + 1]; sc.tail = !nx ? 0 : ['fade', 'cut'].includes(nx.tr) ? 0 : nx.td; });
  const keysOf = sc => sc.type === 'phone' ? phoneSteps(sc).map(st => +(st.e - .3).toFixed(2))
    : sc.type === 'photos' ? photoList(sc).map(p => +(p.s + p.d - .3).toFixed(2))
    : [+Math.max(.2, Math.min(sc.dur - .35, sc.dur * .85)).toFixed(2)];
  scenes.forEach(sc => { sc.keys = keysOf(sc); });
  return { scenes, duration: +clock.toFixed(4), looks: L };
}

/* ---------- subtitles ---------- */
export const plain = x => String(x).replace(/\*\*|!!|\+\+|<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
export function chunkLines(lines, per = 3) {
  const out = [];
  for (const l of lines) {
    const words = plain(l.text).split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const wt = words.map(w => w.length + 2), tot = wt.reduce((a, b) => a + b, 0);
    let at = l.start, cur = [];
    const timed = words.map((w, i) => { const x = { w, s: at }; at += (l.end - l.start) * wt[i] / tot; return x; });
    timed.forEach((x, i) => {
      cur.push(x);
      const last = i === timed.length - 1, long = !last && timed[i + 1].s - cur[0].s > 1.2;
      if (cur.length >= per || long || /[.,!?;:…]$/.test(x.w) || last) { out.push({ s: cur[0].s, e: last ? l.end : timed[i + 1].s, words: cur }); cur = []; }
    });
  }
  return out;
}
/** Voiceover line timings estimated from the speech rate; render replaces them with the real clip timings. */
export function estimateLines(scenes, S, duration) {
  const rate = S.voiceRate ?? 185, items = [];
  scenes.forEach(sc => {
    if (!sc.vo) return;
    (typeof sc.vo === 'string' ? [{ at: .15, text: sc.vo }] : sc.vo).forEach(v => items.push({ start: sc.s + (v.at ?? .15), text: v.text, rate: v.rate || rate }));
  });
  items.sort((a, b) => a.start - b.start);
  return items.map((l, i) => ({ ...l, end: Math.min(l.start + plain(l.text).split(/\s+/).length * 60 / l.rate + .2, (items[i + 1]?.start ?? duration + 1.5) - .12) }));
}
