/* Scene types as React components. Times (t, d, o) are seconds from the scene's start; layout comes from engine.css,
 * so a spec looks like the same brand under both engines while motion here is Remotion's (springs for pops). */
import React, { useContext } from 'react';
import { Img } from 'remotion';
import { A, Ctx, KINETIC, M } from './anim.jsx';
import { clamp, fitPx, makeFmt, md, pair, phoneSteps, photoList, promoTimes, testimonialTimes, textOf, tone } from './lib.js';

/** A headline (.h1/.h2) honouring the scene's reveal: up (default), words, chars, pop, mask, slam or explode. */
function Head({ cls, text, t = 0, d, o, style, sc, a = 'up' }) {
  const { L } = useContext(Ctx), html = md(text), rv = L.reveal(sc);
  // the bold CTA lands word by word unless the video sets its own reveal
  const r = a === 'land' && rv ? rv : a === 'up' && rv ? rv : a;
  let st = style;
  if (L.bold(sc)) {
    const base = /\bh1\b/.test(cls) ? 156 : /\bh2\b/.test(cls) ? 108 : 0, px = base && fitPx(html, base, 860);
    if (px && px < base) st = { ...style, fontSize: px };
  }
  if (KINETIC[r]) return <A a="none" className={cls} style={st} t={t} o={o}><M html={html} split={r} t={t} d={d} /></A>;
  if (r === 'explode') return <A a="explode" className={cls} style={st} t={t} o={o}><M html={html} explode t={t} /></A>;
  return <A a={r} className={cls} style={st} t={t} d={d} o={o}><M html={html} /></A>;
}
const T = ({ html }) => <M html={md(html)} />;

