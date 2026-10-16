/* The whole video: stage background, one <Sequence> per scene wrapped in its transition, chroma overlays,
 * burned-in subtitles and the watermark. Props: { brand, spec, zones, css, voTiming, assetMode }. */
import React, { useEffect, useMemo, useState } from 'react';
import { AbsoluteFill, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Ctx, SceneCtx } from './anim.jsx';
import { E, chunkLines, clamp, estimateLines, rng, timeline } from './lib.js';
import { SCENES, Wordmark } from './scenes.jsx';

/* ---------- transitions: incoming (enter) / outgoing (leave) scene state at progress u ---------- */
const pushBlur = u => { const w = u * .55 - .03; return w <= 0 || w >= .5 ? 0 : 12 * E.p2.i(w < .25 ? w / .25 : (.5 - w) / .25); };
const ENTER = {
  fade: u => ({ o: u }),
  push: u => { const k = E.p3.io(u); return { tf: `translateY(${((1 - k) * 1920).toFixed(1)}px)`, fl: 'url(#rs-vb)', vb: pushBlur(u) }; },
  wipe: u => ({ clip: `inset(0 ${(1 - E.cubicOut(u)) * 100}% 0 0)` }),
  zoom: u => { const k = E.p3.o(clamp((u - .12 / .57) / (.45 / .57))); return { o: k, tf: `scale(${(.55 + .45 * k).toFixed(4)})`, fl: k < 1 ? `blur(${(10 * (1 - k)).toFixed(2)}px)` : '' }; },
  whip: u => { const k = E.p3.io(u); return { tf: `translateX(${((1 - k) * 1080).toFixed(1)}px)`, fl: 'url(#rs-hb)', hb: u < .5 ? 40 * E.p3.i(u / .5) : 40 * (1 - E.p3.o((u - .5) / .5)) }; },
  chroma: u => { const k = E.p3.io(u); return { clip: `inset(0 ${((1 - k) * 100).toFixed(2)}% 0 0)`, tf: `translateX(${(60 * (1 - k)).toFixed(1)}px) scale(${(1.04 - .04 * k).toFixed(4)})`, fx: u }; },
  blur: u => { const k = E.p2.o(clamp((u - .2 / .7) / (.5 / .7))); return { o: k, tf: `scale(${(.95 + .05 * k).toFixed(4)})`, fl: k < 1 ? `blur(${(15 * (1 - k)).toFixed(2)}px)` : '' }; },
};
const LEAVE = {
  push: u => ({ tf: `translateY(${(-E.p3.io(u) * 1920).toFixed(1)}px)`, fl: 'url(#rs-vb)' }),
  wipe: u => ({ clip: `inset(0 0 0 ${E.cubicOut(u) * 100}%)` }),
  zoom: u => { const k = E.p3.i(clamp(u / (.45 / .57))); return { o: 1 - k, tf: `scale(${(1 + 1.4 * k).toFixed(4)})`, fl: `blur(${(10 * k).toFixed(2)}px)` }; },
  whip: u => ({ tf: `translateX(${(-E.p3.io(u) * 1080).toFixed(1)}px)`, fl: 'url(#rs-hb)' }),
  chroma: u => { const k = E.p3.io(u); return { clip: `inset(0 0 0 ${(k * 100).toFixed(2)}%)`, tf: `translateX(${(-70 * k).toFixed(1)}px) scale(${(1 - .04 * k).toFixed(4)})`, fl: `blur(${(5 * k).toFixed(2)}px)` }; },
  blur: u => { const k = E.p2.i(clamp(u / (.45 / .7))); return { o: 1 - k, tf: `scale(${(1 + .05 * k).toFixed(4)})`, fl: `blur(${(15 * k).toFixed(2)}px)` }; },
};
/** Style of scene i at time t, plus the stage-wide blur / chroma values it drives. */
function sceneState(scenes, i, t) {
  const sc = scenes[i], nx = scenes[i + 1], isLast = !nx, out = { o: 1, tf: [], fl: [], clip: '' };
  const apply = r => {
    if (r.o !== undefined) out.o = Math.min(out.o, r.o);
    if (r.tf) out.tf.push(r.tf);
    if (r.fl) out.fl.push(r.fl);
    if (r.clip) out.clip = r.clip;
    for (const k of ['hb', 'vb', 'fx']) if (r[k] !== undefined) out[k] = r[k];
  };
  // the last scene holds its final frame for one extra second (the voiceover may run past the end)
  if (t < sc.s || t > sc.e + (isLast ? 1 : sc.tail)) out.o = 0;
  else {
    if (t < sc.s + sc.td && ENTER[sc.tr]) apply(ENTER[sc.tr](clamp((t - sc.s) / sc.td)));
    if (!isLast && nx.tr === 'fade') out.o = Math.min(out.o, clamp((sc.e - t) / nx.td));
    else if (!isLast && t > sc.e && LEAVE[nx.tr]) apply(LEAVE[nx.tr](clamp((t - sc.e) / nx.td)));
  }
  return out;
}

