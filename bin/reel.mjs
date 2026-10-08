#!/usr/bin/env node
/**
 * Reel Studio CLI — turns JSON reel specs into a scrubbable HTML player, a storyboard image and 1080×1920 MP4s.
 *
 *   reel doctor                          check node / ffmpeg / chrome / puppeteer-core
 *   reel init [--link URL|PATH]… [--unlink URL|PATH]… [--note TEXT]… [--ref BRANCH]
 *                                        create/update the workspace profile and its context links
 *                                        (prefix a link with competitor= or inspiration= to tag it;
 *                                        --facebook/--website/--code still work as aliases)
 *   reel profile                         one-screen summary of the saved profile (start of every run)
 *   reel sources [sync|fetched]          list links; sync clones/pulls GitHub repos; fetched stamps the fetch date
 *   reel campaign new <theme> [--platforms facebook,tiktok] [--mode series|variants] [--count 3]
 *   reel campaign [list]                 list campaigns (newest last)
 *   reel list                            list the campaign's specs with scene count and duration
 *   reel preview <spec…|--all> [--open]  build player.html + storyboard.jpg per spec
 *   reel frames <spec> --times 1,2.5     save individual stills
 *   reel render <spec…|--all> [--voice NAME] [--rate 185] [--fps 30] [--jobs 3]
 *   reel gallery                         rebuild out/index.html (all players, storyboards, videos, captions)
 *
 * Workspace resolution: --ws, $REEL_WS, nearest ancestor containing .claude/reel-studio, else ./.claude/reel-studio.
 * Campaign resolution (list/preview/frames/render/gallery): --campaign NAME|PART, else the newest campaign.
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
  if (a.startsWith('--')) {
    const k = a.slice(2), nx = argv[i + 1];
    let v = true; if (nx !== undefined && !nx.startsWith('--')) { v = nx; i++; }
    flags[k] = k in flags ? [].concat(flags[k], v) : v;   // repeated flags (--link a --link b) collect into an array
  }
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

/* ---------- campaigns: one folder per run (campaigns/<date>-<theme>/ with campaign.json, brief.md, specs/, out/) ---------- */
const CAMPS = () => path.join(WS, 'campaigns');
function campaignList() {
  if (!fs.existsSync(CAMPS())) return [];
  return fs.readdirSync(CAMPS())
    .filter(n => fs.existsSync(path.join(CAMPS(), n, 'campaign.json')))
    .map(n => ({ name: n, dir: path.join(CAMPS(), n), ...readJSON(path.join(CAMPS(), n, 'campaign.json')) }))
    .sort((a, b) => String(a.created).localeCompare(String(b.created)) || a.name.localeCompare(b.name));
}
let campCache;
/** The campaign this command works on: --campaign NAME (or part of it), else the newest. A pre-campaign workspace uses its root. */
function campaign() {
  if (campCache) return campCache;
  const all = campaignList(), want = flags.campaign;
  if (want && want !== true) {
    const hit = all.find(c => c.name === want) || all.filter(c => c.name.includes(want)).pop();
    if (!hit) die(`Campaign not found: ${want}. Known: ${all.map(c => c.name).join(', ') || 'none'}`);
    return (campCache = hit);
  }
  if (all.length) return (campCache = all[all.length - 1]);
  return (campCache = { name: null, dir: WS, platforms: [] });
}
const SPECS = () => path.join(campaign().dir, 'specs');
const OUT = () => path.join(campaign().dir, 'out');

