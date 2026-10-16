/* player.html for the Remotion engine: the same <Reel> inside @remotion/player. Loaded by bin/reel.mjs with
 * window.BRAND, SPEC, ZONES, PLATFORMS and CSS set. It exposes the engine's page API (render(t), DURATION, SCENES,
 * safeCheck, setVoTiming) so preview, frames and storyboards work exactly as with the other engines.
 * ?render: a bare 1080×1920 frame for screenshots; otherwise an interactive player with safe zones and scene jumps. */
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { Reel, reelFrames } from './Reel.jsx';
import { timeline, voText } from './lib.js';

const B = window.BRAND, S = window.SPEC, ZONES = window.ZONES || [], FPS = 30;
const RENDER = new URLSearchParams(location.search).has('render');
const tl = timeline(S, B, FPS), frames = reelFrames({ brand: B, spec: S }, FPS);
window.DURATION = +tl.duration.toFixed(2);
window.SCENES = tl.scenes.map(sc => ({ s: sc.s, e: sc.e, type: sc.type, dur: sc.dur, vo: sc.vo, keys: sc.keys }));

let resolveReady;
const playerReady = new Promise(r => { resolveReady = r; });
const raf = () => new Promise(r => requestAnimationFrame(() => r()));

function App() {
  const ref = useRef(null), [vo, setVo] = useState(null), [safe, setSafe] = useState(false), [loop, setLoop] = useState(true);
  useEffect(() => { window.setVoTiming = setVo; resolveReady(ref.current); }, []);
  const props = { brand: B, spec: S, zones: ZONES, css: window.CSS_TEXT || '', voTiming: vo, assetMode: 'relative' };
  const player = <Player ref={ref} component={Reel} inputProps={props} durationInFrames={frames} fps={FPS} compositionWidth={1080} compositionHeight={1920}
    controls={!RENDER} loop={loop} clickToPlay={!RENDER} doubleClickToFullscreen={!RENDER} spaceKeyToPlayOrPause={!RENDER}
    style={RENDER ? { width: 1080, height: 1920 } : { width: '100%', height: '100%' }} />;
  if (RENDER) return player;
  const jump = s => ref.current?.seekTo(Math.round(s * FPS));
  const step = d => { const p = ref.current; if (!p) return; p.pause(); p.seekTo(Math.max(0, Math.min(frames - 1, p.getCurrentFrame() + d))); };
  return <>
    <div id="wrap" style={{ height: 'calc(100vh - 150px)', aspectRatio: '1080 / 1920', position: 'relative' }}>
      {player}
      <div id="safe" style={{ display: safe ? 'block' : 'none' }}>
        {ZONES.map((z, i) => <div key={i} style={{ left: `${z.x / 10.8}%`, top: `${z.y / 19.2}%`, width: `${z.w / 10.8}%`, height: `${z.h / 19.2}%` }}><span>{z.name}</span></div>)}
      </div>
    </div>
    <div id="ctl">
      <button onClick={() => step(-1)} title="Previous frame">◀︎ frame</button><button onClick={() => step(1)} title="Next frame">frame ▶︎</button>
      <button className={safe ? 'on' : ''} onClick={() => setSafe(!safe)} title={(window.PLATFORMS || []).join(' + ')}>Safe zones{window.PLATFORMS ? ' · ' + window.PLATFORMS.length : ''}</button>
      <button className={loop ? 'on' : ''} onClick={() => setLoop(!loop)}>Loop</button>
      <div style={{ width: '100%', display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {window.SCENES.map((x, i) => <button key={i} onClick={() => jump(x.s)} title={voText(x.vo)}>{i + 1} · {x.type} · {x.s.toFixed(1)}s</button>)}
      </div>
    </div>
  </>;
}

/** Seeks the Player to t seconds and resolves once that frame is painted, with its images and fonts loaded. */
window.render = async t => {
  const p = await playerReady, f = Math.max(0, Math.min(frames - 1, Math.round(t * FPS)));
  p.seekTo(f);
  for (let i = 0; i < 60 && p.getCurrentFrame() !== f; i++) await raf();
  await raf(); await raf();
  await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.complete ? null : i.decode().catch(() => {})));
  window.__T = t;
};

/* ---------- safe zones: visible text at the current frame whose glyphs overlap a platform UI zone ---------- */
window.safeCheck = function () {
  const stage = document.getElementById('stage'), out = [];
  if (!stage) return out;
  const base = stage.getBoundingClientRect(), k = base.width / 1080, range = document.createRange();
  const seen = el => {
    for (let e = el; e && e !== stage; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .5) return false;
    }
    return true;
  };
  const hit = (r, label) => {
    const b = { x: (r.left - base.left) / k, y: (r.top - base.top) / k, w: r.width / k, h: r.height / k };
    if (b.w < 2 || b.h < 2) return;
    for (const z of ZONES) {
      const ix = Math.min(b.x + b.w, z.x + z.w) - Math.max(b.x, z.x), iy = Math.min(b.y + b.h, z.y + z.h) - Math.max(b.y, z.y);
      if (ix > 4 && iy > 4) { out.push({ text: label, zone: z.name }); return; }
    }
  };
  const walk = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) {
    const el = n.parentElement;
    if (!n.textContent.trim() || !el.closest('.scene') || el.closest('.wm,#safe,.subs,.bgfx,.fxdefs,style') || !seen(el)) continue;
    const block = el.closest('.h1,.h2,.h3,.p,.small,.kick,.pill,.num,.fact,.row,.chk,.bub,.chipx,.logo,.scr,.quote,.scap,.srf,.now,.badge') || el;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) hit(r, block.textContent.trim().replace(/\s+/g, ' ').slice(0, 40));
  }
  stage.querySelectorAll('.scene .logo img, .scene .pill img').forEach(img => seen(img) && hit(img.getBoundingClientRect(), 'logo'));
  return out.filter((x, i) => out.findIndex(y => y.text === x.text && y.zone === x.zone) === i);
};

document.body.className = RENDER ? 'render' : 'player';
document.title = `${S.title || S.id || 'Reel'} · Reel Studio`;
const root = document.createElement('div');
root.style.display = 'contents';
document.body.appendChild(root);
createRoot(root).render(<App />);
