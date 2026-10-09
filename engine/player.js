/* Reel Studio player: scrub, play, frame-step, scene jumps and the safe-zone overlay around the engine's stage.
 * Loaded after engine.js in player.html only, so renders never carry its requestAnimationFrame loop. */
window.REEL_PLAYER = function ({ stage, ZONES, prepare, voText }) {
  const S = window.SPEC;
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
};
