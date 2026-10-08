/* Reel Studio engine. Expects window.BRAND and window.SPEC (injected by bin/reel.mjs build).
 * Exposes window.render(t), window.DURATION, window.SCENES. In player mode adds scrub controls. */
(function () {
  const B = window.BRAND, S = window.SPEC;
  const RENDER = new URLSearchParams(location.search).has('render');

  /* ---------- math & number helpers ---------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const eo = p => 1 - Math.pow(1 - p, 3);
  const eb = p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
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

  /* ---------- scene generators: (scene) => inner HTML. Local times (data-t) are seconds from scene start. ---------- */
  const T = {};
  const bgLayer = sc => sc.bg ? `<div class="bg ${sc.bgFull ? 'full' : ''}" style="background-image:url('${sc.bg}');background-position:${sc.bgPos || 'center'} center" data-a="kb"></div><div class="shade"></div>` : '';

  T.hook = sc => `${bgLayer(sc)}
    <div class="box" style="top:${sc.top ?? (sc.bg ? 980 : 600)}px">
      ${sc.kicker ? `<div class="kick" data-t="0" data-a="fade" data-d=".2">${md(sc.kicker)}</div>` : ''}
      <div class="h1" style="margin-top:36px" data-t=".05" data-a="up">${md(sc.title)}</div>
      ${sc.sub ? `<div class="${sc.subSize || 'h2'} acc" style="margin-top:40px" data-t="1" data-a="up">${md(sc.sub)}</div>` : ''}
    </div>`;

  T.number = sc => `${bgLayer(sc)}
    <div class="box" style="top:${sc.top ?? 520}px">
      ${sc.kicker ? `<div class="kick" data-t="0" data-a="fade" data-d=".2">${md(sc.kicker)}</div>` : ''}
      <div class="num" style="margin-top:50px" data-t="0" data-a="count" data-from="${sc.from ?? 0}" data-to="${sc.value}" data-d="${sc.countDur ?? 1.2}" data-suf="${sc.suffix ?? ''}" data-pre="${sc.prefix ?? ''}"></div>
      ${sc.title ? `<div class="h1" style="margin-top:30px" data-t=".3" data-a="up">${md(sc.title)}</div>` : ''}
      ${sc.sub ? `<div class="h2 acc" style="margin-top:60px" data-t="1.4" data-a="up">${md(sc.sub)}</div>` : ''}
    </div>`;

  T.statement = sc => `${bgLayer(sc)}
    <div class="box ${sc.center ? 'center' : ''}" style="top:${sc.top ?? 600}px">
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

  T.cta = sc => `<div class="box center" style="top:${sc.top ?? 640}px">
      <div class="h2" data-t="0" data-a="up">${md(sc.title)}</div>
      <div style="margin-top:70px" data-t=".4" data-a="pop"><span class="pill" style="font-size:${(sc.pill || B.url || '').length > 14 ? 56 : 64}px">${md(sc.pill || B.url)}</span></div>
      ${sc.sub ? `<div class="p" style="margin-top:70px" data-t=".9" data-a="up">${md(sc.sub)}</div>` : ''}
    </div>`;

  T.end = sc => `<div class="box center" style="top:560px">
      <div class="logo" data-t="0" data-a="pop" data-d=".6">${wordmark()}</div>
      <div style="display:flex;justify-content:center;margin-top:26px"><div class="bar" data-t=".35" data-a="grow" data-d=".5" style="width:260px"></div></div>
      ${(sc.line ?? B.endLine) ? `<div class="h2" style="margin-top:70px" data-t=".5" data-a="up">${md(sc.line ?? B.endLine)}</div>` : ''}
      ${B.url ? `<div style="margin-top:80px" data-t=".9" data-a="pop"><span class="pill">${B.url}</span></div>` : ''}
      ${(sc.tagline ?? B.tagline) ? `<div class="p" style="margin-top:60px;color:var(--muted)" data-t="1.3" data-a="up">${md(sc.tagline ?? B.tagline)}</div>` : ''}
    </div>`;

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
      ${ps.map((p, i) => p.caption ? `<div class="box" style="top:${sc.capTop ?? 1060}px"><div class="h2" data-t="${p.s + .25}" data-a="up" ${i === ps.length - 1 ? '' : `data-o="${p.s + p.d - .15}"`}>${md(p.caption)}</div></div>` : '').join('')}`;
  };

  // Price / promo reveal: old price struck through, new price counting down to it, badge, promo code, optional live countdown.
  const secsOf = v => typeof v === 'number' ? v : String(v).split(':').reduce((a, x) => a * 60 + +x, 0);
  T.promo = sc => {
    const dec = sc.decimals ?? (String(sc.now ?? '').split('.')[1] || '').length;
    const pre = sc.prefix ?? '', suf = sc.suffix ?? '', num = v => (pre + fmt(+v, dec) + suf);
    const t1 = sc.was != null ? 1.5 : .4;   // the new price lands ~0.25 s after the strike-through finishes
    return `${bgLayer(sc)}<div class="box center" style="top:${sc.top ?? (sc.code && sc.countdown != null ? 300 : 420)}px">
      ${sc.kicker ? `<div class="kick" data-t="0" data-a="fade" data-d=".2">${md(sc.kicker)}</div>` : ''}
      ${sc.title ? `<div class="h2" style="margin-top:40px" data-t=".1" data-a="up">${md(sc.title)}</div>` : ''}
      ${sc.was != null ? `<div style="margin-top:56px" data-t=".45" data-a="up"><span class="was">${num(sc.was)}<i class="strike" data-t=".85" data-a="grow" data-d=".4"></i></span></div>` : ''}
      <div style="margin-top:10px" data-t="${t1}" data-a="pop"><span class="now" ${sc.was != null ? `data-a="count" data-t="${t1}" data-d=".9" data-from="${sc.was}" data-to="${sc.now}" data-dec="${dec}" data-pre="${pre}" data-suf="${suf}"` : ''}>${num(sc.now)}</span></div>
      ${sc.badge ? `<div style="margin-top:26px" data-t="${t1 + .8}" data-a="pop"><span class="badge">${md(sc.badge)}</span></div>` : ''}
      ${sc.code ? `<div style="margin-top:60px" data-t="${t1 + 1.2}" data-a="up"><div class="small">${md(sc.codeLabel ?? 'Code')}</div><span class="code" data-a="type" data-t="${t1 + 1.4}" data-d=".5">${sc.code}</span></div>` : ''}
      ${sc.countdown != null ? `<div style="margin-top:50px" data-t="${t1 + (sc.code ? 1.8 : 1.2)}" data-a="up">${sc.until ? `<div class="small">${md(sc.until)}</div>` : ''}<span class="clock" data-a="clock" data-from="${secsOf(sc.countdown)}"></span></div>`
        : sc.until ? `<div class="p" style="margin-top:50px" data-t="${t1 + 1.2}" data-a="up">${md(sc.until)}</div>` : ''}
    </div>`;
  };

  // Testimonial card: stars fill in, the quote reveals word by word, then the author.
  T.testimonial = sc => {
    const hasStars = sc.stars != null && sc.stars !== false, n = clamp(+sc.stars, 0, 5);
    const words = String(sc.quote || '').split(/\s+/).length, tq = .3, ts = tq + Math.min(.8, words * .06) + .45;
    const ta = ts + (hasStars ? .6 : 0);
    const initials = String(sc.author || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    return `${bgLayer(sc)}<div class="box" style="top:${sc.top ?? 420}px"><div class="tcard" data-t="0" data-a="up">
      <div class="quote" data-t="${tq}" data-a="${sc.reveal || 'words'}">${md('“' + String(sc.quote || '').replace(/(\*\*|!!|\+\+)?$/, '”$1'))}</div>
      ${hasStars ? `<div class="stars">${[0, 1, 2, 3, 4].map(i => `<span class="star" style="--f:${clamp(n - i) * 100}%" data-t="${ts + i * .1}" data-a="pop" data-d=".4">★</span>`).join('')}</div>` : ''}
      <div class="who" data-t="${ta}" data-a="up">
        <div class="av">${sc.avatar ? `<img src="${sc.avatar}" alt="">` : initials}</div>
        <div><b>${md(sc.author || '')}</b>${sc.role || sc.source ? `<small>${md([sc.role, sc.source].filter(Boolean).join(' · '))}</small>` : ''}</div>
      </div></div></div>`;
  };

  T.html = sc => sc.html || '';
  const voText = vo => !vo ? '' : typeof vo === 'string' ? vo : vo.map(v => v.text).join(' / ');

  /* ---------- default durations ---------- */
  const autoDur = sc => {
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
      case 'cta': return 2.8;
      case 'end': return 2.5;
      case 'phone': return (sc.steps || []).reduce((a, st) => a + (st.dur ?? 2.8), 0) + .6;
      case 'photos': return photoList(sc).reduce((a, p) => a + p.d, 0) + .2;
      case 'promo': return (sc.was != null ? 3.8 : 2.8) + (sc.code ? 1.6 : 0) + (sc.countdown != null || sc.until ? .9 : 0);
      case 'testimonial': { const w = String(sc.quote || '').split(/\s+/).length; return +(.3 + Math.min(.8, w * .06) + 1.4 + Math.max(3, w * .28)).toFixed(2); }
      default: return 4;
    }
  };

  // Scene transitions (into a scene) and their default durations in seconds.
  const TRANS = { fade: .3, cut: 0, push: .45, wipe: .5, zoom: .5, whip: .3 };

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
  stage.className = 'stage'; stage.id = 'stage';
  stage.innerHTML = scenes.map((sc, i) => {
    if (!T[sc.type]) throw new Error(`Unknown scene type "${sc.type}" (scene ${i + 1})`);
    const tr = i === 0 ? 'cut' : (sc.transition ?? S.transition ?? 'fade');
    const type = typeof tr === 'string' ? tr : tr.type, td = (typeof tr === 'object' && tr.dur) || TRANS[type];
    if (TRANS[type] === undefined) throw new Error(`Unknown transition "${type}" (scene ${i + 1}). Use: ${Object.keys(TRANS).join(', ')}`);
    return `<div class="scene" data-s="${sc.s}" data-e="${sc.e}" data-tr="${type}" data-td="${td}">${T[sc.type](sc)}</div>`;
  }).join('') + (B.watermark === false || S.watermark === false ? '' : `<div class="wm">${B.logoSmall ? `<img src="${B.logoSmall}" style="height:48px">` : wordmark()}</div>`);

  // Kinetic headlines: scene "reveal" (or spec-wide) turns the headline slide-up into words / chars / pop / mask reveals.
  stage.querySelectorAll(':scope > .scene').forEach((el, i) => {
    const r = scenes[i]?.reveal ?? S.reveal;
    if (r && r !== 'up') el.querySelectorAll('.h1[data-a="up"], .h2[data-a="up"]').forEach(h => { h.dataset.a = r; });
  });

  /* ---------- animation ---------- */

  // Stagger (s) and per-unit animation for kinetic reveals.
  // Group reveals are capped at ~0.8 s so long lines don't drag (reference/motion/typography-and-captions.md).
  const KINETIC = { words: [.06, 'rise'], chars: [.03, 'rise'], pop: [.07, 'pop'] };
  function split(el) {
    const [base, anim] = KINETIC[el.dataset.a], t0 = +(el.dataset.t || 0), d = el.dataset.d || .45;
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
  function prepare() {
    stage.querySelectorAll('[data-a="type"]').forEach(el => { el.dataset.text = el.dataset.text ?? el.textContent; el.textContent = ''; });
    stage.querySelectorAll('[data-a="words"],[data-a="chars"],[data-a="pop"].h1,[data-a="pop"].h2,[data-a="pop"].quote').forEach(el => {
      if (el.dataset.a === 'pop' && !el.matches('.h1,.h2,.quote')) return;
      if (KINETIC[el.dataset.a]) split(el);
    });
  }

  window.render = function (t) {
    const total = window.DURATION;
    stage.querySelectorAll('.scene').forEach((sc, idx, all) => {
      const s = +sc.dataset.s, e = +sc.dataset.e, isLast = idx === all.length - 1;
      // A scene's transition plays over the first `td` seconds of that scene; the outgoing scene stays visible
      // underneath (or moves away) during it, except for fade, which dips through the background.
      const tin = sc.dataset.tr, din = +sc.dataset.td, nx = all[idx + 1];
      const tout = nx ? nx.dataset.tr : 'cut', dout = nx ? +nx.dataset.td : 0;
      const tail = isLast ? 1 : ['fade', 'cut'].includes(tout) ? 0 : dout;
      let o = 1, clip = '';
      const tf = [], fl = [];
      if (t < s || t > e + tail) o = 0;
      else {
        if (t < s + din) {
          const q = clamp((t - s) / din), k = eo(q);
          switch (tin) {
            case 'fade': o = Math.min(o, q); break;
            case 'push': tf.push(`translateY(${(1 - k) * 1920}px)`); break;
            case 'wipe': clip = `inset(0 ${(1 - k) * 100}% 0 0)`; break;
            case 'zoom': o = Math.min(o, q); tf.push(`scale(${1.08 - .08 * k})`); break;
            case 'whip': tf.push(`translateX(${(1 - k) * 1080}px)`); fl.push(`blur(${(Math.sin(Math.PI * q) * 28).toFixed(1)}px)`); break;
          }
        }
        if (!isLast && tout === 'fade') o = Math.min(o, clamp((e - t) / dout));
        else if (!isLast && t > e) {
          const q = clamp((t - e) / dout), k = eo(q);
          switch (tout) {
            case 'push': tf.push(`translateY(${-k * 1920}px)`); break;
            case 'zoom': o = Math.min(o, 1 - q); tf.push(`scale(${1 + .15 * k})`); break;
            case 'whip': tf.push(`translateX(${-k * 1080}px)`); fl.push(`blur(${(Math.sin(Math.PI * q) * 28).toFixed(1)}px)`); break;
          }
        }
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
          case 'on': el.classList.toggle('on', lt >= t0); break;
          case 'tap': op = lt < t0 ? 0 : (1 - p); tr = `scale(${.4 + p})`; break;
          case 'type': {
            const full = el.dataset.text || '', n = Math.round(full.length * p);
            el.textContent = lt < t0 ? '' : full.slice(0, n);
            el.classList.toggle('caret', lt >= t0 - .3 && p < 1 && Math.floor(lt * 3) % 2 === 0);
            break;
          }
          case 'count': {
            const from = +el.dataset.from, to = +el.dataset.to;
            el.textContent = (el.dataset.pre || '') + fmt(from + (to - from) * eo(p), +(el.dataset.dec || 0)) + (el.dataset.suf || '');
            break;
          }
          case 'rise': { const k = 1 - Math.pow(2, -10 * p); op = clamp(p * 2.5); tr = `translateY(${(1 - k) * 0.45}em)`; break; }
          case 'mask': op = p > 0 ? 1 : 0; el.style.clipPath = `inset(0 0 ${(1 - eo(p)) * 100}% 0)`; tr = `translateY(${(1 - eo(p)) * 40}px)`; break;
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
        }
        if (el.dataset.o !== undefined) op *= 1 - clamp((lt - +el.dataset.o) / .3);
        if (!['on', 'type', 'count', 'clock'].includes(a)) { el.style.opacity = op; el.style.transform = tr; }
      });
    });
    renderSubs(t);
    window.__T = t;
  };

  /* ---------- subtitles: word-by-word captions from the voiceover lines ---------- */
  // Timing is estimated from the speech rate in the player; render injects the real clip timings via setVoTiming.
  const SUBS_ON = S.subtitles ?? B.subtitles ?? false;
  const subs = document.createElement('div'); subs.className = 'subs';
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
  function renderSubs(t) {
    const c = CHUNKS.find(x => t >= x.s && t < x.e) || null;
    if (c !== lastChunk) { subs.innerHTML = c ? `<span class="chunk">${c.words.map(w => `<span>${w.w}</span>`).join(' ')}</span>` : ''; lastChunk = c; }
    if (!c) return;
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
      if (!n.textContent.trim() || !el.closest('.scene') || el.closest('.wm,#safe') || !seen(el)) continue;
      const block = el.closest('.h1,.h2,.h3,.p,.small,.kick,.pill,.num,.fact,.row,.chk,.bub,.chipx,.logo,.scr') || el;
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
    document.body.className = 'player';
    document.title = `${S.title || S.id || 'Reel'} · Reel Studio`;
    const wrap = document.createElement('div'); wrap.id = 'wrap';
    const safe = document.createElement('div'); safe.id = 'safe';
    safe.innerHTML = ZONES.map(z => `<div style="left:${z.x}px;top:${z.y}px;width:${z.w}px;height:${z.h}px"><span>${z.name}</span></div>`).join('');
    stage.appendChild(safe);
    wrap.appendChild(stage);
    const ctl = document.createElement('div'); ctl.id = 'ctl';
    ctl.innerHTML = `<button id="pp">▶ Play</button><input id="sc" type="range" min="0" max="${window.DURATION}" step="0.01" value="0"><span id="tm"></span>
      <button id="sz" title="${(window.PLATFORMS || []).join(' + ')}">Safe zones${window.PLATFORMS ? ' · ' + window.PLATFORMS.length : ''}</button><button id="lp" class="on">Loop</button>
      <div style="width:100%;display:flex;gap:6px;flex-wrap:wrap;justify-content:center">${window.SCENES.map((x, i) => `<button data-j="${x.s}" title="${voText(x.vo).replace(/"/g, '&quot;')}">${i + 1} · ${x.type} · ${x.s.toFixed(1)}s</button>`).join('')}</div>`;
    document.body.append(wrap, ctl);
    const fit = () => {
      const k = Math.min((innerHeight - ctl.offsetHeight - 30) / 1920, (innerWidth - 24) / 1080);
      stage.style.transform = `scale(${k})`; wrap.style.width = 1080 * k + 'px'; wrap.style.height = 1920 * k + 'px';
    };
    addEventListener('resize', fit);
    prepare();
    let t = (() => { try { return +localStorage.getItem('rs:' + (S.id || '')) || 0; } catch (e) { return 0; } })(), playing = false, last = 0, loop = true;
    const sc = ctl.querySelector('#sc'), tm = ctl.querySelector('#tm'), pp = ctl.querySelector('#pp');
    const show = () => { render(t); sc.value = t; tm.textContent = `${t.toFixed(2)} / ${window.DURATION.toFixed(2)}s`; try { localStorage.setItem('rs:' + (S.id || ''), t); } catch (e) {} };
    const tick = now => {
      if (!playing) return;
      t += (now - last) / 1000; last = now;
      if (t >= window.DURATION) { if (loop) t = 0; else { t = window.DURATION; playing = false; pp.textContent = '▶ Play'; } }
      show(); requestAnimationFrame(tick);
    };
    const toggle = () => { playing = !playing; pp.textContent = playing ? '❚❚ Pause' : '▶ Play'; if (playing) { if (t >= window.DURATION) t = 0; last = performance.now(); requestAnimationFrame(tick); } };
    pp.onclick = toggle;
    sc.oninput = () => { t = +sc.value; show(); };
    ctl.querySelector('#sz').onclick = e => { const on = safe.style.display !== 'block'; safe.style.display = on ? 'block' : 'none'; e.target.classList.toggle('on', on); };
    ctl.querySelector('#lp').onclick = e => { loop = !loop; e.target.classList.toggle('on', loop); };
    ctl.querySelectorAll('[data-j]').forEach((b, i) => b.onclick = () => { const x = window.SCENES[i]; t = x.s + Math.min(1.2, x.dur / 2); show(); });
    addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.code === 'ArrowRight') { t = Math.min(window.DURATION, t + (e.shiftKey ? 1 : 1 / 30)); show(); }
      if (e.code === 'ArrowLeft') { t = Math.max(0, t - (e.shiftKey ? 1 : 1 / 30)); show(); }
    });
    fit(); show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