function specFiles(list) {
  const dir = SPECS();
  if (!fs.existsSync(dir)) die(`No specs folder in ${campaign().dir}. Create a campaign first: reel campaign new <theme>`);
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
  const outDir = path.join(OUT(), id); fs.mkdirSync(outDir, { recursive: true });
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
/* ---------- sources: a typed list of links (website, social pages, code, docs, competitors…) ---------- */
const SRC = () => path.join(WS, 'sources.json');
const ROLES = ['own', 'competitor', 'inspiration'];
/** v1 kept three fixed slots (facebook, website, code); v2 is { version: 2, links: [], notes: [] }. */
function migrateSources(src) {
  if (src.version >= 2) return src;
  const links = [];
  if (src.website) links.push({ type: 'website', url: src.website, role: 'own' });
  if (src.facebook) links.push({ type: 'facebook', url: src.facebook, role: 'own' });
  if (src.code?.type === 'github') links.push({ type: 'github', url: src.code.url, ref: src.code.ref, path: src.code.path, role: 'own' });
  if (src.code?.type === 'local') links.push({ type: 'local', path: src.code.path, role: 'own' });
  return { version: 2, links, notes: [], updated: src.updated, synced: src.synced };
}
function loadSources() {
  if (!fs.existsSync(SRC())) return { version: 2, links: [], notes: [] };
  const raw = readJSON(SRC()), src = migrateSources(raw);
  if (src !== raw) { fs.writeFileSync(SRC(), JSON.stringify(src, null, 2) + '\n'); log('• Converted sources.json to the link list format'); }
  return src;
}
const saveSources = src => fs.writeFileSync(SRC(), JSON.stringify(src, null, 2) + '\n');
const normUrl = u => /^https?:\/\//.test(u) ? u : 'https://' + u.replace(/^\/+/, '');
function parseGithub(v) {
  const m = String(v).match(/^(?:github:|https?:\/\/(?:www\.)?github\.com\/|git@github\.com:)([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^/]+))?\/?$/);
  return m ? { owner: m[1], repo: m[2], ref: m[3] } : null;
}
const HOSTS = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|fb\.watch)$/, 'facebook'], [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'], [/(^|\.)linkedin\.com$/, 'linkedin'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(x\.com|twitter\.com)$/, 'x'], [/(^|\.)(drive\.google\.com|docs\.google\.com|dropbox\.com|notion\.so|notion\.site)$/, 'docs'],
];
/** "competitor=https://…" → { type, url|path, role }. Types: website, facebook, instagram, tiktok, linkedin, youtube, x, docs, github, local. */
function classify(raw) {
  let v = String(raw).trim(), role = 'own';
  const tag = v.match(/^(\w+)=(.+)$/);
  if (tag && ROLES.includes(tag[1].toLowerCase())) { role = tag[1].toLowerCase(); v = tag[2]; }
  const gh = parseGithub(v);
  if (gh) return { type: 'github', url: `https://github.com/${gh.owner}/${gh.repo}`, ref: (typeof flags.ref === 'string' && flags.ref) || gh.ref || null, path: `sources/${gh.repo}`, role };
  if (!/^https?:\/\//.test(v)) {
    const abs = path.resolve(process.cwd(), v.replace(/^~(?=\/|$)/, os.homedir()));
    if (fs.existsSync(abs)) return { type: 'local', path: abs, role };
    if (/^[.~/]/.test(v)) die('Folder not found: ' + abs);
  }
  const url = normUrl(v);
  let host; try { host = new URL(url).hostname.replace(/^(www|m|web|mobile)\./, ''); } catch { die('Not a URL or folder: ' + v); }
  return { type: (HOSTS.find(([re]) => re.test(host)) || [, 'website'])[1], url, role };
}
const linkKey = l => l.url || l.path;
const isCode = l => l.type === 'github' || l.type === 'local';
/** Absolute folders Claude should read for code context. */
const codeDirs = (src = loadSources()) => src.links.filter(isCode).map(l => l.type === 'github' ? path.join(WS, l.path) : l.path);
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
const day = iso => iso ? String(iso).slice(0, 10) : '—';
function printSources(src = loadSources()) {
  if (!src.links.length) log('Links: none yet — reel init --link URL');
  for (const l of src.links) {
    const where = l.type === 'github' ? `${l.url}${l.ref ? ' @ ' + l.ref : ''} → ${path.join(WS, l.path)}` : linkKey(l);
    log(`  ${l.type.padEnd(10)} ${l.role === 'own' ? '' : `[${l.role}] `}${where}`);
  }
  for (const n of src.notes || []) log(`  note       ${n}`);
  log(`Last fetched: ${day(src.fetched)}`);
}
function sources() {
  const sub = pos[0], src = loadSources();
  if (sub === 'sync') {
    for (const l of src.links) {
      if (l.type === 'github') syncGithub(l);
      else if (l.type === 'local' && !fs.existsSync(l.path)) log('  ⚠ local folder is gone: ' + l.path);
    }
    src.synced = new Date().toISOString(); saveSources(src);
  }
  if (sub === 'fetched') { src.fetched = new Date().toISOString(); saveSources(src); }
  printSources(src);
}

