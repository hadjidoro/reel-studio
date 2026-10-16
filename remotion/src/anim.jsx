/* <A>: one animated element, a pure function of the scene's local frame. Animation names match the engine's data-a
 * values, so phone screens and html scenes written for the engine animate the same way here.
 * <M>: spec markup (md + raw HTML) turned into React, optionally split into word / letter units for kinetic reveals. */
import React, { createContext, useContext, useMemo } from 'react';
import { Img, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { E, clamp, drift, hash, makeFmt, rng, shake } from './lib.js';

/** Brand, spec, asset resolver and the current scene's span (seconds). */
export const Ctx = createContext(null);
export const SceneCtx = createContext({ span: 1 });

const XPL = { hold: .35, ret: .66, stag: .28 };
const NO_STYLE = ['on', 'type', 'count', 'clock', 'scount', 'starfill'];

// Animation parameters; every other prop (src, alt, id…) goes to the element.
const PARAMS = ['from', 'to', 'dec', 'pre', 'suf', 'ease', 'split', 'land', 'zoom', 'pan', 'v', 'text', 'x', 'y', 'r', 'dl'];

export function A({ a = 'none', t = 0, d, o, as = 'div', className = '', style, children, html, el = {}, ...rest }) {
  const data = {}, attrs = { ...el };
  for (const [k, v] of Object.entries(rest)) (PARAMS.includes(k) ? data : attrs)[k] = v;
  const frame = useCurrentFrame(), { fps } = useVideoConfig(), { span } = useContext(SceneCtx), { B } = useContext(Ctx);
  const lt = frame / fps, t0 = +t, dd = d != null ? +d : .55, p = clamp((lt - t0) / dd), q = lt - t0;
  const pop = (cfg, delay = 0) => spring({ frame: (q - delay) * fps, fps, config: cfg });
  let op = 1, tr = '', cls = className, content = children, inner = html;
  const st = {};
  switch (a) {
    case 'up': op = E.cubicOut(p); tr = `translateY(${(1 - op) * 70}px)`; break;
    case 'left': op = E.cubicOut(p); tr = `translateX(${(1 - op) * -90}px)`; break;
    case 'fade': op = p; break;
    // pops are springs: a quick overshoot that settles by itself
    case 'pop': { const k = q < 0 ? 0 : pop({ damping: 11, stiffness: 170, mass: .7 }); op = clamp(p * 3); tr = `scale(${.5 + .5 * k})`; break; }
    case 'kb': tr = `scale(${1.05 + .1 * (lt / span)})`; break;
    case 'grow': st.transformOrigin = 'left'; tr = `scaleX(${E.cubicOut(p)})`; break;
    case 'growc': tr = `scaleX(${E.p3.o(p)})`; break;
    case 'bar': st.transformOrigin = 'left'; tr = `scaleX(${p})`; break;
    case 'show': op = lt >= t0 ? 1 : 0; break;
    case 'on': if (lt >= t0) cls += ' on'; break;
    case 'tap': op = lt < t0 ? 0 : 1 - p; tr = `scale(${.4 + p})`; break;
    case 'type': {
      const full = String(data.text ?? textContent(children)), n = Math.round(full.length * p);
      content = lt < t0 ? '' : full.slice(0, n); inner = undefined;
      if (lt >= t0 - .3 && p < 1 && Math.floor(lt * 3) % 2 === 0) cls += ' caret';
      break;
    }
    case 'count': {
      const fmt = makeFmt(B), from = +data.from, to = +data.to, dec = +(data.dec || 0), pre = data.pre || '', suf = data.suf || '';
      const v = fmt(from + (to - from) * (data.ease === 'sine' ? E.sineIO(p) : E.cubicOut(p)), dec);
      if (data.split) {
        const i = dec ? v.lastIndexOf(B.decimalSep ?? '.') : -1;
        content = <>{pre}{i >= 0 ? v.slice(0, i) : v}<span className="aff">{i >= 0 ? v.slice(i) : ''}{suf}</span></>;
      } else content = pre + v + suf;
      inner = undefined;
      break;
    }
    case 'rise': { const k = 1 - 2 ** (-10 * p); op = clamp(p * 2.5); tr = `translateY(${(1 - k) * .45}em)`; break; }
    case 'landw': { const k = E.p3.o(p); op = k; tr = `translateY(${((1 - k) * 58).toFixed(1)}px)`; break; }
    case 'mask': op = p > 0 ? 1 : 0; st.clipPath = `inset(0 0 ${(1 - E.cubicOut(p)) * 100}% 0)`; tr = `translateY(${(1 - E.cubicOut(p)) * 40}px)`; break;
    case 'slam': {
      const k = E.expoOut(clamp(q / .58)), [sx, sy] = shake(q - .58);
      op = q < 0 ? 0 : k;
      tr = `translate(${sx.toFixed(2)}px,${(sy + drift(q - .72, span - t0 - .72, 2.5)).toFixed(2)}px) scale(${(1.6 - .6 * k).toFixed(4)})`;
      break;
    }
    case 'explode': {
      const land = XPL.hold + XPL.ret + XPL.stag, [sx, sy] = shake(q - land);
      tr = `translate(${sx.toFixed(2)}px,${(sy + drift(q - land - .1, span - t0 - land - .4, 2)).toFixed(2)}px)`;
      break;
    }
    case 'xg': {
      const k = E.back(1.7)(clamp((q - XPL.hold - +data.dl) / XPL.ret)), m = 1 - k;
      op = clamp(q / .12);
      tr = `translate(${(+data.x * m).toFixed(3)}em,${(+data.y * m).toFixed(3)}em) rotate(${(+data.r * m).toFixed(2)}deg) scale(${(.82 + .18 * k).toFixed(4)})`;
      break;
    }
    case 'ken': {
      const k = .5 - .5 * Math.cos(Math.PI * p), z = data.zoom === 'out' ? 1.16 - .10 * k : 1.06 + .10 * k;
      const dir = { left: -1, right: 1 }[data.pan] || 0;
      tr = `translateX(${dir * (k - .5) * 60}px) scale(${z})`;
      break;
    }
    case 'clock': {
      const v = Math.max(0, +data.from - Math.max(0, q)), h = Math.floor(v / 3600), m = Math.floor(v % 3600 / 60), x = Math.floor(v % 60);
      content = (h ? [h, m, x] : [m, x]).map(n => String(n).padStart(2, '0')).join(':'); inner = undefined;
      break;
    }
    case 'cnt': { const k = E.p2.o(p); op = k; tr = `translateX(${((1 - k) * -20).toFixed(1)}px)`; break; }
    case 'mrise': op = lt >= t0 ? 1 : 0; tr = `translateY(${((1 - E.p4.o(p)) * 110).toFixed(2)}%)`; break;
    case 'cu': {
      const k = clamp(q / .38), w = lt - +data.land;
      let z = .98 + .02 * E.p3.o(k);
      if (w >= 0 && w < .165) z *= 1 + .07 * E.p3.o(w / .165);
      else if (w >= .165 && w < .33) z *= 1.07 - .07 * E.p2.o((w - .165) / .165);
      op = E.p2.o(k); tr = `translateY(${((1 - E.p3.o(k)) * 11).toFixed(2)}px) scale(${z.toFixed(4)})`;
      break;
    }
    // badge: springs in from 0.8 and settles at −8°
    case 'spring': {
      const k = q < 0 ? 0 : pop({ damping: 9, stiffness: 160, mass: .8 });
      op = E.p2.o(clamp(q / .3)); tr = `rotate(${(-8 * k).toFixed(2)}deg) scale(${(.8 + .2 * k).toFixed(4)})`;
      break;
    }
    case 'btn': { const k = q < 0 ? 0 : pop({ damping: 12, stiffness: 150, mass: .8 }); op = E.p2.o(clamp(q / .22)); tr = `translateY(${((1 - k) * 22).toFixed(1)}px) scale(${(.85 + .15 * k).toFixed(4)})`; break; }
    case 'glow': {
      const k = E.p2.o(clamp(q / .6)), z = (.6 + .4 * k) * (q > .65 ? 1 + .075 * (1 - Math.cos(2 * Math.PI * (q - .65) / 1.4)) : 1);
      op = k; tr = `scale(${z.toFixed(4)})`;
      break;
    }
    case 'draw': op = lt >= t0 ? 1 : 0; st.strokeDashoffset = (100 * (1 - E.p2.io(p))).toFixed(2); break;
    case 'starfill': st.clipPath = `inset(0 ${(100 - +data.v * E.p2.o(p)).toFixed(2)}% 0 0)`; break;
    case 'scount': content = (+data.to * E.p2.o(p)).toFixed(1).replace('.', B.decimalSep ?? '.'); inner = undefined; break;
    case 'pulse': tr = `scale(${(p <= 0 || p >= 1 ? 1 : p < .45 ? 1 + .06 * E.p2.o(p / .45) : 1.06 - .06 * E.p2.o((p - .45) / .55)).toFixed(4)})`; break;
    case 'breathe': tr = `scale(${(1 + .025 * E.sineIO(clamp(q / Math.max(.1, span - t0)))).toFixed(4)})`; break;
    case 'lbl': { const k = E.expoOut(p); op = lt < t0 ? 0 : k; tr = `translateY(${((1 - k) * .62).toFixed(3)}em)`; break; }
    case 'wmset': tr = `scale(${(1.04 - .04 * E.expoOut(p)).toFixed(4)})`; break;
  }
  if (o != null && !NO_STYLE.includes(a)) op *= 1 - clamp((lt - +o) / .3);
  if (!NO_STYLE.includes(a)) { st.opacity = op; if (tr) st.transform = tr; }
  // data-a stays on the element: engine.css keys a few rules on it (slam's transform origin)
  const props = { ...attrs, className: cls.trim() || undefined, style: { ...style, ...st }, 'data-a': a };
  if (inner != null) props.dangerouslySetInnerHTML = { __html: inner };
  return React.createElement(as === 'img' ? Img : as, props, inner != null ? undefined : content);
}
const textContent = c => typeof c === 'string' || typeof c === 'number' ? String(c) : Array.isArray(c) ? c.map(textContent).join('') : c?.props ? textContent(c.props.children) : '';

/* ---------- markup → React ---------- */
// Kinetic reveals: per-unit stagger (s), unit animation, unit duration. Group reveals are capped at ~0.8 s.
export const KINETIC = { words: [.06, 'rise', .45], chars: [.03, 'rise', .45], pop: [.07, 'pop', .45], land: [.1, 'landw', .62] };
const ATTR = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', colspan: 'colSpan', rowspan: 'rowSpan', srcset: 'srcSet', crossorigin: 'crossOrigin', maxlength: 'maxLength', readonly: 'readOnly' };
const DATA = { 'data-t': 't', 'data-d': 'd', 'data-o': 'o', 'data-from': 'from', 'data-to': 'to', 'data-dec': 'dec', 'data-pre': 'pre', 'data-suf': 'suf',
  'data-ease': 'ease', 'data-split': 'split', 'data-land': 'land', 'data-z': 'zoom', 'data-p': 'pan', 'data-v': 'v', 'data-text': 'text' };
const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'source', 'wbr']);
const styleObj = s => {
  const o = {};
  for (const part of s.split(/;(?![^(]*\))/)) {
    const i = part.indexOf(':'); if (i < 0) continue;
    let k = part.slice(0, i).trim(); const v = part.slice(i + 1).trim(); if (!k) continue;
    if (!k.startsWith('--')) { const vendor = k.startsWith('-'); k = k.replace(/^-/, '').replace(/-([a-z])/g, (m, c) => c.toUpperCase()); if (vendor) k = k[0].toUpperCase() + k.slice(1); }
    o[k] = v;
  }
  return o;
};
const parse = html => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;

