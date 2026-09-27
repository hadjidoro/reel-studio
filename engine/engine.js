/* Reel Studio engine. Expects window.BRAND and window.SPEC (injected by bin/reel.mjs build).
 * Exposes window.render(t), window.DURATION, window.SCENES. In player mode adds scrub controls. */
(function () {
  const B = window.BRAND, S = window.SPEC;
  const RENDER = new URLSearchParams(location.search).has('render');

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
    return html.replace(/data-(t|o)="([\d.]+)"/g, (m, k, v) => `data-${k}="${(+v + by).toFixed(2)}"`);
  }

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
      default: return 4;
    }
  };

  /* ---------- timeline ---------- */
  const scenes = (S.scenes || []).map(x => ({ ...x }));
  if (S.end !== false && !scenes.some(x => x.type === 'end')) scenes.push({ type: 'end', ...(S.end || {}) });
  let clock = 0;
  scenes.forEach(sc => { sc.dur = +(sc.dur ?? autoDur(sc)).toFixed(2); sc.s = +clock.toFixed(2); clock += sc.dur; sc.e = +clock.toFixed(2); });
  window.DURATION = +clock.toFixed(2);
  // keys: scene-local times worth a storyboard frame (one per phone step, else the settled end of the scene)
  const keysOf = sc => sc.type === 'phone'
    ? (() => { let t = 0; return (sc.steps || []).map(st => { t += st.dur ?? 2.8; return +(t - .3).toFixed(2); }); })()
    : [+Math.max(.2, Math.min(sc.dur - .35, sc.dur * .85)).toFixed(2)];
  window.SCENES = scenes.map(sc => ({ s: sc.s, e: sc.e, type: sc.type, dur: sc.dur, vo: sc.vo, keys: keysOf(sc) }));

  const stage = document.createElement('div');
  stage.className = 'stage'; stage.id = 'stage';
  stage.innerHTML = scenes.map((sc, i) => {
    if (!T[sc.type]) throw new Error(`Unknown scene type "${sc.type}" (scene ${i + 1})`);
    return `<div class="scene" data-s="${sc.s}" data-e="${sc.e}">${T[sc.type](sc)}</div>`;
  }).join('') + (B.watermark === false || S.watermark === false ? '' : `<div class="wm">${B.logoSmall ? `<img src="${B.logoSmall}" style="height:48px">` : wordmark()}</div>`);

  /* ---------- animation ---------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const eo = p => 1 - Math.pow(1 - p, 3);
  const eb = p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  const group = (B.numberGroup ?? ' ');
  const fmt = n => (n < 0 ? '− ' : '') + Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, group);

  function prepare() {
    stage.querySelectorAll('[data-a="type"]').forEach(el => { el.dataset.text = el.dataset.text ?? el.textContent; el.textContent = ''; });
  }

  window.render = function (t) {
    const total = window.DURATION;
    stage.querySelectorAll('.scene').forEach((sc, idx, all) => {
      const s = +sc.dataset.s, e = +sc.dataset.e, f = .3;
      const isFirst = idx === 0, isLast = idx === all.length - 1;
      let o = 1;
      if (t < s || t > e + (isLast ? 1 : 0)) o = 0;
      else {
        if (!isFirst) o = Math.min(o, clamp((t - s) / f));
        if (!isLast) o = Math.min(o, clamp((e - t) / f));
      }
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
            el.textContent = (el.dataset.pre || '') + fmt(from + (to - from) * eo(p)) + (el.dataset.suf || '');
            break;
          }
        }
        if (el.dataset.o !== undefined) op *= 1 - clamp((lt - +el.dataset.o) / .3);
        if (!['on', 'type', 'count'].includes(a)) { el.style.opacity = op; el.style.transform = tr; }
      });
    });
    window.__T = t;
  };

  /* ---------- mount ---------- */
  function mount() {
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
    // Approximate overlay zones shared by Facebook/Instagram Reels and TikTok.
    safe.innerHTML = `<div style="left:0;right:0;top:0;height:220px"><span>Top UI</span></div>
      <div style="left:0;right:0;bottom:0;height:420px"><span>Caption / CTA</span></div>
      <div style="right:0;width:150px;top:900px;height:600px"><span>Buttons</span></div>`;
    stage.appendChild(safe);
    wrap.appendChild(stage);
    const ctl = document.createElement('div'); ctl.id = 'ctl';
    ctl.innerHTML = `<button id="pp">▶ Play</button><input id="sc" type="range" min="0" max="${window.DURATION}" step="0.01" value="0"><span id="tm"></span>
      <button id="sz">Safe zones</button><button id="lp" class="on">Loop</button>
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