/* ---------- background: drifting mesh + film grain ---------- */
const POSES = [[18, 20, 84, 52, 38, 86], [36, 34, 66, 40, 60, 72], [24, 48, 78, 24, 30, 70], [44, 26, 60, 64, 54, 88], [20, 22, 82, 55, 40, 84]];
const JIT = (r => Array.from({ length: 24 }, () => [Math.round((r() * 2 - 1) * 15), Math.round((r() * 2 - 1) * 15)]))(rng(0x9a1e));
function Bg({ t, D, mesh, grain }) {
  let blobs = [], meshTf = '';
  if (mesh) {
    const u = clamp(t / D), seg = D / 4, i = Math.max(0, Math.min(3, Math.floor(t / seg))), k = E.sineIO(clamp((t - i * seg) / seg));
    const v = POSES[i].map((x, j) => x + (POSES[i + 1][j] - x) * k);
    blobs = [0, 1, 2].map(j => `translate(${(v[j * 2] * 15.12 - 1050).toFixed(1)}px,${(v[j * 2 + 1] * 26.88 - 1050).toFixed(1)}px)`);
    meshTf = `rotate(${(-4 + 8 * u).toFixed(3)}deg) scale(${(1 + .08 * u).toFixed(4)})`;
  }
  const j = JIT[Math.floor(Math.max(0, t) * 30 + 1e-6) % JIT.length];
  return <div className="bgfx">
    {mesh && <><div className="mesh" style={{ transform: meshTf }}>{blobs.map((tf, i) => <i key={i} style={{ transform: tf }} />)}</div><div className="vig" /></>}
    {grain && <div className="grain" style={{ transform: `translate(${j[0]}%,${j[1]}%)` }} />}
  </div>;
}

/* ---------- subtitles ---------- */
function Subs({ t, chunks, pill, bottom }) {
  const lead = pill ? .08 : 0, c = chunks.find(x => t >= x.s - lead && t < x.e);
  if (!c) return <div className={pill ? 'subs spill' : 'subs'} style={{ bottom }} />;
  let chunkStyle, words;
  if (pill) {
    // the chunk rises into a dark pill; the spoken word takes the accent with a small pop
    const k = E.p2.o(clamp((t - (c.s - lead)) / .14)), on = c.words.reduce((a, w, i) => t >= w.s - .04 ? i : a, -1);
    chunkStyle = { opacity: k, transform: `translateY(${((1 - k) * 18).toFixed(1)}px) scale(${(.94 + .06 * k).toFixed(4)})` };
    words = c.words.map((w, i) => { const q = t - (w.s - .04); return { on: i === on, style: { transform: `scale(${(q < 0 || q >= .16 ? 1 : q < .08 ? 1 + .08 * E.p2.o(q / .08) : 1 + .08 * E.p2.o(1 - (q - .08) / .08)).toFixed(4)})` } }; });
  } else {
    const active = c.words.reduce((k, w, i) => t >= w.s ? i : k, 0);
    words = c.words.map((w, i) => ({ on: i === active, style: { opacity: t < w.s ? 0 : 1, transform: `scale(${.6 + .4 * E.back(1.70158)(clamp((t - w.s) / .26))})` } }));
  }
  return <div className={pill ? 'subs spill' : 'subs'} style={{ bottom }}>
    <span className="chunk" style={chunkStyle}>{c.words.map((w, i) => <React.Fragment key={i}>{i ? ' ' : ''}<span className={words[i].on ? 'on' : undefined} style={words[i].style}>{w.w}</span></React.Fragment>)}</span>
  </div>;
}

/* ---------- fonts and assets ---------- */
// Rendering waits for every webfont the brand css declares; the Player shows frames as soon as they are ready.
function useFonts() {
  const [h] = useState(() => delayRender('fonts'));
  useEffect(() => { document.fonts.ready.then(() => continueRender(h)); }, [h]);
}
const isUrl = s => /^(https?:|data:|blob:|\/)/.test(s);