/** Converts parsed nodes. split: { mode, t0, step, d, k } for kinetic units; explode: { r, t0, c, k }. */
function convert(node, x, key) {
  if (node.nodeType === 3) {
    const text = node.textContent;
    if (x.split) {
      const { mode } = x.split, [, anim, dd] = KINETIC[mode];
      return text.split(mode === 'chars' ? /(\s+|)/ : /(\s+)/).filter(s => s !== '' && s !== undefined).map((part, i) => /^\s+$/.test(part) ? part
        : <A key={`${key}.${i}`} as="span" className="w" a={anim} t={+(x.split.t0 + x.split.k++ * x.split.step).toFixed(3)} d={x.split.d ?? dd}>{part}</A>);
    }
    if (x.explode) {
      const X = x.explode;
      return text.split(/(\s+)/).filter(Boolean).map((part, i) => /^\s+$/.test(part) ? part : <span key={`${key}.${i}`} className="wd">{[...part].map((ch, j) => {
        const g = { x: ((X.r() * 2 - 1) * 1).toFixed(3), y: ((X.r() * 2 - 1) * .6).toFixed(3), r: ((X.r() * 2 - 1) * 22).toFixed(1), dl: (XPL.stag * (X.c > 0 ? Math.abs(X.k - X.c) / X.c : 0)).toFixed(3) };
        X.k++;
        return <A key={j} as="span" className="w" a="xg" t={X.t0} {...g}>{ch}</A>;
      })}</span>);
    }
    return text;
  }
  if (node.nodeType !== 1) return null;
  const tag = node.tagName.toLowerCase(), props = { key }, data = {};
  for (const { name, value } of [...node.attributes]) {
    if (name === 'style') props.style = styleObj(value);
    else if (name === 'data-a') data.a = value;
    else if (DATA[name]) data[DATA[name]] = value;
    else if ((name === 'src' || name === 'href') && x.asset) props[name] = x.asset(value);
    else props[ATTR[name] || name] = value;
  }
  if (tag === 'img' && !data.a) return <Img {...props} />;
  if (VOID.has(tag) && !data.a) return React.createElement(tag, props);
  // A subtree with nothing to animate, split or load stays raw HTML.
  const deep = !VOID.has(tag) && (x.split || x.explode || data.a || node.querySelector('[data-a],img'));
  const kids = deep ? [...node.childNodes].map((c, i) => convert(c, x, i)) : undefined;
  const inner = deep || VOID.has(tag) ? undefined : x.rewrite(node.innerHTML);
  if (data.a) {
    // element attributes named like <A>'s own props (an SVG path's d) travel separately
    const el = {};
    for (const k of ['a', 't', 'd', 'o', 'as', 'html', 'el']) if (k in props) { el[k] = props[k]; delete props[k]; }
    return <A {...props} {...data} el={el} as={tag} html={inner}>{kids}</A>;
  }
  return React.createElement(tag, inner != null ? { ...props, dangerouslySetInnerHTML: { __html: inner } } : props, kids);
}
const countUnits = (root, mode) => {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n = 0;
  for (let t; (t = w.nextNode());) n += mode === 'chars' ? t.textContent.replace(/\s/g, '').length : t.textContent.trim().split(/\s+/).filter(Boolean).length;
  return n;
};