function init() {
  fs.mkdirSync(path.join(WS, 'assets'), { recursive: true });
  const bf = path.join(WS, 'brand.json');
  if (!fs.existsSync(bf)) fs.copyFileSync(path.join(SKILL, 'templates', 'brand.json'), bf);
  const cf = path.join(WS, 'context.md');
  if (!fs.existsSync(cf)) fs.copyFileSync(path.join(SKILL, 'templates', 'context.md'), cf);
  // Nothing the skill writes is versioned: profile, links, specs, renders all stay out of git.
  fs.writeFileSync(path.join(WS, '.gitignore'), '*\n');
  const src = loadSources();
  const arr = k => flags[k] === undefined ? [] : [].concat(flags[k]).filter(x => x !== true);
  // Legacy aliases from the three-slot onboarding.
  const adds = [...arr('link'), ...arr('website'), ...arr('facebook'), ...arr('code')].filter(v => v !== 'none' && v !== '');
  for (const raw of adds) {
    const l = classify(raw);
    src.links = src.links.filter(x => linkKey(x) !== linkKey(l)).concat(l);
    if (l.type === 'github') { syncGithub(l); src.synced = new Date().toISOString(); }
  }
  for (const raw of arr('unlink')) {
    const before = src.links.length, k = raw.replace(/\/+$/, '');
    src.links = src.links.filter(x => ![linkKey(x), linkKey(x).replace(/\/+$/, '')].some(y => y === k || y === normUrl(k)));
    if (src.links.length === before) log('  ⚠ no link matched ' + raw);
  }
  src.notes = [...(src.notes || []), ...arr('note')];
  src.updated = new Date().toISOString();
  saveSources(src);
  log(`✓ Workspace ready: ${WS}`);
  printSources(src);
  log('  Next: gather context from the links into context.md and brand.json, then: reel campaign new <theme>');
}

