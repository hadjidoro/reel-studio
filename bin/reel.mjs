#!/usr/bin/env node
/**
 * Reel Studio CLI — turns JSON reel specs into a scrubbable HTML player, a storyboard image and 1080×1920 MP4s.
 *
 *   reel doctor                          check node / ffmpeg / chrome / puppeteer-core
 *   reel init [--facebook URL] [--website URL] [--code .|PATH|GITHUB_URL|none] [--ref BRANCH]
 *                                        create/update the workspace and record where context comes from
 *   reel sources [sync]                  show context sources; sync clones/pulls a GitHub repo
 *   reel list                            list specs with scene count and duration
 *   reel preview <spec…|--all> [--open]  build player.html + storyboard.jpg per spec
 *   reel frames <spec> --times 1,2.5     save individual stills
 *   reel render <spec…|--all> [--voice NAME] [--rate 185] [--fps 30] [--jobs 3]
 *   reel gallery                         rebuild out/index.html (all players, storyboards, videos, captions)
 *
 * Workspace resolution: --ws, $REEL_WS, nearest ancestor containing .claude/reel-studio, else ./.claude/reel-studio.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = {}; const pos = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const nx = argv[i + 1]; if (nx === undefined || nx.startsWith('--')) flags[k] = true; else { flags[k] = nx; i++; } }
  else pos.push(a);
}
const die = m => { console.error('✖ ' + m); process.exit(1); };
const log = m => console.log(m);

/* ---------- environment ---------- */
function chromePath() {
  const c = [process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
  return c.find(p => fs.existsSync(p));
}
const has = bin => spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin]).status === 0;
function ensurePuppeteer() {
  const req = createRequire(path.join(SKILL, 'package.json'));
  try { return req.resolve('puppeteer-core'); } catch {
    log('• Installing puppeteer-core into the skill folder (one time)…');
    const r = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--silent'], { cwd: SKILL, stdio: 'inherit' });
    if (r.status !== 0) die('npm install failed in ' + SKILL);
    return req.resolve('puppeteer-core');
  }
}
async function browser() {
  const exe = chromePath(); if (!exe) die('Chrome/Chromium not found. Set CHROME_PATH.');
  const pp = (await import(pathToFileURL(ensurePuppeteer()).href)).default;
  return pp.launch({ executablePath: exe, headless: true, args: ['--force-device-scale-factor=1', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
}

/* ---------- workspace ---------- */
function findWs() {
  if (flags.ws) return path.resolve(flags.ws);
  if (process.env.REEL_WS) return path.resolve(process.env.REEL_WS);
  let d = process.cwd();
  while (true) {
    const c = path.join(d, '.claude', 'reel-studio');
    if (fs.existsSync(path.join(c, 'brand.json'))) return c;
    const up = path.dirname(d); if (up === d) break; d = up;
  }
  return path.join(process.cwd(), '.claude', 'reel-studio');
}
const WS = findWs();
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { die(`Invalid JSON in ${f}: ${e.message}`); } };
function brand() {
  const f = path.join(WS, 'brand.json');
  if (!fs.existsSync(f)) die(`No brand.json in ${WS}. Run: reel init`);
  return readJSON(f);
}
function specFiles(list) {
  const dir = path.join(WS, 'specs');
  if (flags.all || !list.length) return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(f => path.join(dir, f));
  return list.map(s => {
    for (const c of [s, path.join(dir, s), path.join(dir, s + '.json')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.resolve(c);
    const hit = fs.readdirSync(dir).find(f => f.startsWith(s) && f.endsWith('.json'));
    if (hit) return path.join(dir, hit);
    die('Spec not found: ' + s);
  });
}
const specId = (file, spec) => spec.id || path.basename(file, '.json');

/* ---------- build ---------- */
function cssVars(b) {
  const c = b.colors || {};
  const v = {
    '--bg': c.bg || '#1d1a17', '--bg2': c.bg2 || c.bg || '#2a2521', '--text': c.text || '#fbf7f2', '--muted': c.muted || '#b3a79c',
    '--accent': c.accent || '#e8a13c', '--accent2': c.accent2 || '#ec3013', '--success': c.success || '#1f9d55', '--on-accent': c.onAccent || '#1b1206',
    '--surface': c.surface || '#fbf7f2', '--ink': c.ink || c.bg || '#2e241d', '--font': `'${b.font?.family || 'Inter'}'`,
  };
  return ':root{' + Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';') + '}';
}
function fontTags(b) {
  const f = b.font || {};
  let out = '';
  if (f.google) out += `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=${f.google.replace(/ /g, '+')}&display=block" rel="stylesheet">`;
  for (const src of [].concat(f.files || [])) out += `<style>@font-face{font-family:'${f.family}';src:url('${src.file || src}');font-weight:${src.weight || '100 900'};font-style:normal}</style>`;
  return out;
}
function build(file) {
  const spec = readJSON(file), b = brand(), id = specId(file, spec);
  const outDir = path.join(WS, 'out', id); fs.mkdirSync(outDir, { recursive: true });
  const css = fs.readFileSync(path.join(SKILL, 'engine', 'engine.css'), 'utf8');
  const js = fs.readFileSync(path.join(SKILL, 'engine', 'engine.js'), 'utf8');
  const safe = o => JSON.stringify(o).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="${b.lang || 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<base href="${pathToFileURL(WS).href}/">
<title>${id}</title>${fontTags(b)}<style>${cssVars(b)}\n${css}\n${b.css || ''}\n${spec.css || ''}</style></head>
<body><script>window.BRAND=${safe(b)};window.SPEC=${safe({ ...spec, id })};</script><script>${js}</script></body></html>`;
  const player = path.join(outDir, 'player.html');
  fs.writeFileSync(player, html);
  return { id, spec, player, outDir };
}
async function openPage(br, player) {
  const page = await br.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport({ width: 1080, height: 1920 });
  await page.goto(pathToFileURL(player).href + '?render', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  const ok = await page.evaluate(() => typeof window.render === 'function');
  if (!ok) throw new Error('Engine failed to start: ' + (errors.join(' | ') || 'unknown error'));
  const missing = await page.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')));
  if (missing.length) log('  ⚠ images not found: ' + missing.join(', '));
  const meta = await page.evaluate(() => ({ dur: window.DURATION, scenes: window.SCENES }));
  return { page, meta, errors };
}

/* ---------- commands ---------- */
async function doctor() {
  const rows = [
    ['node ≥ 18', +process.versions.node.split('.')[0] >= 18, process.versions.node],
    ['ffmpeg', has('ffmpeg'), has('ffmpeg') ? execFileSync('ffmpeg', ['-version']).toString().split('\n')[0] : 'brew install ffmpeg / apt install ffmpeg'],
    ['ffprobe', has('ffprobe'), ''],
    ['chrome', !!chromePath(), chromePath() || 'install Chrome or set CHROME_PATH'],
    ['say (voiceover, macOS only)', has('say'), has('say') ? 'ok' : 'optional'],
  ];
  let pup = true; try { ensurePuppeteer(); } catch { pup = false; }
  rows.push(['puppeteer-core', pup, SKILL]);
  for (const [n, ok, info] of rows) log(`${ok ? '✓' : '✖'} ${n.padEnd(28)} ${info}`);
  log(`\nWorkspace: ${WS} ${fs.existsSync(path.join(WS, 'brand.json')) ? '(ready)' : '(not initialised — run reel init)'}`);
  if (fs.existsSync(SRC())) printSources();
}
/* ---------- sources: facebook page, website, source code ---------- */
const SRC = () => path.join(WS, 'sources.json');
function loadSources() { return fs.existsSync(SRC()) ? readJSON(SRC()) : {}; }
const normUrl = u => !u || u === true || u === 'none' ? null : (/^https?:\/\//.test(u) ? u : 'https://' + u.replace(/^\/+/, ''));
function parseGithub(v) {
  const m = String(v).match(/^(?:github:|https?:\/\/(?:www\.)?github\.com\/|git@github\.com:)([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^/]+))?\/?$/);
  return m ? { owner: m[1], repo: m[2], ref: m[3] } : null;
}
function codeFrom(v, ref) {
  if (v === undefined) return undefined;
  if (v === true || v === 'none' || v === '') return { type: 'none' };
  const gh = parseGithub(v);
  if (gh) return { type: 'github', url: `https://github.com/${gh.owner}/${gh.repo}`, ref: ref || gh.ref || null, path: `sources/${gh.repo}` };
  const abs = path.resolve(process.cwd(), v);
  if (!fs.existsSync(abs)) die('Source folder not found: ' + abs);
  return { type: 'local', path: abs };
}
/** Absolute folder Claude should read for code context (null when there is none). */
function codeDir(src = loadSources()) {
  const c = src.code; if (!c || c.type === 'none') return null;
  return c.type === 'github' ? path.join(WS, c.path) : c.path;
}
function syncGithub(c) {
  const dest = path.join(WS, c.path);
  if (fs.existsSync(path.join(dest, '.git'))) {
    log(`• Updating ${c.url}…`);
    const r = spawnSync('git', ['-C', dest, 'pull', '--ff-only', '--depth', '1'], { stdio: 'inherit' });
    if (r.status !== 0) die('git pull failed in ' + dest);
    return dest;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  log(`• Cloning ${c.url}${c.ref ? ' @ ' + c.ref : ''} (shallow)…`);
  const args = ['clone', '--depth', '1', ...(c.ref ? ['--branch', c.ref] : []), c.url + '.git', dest];
  let r = spawnSync('git', args, { stdio: 'inherit', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (r.status !== 0 && has('gh')) {
    log('• git clone failed — retrying with the GitHub CLI (private repos)…');
    const slug = c.url.replace('https://github.com/', '');
    r = spawnSync('gh', ['repo', 'clone', slug, dest, '--', '--depth', '1', ...(c.ref ? ['--branch', c.ref] : [])], { stdio: 'inherit' });
  }
  if (r.status !== 0) die(`Could not clone ${c.url}. For a private repo run \`gh auth login\` (or set up SSH), then: reel sources sync`);
  return dest;
}
function printSources(src = loadSources()) {
  const c = src.code;
  log(`Facebook page: ${src.facebook || '— (not set)'}`);
  log(`Website:       ${src.website || '— (not set)'}`);
  log(`Source code:   ${!c ? '— (not set)' : c.type === 'none' ? 'none (website only)' : c.type === 'github' ? `${c.url}${c.ref ? ' @ ' + c.ref : ''} → ${codeDir(src)}` : c.path}`);
}
function sources() {
  const sub = pos[0];
  const src = loadSources();
  if (sub === 'sync') {
    if (src.code?.type === 'github') syncGithub(src.code);
    else if (src.code?.type === 'local' && !fs.existsSync(src.code.path)) die('Local source folder is gone: ' + src.code.path);
    src.synced = new Date().toISOString(); fs.writeFileSync(SRC(), JSON.stringify(src, null, 2) + '\n');
  }
  printSources(src);
}

function init() {
  fs.mkdirSync(path.join(WS, 'specs'), { recursive: true });
  fs.mkdirSync(path.join(WS, 'assets'), { recursive: true });
  const bf = path.join(WS, 'brand.json');
  if (!fs.existsSync(bf)) fs.copyFileSync(path.join(SKILL, 'templates', 'brand.json'), bf);
  const cf = path.join(WS, 'context.md');
  if (!fs.existsSync(cf)) fs.copyFileSync(path.join(SKILL, 'templates', 'context.md'), cf);
  const ex = path.join(WS, 'specs', '01-example.json');
  if (!fs.readdirSync(path.join(WS, 'specs')).length && !flags['no-example']) fs.copyFileSync(path.join(SKILL, 'templates', 'example-spec.json'), ex);
  fs.writeFileSync(path.join(WS, '.gitignore'), 'out/\nsources/\n');
  // Onboarding answers — re-run init with any flag to change one; others are kept.
  const src = loadSources();
  if (flags.facebook !== undefined) src.facebook = normUrl(flags.facebook);
  if (flags.website !== undefined) src.website = normUrl(flags.website);
  const code = codeFrom(flags.code, flags.ref);
  if (code) src.code = code;
  if (code?.type === 'github') { syncGithub(code); src.synced = new Date().toISOString(); }
  src.updated = new Date().toISOString();
  fs.writeFileSync(SRC(), JSON.stringify(src, null, 2) + '\n');
  log(`✓ Workspace ready: ${WS}`);
  printSources(src);
  const missing = ['facebook', 'website', 'code'].filter(k => src[k] === undefined);
  if (missing.length) log(`\n  Not answered yet: ${missing.join(', ')} — re-run: reel init ${missing.map(k => `--${k} …`).join(' ')}`);
  log('  Next: gather context into context.md and brand.json, then write specs/*.json');
}
function list() {
  const b = brand();
  for (const f of specFiles([])) {
    const s = readJSON(f);
    log(`${path.basename(f).padEnd(40)} ${String((s.scenes || []).length).padStart(2)} scenes  ${s.title || ''}`);
  }
}
async function preview() {
  const files = specFiles(pos);
  const br = await browser();
  try {
    for (const f of files) {
      const { id, player, outDir } = build(f);
      const { page, meta, errors } = await openPage(br, player);
      // one settled frame per scene
      const shots = [];
      for (const [i, sc] of meta.scenes.entries()) {
        const vo = !sc.vo ? '' : typeof sc.vo === 'string' ? sc.vo : sc.vo.map(v => v.text).join(' / ');
        for (const [k, key] of sc.keys.entries()) {
          await page.evaluate(t => render(t), sc.s + key);
          const b64 = await page.screenshot({ type: 'jpeg', quality: 70, encoding: 'base64' });
          const part = sc.keys.length > 1 ? ` (${k + 1}/${sc.keys.length})` : '';
          shots.push({ b64, label: `${i + 1}${part} · ${sc.type} · ${sc.s.toFixed(1)}–${sc.e.toFixed(1)}s`, vo: k === 0 ? vo : '' });
        }
      }
      await page.close();
      const cols = Math.min(shots.length, 6), W = 270;
      const sheet = await br.newPage();
      await sheet.setViewport({ width: cols * (W + 12) + 12, height: 400 });
      await sheet.setContent(`<body style="margin:0;background:#161312;font:600 13px system-ui;color:#ddd;padding:12px">
        <div style="margin:0 0 10px 2px;font-size:15px">${id} — ${meta.dur.toFixed(1)}s, ${meta.scenes.length} scenes</div>
        <div style="display:grid;grid-template-columns:repeat(${cols},${W}px);gap:12px">${shots.map(s => `<div><img src="data:image/jpeg;base64,${s.b64}" style="width:${W}px;display:block;border-radius:8px"><div style="margin-top:5px">${s.label}</div>${s.vo ? `<div style="color:#9a8f86;font-weight:400;margin-top:2px">🎙 ${s.vo}</div>` : ''}</div>`).join('')}</div></body>`);
      const sb = path.join(outDir, 'storyboard.jpg');
      await sheet.screenshot({ path: sb, type: 'jpeg', quality: 82, fullPage: true });
      await sheet.close();
      log(`✓ ${id}  ${meta.dur.toFixed(1)}s\n  player:     ${player}\n  storyboard: ${sb}`);
      if (errors.length) log('  ⚠ page errors: ' + errors.join(' | '));
      if (flags.open) spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [player], { detached: true, stdio: 'ignore' }).unref();
    }
  } finally { await br.close(); }
  gallery();
}
/** out/index.html — every spec's storyboard, player and video in one page. */
function gallery() {
  const out = path.join(WS, 'out'); if (!fs.existsSync(out)) return;
  const items = fs.readdirSync(out).filter(d => fs.existsSync(path.join(out, d, 'player.html'))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = items.map(id => {
    const f = n => fs.existsSync(path.join(out, id, n));
    const spec = (() => { try { return readJSON(specFiles([id])[0]); } catch { return {}; } })();
    return `<section><h2>${esc(id)}</h2><p>${esc(spec.title || '')}${spec.audience ? ` · <i>${esc(spec.audience)}</i>` : ''}</p>
      <p><a href="${id}/player.html">▶ Player</a>${f(id + '.mp4') ? ` · <a href="${id}/${id}.mp4">MP4</a>` : ' · <span style="opacity:.6">not rendered</span>'}</p>
      ${f('storyboard.jpg') ? `<a href="${id}/player.html"><img src="${id}/storyboard.jpg"></a>` : ''}
      ${spec.caption ? `<pre>${esc(spec.caption)}</pre>` : ''}</section>`;
  }).join('');
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Reel Studio</title>
<style>body{background:#161312;color:#ddd;font:14px system-ui;margin:24px}a{color:#e8a13c}section{margin-bottom:36px}img{max-width:100%;border-radius:10px}pre{white-space:pre-wrap;background:#221d1a;padding:10px;border-radius:8px}h2{margin:0 0 4px}</style>
<h1>Reel Studio · ${items.length} reels</h1>${rows}`);
}
async function frames() {
  const [f] = specFiles(pos.slice(0, 1));
  const times = String(flags.times || '0').split(',').map(Number);
  const br = await browser();
  try {
    const { id, player, outDir } = build(f);
    const { page } = await openPage(br, player);
    for (const t of times) { await page.evaluate(t => render(t), t); const p = path.join(outDir, `frame-${t}.jpg`); await page.screenshot({ path: p, type: 'jpeg', quality: 85 }); log(p); }
  } finally { await br.close(); }
}
const probe = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();

async function render() {
  if (!has('ffmpeg')) die('ffmpeg not found');
  const files = specFiles(pos), fps = +(flags.fps || 30);
  const br = await browser();
  const jobs = +(flags.jobs || 3);
  const queue = [...files]; const done = [];
  async function worker() {
    while (queue.length) {
      const f = queue.shift();
      const { id, spec, player, outDir } = build(f);
      const { page, meta } = await openPage(br, player);
      const silent = path.join(outDir, `${id}.silent.mp4`);
      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
        '-pix_fmt', 'yuv420p', '-r', String(fps), '-c:a', 'aac', '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
      const n = Math.round(meta.dur * fps);
      for (let i = 0; i < n; i++) {
        await page.evaluate(t => render(t), i / fps);
        const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      ff.stdin.end(); await new Promise(r => ff.on('close', r));
      await page.close();
      const final = path.join(outDir, `${id}.mp4`);
      const voice = flags.voice || spec.voice;
      if ((voice && meta.scenes.some(s => s.vo)) || spec.audio) await mixAudio({ spec, meta, silent, final, voice, outDir });
      else fs.renameSync(silent, final);
      fs.rmSync(silent, { force: true });
      spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.min(2.2, meta.dur / 2)), '-i', final, '-frames:v', '1', '-q:v', '3', path.join(outDir, 'cover.jpg')]);
      if (spec.caption) fs.writeFileSync(path.join(outDir, 'caption.txt'), spec.caption + '\n');
      log(`✓ ${id}  ${probe(final).toFixed(1)}s  ${final}`);
      done.push(final);
    }
  }
  try { await Promise.all(Array.from({ length: Math.min(jobs, files.length) }, worker)); } finally { await br.close(); }
  gallery();
}

/** Voiceover via macOS `say` (one clip per scene `vo`, or `vo: [{at, text}]`), plus optional music bed `spec.audio`. */
async function mixAudio({ spec, meta, silent, final, voice, outDir }) {
  const rate = +(flags.rate || spec.voiceRate || 185);
  const clips = [];
  if (voice) {
    if (!has('say')) die('Voiceover needs macOS `say`. Record your own track and set spec.audio instead.');
    const lines = [];
    meta.scenes.forEach(sc => {
      if (!sc.vo) return;
      const items = typeof sc.vo === 'string' ? [{ at: .15, text: sc.vo }] : sc.vo;
      items.forEach(it => lines.push({ start: sc.s + (it.at ?? .15), text: it.text, rate: it.rate || rate }));
    });
    lines.sort((a, b) => a.start - b.start);
    fs.mkdirSync(path.join(outDir, 'vo'), { recursive: true });
    lines.forEach((l, i) => {
      const f = path.join(outDir, 'vo', `${i}.aiff`);
      execFileSync('say', ['-v', voice, '-r', String(l.rate), '-o', f, l.text]);
      const d = probe(f), room = (lines[i + 1]?.start ?? meta.dur + 1.5) - l.start - .12;
      const tempo = d > room ? d / room : 1;
      if (tempo > 1.18) log(`  ⚠ line ${i + 1} too long (${d.toFixed(2)}s for ${room.toFixed(2)}s): "${l.text}" — shorten it or lengthen the scene`);
      clips.push({ f, start: l.start, tempo: Math.min(tempo, 1.35), end: l.start + d / Math.min(tempo, 1.35) });
    });
  }
  const lastEnd = Math.max(meta.dur, ...clips.map(c => c.end + .4));
  const total = +lastEnd.toFixed(2), pad = +(total - meta.dur).toFixed(2);
  const inputs = ['-i', silent], filt = [], mixes = [];
  clips.forEach((c, j) => { inputs.push('-i', c.f); const ms = Math.round(c.start * 1000); filt.push(`[${j + 1}:a]aresample=44100,atempo=${c.tempo.toFixed(3)},adelay=${ms}|${ms},apad[v${j}]`); mixes.push(`[v${j}]`); });
  if (clips.length) filt.push(`${mixes.join('')}amix=inputs=${clips.length}:normalize=0,atrim=0:${total},highpass=f=80,acompressor=threshold=-18dB:ratio=3,loudnorm=I=-14:TP=-1.5:LRA=7[vo]`);
  let out = clips.length ? '[vo]' : null;
  if (spec.audio) {
    const a = typeof spec.audio === 'string' ? { file: spec.audio } : spec.audio;
    const k = clips.length + 1; inputs.push('-stream_loop', '-1', '-i', path.resolve(WS, a.file));
    filt.push(`[${k}:a]aresample=44100,volume=${a.volume ?? (clips.length ? .18 : .8)},atrim=0:${total},afade=t=out:st=${Math.max(0, total - 1.2)}:d=1.2[bed]`);
    if (out) { filt.push(`${out}[bed]amix=inputs=2:normalize=0,aformat=channel_layouts=stereo[mix]`); out = '[mix]'; } else out = '[bed]';
  }
  const vArgs = pad > 0.05 ? ['-vf', `tpad=stop_mode=clone:stop_duration=${pad}`, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p'] : ['-c:v', 'copy'];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filt.join(';'), '-map', '0:v', '-map', out, ...vArgs, '-c:a', 'aac', '-b:a', '160k', '-t', String(total), '-movflags', '+faststart', final], { stdio: 'inherit' });
}

const CMDS = { doctor, init, sources, list, preview, frames, render, gallery: async () => { gallery(); log(path.join(WS, 'out', 'index.html')); } };
if (!CMDS[cmd]) { log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*?/, '').replace(/^ \* ?/gm, '')); process.exit(cmd ? 1 : 0); }
await CMDS[cmd]();