/** Spec markup as React. split = words|chars|pop|land splits text into staggered units starting at t; explode scatters the letters. */
export function M({ html, split, explode, t = 0, d }) {
  const { asset } = useContext(Ctx);
  return useMemo(() => {
    const src = String(html ?? '');
    if (!split && !explode && !/[<&]/.test(src)) return src;
    const rewrite = h => h.replace(/(src|href)=(["'])(?!https?:|data:|\/)([^"']+)\2/g, (m, k, q, v) => `${k}=${q}${asset(v)}${q}`)
      .replace(/url\((["']?)(?!https?:|data:|\/)([^)"']+)\1\)/g, (m, q, v) => `url(${q}${asset(v)}${q})`);
    const root = parse(src), x = { asset, rewrite };
    if (split) {
      const [base, , dd] = KINETIC[split], units = countUnits(root, split);
      x.split = { mode: split, t0: +t, step: Math.min(base, .8 / Math.max(1, units - 1)), d: d ?? dd, k: 0 };
    }
    if (explode) {
      const total = countUnits(root, 'chars');
      x.explode = { r: rng(hash(root.textContent)), t0: +t, c: (total - 1) / 2, k: 0 };
    }
    return [...root.childNodes].map((n, i) => convert(n, x, i));
  }, [html, split, explode, t, d, asset]);
}