function BgLayer({ sc }) {
  const { asset } = useContext(Ctx);
  if (!sc.bg) return null;
  return <>
    <A a="kb" className={`bg ${sc.bgFull ? 'full' : ''}`}><Img src={asset(sc.bg)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${sc.bgPos || 'center'} center` }} /></A>
    <div className="shade" />
  </>;
}
const Kick = ({ text, t = 0, d = .2 }) => text ? <A a="fade" className="kick" t={t} d={d}><T html={text} /></A> : null;

function Hook({ sc }) {
  const { L } = useContext(Ctx), b = L.bold(sc);
  return <><BgLayer sc={sc} />
    <div className="box" style={{ top: sc.top ?? (sc.bg ? (b ? 760 : 980) : b ? 330 : 600) }}>
      <Kick text={sc.kicker} />
      <Head sc={sc} cls="h1" style={{ marginTop: 36 }} t={.05} text={sc.title} />
      {sc.sub && <Head sc={sc} cls={`${sc.subSize || 'h2'} acc`} style={{ marginTop: 40 }} t={1} text={sc.sub} />}
      {b && <A a="growc" className="brule" t={sc.sub ? 1.5 : 1.1} d={.45} />}
    </div></>;
}

function NumberScene({ sc }) {
  return <><BgLayer sc={sc} />
    <div className="box" style={{ top: sc.top ?? 520 }}>
      <Kick text={sc.kicker} />
      <A a="count" className="num" style={{ marginTop: 50 }} t={0} from={sc.from ?? 0} to={sc.value} d={sc.countDur ?? 1.2} suf={sc.suffix ?? ''} pre={sc.prefix ?? ''} />
      {sc.title && <Head sc={sc} cls="h1" style={{ marginTop: 30 }} t={.3} text={sc.title} />}
      {sc.sub && <Head sc={sc} cls="h2 acc" style={{ marginTop: 60 }} t={1.4} text={sc.sub} />}
    </div></>;
}

function Statement({ sc }) {
  const { L } = useContext(Ctx), lines = sc.lines || [], step = sc.step ?? .5;
  return <><BgLayer sc={sc} />
    <div className={`box ${sc.center ? 'center' : ''}`} style={{ top: sc.top ?? (L.bold(sc) ? 480 : 600) }}>
      {lines.map((l, i) => <Head key={i} sc={sc} cls={`h1 ${sc.plain ? '' : ['', 'acc', 'red'][i % 3]}`} style={{ marginTop: i ? 20 : 0 }} t={i * step} text={l} />)}
      {sc.sub && <A a="up" className="p" style={{ marginTop: 70 }} t={lines.length * step + .2}><T html={sc.sub} /></A>}
    </div></>;
}

function List({ sc }) {
  const step = sc.step ?? 1.1, kind = sc.mark || 'ok';
  return <><BgLayer sc={sc} />
    <div className="box" style={{ top: sc.top ?? 300 }}>
      {sc.title && <A a="up" className="h3 acc"><T html={sc.title} /></A>}
      <div style={{ marginTop: 34 }}>{(sc.items || []).map((it, i) => {
        const [label, sub] = pair(it), t = .5 + i * step;
        return <A key={i} a="left" className="chk" t={t}>
          <div className="bx"><A a="pop" className={`tk ${kind}`} t={t + .3} d={.4}>{kind === 'no' ? '✕' : kind === 'num' ? i + 1 : '✓'}</A></div>
          <div><T html={label} />{sub && <small><T html={sub} /></small>}</div>
        </A>;
      })}</div>
    </div></>;
}

function Facts({ sc }) {
  const step = sc.step ?? .9, facts = sc.facts || [];
  return <><BgLayer sc={sc} />
    <div className="box" style={{ top: sc.top ?? 260 }}>
      {sc.kicker && <A a="fade" className="kick"><T html={sc.kicker} /></A>}
      {sc.title && <A a="up" className="h3" style={{ marginTop: sc.kicker ? 34 : 0 }} t={.1}><T html={sc.title} /></A>}
      <div style={{ marginTop: 40 }}>{facts.map((f, i) => {
        const [v, l, tn] = Array.isArray(f) ? f : [f.value, f.label, f.tone];
        return <A key={i} a="up" className="fact" t={.5 + i * step}><div className={`fv ${tone(tn)}`}><T html={v} /></div>{l && <div className="fl"><T html={l} /></div>}</A>;
      })}</div>
      {sc.foot && <A a="up" className="p" style={{ marginTop: 30 }} t={.6 + facts.length * step}><T html={sc.foot} /></A>}
    </div></>;
}

function Calc({ sc }) {
  const step = sc.step ?? .85, rows = sc.rows || [], tt = .6 + rows.length * step;
  const tot = sc.total ? (Array.isArray(sc.total) ? sc.total : [sc.total.label, sc.total.value, sc.total.tone]) : null;
  const totCls = `h1 ${tot ? tone(tot[2]) || 'red' : ''}`;
  return <div className="box" style={{ top: sc.top ?? 260 }}>
    {sc.title && <A a="up" className="h3"><T html={sc.title} /></A>}
    <div style={{ marginTop: 44 }}>
      {rows.map((r, i) => {
        const [l, v, tn] = Array.isArray(r) ? r : [r.label, r.value, r.tone];
        return <A key={i} a="left" className="row" t={.6 + i * step}><span><T html={l} /></span><b className={tn === 'good' ? 'grn' : tn === 'bad' || tn === 'alert' ? 'neg' : tone(tn)}><T html={v} /></b></A>;
      })}
      {tot && <A a="up" className="total" t={tt}><span className="h3"><T html={tot[0]} /></span>
        {sc.totalCount
          ? <A as="span" a="count" className={totCls} style={{ fontSize: 96 }} t={tt + .1} from={sc.totalCount.from} to={sc.totalCount.to} d={1.3} suf={sc.totalCount.suffix ?? ''} />
          : <span className={totCls} style={{ fontSize: 96 }}><T html={tot[1]} /></span>}
      </A>}
    </div>
    {sc.foot && <A a="up" className="p" style={{ marginTop: 60 }} t={tt + 1.6}><T html={sc.foot} /></A>}
    {sc.note && <A a="fade" className="small" style={{ marginTop: 40 }} t={tt + 2}><T html={sc.note} /></A>}
  </div>;
}

const Chat = ({ sc }) => <div className="box" style={{ top: sc.top ?? 300 }}>
  {sc.title && <Head sc={sc} cls="h2" text={sc.title} />}
  <div style={{ marginTop: 80 }}>{(sc.messages || []).map((m, i) =>
    <A key={i} a="up" className={`bub ${m.me ? 'me' : ''}`} t={.5 + i * (sc.step ?? .65)}><T html={m.text} />{m.time && <small>{m.time}</small>}</A>)}</div>
</div>;

function Chips({ sc }) {
  const pal = [['var(--accent2)', '#fff'], ['color-mix(in srgb,var(--text) 10%,transparent)', 'var(--text)'], ['var(--accent)', 'var(--on-accent)']];
  const chips = sc.chips || [], step = sc.step ?? .3;
  return <div className="box" style={{ top: sc.top ?? 300 }}>
    {sc.title && <A a="up" className="h3 acc"><T html={sc.title} /></A>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, marginTop: 50 }}>{chips.map((c, i) =>
      <A key={i} a="pop" className="chipx" t={.4 + i * step} style={{ background: pal[i % 3][0], color: pal[i % 3][1] }}><T html={(sc.icon ?? '') + c} /></A>)}</div>
    {sc.foot && <A a="up" className="p" style={{ marginTop: 60 }} t={.6 + chips.length * step}><T html={sc.foot} /></A>}
  </div>;
}

function Versus({ sc }) {
  const a = sc.a || {}, b = sc.b || {};
  return <>
    <A a="fade" d={.15} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 960, background: a.bg || 'var(--accent2)' }} />
    <A a="fade" d={.15} style={{ position: 'absolute', left: 0, top: 960, width: 1080, height: 960, background: b.bg || '#161616' }} />
    <div className="box center" style={{ top: 520 }}><A a="left" className="logo" style={{ fontSize: 150, color: a.color || '#fff' }}><T html={a.name} /></A></div>
    <div className="box center" style={{ top: 1230 }}><A a="left" className="logo" t={.2} style={{ fontSize: 150, color: b.color || '#fff' }}><T html={b.name} /></A></div>
    <A a="pop" t={.5} style={{ position: 'absolute', left: 390, top: 810, width: 300, height: 300, borderRadius: '50%', background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 900, fontSize: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 80px rgba(0,0,0,.5)' }}>VS</A>
    {sc.question && <div className="box center" style={{ top: 250 }}><Head sc={sc} cls="h2" t={.9} text={sc.question} /></div>}
  </>;
}

const Rule = ({ sc }) => <div className="box" style={{ top: sc.top ?? 620 }}>
  <div className="rule"><A a="pop" className="n">{sc.n}</A>
    <div><Head sc={sc} cls="h2" t={.25} text={sc.title} />{sc.sub && <A a="up" className="p" style={{ marginTop: 30 }} t={.7}><T html={sc.sub} /></A>}</div></div>
</div>;

function Cta({ sc }) {
  const { B, L } = useContext(Ctx), label = sc.pill || B.url || '';
  if (!L.bold(sc)) return <div className="box center" style={{ top: sc.top ?? 640 }}>
    <Head sc={sc} cls="h2" text={sc.title} />
    <A a="pop" style={{ marginTop: 70 }} t={.4}><span className="pill" style={{ fontSize: label.length > 14 ? 56 : 64 }}><T html={label} /></span></A>
    {sc.sub && <A a="up" className="p" style={{ marginTop: 70 }} t={.9}><T html={sc.sub} /></A>}
  </div>;
  // the action line lands word by word, the capsule springs in over a soft accent glow that keeps pulsing
  return <div className="box center" style={{ top: sc.top ?? 540 }}>
    <Head sc={sc} cls="h2" t={.06} a="land" text={sc.title} />
    <div className="ctaw" style={{ marginTop: 84 }}><A a="glow" className="cglow" t={1.05} />
      <A a="btn" className="btnw" t={.72}><span className="pill big" style={{ fontSize: textOf(label).length > 14 ? 60 : 76 }}><T html={label} /></span></A></div>
    {sc.sub && <A a="up" className="p" style={{ marginTop: 70 }} t={1.2}><T html={sc.sub} /></A>}
  </div>;
}

function Wordmark() {
  const { B, asset } = useContext(Ctx);
  return B.logo ? <Img src={asset(B.logo)} alt="" /> : <>{B.wordmark?.[0] ?? B.name}<b>{B.wordmark?.[1] ?? ''}</b></>;
}
function End({ sc }) {
  const { B, L } = useContext(Ctx), line = sc.line ?? B.endLine, tag = sc.tagline ?? B.tagline;
  if (!L.brandEnd(sc)) return <div className="box center" style={{ top: 560 }}>
    <A a="pop" className="logo" d={.6}><Wordmark /></A>
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 26 }}><A a="grow" className="bar" t={.35} d={.5} style={{ width: 260 }} /></div>
    {line && <Head sc={sc} cls="h2" style={{ marginTop: 70 }} t={.5} text={line} />}
    {B.url && <A a="pop" style={{ marginTop: 80 }} t={.9}><span className="pill">{B.url}</span></A>}
    {tag && <A a="up" className="p" style={{ marginTop: 60, color: 'var(--muted)' }} t={1.3}><T html={tag} /></A>}
  </div>;
  // wordmark letters rise one after another while the mark settles; the second part takes the accent
  const parts = B.wordmark ? [B.wordmark[0] ?? '', B.wordmark[1] ?? ''] : [B.name ?? '', ''];
  const chars = [...parts[0]].map(c => [c, 0]).concat([...parts[1]].map(c => [c, 1])), n = chars.length;
  const size = Math.min(230, Math.floor(640 / (Math.max(1, n) * .62)));
  return <div className="box center lbcbox" style={{ top: sc.top ?? 440 }}>
    <A a="wmset" className="logo lbc" style={{ fontSize: size }} d={2.4}>{chars.map(([c, acc], i) =>
      <A key={i} as="span" a="lbl" className={`w${acc ? ' acc' : ''}`} t={+(n > 1 ? .7 * i / (n - 1) : 0).toFixed(3)} d={1.15}>{/\s/.test(c) ? ' ' : c}</A>)}</A>
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 34 }}><A a="growc" className="bar" t={.95} d={.5} style={{ width: 360, height: 12, background: 'var(--accent)' }} /></div>
    {line && <Head sc={sc} cls="h2" style={{ marginTop: 64 }} t={1.1} d={.5} text={line} />}
    {B.url && <A a="pop" style={{ marginTop: 70 }} t={1.4} d={.5}><span className="pill">{B.url}</span></A>}
    {tag && <A a="up" className="p" style={{ marginTop: 56, color: 'var(--muted)' }} t={1.65} d={.45}><T html={tag} /></A>}
  </div>;
}

// Inside phone screens authors write data-t / data-o relative to their step; shift them to scene time.
const shiftTimes = (html, by) => html.replace(/data-(t|o)=(["'])([\d.]+)\2/g, (m, k, q, v) => `data-${k}=${q}${(+v + by).toFixed(2)}${q}`);
function Phone({ sc }) {
  const steps = phoneSteps(sc);
  return <>
    <div className="box" style={{ top: 250 }}>{steps.map((st, i) =>
      <Head key={i} sc={sc} cls="h2" style={{ position: 'absolute', top: 0 }} t={st.s} o={st.last ? undefined : st.e - .1} text={st.caption || ''} />)}</div>
    <A a="up" className="phone" d={.7}><div className="screen"><div className="notch" />{steps.map((st, i) =>
      <A key={i} a="fade" className="scr" t={st.s} o={st.last ? undefined : st.e} style={{ ...(st.pad === false ? { padding: 0 } : {}), ...cssText(st.style) }}><M html={shiftTimes(st.screen || '', st.s)} /></A>)}</div></A>
    {steps.flatMap((st, i) => (st.taps || []).map(([x, y, at], j) => <A key={`${i}.${j}`} a="tap" className="tap" style={{ left: x, top: y }} t={st.s + at} d={.6} />))}
  </>;
}
const cssText = s => Object.fromEntries(String(s || '').split(';').map(p => p.split(':')).filter(p => p.length > 1 && p[0].trim())
  .map(([k, ...v]) => [k.trim().startsWith('--') ? k.trim() : k.trim().replace(/-([a-z])/g, (m, c) => c.toUpperCase()), v.join(':').trim()]));

function Photos({ sc }) {
  const { asset } = useContext(Ctx), ps = photoList(sc), x = .25;
  return <>
    {ps.map((p, i) => {
      const last = i === ps.length - 1, zoom = p.zoom ?? (i % 2 ? 'out' : 'in'), pan = p.pan ?? ['left', 'right', 'none'][i % 3];
      return <A key={i} a={i ? 'fade' : 'none'} className="ph" t={i ? p.s - x : 0} d={x * 2} o={last ? undefined : p.s + p.d + x}>
        <A as="img" a="ken" src={asset(p.src)} style={{ objectPosition: p.pos || 'center' }} t={Math.max(0, p.s - x)} d={p.d + x * 2} zoom={zoom} pan={pan} />
      </A>;
    })}
    <div className="pshade" />
    {sc.title && <div className="box" style={{ top: sc.top ?? 300 }}><Head sc={sc} cls="h2" t={.1} text={sc.title} /></div>}
    {sc.stories ? <Stories sc={sc} ps={ps} /> : ps.map((p, i) => p.caption &&
      <div key={i} className="box" style={{ top: sc.capTop ?? 1060 }}><Head sc={sc} cls="h2" t={p.s + .25} o={i === ps.length - 1 ? undefined : p.s + p.d - .15} text={p.caption} /></div>)}
  </>;
}
// story-style progress bars, a "02 / 03" counter and a big caption rising through a mask with an accent underline
function Stories({ sc, ps }) {
  const n = ps.length, pad = v => String(v).padStart(2, '0');
  return <>
    <div className="stories">{ps.map((p, i) => {
      const a = i ? p.s : .3, b = i === n - 1 ? p.s + p.d - .3 : p.s + p.d;
      return <div key={i} className="trk"><A a="bar" className="fill" t={a} d={b - a} /></div>;
    })}</div>
    {ps.map((p, i) => {
      const t = i ? p.s + .4 : .55, last = i === n - 1;
      return <A key={i} a="show" className="scap" style={{ bottom: sc.capBottom ?? 690 }} t={t - .05} o={last ? undefined : p.s + p.d - .15}>
        <A as="span" a="cnt" className="cnt" t={t} d={.4}>{pad(i + 1)} / {pad(n)}</A>
        {p.caption && <><div className="mask"><A a="mrise" className="big" style={{ fontSize: fitPx(p.caption, 210, 820) }} t={t + .08} d={.6}><T html={p.caption} /></A></div>
          <A a="grow" className="ul" t={t + .4} d={.5} /></>}
      </A>;
    })}
  </>;
}

const secsOf = v => typeof v === 'number' ? v : String(v).split(':').reduce((a, x) => a * 60 + +x, 0);
function Promo({ sc }) {
  const { B, L } = useContext(Ctx), fmt = makeFmt(B), nb = L.bold(sc);
  const dec = sc.decimals ?? (String(sc.now ?? '').split('.')[1] || '').length;
  const pre = sc.prefix ?? '', suf = sc.suffix ?? '', num = v => pre + fmt(+v, dec) + suf;
  const { t1, cd, tBadge, tCode } = promoTimes(sc, nb);
  const count = sc.was != null ? { a: 'count', t: t1, d: cd, from: sc.was, to: sc.now, dec, pre, suf, ...(nb ? { ease: 'sine', split: 1 } : {}) } : null;
  const now = cls => count ? <A as="span" className={cls} {...count} /> : <span className={cls}>{num(sc.now)}</span>;
  return <><BgLayer sc={sc} />
    <div className="box center" style={{ top: sc.top ?? (sc.code && sc.countdown != null ? 300 : 420) }}>
      <Kick text={sc.kicker} />
      {sc.title && <Head sc={sc} cls="h2" style={{ marginTop: 40 }} t={.1} text={sc.title} />}
      {sc.was != null && <A a="up" style={{ marginTop: 56 }} t={.45}><span className="was">{num(sc.was)}<A as="i" a="grow" className="strike" t={.85} d={.4} /></span></A>}
      {nb ? <div style={{ marginTop: 10 }}><A a="cu" className="cuw" t={t1} land={t1 + (sc.was != null ? cd : 0)}>{now('now glow')}</A></div>
        : <A a="pop" style={{ marginTop: 10 }} t={t1}>{now('now')}</A>}
      {sc.badge && (nb ? <div style={{ marginTop: 30 }}><A a="spring" className="spw" t={tBadge}><span className="badge"><T html={sc.badge} /></span></A></div>
        : <A a="pop" style={{ marginTop: 26 }} t={tBadge}><span className="badge"><T html={sc.badge} /></span></A>)}
      {sc.code && <A a="up" style={{ marginTop: 60 }} t={tCode}><div className="small"><T html={sc.codeLabel ?? 'Code'} /></div><A as="span" a="type" className="code" t={tCode + .2} d={.5} text={sc.code} /></A>}
      {sc.countdown != null ? <A a="up" style={{ marginTop: 50 }} t={tCode + (sc.code ? .6 : 0)}>{sc.until && <div className="small"><T html={sc.until} /></div>}<A as="span" a="clock" className="clock" from={secsOf(sc.countdown)} /></A>
        : sc.until && <A a="up" className="p" style={{ marginTop: 50 }} t={tCode}><T html={sc.until} /></A>}
    </div></>;
}

const STAR = <svg viewBox="0 0 100 100"><path d="M50 0 61.8 36.2 100 36.2 69.1 58.6 80.9 95 50 72.4 19.1 95 30.9 58.6 0 36.2 38.2 36.2Z" /></svg>;
function Who({ sc, t }) {
  const { asset } = useContext(Ctx);
  const initials = String(sc.author || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return <A a="up" className="who" t={t}>
    <div className="av">{sc.avatar ? <Img src={asset(sc.avatar)} alt="" /> : initials}</div>
    <div><b><T html={sc.author || ''} /></b>{(sc.role || sc.source) && <small><T html={[sc.role, sc.source].filter(Boolean).join(' · ')} /></small>}</div>
  </A>;
}
const Quote = ({ sc, t, html }) => { const r = sc.reveal || 'words'; return KINETIC[r] ? <A a="none" className="quote" t={t}><M html={html} split={r} t={t} /></A> : <A a={r} className="quote" t={t}><M html={html} /></A>; };
function Testimonial({ sc }) {
  const { B } = useContext(Ctx), { hasStars, n, words, tq, ts, ta } = testimonialTimes(sc);
  if (sc.card !== 'proof') return <><BgLayer sc={sc} />
    <div className="box" style={{ top: sc.top ?? 420 }}><A a="up" className="tcard">
      <Quote sc={sc} t={tq} html={md('“' + String(sc.quote || '').replace(/(\*\*|!!|\+\+)?$/, '”$1'))} />
      {hasStars && <div className="stars">{[0, 1, 2, 3, 4].map(i => <A key={i} as="span" a="pop" className="star" style={{ '--f': `${clamp(n - i) * 100}%` }} t={ts + i * .1} d={.4}>★</A>)}</div>}
      <Who sc={sc} t={ta} />
    </A></div></>;
  // proof card: stars sweep to the score, a big quote mark, and a hand-drawn underline under the **accent** words
  const tDraw = tq + Math.min(.8, words * .06) + .55, fs = .2, tb = hasStars ? ts + 1.2 : ta;
  const cells = () => [0, 1, 2, 3, 4].map(i => i < Math.ceil(n)
    ? <A key={i} as="span" a="pulse" className="srf-c" t={+(ts + fs + 1.1 * (i / Math.max(1, n)) * .82).toFixed(2)} d={.2}>{STAR}</A>
    : <span key={i} className="srf-c">{STAR}</span>);
  const mark = `<svg class="tq-mark" viewBox="0 0 100 12" preserveAspectRatio="none"><path d="M 2 7 C 20 4.5, 46 8.5, 66 6 C 80 4.5, 92 7.5, 98 5.5" pathLength="100" data-a="draw" data-t="${tDraw.toFixed(2)}" data-d=".55"/></svg>`;
  const quote = md(sc.quote || '').replace(/<span class="acc">(.+?)<\/span>/g, (m, x) => `<span class="tq-em">${mark}<span class="acc">${x}</span></span>`);
  return <><BgLayer sc={sc} />
    <div className="box" style={{ top: sc.top ?? 300 }}>
      {hasStars && <A a="up" className="srf" t={+(ts - .1).toFixed(2)} d={.4}>
        <div className="srf-stars"><div className="srf-l srf-base">{cells()}</div><A a="starfill" className="srf-l srf-fill" t={+(ts + fs).toFixed(2)} d={1.1} v={n / 5 * 100}>{cells()}</A></div>
        <A as="span" a="scount" className="srf-v" t={+(ts + fs).toFixed(2)} d={1.1} to={n} />
      </A>}
      <A a="up" d={.5}><A a="breathe" className="tcard proof" t={.4}>
        <div className="tq-glyph">“</div>
        <Quote sc={sc} t={tq} html={quote} />
        <Who sc={sc} t={tb} />
      </A></A>
    </div></>;
}

const Html = ({ sc }) => <M html={sc.html || ''} />;

export const SCENES = { hook: Hook, number: NumberScene, statement: Statement, list: List, facts: Facts, calc: Calc, chat: Chat, chips: Chips, versus: Versus,
  rule: Rule, cta: Cta, end: End, phone: Phone, photos: Photos, promo: Promo, testimonial: Testimonial, html: Html };
export { Wordmark };