export function Reel({ brand: B, spec: S, zones = [], css = '', voTiming = null, assetMode = 'relative' }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig(), t = frame / fps;
  useFonts();
  const asset = useMemo(() => assetMode === 'static' ? (p => !p || isUrl(p) ? p : staticFile(p)) : (p => p), [assetMode]);
  const tl = useMemo(() => timeline(S, B, fps), [S, B, fps]);
  const { scenes, duration: D, looks: L } = tl;
  const chunks = useMemo(() => {
    if (!(S.subtitles ?? B.subtitles ?? false)) return [];
    return chunkLines(voTiming || estimateLines(scenes, S, D), S.subtitleWords ?? B.subtitleWords ?? 3);
  }, [S, B, scenes, D, voTiming]);
  const styleCss = useMemo(() => assetMode === 'static' ? css.replace(/url\((["']?)(?!https?:|data:|\/)([^)"']+)\1\)/g, (m, q, v) => `url(${q}${staticFile(v)}${q})`) : css, [css, assetMode]);
  const ctx = useMemo(() => ({ B, S, L, asset }), [B, S, L, asset]);
  const capZone = zones.find(z => z.name === 'Caption / CTA');

  let hb = 0, vb = 0, fx = null;
  const layers = scenes.map((sc, i) => {
    const st = sceneState(scenes, i, t);
    if (st.hb !== undefined) hb = st.hb;
    if (st.vb !== undefined) vb = st.vb;
    if (st.fx !== undefined) fx = st.fx;
    const Scene = SCENES[sc.type], from = Math.round(sc.s * fps), len = Math.round((sc.e + (i === scenes.length - 1 ? 1 : sc.tail)) * fps) - from;
    return <Sequence key={i} from={from} durationInFrames={Math.max(1, len)} layout="none" name={`${i + 1} · ${sc.type}`}>
      <div className={`scene t-${sc.type}${L.bold(sc) ? ' bold' : ''}`} data-tr={sc.tr}
        style={{ opacity: st.o, display: st.o <= 0 ? 'none' : 'block', transform: st.tf.join(' ') || undefined, filter: st.fl.join(' ') || undefined, clipPath: st.clip || undefined }}>
        <SceneCtx.Provider value={{ span: sc.e - sc.s }}><Scene sc={sc} /></SceneCtx.Provider>
      </div>
    </Sequence>;
  });
  // chroma overlays: a light sheen sweeps across and a red/cyan split flickers mid-wipe
  const q = fx == null ? -1 : fx * .8, sheen = q >= .16 && q < .76, split = q >= .3 && q < .6 && Math.floor((q - .3) / .07) % 2 === 1;

  return <Ctx.Provider value={ctx}>
    <style>{styleCss}</style>
    <AbsoluteFill className={`stage bg-${L.bg}`} id="stage">
      <Bg t={t} D={Math.max(.001, D)} mesh={L.bg === 'mesh'} grain={L.grain} />
      <svg className="fxdefs" width="0" height="0" aria-hidden="true"><defs>
        <filter id="rs-hb" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation={`${hb.toFixed(2)} 0`} /></filter>
        <filter id="rs-vb" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation={`0 ${vb.toFixed(2)}`} /></filter></defs></svg>
      {layers}
      <div className="fx-sheen" style={{ display: sheen ? 'block' : 'none', transform: sheen ? `translateX(${(-110 + 220 * E.p2.io(clamp((q - .16) / .58))).toFixed(1)}%)` : undefined }} />
      <div className="fx-rgb" style={{ display: split ? 'block' : 'none', transform: split ? 'translateX(16px)' : undefined }} />
      <Subs t={t} chunks={chunks} pill={(S.subtitleStyle ?? B.subtitleStyle) === 'pill'} bottom={capZone ? 1920 - capZone.y + 40 : 520} />
      {B.watermark === false || S.watermark === false ? null
        : <div className="wm">{B.logoSmall ? <img src={asset(B.logoSmall)} style={{ height: 48 }} /> : <Wordmark />}</div>}
    </AbsoluteFill>
  </Ctx.Provider>;
}

/** Duration in frames for calculateMetadata and the Player. */
export const reelFrames = ({ brand, spec }, fps) => Math.max(1, Math.round(timeline(spec, brand, fps).duration * fps));