function profile() {
  if (!fs.existsSync(path.join(WS, 'brand.json'))) { log(`No profile yet in ${WS} — start onboarding.`); process.exitCode = 2; return; }
  const b = brand(), src = loadSources(), cf = path.join(WS, 'context.md');
  const ctx = fs.existsSync(cf) ? fs.readFileSync(cf, 'utf8') : '';
  const section = h => (ctx.split(/^## /m).find(s => s.startsWith(h)) || '');
  const rows = h => section(h).split('\n').filter(l => /^\|/.test(l) && !/^\|\s*-/.test(l)).slice(1).filter(l => l.replace(/[|\s]/g, ''));
  const camps = campaignList();
  log(`Brand:      ${b.name}${b.url ? ' · ' + b.url : ''}`);
  log(`Language:   ${b.lang || 'en'}`);
  log(`Voiceover:  ${b.voice ? 'on (' + b.voice + ')' : 'off'}`);
  log(`Context:    context.md, ${rows('Facts').length} sourced facts, updated ${fs.existsSync(cf) ? day(fs.statSync(cf).mtime.toISOString()) : '—'}`);
  log(`Published:  ${rows('Already published').length} videos`);
  log(`Campaigns:  ${camps.length}${camps.length ? ` (latest: ${camps[camps.length - 1].name})` : ''}`);
  log('Links:');
  printSources(src);
}

const slugify = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
function campaignCmd() {
  const sub = pos[0] || 'list';
  if (sub === 'list') {
    const all = campaignList();
    if (!all.length) log('No campaigns yet — reel campaign new <theme>');
    for (const c of all) {
      const n = fs.existsSync(path.join(c.dir, 'specs')) ? fs.readdirSync(path.join(c.dir, 'specs')).filter(f => f.endsWith('.json')).length : 0;
      log(`${c.name.padEnd(44)} ${c.mode.padEnd(9)} ${String(n).padStart(2)}/${c.count} specs  ${c.platforms.join(',')}`);
    }
    return;
  }
  if (sub !== 'new') die('Usage: reel campaign new <theme> | reel campaign list');
  const theme = pos.slice(1).join(' ') || (typeof flags.theme === 'string' && flags.theme);
  if (!theme) die('Give the campaign a theme: reel campaign new "back to school promo"');
  const mode = typeof flags.mode === 'string' ? flags.mode : 'series';
  if (!['series', 'variants'].includes(mode)) die('--mode must be series or variants');
  const count = flags.count === undefined ? 3 : +flags.count;
  if (!Number.isInteger(count) || count < 1 || count > 10) die('--count must be 1–10');
  const platforms = String(typeof flags.platforms === 'string' ? flags.platforms : 'facebook').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!fs.existsSync(path.join(WS, 'brand.json'))) die(`No profile in ${WS}. Run: reel init`);
  adoptLegacySpecs();
  const created = new Date().toISOString();
  const name = `${created.slice(0, 10)}-${slugify(theme) || 'campaign'}`;
  const dir = path.join(CAMPS(), name);
  if (fs.existsSync(dir)) die('Campaign already exists: ' + name);
  fs.mkdirSync(path.join(dir, 'specs'), { recursive: true });
  const meta = { theme, platforms, mode, count, created };
  fs.writeFileSync(path.join(dir, 'campaign.json'), JSON.stringify(meta, null, 2) + '\n');
  const brief = fs.readFileSync(path.join(SKILL, 'templates', 'brief.md'), 'utf8')
    .replace(/\{\{(\w+)\}\}/g, (m, k) => ({ name, theme, platforms: platforms.join(', '), mode, count, date: created.slice(0, 10) }[k] ?? m));
  fs.writeFileSync(path.join(dir, 'brief.md'), brief);
  log(`✓ Campaign ${name}\n  ${mode}, ${count} video${count > 1 ? 's' : ''}, ${platforms.join(', ')}\n  ${dir}`);
}
/** A workspace from before campaigns kept specs/ and out/ at its root: move them into a campaign so they stay reachable. */
function adoptLegacySpecs() {
  const specs = path.join(WS, 'specs');
  if (!fs.existsSync(specs) || !fs.readdirSync(specs).some(f => f.endsWith('.json'))) return;
  const first = Math.min(...fs.readdirSync(specs).map(f => fs.statSync(path.join(specs, f)).mtimeMs));
  const created = new Date(first).toISOString(), name = `${created.slice(0, 10)}-earlier-reels`;
  const dir = path.join(CAMPS(), name);
  fs.mkdirSync(dir, { recursive: true });
  fs.renameSync(specs, path.join(dir, 'specs'));
  if (fs.existsSync(path.join(WS, 'out'))) fs.renameSync(path.join(WS, 'out'), path.join(dir, 'out'));
  const n = fs.readdirSync(path.join(dir, 'specs')).filter(f => f.endsWith('.json')).length;
  fs.writeFileSync(path.join(dir, 'campaign.json'), JSON.stringify({ theme: 'Reels made before campaigns', platforms: ['facebook'], mode: 'series', count: n, created }, null, 2) + '\n');
  log(`• Moved ${n} earlier specs into campaigns/${name}`);
  campCache = undefined;
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
  const out = OUT(); if (!fs.existsSync(out)) return;
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
<h1>${esc(campaign().theme || 'Reel Studio')} · ${items.length} reels</h1>${campaign().name ? `<p>${esc(campaign().name)} · ${esc(campaign().mode)} · ${esc((campaign().platforms || []).join(', '))}</p>` : ''}${rows}`);
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
      const voice = spec.voice === false ? null : flags.voice || spec.voice || brand().voice;
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

const CMDS = { doctor, init, sources, list, preview, frames, render, profile, campaign: campaignCmd, gallery: async () => { gallery(); log(path.join(OUT(), 'index.html')); } };
if (!CMDS[cmd]) { log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*?/, '').replace(/^ \* ?/gm, '')); process.exit(cmd ? 1 : 0); }
await CMDS[cmd]();
