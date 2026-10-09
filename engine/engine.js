/* Reel Studio engine. Expects window.BRAND and window.SPEC (injected by bin/reel.mjs build).
 * Exposes window.render(t), window.DURATION, window.SCENES. In player mode adds scrub controls. */
(function () {
  const B = window.BRAND, S = window.SPEC;
  const RENDER = new URLSearchParams(location.search).has('render');

  /* ---------- math & number helpers ---------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const eo = p => 1 - Math.pow(1 - p, 3);
  const eb = p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  // GSAP-equivalent eases as pure functions of progress: powerN = exponent N+1; .i in, .o out, .io in-out.
  const pw = n => ({ i: p => p ** n, o: p => 1 - (1 - p) ** n, io: p => p < .5 ? 2 ** (n - 1) * p ** n : 1 - (-2 * p + 2) ** n / 2 });
  const P2 = pw(3), P3 = pw(4), P4 = pw(5);
  const expoOut = p => p >= 1 ? 1 : 1 - 2 ** (-10 * p);
  const backOut = c => p => 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2;
  const sineIO = p => (1 - Math.cos(Math.PI * p)) / 2;
  // Seeded PRNG (mulberry32) and string hash: the only source of randomness, so every frame is a pure function of t.
  const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
  // Ported from HyperFrames headline-slam / char-slam-explode: three one-frame (1/30 s) power2.out shake steps, then rest.
  const SHAKE = [[0, 0], [4.8, -1.3], [-3.3, .9], [0, 0]];
  const shake = q => { if (q < 0 || q >= .1) return [0, 0]; const f = Math.min(2, Math.floor(q * 30)), k = P2.o(q * 30 - f), a = SHAKE[f], b = SHAKE[f + 1]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
  // Subtle hold drift: one sine.inOut yoyo up by `amp` px over `len` seconds.
  const drift = (q, len, amp) => q <= 0 || len <= 0 ? 0 : -amp * (1 - Math.cos(2 * Math.PI * Math.min(1, q / len))) / 2;
  const group = (B.numberGroup ?? ' ');
  const fmt = (n, dec = 0) => {
    const [i, f] = Math.abs(n).toFixed(dec).split('.');
    return (n < 0 ? '− ' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, group) + (f ? (B.decimalSep ?? '.') + f : '');
  };

  /* ---------- text helpers ---------- */
  // **x** accent · !!x!! alert/second accent · ++x++ success. Raw HTML is allowed too.
  const md = s => String(s ?? '')
    .replace(/\*\*(.+?)\*\*/g, '<span class="acc">$1</span>')
    .replace(/!!(.+?)!!/g, '<span class="red">$1</span>')
    .replace(/\+\+(.+?)\+\+/g, '<span class="grn">$1</span>');
  const tone = t => ({ accent: 'acc', acc: 'acc', alert: 'red', red: 'red', bad: 'red', good: 'grn', success: 'grn', grn: 'grn' }[t] || '');
  const wordmark = () => B.logo ? `<img src="${B.logo}" alt="">` : `${B.wordmark?.[0] ?? B.name}<b>${B.wordmark?.[1] ?? ''}</b>`;
  const pair = x => Array.isArray(x) ? x : (typeof x === 'object' && x ? [x.label ?? x.value, x.sub ?? x.label, x.tone] : [x, '']);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const textOf = html => String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z#0-9]+;/gi, 'x');
  // Deterministic fit from character count (no layout measurement, so it holds before fonts load):
  // the longest word must fit `width` px at ~0.58 em per glyph of a black weight with tight tracking.
  const fitPx = (html, base, width, em = .58) => Math.min(base, Math.floor(width / (Math.max(1, ...textOf(html).split(/\s+/).map(w => [...w].length)) * em)));

  /* ---------- looks ---------- */
  // style "bold": bigger, centred headlines in these scene types (spec, brand, or per scene).
  const BOLD_TYPES = ['hook', 'statement', 'cta', 'number', 'rule', 'promo'];
  const bold = sc => (sc.style ?? S.style ?? B.style) === 'bold' && BOLD_TYPES.includes(sc.type);
  const BG = S.background ?? B.background ?? 'gradient';
  if (!['mesh', 'gradient', 'flat'].includes(BG)) throw new Error(`Unknown background "${BG}". Use: mesh, gradient, flat`);
  const GRAIN = !!(S.grain ?? B.grain ?? BG === 'mesh');

  /* ---------- scene generators: (scene) => inner HTML. Local times (data-t) are seconds from scene start. ---------- */
  const T = {};
  const bgLayer = sc => sc.bg ? `<div class="bg ${sc.bgFull ? 'full' : ''}" style="background-image:url('${sc.bg}');background-position:${sc.bgPos || 'center'} center" data-a="kb"></div><div class="shade"></div>` : '';

  T.hook = sc => `${bgLayer(sc)}
    <div class="box" style="top:${sc.top ?? (sc.bg ? (bold(sc) ? 760 : 980) : bold(sc) ? 330 : 600)}px">
      ${sc.kicker ? `<div class="kick" data-t="0" data-a="fade" data-d=".2">${md(sc.kicker)}</div>` : ''}
      <div class="h1" style="margin-top:36px" data-t=".05" data-a="up">${md(sc.title)}</div>
      ${sc.sub ? `<div class="${sc.subSize || 'h2'} acc" style="margin-top:40px" data-t="1" data-a="up">${md(sc.sub)}</div>` : ''}
      ${bold(sc) ? `<div class="brule" data-t="${sc.sub ? 1.5 : 1.1}" data-a="growc" data-d=".45"></div>` : ''}
    </div>`;

  T.number = sc => `${bgLayer(sc)}
    <div class="box" style="top:${sc.top ?? 520}px">
      ${sc.kicker ? `<div class="kick" data-t="0" data-a="fade" data-d=".2">${md(sc.kicker)}</div>` : ''}
      <div class="num" style="margin-top:50px" data-t="0" data-a="count" data-from="${sc.from ?? 0}" data-to="${sc.value}" data-d="${sc.countDur ?? 1.2}" data-suf="${sc.suffix ?? ''}" data-pre="${sc.prefix ?? ''}"></div>
      ${sc.title ? `<div class="h1" style="margin-top:30px" data-t=".3" data-a="up">${md(sc.title)}</div>` : ''}
      ${sc.sub ? `<div class="h2 acc" style="margin-top:60px" data-t="1.4" data-a="up">${md(sc.sub)}</div>` : ''}
    </div>`;

  T.statement = sc => `${bgLayer(sc)}
    <div class="box ${sc.center ? 'center' : ''}" style="top:${sc.top ?? (bold(sc) ? 480 : 600)}px">
      ${(sc.lines || []).map((l, i) => `<div class="h1 ${sc.plain ? '' : ['', 'acc', 'red'][i % 3]}" style="margin-top:${i ? 20 : 0}px" data-t="${i * (sc.step ?? .5)}" data-a="up">${md(l)}</div>`).join('')}
      ${sc.sub ? `<div class="p" style="margin-top:70px" data-t="${(sc.lines || []).length * (sc.step ?? .5) + .2}" data-a="up">${md(sc.sub)}</div>` : ''}
    </div>`;

  T.list = sc => {
    const step = sc.step ?? 1.1, kind = sc.mark || 'ok';
    return `${bgLayer(sc)}<div class="box" style="top:${sc.top ?? 300}px">
      ${sc.title ? `<div class="h3 acc" data-t="0" data-a="up">${md(sc.title)}</div>` : ''}
      <div style="margin-top:34px">${(sc.items || []).map((it, i) => {
        const [label, sub] = pair(it), t = .5 + i * step;
        const glyph = kind === 'no' ? '✕' : kind === 'num' ? i + 1 : '✓';
        return `<div class="chk" data-t="${t}" data-a="left"><div class="bx"><div class="tk ${kind}" data-t="${t + .3}" data-a="pop" data-d=".4">${glyph}</div></div><div>${md(label)}${sub ? `<small>${md(sub)}</small>` : ''}</div></div>`;
      }).join('')}</div></div>`;
  };

  T.facts = sc => {
    const step = sc.step ?? .9, facts = sc.facts || [];
    return `${bgLayer(sc)}<div class="box" style="top:${sc.top ?? 260}px">
      ${sc.kicker ? `<div class="kick" data-t="0" data-a="fade">${md(sc.kicker)}</div>` : ''}
      ${sc.title ? `<div class="h3" style="margin-top:${sc.kicker ? 34 : 0}px" data-t=".1" data-a="up">${md(sc.title)}</div>` : ''}
      <div style="margin-top:40px">${facts.map((f, i) => {
        const [v, l, tn] = Array.isArray(f) ? f : [f.value, f.label, f.tone];
        return `<div class="fact" data-t="${.5 + i * step}" data-a="up"><div class="fv ${tone(tn)}">${md(v)}</div>${l ? `<div class="fl">${md(l)}</div>` : ''}</div>`;
      }).join('')}</div>
      ${sc.foot ? `<div class="p" style="margin-top:30px" data-t="${.6 + facts.length * step}" data-a="up">${md(sc.foot)}</div>` : ''}
    </div>`;
  };

  T.calc = sc => {
    const step = sc.step ?? .85, rows = sc.rows || [];
    const tt = .6 + rows.length * step;
    const tot = sc.total ? (Array.isArray(sc.total) ? sc.total : [sc.total.label, sc.total.value, sc.total.tone]) : null;
    const countAttrs = sc.totalCount ? `data-a="count" data-t="${tt + .1}" data-from="${sc.totalCount.from}" data-to="${sc.totalCount.to}" data-d="1.3" data-suf="${sc.totalCount.suffix ?? ''}"` : '';
    return `<div class="box" style="top:${sc.top ?? 260}px">
      ${sc.title ? `<div class="h3" data-t="0" data-a="up">${md(sc.title)}</div>` : ''}
      <div style="margin-top:44px">${rows.map((r, i) => {
        const [l, v, tn] = Array.isArray(r) ? r : [r.label, r.value, r.tone];
        return `<div class="row" data-t="${.6 + i * step}" data-a="left"><span>${md(l)}</span><b class="${tn === 'good' ? 'grn' : tn === 'bad' || tn === 'alert' ? 'neg' : tone(tn)}">${md(v)}</b></div>`;
      }).join('')}
      ${tot ? `<div class="total" data-t="${tt}" data-a="up"><span class="h3">${md(tot[0])}</span><span class="h1 ${tone(tot[2]) || 'red'}" style="font-size:96px" ${countAttrs}>${md(tot[1])}</span></div>` : ''}
      </div>
      ${sc.foot ? `<div class="p" style="margin-top:60px" data-t="${tt + 1.6}" data-a="up">${md(sc.foot)}</div>` : ''}
      ${sc.note ? `<div class="small" style="margin-top:40px" data-t="${tt + 2}" data-a="fade">${md(sc.note)}</div>` : ''}
    </div>`;
  };

  T.chat = sc => `<div class="box" style="top:${sc.top ?? 300}px">
      ${sc.title ? `<div class="h2" data-t="0" data-a="up">${md(sc.title)}</div>` : ''}
      <div style="margin-top:80px">${(sc.messages || []).map((m, i) =>
        `<div class="bub ${m.me ? 'me' : ''}" data-t="${.5 + i * (sc.step ?? .65)}" data-a="up">${md(m.text)}${m.time ? `<small>${m.time}</small>` : ''}</div>`).join('')}</div>
    </div>`;

  T.chips = sc => {
    const pal = [['var(--accent2)', '#fff'], ['color-mix(in srgb,var(--text) 10%,transparent)', 'var(--text)'], ['var(--accent)', 'var(--on-accent)']];
    const n = (sc.chips || []).length, step = sc.step ?? .3;
    return `<div class="box" style="top:${sc.top ?? 300}px">
      ${sc.title ? `<div class="h3 acc" data-t="0" data-a="up">${md(sc.title)}</div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:22px;margin-top:50px">${(sc.chips || []).map((c, i) =>
        `<div class="chipx" data-t="${.4 + i * step}" data-a="pop" style="background:${pal[i % 3][0]};color:${pal[i % 3][1]}">${sc.icon ?? ''}${md(c)}</div>`).join('')}</div>
      ${sc.foot ? `<div class="p" style="margin-top:60px" data-t="${.6 + n * step}" data-a="up">${md(sc.foot)}</div>` : ''}
    </div>`;
  };

  T.versus = sc => {
    const a = sc.a || {}, b = sc.b || {};
    return `<div style="position:absolute;left:0;top:0;width:1080px;height:960px;background:${a.bg || 'var(--accent2)'}" data-t="0" data-a="fade" data-d=".15"></div>
      <div style="position:absolute;left:0;top:960px;width:1080px;height:960px;background:${b.bg || '#161616'}" data-t="0" data-a="fade" data-d=".15"></div>
      <div class="box center" style="top:520px"><div class="logo" style="font-size:150px;color:${a.color || '#fff'}" data-t="0" data-a="left">${md(a.name)}</div></div>
      <div class="box center" style="top:1230px"><div class="logo" style="font-size:150px;color:${b.color || '#fff'}" data-t=".2" data-a="left">${md(b.name)}</div></div>
      <div style="position:absolute;left:390px;top:810px;width:300px;height:300px;border-radius:50%;background:var(--accent);color:var(--on-accent);font-weight:900;font-size:120px;display:flex;align-items:center;justify-content:center;box-shadow:0 20px 80px rgba(0,0,0,.5)" data-t=".5" data-a="pop">VS</div>
      ${sc.question ? `<div class="box center" style="top:250px"><div class="h2" data-t=".9" data-a="up">${md(sc.question)}</div></div>` : ''}`;
  };

  T.rule = sc => `<div class="box" style="top:${sc.top ?? 620}px">
      <div class="rule"><div class="n" data-t="0" data-a="pop">${sc.n}</div>
      <div><div class="h2" data-t=".25" data-a="up">${md(sc.title)}</div>${sc.sub ? `<div class="p" style="margin-top:30px" data-t=".7" data-a="up">${md(sc.sub)}</div>` : ''}</div></div>
    </div>`;

  T.cta = sc => bold(sc) ? ctaClose(sc) : `<div class="box center" style="top:${sc.top ?? 640}px">
      <div class="h2" data-t="0" data-a="up">${md(sc.title)}</div>
      <div style="margin-top:70px" data-t=".4" data-a="pop"><span class="pill" style="font-size:${(sc.pill || B.url || '').length > 14 ? 56 : 64}px">${md(sc.pill || B.url)}</span></div>
      ${sc.sub ? `<div class="p" style="margin-top:70px" data-t=".9" data-a="up">${md(sc.sub)}</div>` : ''}
    </div>`;
  // Ported from HyperFrames cta-close: the action line lands per word (0.62 s power3.out, 0.1 s stagger), the capsule
  // pops at 0.72 s with one back.out(1.5) overshoot, and a soft accent glow behind it swells in and keeps pulsing.
  const ctaClose = sc => {
    const label = sc.pill || B.url || '';
    return `<div class="box center" style="top:${sc.top ?? 540}px">
      <div class="h2" data-t=".06" data-a="${(sc.reveal ?? S.reveal) ? 'up' : 'land'}">${md(sc.title)}</div>
      <div class="ctaw" style="margin-top:84px"><div class="cglow" data-t="1.05" data-a="glow"></div>
        <div class="btnw" data-t=".72" data-a="btn"><span class="pill big" style="font-size:${textOf(label).length > 14 ? 60 : 76}px">${md(label)}</span></div></div>
      ${sc.sub ? `<div class="p" style="margin-top:70px" data-t="1.2" data-a="up">${md(sc.sub)}</div>` : ''}
    </div>`;
  };

  // endStyle "brand" (spec, brand, or the end scene's `style`); needs a text wordmark, so a logo image keeps the classic card.
  const brandEnd = sc => (sc.style ?? S.endStyle ?? B.endStyle) === 'brand' && !B.logo;
  T.end = sc => brandEnd(sc) ? logoBrandClose(sc) : `<div class="box center" style="top:560px">
      <div class="logo" data-t="0" data-a="pop" data-d=".6">${wordmark()}</div>
      <div style="display:flex;justify-content:center;margin-top:26px"><div class="bar" data-t=".35" data-a="grow" data-d=".5" style="width:260px"></div></div>
      ${(sc.line ?? B.endLine) ? `<div class="h2" style="margin-top:70px" data-t=".5" data-a="up">${md(sc.line ?? B.endLine)}</div>` : ''}
      ${B.url ? `<div style="margin-top:80px" data-t=".9" data-a="pop"><span class="pill">${B.url}</span></div>` : ''}
      ${(sc.tagline ?? B.tagline) ? `<div class="p" style="margin-top:60px;color:var(--muted)" data-t="1.3" data-a="up">${md(sc.tagline ?? B.tagline)}</div>` : ''}
    </div>`;
  // Ported from HyperFrames logo-brand-close: wordmark letters fade and rise 0.62 em (expo.out 1.15 s, 0.7 s stagger)
  // while the whole mark settles from 1.04; the accent starts at the wordmark split (brand.json wordmark[1]).
  const logoBrandClose = sc => {
    const parts = B.wordmark ? [B.wordmark[0] ?? '', B.wordmark[1] ?? ''] : [B.name ?? '', ''];
    const chars = [...parts[0]].map(c => [c, 0]).concat([...parts[1]].map(c => [c, 1])), n = chars.length;
    const size = Math.min(230, Math.floor(640 / (Math.max(1, n) * .62)));
    return `<div class="box center lbcbox" style="top:${sc.top ?? 440}px">
      <div class="logo lbc" style="font-size:${size}px" data-a="wmset" data-d="2.4">${chars.map(([c, acc], i) =>
        `<span class="w${acc ? ' acc' : ''}" data-a="lbl" data-t="${(n > 1 ? .7 * i / (n - 1) : 0).toFixed(3)}" data-d="1.15">${/\s/.test(c) ? '&nbsp;' : esc(c)}</span>`).join('')}</div>
      <div style="display:flex;justify-content:center;margin-top:34px"><div class="bar" data-t=".95" data-a="growc" data-d=".5" style="width:360px;height:12px;background:var(--accent)"></div></div>
      ${(sc.line ?? B.endLine) ? `<div class="h2" style="margin-top:64px" data-t="1.1" data-a="up" data-d=".5">${md(sc.line ?? B.endLine)}</div>` : ''}
      ${B.url ? `<div style="margin-top:70px" data-t="1.4" data-a="pop" data-d=".5"><span class="pill">${B.url}</span></div>` : ''}
      ${(sc.tagline ?? B.tagline) ? `<div class="p" style="margin-top:56px;color:var(--muted)" data-t="1.65" data-a="up" data-d=".45">${md(sc.tagline ?? B.tagline)}</div>` : ''}
    </div>`;
  };

  // Phone walkthrough: steps play one after another; each has a caption above the phone and screen HTML inside it.
  T.phone = sc => {
    let t = 0;
    const steps = (sc.steps || []).map((st, i, arr) => {
      const s = t, d = st.dur ?? 2.8; t += d;
      const last = i === arr.length - 1;
      return { ...st, s, e: t, last };
    });
    const caps = steps.map((st, i) => `<div class="h2" style="position:absolute;top:0" data-t="${st.s}" data-a="up" ${st.last ? '' : `data-o="${st.e - .1}"`}>${md(st.caption || '')}</div>`).join('');
    const screens = steps.map((st, i) => `<div class="scr" style="${st.pad === false ? 'padding:0;' : ''}${st.style || ''}" data-t="${st.s}" data-a="fade" ${st.last ? '' : `data-o="${st.e}"`}>${shiftTimes(st.screen || '', st.s)}</div>`).join('');
    const taps = steps.flatMap(st => (st.taps || []).map(([x, y, at]) => `<div class="tap" style="left:${x}px;top:${y}px" data-t="${st.s + at}" data-a="tap" data-d=".6"></div>`)).join('');
    return `<div class="box" style="top:250px">${caps}</div>
      <div class="phone" data-t="0" data-a="up" data-d=".7"><div class="screen"><div class="notch"></div>${screens}</div></div>${taps}`;
  };
  // Inside phone screens authors write data-t relative to their step; shift to scene-local time.
  function shiftTimes(html, by) {
    return html.replace(/data-(t|o)=(["'])([\d.]+)\2/g, (m, k, q, v) => `data-${k}=${q}${(+v + by).toFixed(2)}${q}`);
  }

  // Photo slideshow: full-frame images with a slow Ken Burns move, cross-fading, each with an optional caption.
  const photoList = sc => { let t = 0; return (sc.photos || []).map(ph => { const p = typeof ph === 'string' ? { src: ph } : { ...ph }; p.s = t; p.d = p.dur ?? sc.each ?? 3; t += p.d; return p; }); };
  T.photos = sc => {
    const ps = photoList(sc), x = .25;
    return ps.map((p, i) => {
      const last = i === ps.length - 1, end = p.s + p.d;
      const zoom = p.zoom ?? (i % 2 ? 'out' : 'in'), pan = p.pan ?? ['left', 'right', 'none'][i % 3];
      return `<div class="ph" data-t="${i ? p.s - x : 0}" data-a="${i ? 'fade' : 'none'}" data-d="${x * 2}" ${last ? '' : `data-o="${end + x}"`}>
        <img src="${p.src}" style="object-position:${p.pos || 'center'}" data-a="ken" data-t="${Math.max(0, p.s - x)}" data-d="${p.d + x * 2}" data-z="${zoom}" data-p="${pan}"></div>`;
    }).join('') + `<div class="pshade"></div>
      ${sc.title ? `<div class="box" style="top:${sc.top ?? 300}px"><div class="h2" data-t=".1" data-a="up">${md(sc.title)}</div></div>` : ''}
      ${sc.stories ? stories(sc, ps) : ps.map((p, i) => p.caption ?`<div class="box" style="top:${sc.capTop ?? 1060}px"><div class="h2" data-t="${p.s + .25}" data-a="up" ${i === ps.length - 1 ? '' : `data-o="${p.s + p.d - .15}"`}>${md(p.caption)}</div></div>` : '').join('')}`;
  };

  // Ported from the HyperFrames trial's s2-photos scene: story-style progress bars (one linear fill per photo),
  // a "02 / 03" counter, a big caption rising through a mask (power4.out) and an accent underline drawing in.
  const stories = (sc, ps) => {
    const n = ps.length, pad = x => String(x).padStart(2, '0');
    const bars = ps.map((p, i) => {
      const a = i ? p.s : .3, b = i === n - 1 ? p.s + p.d - .3 : p.s + p.d;
      return `<div class="trk"><div class="fill" data-a="bar" data-t="${a.toFixed(2)}" data-d="${(b - a).toFixed(2)}"></div></div>`;
    }).join('');
    const caps = ps.map((p, i) => {
      const t = i ? p.s + .4 : .55, last = i === n - 1;
      return `<div class="scap" style="bottom:${sc.capBottom ?? 690}px" data-t="${(t - .05).toFixed(2)}" data-a="show" ${last ? '' : `data-o="${(p.s + p.d - .15).toFixed(2)}"`}>
        <span class="cnt" data-t="${t.toFixed(2)}" data-a="cnt" data-d=".4">${pad(i + 1)} / ${pad(n)}</span>
        ${p.caption ? `<div class="mask"><div class="big" style="font-size:${fitPx(p.caption, 210, 820)}px" data-t="${(t + .08).toFixed(2)}" data-a="mrise" data-d=".6">${md(p.caption)}</div></div>
        <div class="ul" data-t="${(t + .4).toFixed(2)}" data-a="grow" data-d=".5"></div>` : ''}</div>`;
    }).join('');
    return `<div class="stories">${bars}</div>${caps}`;
  };

  // Price / promo reveal: old price struck through, new price counting down to it, badge, promo code, optional live countdown.
  const secsOf = v => typeof v === 'number' ? v : String(v).split(':').reduce((a, x) => a * 60 + +x, 0);
  T.promo = sc => {
    const dec = sc.decimals ?? (String(sc.now ?? '').split('.')[1] || '').length;
    const pre = sc.prefix ?? '', suf = sc.suffix ?? '', num = v => (pre + fmt(+v, dec) + suf);
    const t1 = sc.was != null ? 1.5 : .4;   // the new price lands ~0.25 s after the strike-through finishes
    // In the bold look the price is the ported count-up (sine.inOut count, glow, landing pulse) and the badge the
    // ported spring-pop; both take a little longer, so the code and countdown move later.
    const nb = bold(sc), cd = nb ? 1.2 : .9, tBadge = nb ? t1 + cd - .1 : t1 + .8, tCode = nb ? tBadge + .5 : t1 + 1.2;
    const countAttrs = sc.was != null ? `data-a="count" data-t="${t1}" data-d="${cd}" data-from="${sc.was}" data-to="${sc.now}" data-dec="${dec}" data-pre="${pre}" data-suf="${suf}"${nb ? ' data-ease="sine" data-split="1"' : ''}` : '';
    const price = nb
      // Ported from HyperFrames count-up: 0.38 s arrival (opacity power2.out, rise + 0.98→1 power3.out), then a 1.07 pulse on landing.
      ? `<div style="margin-top:10px"><div class="cuw" data-t="${t1}" data-a="cu" data-land="${t1 + (sc.was != null ? cd : 0)}"><span class="now glow" ${countAttrs}>${num(sc.now)}</span></div></div>`
      : `<div style="margin-top:10px" data-t="${t1}" data-a="pop"><span class="now" ${countAttrs}>${num(sc.now)}</span></div>`;
    // Ported from HyperFrames spring-pop (badge only: the catalog's leading dot is left out, which was the stray "•").
    const badge = !sc.badge ? '' : nb
      ? `<div style="margin-top:30px"><div class="spw" data-t="${tBadge}" data-a="spring"><span class="badge">${md(sc.badge)}</span></div></div>`
      : `<div style="margin-top:26px" data-t="${tBadge}" data-a="pop"><span class="badge">${md(sc.badge)}</span></div>`;
    return `${bgLayer(sc)}<div class="box center" style="top:${sc.top ?? (sc.code && sc.countdown != null ? 300 : 420)}px">
      ${sc.kicker ? `<div class="kick" data-t="0" data-a="fade" data-d=".2">${md(sc.kicker)}</div>` : ''}
      ${sc.title ? `<div class="h2" style="margin-top:40px" data-t=".1" data-a="up">${md(sc.title)}</div>` : ''}
      ${sc.was != null ? `<div style="margin-top:56px" data-t=".45" data-a="up"><span class="was">${num(sc.was)}<i class="strike" data-t=".85" data-a="grow" data-d=".4"></i></span></div>` : ''}
      ${price}
      ${badge}
      ${sc.code ? `<div style="margin-top:60px" data-t="${tCode}" data-a="up"><div class="small">${md(sc.codeLabel ?? 'Code')}</div><span class="code" data-a="type" data-t="${tCode + .2}" data-d=".5">${sc.code}</span></div>` : ''}
      ${sc.countdown != null ? `<div style="margin-top:50px" data-t="${tCode + (sc.code ? .6 : 0)}" data-a="up">${sc.until ? `<div class="small">${md(sc.until)}</div>` : ''}<span class="clock" data-a="clock" data-from="${secsOf(sc.countdown)}"></span></div>`
        : sc.until ? `<div class="p" style="margin-top:50px" data-t="${tCode}" data-a="up">${md(sc.until)}</div>` : ''}
    </div>`;
  };

  // Testimonial card: stars fill in, the quote reveals word by word, then the author.
  T.testimonial = sc => {
    const hasStars = sc.stars != null && sc.stars !== false, n = clamp(+sc.stars, 0, 5);
    const words = String(sc.quote || '').split(/\s+/).length, tq = .3, ts = tq + Math.min(.8, words * .06) + .45;
    const ta = ts + (hasStars ? .6 : 0);
    const initials = String(sc.author || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    if (sc.card === 'proof') return proofCard(sc, { hasStars, n, tq, ts, ta, words, initials });
    return `${bgLayer(sc)}<div class="box" style="top:${sc.top ?? 420}px"><div class="tcard" data-t="0" data-a="up">
      <div class="quote" data-t="${tq}" data-a="${sc.reveal || 'words'}">${md('“' + String(sc.quote || '').replace(/(\*\*|!!|\+\+)?$/, '”$1'))}</div>
      ${hasStars ? `<div class="stars">${[0, 1, 2, 3, 4].map(i => `<span class="star" style="--f:${clamp(n - i) * 100}%" data-t="${ts + i * .1}" data-a="pop" data-d=".4">★</span>`).join('')}</div>` : ''}
      <div class="who" data-t="${ta}" data-a="up">
        <div class="av">${sc.avatar ? `<img src="${sc.avatar}" alt="">` : initials}</div>
        <div><b>${md(sc.author || '')}</b>${sc.role || sc.source ? `<small>${md([sc.role, sc.source].filter(Boolean).join(' · '))}</small>` : ''}</div>
      </div></div></div>`;
  };

  // Ported from HyperFrames testimonial-proof-card (big quote mark, hand-drawn accent underline under the **emphasis**,
  // drawn 0.55 s power2.inOut after the quote lands) and star-rating-fill (power2.out sweep over 1.1 s, the score
  // counting up beside the stars, a 1.06 pop on each star as the sweep passes it).
  const STAR = '<svg viewBox="0 0 100 100"><path d="M50 0 61.8 36.2 100 36.2 69.1 58.6 80.9 95 50 72.4 19.1 95 30.9 58.6 0 36.2 38.2 36.2Z"/></svg>';
  const MARK = '<svg class="tq-mark" viewBox="0 0 100 12" preserveAspectRatio="none"><path d="M 2 7 C 20 4.5, 46 8.5, 66 6 C 80 4.5, 92 7.5, 98 5.5" pathLength="100" data-a="draw" data-t="@" data-d=".55"/></svg>';
  const proofCard = (sc, { hasStars, n, tq, ts, ta, words, initials }) => {
    const tDraw = tq + Math.min(.8, words * .06) + .55, fs = .2;
    ta = hasStars ? ts + 1.2 : ta;   // the byline waits for the star sweep
    const cells = () => [0, 1, 2, 3, 4].map(i => `<span class="srf-c" ${i < Math.ceil(n) ? `data-a="pulse" data-t="${(ts + fs + 1.1 * (i / Math.max(1, n)) * .82).toFixed(2)}" data-d=".2"` : ''}>${STAR}</span>`).join('');
    const quote = md(sc.quote || '').replace(/<span class="acc">(.+?)<\/span>/g, (m, x) => `<span class="tq-em">${MARK.replace('@', tDraw.toFixed(2))}<span class="acc">${x}</span></span>`);
    return `${bgLayer(sc)}<div class="box" style="top:${sc.top ?? 300}px">
      ${hasStars ? `<div class="srf" data-t="${(ts - .1).toFixed(2)}" data-a="up" data-d=".4">
        <div class="srf-stars"><div class="srf-l srf-base">${cells()}</div><div class="srf-l srf-fill" data-a="starfill" data-t="${(ts + fs).toFixed(2)}" data-d="1.1" data-v="${n / 5 * 100}">${cells()}</div></div>
        <span class="srf-v" data-a="scount" data-t="${(ts + fs).toFixed(2)}" data-d="1.1" data-to="${n}">0${B.decimalSep ?? '.'}0</span></div>` : ''}
      <div data-t="0" data-a="up" data-d=".5"><div class="tcard proof" data-a="breathe" data-t=".4">
      <div class="tq-glyph">“</div>
      <div class="quote" data-t="${tq}" data-a="${sc.reveal || 'words'}">${quote}</div>
      <div class="who" data-t="${ta}" data-a="up">
        <div class="av">${sc.avatar ? `<img src="${sc.avatar}" alt="">` : initials}</div>
        <div><b>${md(sc.author || '')}</b>${sc.role || sc.source ? `<small>${md([sc.role, sc.source].filter(Boolean).join(' · '))}</small>` : ''}</div>
      </div></div></div></div>`;
  };

  T.html = sc => sc.html || '';
  const voText = vo => !vo ? '' : typeof vo === 'string' ? vo : vo.map(v => v.text).join(' / ');

  /* ---------- default durations ---------- */
  const baseDur = sc => {
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
      case 'cta': return bold(sc) ? 3.2 : 2.8;
      case 'end': return brandEnd(sc) ? 3.2 : 2.5;
      case 'phone': return (sc.steps || []).reduce((a, st) => a + (st.dur ?? 2.8), 0) + .6;
      case 'photos': return photoList(sc).reduce((a, p) => a + p.d, 0) + .2;
      case 'promo': return (sc.was != null ? 3.8 : 2.8) + (sc.code ? 1.6 : 0) + (sc.countdown != null || sc.until ? .9 : 0) + (bold(sc) ? .5 : 0);
      case 'testimonial': { const w = String(sc.quote || '').split(/\s+/).length; return +(.3 + Math.min(.8, w * .06) + 1.4 + Math.max(3, w * .28) + (sc.card === 'proof' ? .8 : 0)).toFixed(2); }
      default: return 4;
    }
  };
  // The explode reveal holds its scatter and lands ~1.3 s after it starts, so headline scenes get extra reading time.
  const autoDur = sc => +(baseDur(sc) + ((sc.reveal ?? S.reveal) === 'explode' && ['hook', 'number', 'statement', 'rule', 'cta', 'end'].includes(sc.type) ? .7 : 0)).toFixed(2);

  // Scene transitions (into a scene) and their default durations in seconds.
  const TRANS = { fade: .3, cut: 0, push: .5, wipe: .5, zoom: .57, whip: .5, chroma: .8, blur: .7 };

  /* ---------- timeline ---------- */
  const scenes = (S.scenes || []).map(x => ({ ...x }));
  if (S.end !== false && !scenes.some(x => x.type === 'end')) scenes.push({ type: 'end', ...(S.end || {}) });
  let clock = 0;
  scenes.forEach(sc => { sc.dur = +(sc.dur ?? autoDur(sc)).toFixed(2); sc.s = +clock.toFixed(2); clock += sc.dur; sc.e = +clock.toFixed(2); });
  window.DURATION = +clock.toFixed(2);
  // keys: scene-local times worth a storyboard frame (one per phone step, else the settled end of the scene)
  const keysOf = sc => sc.type === 'phone'
    ? (() => { let t = 0; return (sc.steps || []).map(st => { t += st.dur ?? 2.8; return +(t - .3).toFixed(2); }); })()
    : sc.type === 'photos' ? photoList(sc).map(p => +(p.s + p.d - .3).toFixed(2))
    : [+Math.max(.2, Math.min(sc.dur - .35, sc.dur * .85)).toFixed(2)];
  window.SCENES = scenes.map(sc => ({ s: sc.s, e: sc.e, type: sc.type, dur: sc.dur, vo: sc.vo, keys: keysOf(sc) }));

  const stage = document.createElement('div');
  stage.className = `stage bg-${BG}`; stage.id = 'stage';
  // Stage-level layers under every scene: the drifting mesh, its vignette and the film grain (no text, so safeCheck skips them).
  const bgfx = `<div class="bgfx">${BG === 'mesh' ? '<div class="mesh"><i></i><i></i><i></i></div><div class="vig"></div>' : ''}${GRAIN ? '<div class="grain"></div>' : ''}</div>`;
  // Shared directional blurs for whip (horizontal) and push (vertical): one SVG filter each per stage.
  const blurDefs = `<svg class="fxdefs" width="0" height="0" aria-hidden="true"><defs>
    <filter id="rs-hb" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="0 0"/></filter>
    <filter id="rs-vb" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="0 0"/></filter></defs></svg>`;
  stage.innerHTML = bgfx + blurDefs + scenes.map((sc, i) => {
    if (!T[sc.type]) throw new Error(`Unknown scene type "${sc.type}" (scene ${i + 1})`);
    const tr = i === 0 ? 'cut' : (sc.transition ?? S.transition ?? 'fade');
    const type = typeof tr === 'string' ? tr : tr.type, td = (typeof tr === 'object' && tr.dur) || TRANS[type];
    if (TRANS[type] === undefined) throw new Error(`Unknown transition "${type}" (scene ${i + 1}). Use: ${Object.keys(TRANS).join(', ')}`);
    return `<div class="scene t-${sc.type}${bold(sc) ? ' bold' : ''}" data-s="${sc.s}" data-e="${sc.e}" data-tr="${type}" data-td="${td}">${T[sc.type](sc)}</div>`;
  }).join('') + '<div class="fx-sheen"></div><div class="fx-rgb"></div>'
    + (B.watermark === false || S.watermark === false ? '' : `<div class="wm">${B.logoSmall ? `<img src="${B.logoSmall}" style="height:48px">` : wordmark()}</div>`);
  const hBlur = stage.querySelector('#rs-hb feGaussianBlur'), vBlur = stage.querySelector('#rs-vb feGaussianBlur');
  const sheen = stage.querySelector('.fx-sheen'), rgb = stage.querySelector('.fx-rgb');
  const meshEl = stage.querySelector('.mesh'), blobs = meshEl ? [...meshEl.children] : [], grainEl = stage.querySelector('.grain');

  // Bold headlines: scale each one down from its bold size only when its longest word would not fit the 860 px column.
  stage.querySelectorAll(':scope > .scene.bold').forEach(el => el.querySelectorAll('.h1,.h2').forEach(h => {
    const base = h.classList.contains('h1') ? 156 : 108, px = fitPx(h.innerHTML, base, 860);
    if (px < base) h.style.fontSize = px + 'px';
  }));

  // Kinetic headlines: scene "reveal" (or spec-wide) turns the headline slide-up into words / chars / pop / mask / slam / explode reveals.
  stage.querySelectorAll(':scope > .scene').forEach((el, i) => {
    const r = scenes[i]?.reveal ?? S.reveal;
    if (r && r !== 'up') el.querySelectorAll('.h1[data-a="up"], .h2[data-a="up"]').forEach(h => { h.dataset.a = r; });
  });

  /* ---------- animation ---------- */

  // Stagger (s), per-unit animation and default unit duration for kinetic reveals.
  // Group reveals are capped at ~0.8 s so long lines don't drag (reference/motion/typography-and-captions.md).
  // land: ported from HyperFrames cta-close (each word rises 8 % of the box with power3.out, 0.1 s apart).
  const KINETIC = { words: [.06, 'rise', .45], chars: [.03, 'rise', .45], pop: [.07, 'pop', .45], land: [.1, 'landw', .62] };
  function split(el) {
    const [base, anim, dd] = KINETIC[el.dataset.a], t0 = +(el.dataset.t || 0), d = el.dataset.d || dd;
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
    for (let n; (n = walk.nextNode());) nodes.push(n);
    const units = nodes.reduce((a, n) => a + (el.dataset.a === 'chars' ? n.textContent.replace(/\s/g, '').length : n.textContent.trim().split(/\s+/).filter(Boolean).length), 0);
    const step = Math.min(base, .8 / Math.max(1, units - 1));
    let k = 0;
    for (const n of nodes) {
      const parts = n.textContent.split(el.dataset.a === 'chars' ? /(\s+|)/ : /(\s+)/).filter(x => x !== '' && x !== undefined);
      const frag = document.createDocumentFragment();
      for (const part of parts) {
        if (/^\s+$/.test(part)) { frag.append(part); continue; }
        const w = document.createElement('span');
        w.className = 'w'; w.textContent = part;
        Object.assign(w.dataset, { a: anim, t: (t0 + k++ * step).toFixed(3), d });
        frag.append(w);
      }
      n.replaceWith(frag);
    }
    el.dataset.a = 'none';
  }
  // Ported from HyperFrames char-slam-explode: every glyph starts scattered (seeded offsets up to 1 em across,
  // 0.6 em down, 22° and scale 0.82), holds, then all return with back.out(1.7) over 0.66 s, staggered 0.28 s
  // from the centre out, and the line takes the three-frame impact shake on landing.
  const XPL = { hold: .35, ret: .66, stag: .28 };
  function explode(el) {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
    for (let n; (n = walk.nextNode());) nodes.push(n);
    const total = nodes.reduce((a, n) => a + n.textContent.replace(/\s/g, '').length, 0), c = (total - 1) / 2;
    const r = rng(hash(el.textContent)), t0 = el.dataset.t || 0;
    let k = 0;
    for (const n of nodes) {
      const frag = document.createDocumentFragment();
      for (const part of n.textContent.split(/(\s+)/).filter(Boolean)) {
        if (/^\s+$/.test(part)) { frag.append(part); continue; }
        const word = document.createElement('span'); word.className = 'wd';
        for (const ch of part) {
          const g = document.createElement('span'); g.className = 'w'; g.textContent = ch;
          Object.assign(g.dataset, { a: 'xg', t: t0, x: ((r() * 2 - 1) * 1).toFixed(3), y: ((r() * 2 - 1) * .6).toFixed(3), r: ((r() * 2 - 1) * 22).toFixed(1),
            dl: (XPL.stag * (c > 0 ? Math.abs(k - c) / c : 0)).toFixed(3) });
          word.append(g); k++;
        }
        frag.append(word);
      }
      n.replaceWith(frag);
    }
  }
  function prepare() {
    stage.querySelectorAll('[data-a="type"]').forEach(el => { el.dataset.text = el.dataset.text ?? el.textContent; el.textContent = ''; });
    stage.querySelectorAll('[data-a="words"],[data-a="chars"],[data-a="land"],[data-a="pop"].h1,[data-a="pop"].h2,[data-a="pop"].quote').forEach(el => {
      if (el.dataset.a === 'pop' && !el.matches('.h1,.h2,.quote')) return;
      if (KINETIC[el.dataset.a]) split(el);
    });
    stage.querySelectorAll('[data-a="explode"]').forEach(el => { if (!el.querySelector('.wd')) explode(el); });
  }

  /* ---------- stage background: mesh + grain ---------- */
  // Ported from HyperFrames mesh-gradient-bg (as adapted in the trial's bg composition): three brand-coloured radial
  // fields drift through five poses (sine.inOut per leg) across the whole video while the field turns -4°→4° and
  // scales 1→1.08. Positions are % of the 1512×2688 mesh box (the stage plus 20 % bleed).
  const POSES = [[18, 20, 84, 52, 38, 86], [36, 34, 66, 40, 60, 72], [24, 48, 78, 24, 30, 70], [44, 26, 60, 64, 54, 88], [20, 22, 82, 55, 40, 84]];
  // Ported from HyperFrames grain-overlay: the noise tile jumps between offsets every frame; the offset table
  // comes from a fixed seed instead of a CSS keyframe loop, so it is a pure function of t.
  const JIT = (r => Array.from({ length: 24 }, () => [Math.round((r() * 2 - 1) * 15), Math.round((r() * 2 - 1) * 15)]))(rng(0x9a1e));
  function renderBg(t) {
    if (meshEl) {
      const D = Math.max(.001, window.DURATION), u = clamp(t / D), seg = D / 4, i = Math.min(3, Math.floor(t / seg));
      const k = sineIO(clamp((t - i * seg) / seg)), a = POSES[Math.max(0, i)], b = POSES[Math.max(0, i) + 1];
      const v = a.map((x, j) => x + (b[j] - x) * k);
      blobs.forEach((bl, j) => { bl.style.transform = `translate(${(v[j * 2] * 15.12 - 1050).toFixed(1)}px,${(v[j * 2 + 1] * 26.88 - 1050).toFixed(1)}px)`; });
      meshEl.style.transform = `rotate(${(-4 + 8 * u).toFixed(3)}deg) scale(${(1 + .08 * u).toFixed(4)})`;
    }
    if (grainEl) { const j = JIT[Math.floor(Math.max(0, t) * 30 + 1e-6) % JIT.length]; grainEl.style.transform = `translate(${j[0]}%,${j[1]}%)`; }
  }

  /* ---------- transitions ---------- */
  // Each returns the incoming (enter) or outgoing (leave) scene state at progress u of the transition.
  // Base timings are from the HyperFrames trial; a custom `dur` scales them proportionally.
  const ENTER = {
    fade: u => ({ o: u }),
    // push: ported from the trial's catalog push (power3.inOut, 0.55 s) with a vertical-only motion blur.
    push: u => { const k = P3.io(u); return { tf: `translateY(${((1 - k) * 1920).toFixed(1)}px)`, fl: 'url(#rs-vb)', vb: pushBlur(u) }; },
    wipe: u => ({ clip: `inset(0 ${(1 - eo(u)) * 100}% 0 0)` }),
    // Ported from HyperFrames zoom-through-transition: incoming starts 0.12 s in, from scale 0.55 and blur 10 px (power3.out 0.45 s).
    zoom: u => { const k = P3.o(clamp((u - .12 / .57) / (.45 / .57))); return { o: k, tf: `scale(${(.55 + .45 * k).toFixed(4)})`, fl: k < 1 ? `blur(${(10 * (1 - k)).toFixed(2)}px)` : '' }; },
    // Ported from HyperFrames whip-pan-cut: one power3.inOut travel; horizontal-only blur peaks (40 px) at mid-whip.
    whip: u => { const k = P3.io(u); return { tf: `translateX(${((1 - k) * 1080).toFixed(1)}px)`, fl: 'url(#rs-hb)', hb: u < .5 ? 40 * P3.i(u / .5) : 40 * (1 - P3.o((u - .5) / .5)) }; },
    // Ported from HyperFrames chromatic-aberration-wipe: clip edge sweeps left→right while the scene settles from x 60, scale 1.04.
    chroma: u => { const k = P3.io(u); return { clip: `inset(0 ${((1 - k) * 100).toFixed(2)}% 0 0)`, tf: `translateX(${(60 * (1 - k)).toFixed(1)}px) scale(${(1.04 - .04 * k).toFixed(4)})`, fx: u }; },
    // Blur crossfade (catalog transitions-blur recipe from the trial): incoming from blur 15, scale 0.95 at 0.2 s, power2.out 0.5 s.
    blur: u => { const k = P2.o(clamp((u - .2 / .7) / (.5 / .7))); return { o: k, tf: `scale(${(.95 + .05 * k).toFixed(4)})`, fl: k < 1 ? `blur(${(15 * (1 - k)).toFixed(2)}px)` : '' }; },
  };
  const LEAVE = {
    push: u => ({ tf: `translateY(${(-P3.io(u) * 1920).toFixed(1)}px)`, fl: 'url(#rs-vb)' }),
    wipe: u => ({ clip: `inset(0 0 0 ${eo(u) * 100}%)` }),
    // zoom-through: the outgoing scene flies past, scale 1→2.4, blur 0→10 px and fades (power3.in 0.45 s).
    zoom: u => { const k = P3.i(clamp(u / (.45 / .57))); return { o: 1 - k, tf: `scale(${(1 + 1.4 * k).toFixed(4)})`, fl: `blur(${(10 * k).toFixed(2)}px)` }; },
    whip: u => ({ tf: `translateX(${(-P3.io(u) * 1080).toFixed(1)}px)`, fl: 'url(#rs-hb)' }),
    chroma: u => { const k = P3.io(u); return { clip: `inset(0 0 0 ${(k * 100).toFixed(2)}%)`, tf: `translateX(${(-70 * k).toFixed(1)}px) scale(${(1 - .04 * k).toFixed(4)})`, fl: `blur(${(5 * k).toFixed(2)}px)` }; },
    blur: u => { const k = P2.i(clamp(u / (.45 / .7))); return { o: 1 - k, tf: `scale(${(1 + .05 * k).toFixed(4)})`, fl: `blur(${(15 * k).toFixed(2)}px)` }; },
  };
  // push blur: yoyo 0→12 px→0 (power2.in both ways) starting 0.03 s in, 0.25 s each way (trial timings over 0.55 s).
  const pushBlur = u => { const w = u * .55 - .03; return w <= 0 || w >= .5 ? 0 : 12 * P2.i(w < .25 ? w / .25 : (.5 - w) / .25); };
  // chroma overlays: a white sheen sweeps across (0.16–0.74 s, power2.inOut) and a red/cyan split flickers in
  // 0.07 s steps between 0.3 and 0.6 s (times on the 0.8 s base).
  function renderFx(u) {
    const q = u == null ? -1 : u * .8;
    const sh = q >= .16 && q < .76, on = q >= .3 && q < .6 && Math.floor((q - .3) / .07) % 2 === 1;
    sheen.style.display = sh ? 'block' : 'none';
    if (sh) sheen.style.transform = `translateX(${(-110 + 220 * P2.io(clamp((q - .16) / .58))).toFixed(1)}%)`;
    rgb.style.display = on ? 'block' : 'none';
    if (on) rgb.style.transform = 'translateX(16px)';
  }

  window.render = function (t) {
    renderBg(t);
    let hb = 0, vb = 0, fx = null;
    stage.querySelectorAll('.scene').forEach((sc, idx, all) => {
      const s = +sc.dataset.s, e = +sc.dataset.e, isLast = idx === all.length - 1;
      // A scene's transition plays over the first `td` seconds of that scene; the outgoing scene stays visible
      // underneath (or moves away) during it, except for fade, which dips through the background.
      const tin = sc.dataset.tr, din = +sc.dataset.td, nx = all[idx + 1];
      const tout = nx ? nx.dataset.tr : 'cut', dout = nx ? +nx.dataset.td : 0;
      const tail = isLast ? 1 : ['fade', 'cut'].includes(tout) ? 0 : dout;
      let o = 1, clip = '';
      const tf = [], fl = [];
      const apply = r => {
        if (!r) return;
        if (r.o !== undefined) o = Math.min(o, r.o);
        if (r.tf) tf.push(r.tf);
        if (r.fl) fl.push(r.fl);
        if (r.clip) clip = r.clip;
        if (r.hb !== undefined) hb = r.hb;
        if (r.vb !== undefined) vb = r.vb;
        if (r.fx !== undefined) fx = r.fx;
      };
      if (t < s || t > e + tail) o = 0;
      else {
        if (t < s + din && ENTER[tin]) apply(ENTER[tin](clamp((t - s) / din)));
        if (!isLast && tout === 'fade') o = Math.min(o, clamp((e - t) / dout));
        else if (!isLast && t > e && LEAVE[tout]) apply(LEAVE[tout](clamp((t - e) / dout)));
      }
      sc.style.transform = tf.join(' '); sc.style.filter = fl.join(' '); sc.style.clipPath = clip;
      sc.style.opacity = o;
      sc.style.display = o <= 0 ? 'none' : 'block';
      if (o <= 0) return;
      const lt = t - s, span = e - s;
      sc.querySelectorAll('[data-a]').forEach(el => {
        const t0 = +(el.dataset.t || 0), d = +(el.dataset.d || .55), a = el.dataset.a;
        const p = clamp((lt - t0) / d);
        let op = 1, tr = '';
        switch (a) {
          case 'up': op = eo(p); tr = `translateY(${(1 - eo(p)) * 70}px)`; break;
          case 'left': op = eo(p); tr = `translateX(${(1 - eo(p)) * -90}px)`; break;
          case 'fade': op = p; break;
          case 'pop': op = clamp(p * 3); tr = `scale(${.5 + .5 * eb(p)})`; break;
          case 'kb': tr = `scale(${1.05 + .1 * (lt / span)})`; break;
          case 'grow': el.style.transformOrigin = 'left'; tr = `scaleX(${eo(p)})`; break;
          case 'growc': tr = `scaleX(${P3.o(p)})`; break;
          case 'bar': el.style.transformOrigin = 'left'; tr = `scaleX(${p})`; break;
          case 'show': op = lt >= t0 ? 1 : 0; break;
          case 'on': el.classList.toggle('on', lt >= t0); break;
          case 'tap': op = lt < t0 ? 0 : (1 - p); tr = `scale(${.4 + p})`; break;
          case 'type': {
            const full = el.dataset.text || '', n = Math.round(full.length * p);
            el.textContent = lt < t0 ? '' : full.slice(0, n);
            el.classList.toggle('caret', lt >= t0 - .3 && p < 1 && Math.floor(lt * 3) % 2 === 0);
            break;
          }
          case 'count': {
            const from = +el.dataset.from, to = +el.dataset.to, dec = +(el.dataset.dec || 0);
            const v = fmt(from + (to - from) * (el.dataset.ease === 'sine' ? sineIO(p) : eo(p)), dec), pre = el.dataset.pre || '', suf = el.dataset.suf || '';
            if (el.dataset.split) {
              // count-up affix: the decimals and suffix sit smaller beside the whole number
              const i = dec ? v.lastIndexOf(B.decimalSep ?? '.') : -1, h = `${pre}${i >= 0 ? v.slice(0, i) : v}<span class="aff">${i >= 0 ? v.slice(i) : ''}${suf}</span>`;
              if (el.__h !== h) { el.innerHTML = h; el.__h = h; }
            } else el.textContent = pre + v + suf;
            break;
          }
          case 'rise': { const k = 1 - Math.pow(2, -10 * p); op = clamp(p * 2.5); tr = `translateY(${(1 - k) * 0.45}em)`; break; }
          case 'landw': { const k = P3.o(p); op = k; tr = `translateY(${((1 - k) * 58).toFixed(1)}px)`; break; }
          case 'mask': op = p > 0 ? 1 : 0; el.style.clipPath = `inset(0 0 ${(1 - eo(p)) * 100}% 0)`; tr = `translateY(${(1 - eo(p)) * 40}px)`; break;
          // Ported from HyperFrames headline-slam: scale 1.6→1 with expo.out over 0.58 s, three-frame shake, quiet drift.
          case 'slam': {
            const q = lt - t0, k = expoOut(clamp(q / .58)), [sx, sy] = shake(q - .58);
            op = q < 0 ? 0 : k;
            tr = `translate(${sx.toFixed(2)}px,${(sy + drift(q - .72, span - t0 - .72, 2.5)).toFixed(2)}px) scale(${(1.6 - .6 * k).toFixed(4)})`;
            break;
          }
          case 'explode': {   // the line itself: impact shake when the glyphs land, then a small drift
            const land = XPL.hold + XPL.ret + XPL.stag, q = lt - t0, [sx, sy] = shake(q - land);
            tr = `translate(${sx.toFixed(2)}px,${(sy + drift(q - land - .1, span - t0 - land - .4, 2)).toFixed(2)}px)`;
            break;
          }
          case 'xg': {
            const q = lt - t0, k = backOut(1.7)(clamp((q - XPL.hold - +el.dataset.dl) / XPL.ret)), m = 1 - k;
            op = clamp(q / .12);
            tr = `translate(${(+el.dataset.x * m).toFixed(3)}em,${(+el.dataset.y * m).toFixed(3)}em) rotate(${(+el.dataset.r * m).toFixed(2)}deg) scale(${(.82 + .18 * k).toFixed(4)})`;
            break;
          }
          case 'ken': {
            // Slow zoom in or out with a gentle pan; the scale never drops below 1.06 so the pan never shows an edge.
            const k = .5 - .5 * Math.cos(Math.PI * p), z = el.dataset.z === 'out' ? 1.16 - .10 * k : 1.06 + .10 * k;
            const dir = { left: -1, right: 1 }[el.dataset.p] || 0;
            tr = `translateX(${dir * (k - .5) * 60}px) scale(${z})`;
            break;
          }
          case 'clock': {
            const v = Math.max(0, +el.dataset.from - Math.max(0, lt - t0)), h = Math.floor(v / 3600), m = Math.floor(v % 3600 / 60), x = Math.floor(v % 60);
            el.textContent = (h ? [h, m, x] : [m, x]).map(n => String(n).padStart(2, '0')).join(':');
            break;
          }
          // stories (from the trial's s2-photos): counter slides in 20 px, caption rises 110 % through its mask
          case 'cnt': { const k = P2.o(p); op = k; tr = `translateX(${((1 - k) * -20).toFixed(1)}px)`; break; }
          case 'mrise': op = lt >= t0 ? 1 : 0; tr = `translateY(${((1 - P4.o(p)) * 110).toFixed(2)}%)`; break;
          // Ported from HyperFrames count-up: arrival plus one landing pulse to 1.07 (power3.out up, power2.out back).
          case 'cu': {
            const k = clamp((lt - t0) / .38), q = lt - +el.dataset.land;
            let z = .98 + .02 * P3.o(k);
            if (q >= 0 && q < .165) z *= 1 + .07 * P3.o(q / .165);
            else if (q >= .165 && q < .33) z *= 1.07 - .07 * P2.o((q - .165) / .165);
            op = P2.o(k); tr = `translateY(${((1 - P3.o(k)) * 11).toFixed(2)}px) scale(${z.toFixed(4)})`;
            break;
          }
          // Ported from HyperFrames spring-pop: scale 0.8→1 back.out(2) over 0.6 s, opacity in 0.3 s; settles at -8° (back.out(2), 0.5 s).
          case 'spring': {
            const q = lt - t0;
            op = P2.o(clamp(q / .3));
            tr = `rotate(${(-8 * backOut(2)(clamp(q / .5))).toFixed(2)}deg) scale(${(.8 + .2 * backOut(2)(clamp(q / .6))).toFixed(4)})`;
            break;
          }
          // cta-close capsule and its glow (the glow swell is from the trial's s6-cta; it keeps pulsing 1→1.15 every 1.4 s)
          case 'btn': { const q = lt - t0, k = backOut(1.5)(clamp(q / .6)); op = P2.o(clamp(q / .22)); tr = `translateY(${((1 - k) * 22).toFixed(1)}px) scale(${(.85 + .15 * k).toFixed(4)})`; break; }
          case 'glow': {
            const q = lt - t0, k = P2.o(clamp(q / .6));
            const z = (.6 + .4 * k) * (q > .65 ? 1 + .075 * (1 - Math.cos(2 * Math.PI * (q - .65) / 1.4)) : 1);
            op = k; tr = `scale(${z.toFixed(4)})`;
            break;
          }
          // testimonial-proof-card / star-rating-fill
          case 'draw': op = lt >= t0 ? 1 : 0; el.style.strokeDashoffset = (100 * (1 - P2.io(p))).toFixed(2); break;
          case 'starfill': el.style.clipPath = `inset(0 ${(100 - +el.dataset.v * P2.o(p)).toFixed(2)}% 0 0)`; break;
          case 'scount': { const h = (+el.dataset.to * P2.o(p)).toFixed(1).replace('.', B.decimalSep ?? '.'); if (el.textContent !== h) el.textContent = h; break; }
          case 'pulse': tr = `scale(${(p <= 0 || p >= 1 ? 1 : p < .45 ? 1 + .06 * P2.o(p / .45) : 1.06 - .06 * P2.o((p - .45) / .55)).toFixed(4)})`; break;
          case 'breathe': tr = `scale(${(1 + .025 * sineIO(clamp((lt - t0) / Math.max(.1, span - t0)))).toFixed(4)})`; break;
          // logo-brand-close: per-letter rise and the wordmark's settle from 1.04
          case 'lbl': { const k = expoOut(p); op = lt < t0 ? 0 : k; tr = `translateY(${((1 - k) * .62).toFixed(3)}em)`; break; }
          case 'wmset': tr = `scale(${(1.04 - .04 * expoOut(p)).toFixed(4)})`; break;
        }
        if (el.dataset.o !== undefined) op *= 1 - clamp((lt - +el.dataset.o) / .3);
        if (!['on', 'type', 'count', 'clock', 'scount', 'starfill'].includes(a)) { el.style.opacity = op; el.style.transform = tr; }
      });
    });
    hBlur.setAttribute('stdDeviation', `${hb.toFixed(2)} 0`);
    vBlur.setAttribute('stdDeviation', `0 ${vb.toFixed(2)}`);
    renderFx(fx);
    renderSubs(t);
    window.__T = t;
  };

  /* ---------- subtitles: word-by-word captions from the voiceover lines ---------- */
  // Timing is estimated from the speech rate in the player; render injects the real clip timings via setVoTiming.
  const SUBS_ON = S.subtitles ?? B.subtitles ?? false;
  // subtitleStyle "pill" is ported from HyperFrames caption-pill-karaoke (as adapted in the trial's captions):
  // the chunk rises into a dark pill (0.14 s power2.out, from y 18 and scale 0.94) and the spoken word takes the accent with a 1.08 pop.
  const PILL = (S.subtitleStyle ?? B.subtitleStyle) === 'pill';
  const subs = document.createElement('div'); subs.className = PILL ? 'subs spill' : 'subs';
  const plain = x => String(x).replace(/\*\*|!!|\+\+|<[^>]+>/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function chunkLines(lines) {
    const per = S.subtitleWords ?? B.subtitleWords ?? 3, out = [];
    for (const l of lines) {
      const words = plain(l.text).split(/\s+/).filter(Boolean);
      if (!words.length) continue;
      const wt = words.map(w => w.length + 2), tot = wt.reduce((a, b) => a + b, 0);
      let at = l.start, cur = [];
      const timed = words.map((w, i) => { const x = { w, s: at }; at += (l.end - l.start) * wt[i] / tot; return x; });
      timed.forEach((x, i) => {
        cur.push(x);
        const last = i === timed.length - 1;
        const long = !last && timed[i + 1].s - cur[0].s > 1.2;
        if (cur.length >= per || long || /[.,!?;:…]$/.test(x.w) || last) { out.push({ s: cur[0].s, e: last ? l.end : timed[i + 1].s, words: cur }); cur = []; }
      });
    }
    return out;
  }
  function estimateLines() {
    const rate = S.voiceRate ?? 185, items = [];
    scenes.forEach(sc => {
      if (!sc.vo) return;
      (typeof sc.vo === 'string' ? [{ at: .15, text: sc.vo }] : sc.vo).forEach(v => items.push({ start: sc.s + (v.at ?? .15), text: v.text, rate: v.rate || rate }));
    });
    items.sort((a, b) => a.start - b.start);
    return items.map((l, i) => ({ ...l, end: Math.min(l.start + plain(l.text).split(/\s+/).length * 60 / l.rate + .2, (items[i + 1]?.start ?? window.DURATION + 1.5) - .12) }));
  }
  let CHUNKS = SUBS_ON ? chunkLines(estimateLines()) : [], lastChunk = null;
  window.setVoTiming = lines => { CHUNKS = SUBS_ON ? chunkLines(lines) : []; lastChunk = undefined; };
  if (window.VO_TIMING) window.setVoTiming(window.VO_TIMING);   // baked in by the HyperFrames build
  function renderSubs(t) {
    const lead = PILL ? .08 : 0;
    const c = CHUNKS.find(x => t >= x.s - lead && t < x.e) || null;
    if (c !== lastChunk) { subs.innerHTML = c ? `<span class="chunk">${c.words.map(w => `<span>${w.w}</span>`).join(' ')}</span>` : ''; lastChunk = c; }
    if (!c) return;
    if (PILL) {
      const k = P2.o(clamp((t - (c.s - lead)) / .14)), chunk = subs.firstChild;
      chunk.style.opacity = k; chunk.style.transform = `translateY(${((1 - k) * 18).toFixed(1)}px) scale(${(.94 + .06 * k).toFixed(4)})`;
      const on = c.words.reduce((a, w, i) => t >= w.s - .04 ? i : a, -1);
      subs.querySelectorAll('.chunk > span').forEach((el, i) => {
        const q = t - (c.words[i].s - .04);
        el.classList.toggle('on', i === on);
        el.style.transform = `scale(${(q < 0 || q >= .16 ? 1 : q < .08 ? 1 + .08 * P2.o(q / .08) : 1 + .08 * P2.o(1 - (q - .08) / .08)).toFixed(4)})`;
      });
      return;
    }
    // Each word pops in at its own start (0.6 → 1 over 0.26 s with overshoot); only the active word takes the accent.
    const active = c.words.reduce((k, w, i) => t >= w.s ? i : k, 0);
    subs.querySelectorAll('.chunk > span').forEach((el, i) => {
      const p = clamp((t - c.words[i].s) / .26);
      el.classList.toggle('on', i === active);
      el.style.opacity = t < c.words[i].s ? 0 : 1;
      el.style.transform = `scale(${.6 + .4 * eb(p)})`;
    });
  }

  /* ---------- safe zones: union of the target platforms' UI overlays (window.ZONES from the CLI) ---------- */
  const ZONES = window.ZONES || [
    { name: 'Top UI', x: 0, y: 0, w: 1080, h: 220 }, { name: 'Caption / CTA', x: 0, y: 1500, w: 1080, h: 420 },
    { name: 'Buttons', x: 930, y: 900, w: 150, h: 600 }];
  const seen = el => {
    for (let e = el; e && e !== stage; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .5) return false;
    }
    return true;
  };
  // Visible text at the current time whose glyphs overlap a zone. The watermark and safe overlay are exempt.
  window.safeCheck = function () {
    const out = [], base = stage.getBoundingClientRect(), k = base.width / 1080, range = document.createRange();
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
      if (!n.textContent.trim() || !el.closest('.scene') || el.closest('.wm,#safe,.subs,.bgfx,.fxdefs') || !seen(el)) continue;
      const block = el.closest('.h1,.h2,.h3,.p,.small,.kick,.pill,.num,.fact,.row,.chk,.bub,.chipx,.logo,.scr,.quote,.scap,.srf,.now,.badge') || el;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) hit(r, block.textContent.trim().replace(/\s+/g, ' ').slice(0, 40));
    }
    stage.querySelectorAll('.scene .logo img, .scene .pill img').forEach(img => seen(img) && hit(img.getBoundingClientRect(), 'logo'));
    return out.filter((x, i) => out.findIndex(y => y.text === x.text && y.zone === x.zone) === i);
  };

  /* ---------- mount ---------- */
  function mount() {
    // Subtitles sit just above the caption/CTA zone of the target platforms.
    const capZone = ZONES.find(z => z.name === 'Caption / CTA');
    subs.style.bottom = (capZone ? 1920 - capZone.y + 40 : 520) + 'px';
    stage.insertBefore(subs, stage.querySelector('.wm'));
    if (RENDER) {
      document.body.className = 'render';
      document.body.appendChild(stage);
      prepare(); render(0);
      return;
    }
    // Inside a HyperFrames composition: mount on its root and let HyperFrames own the clock.
    // render(t) is a pure function of time, so it is registered as a seekable runtime.
    if (window.HYPERFRAMES) {
      document.getElementById('root').appendChild(stage);
      prepare(); render(0);
      (window.__hfAnime = window.__hfAnime || []).push({ seek: ms => render(ms / 1000), pause() {}, play() {} });
      return;
    }
    // Interactive player (scrub, safe zones, scene jumps) lives in engine/player.js, loaded only by player.html.
    window.REEL_PLAYER({ stage, ZONES, prepare, voText });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
