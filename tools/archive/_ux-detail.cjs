/* 可用性细节核验:把"看起来像问题"的说法落成可测数字(不看感觉看像素/计算值)
   用法: node tools/archive/_ux-detail.cjs <面板码> [基线地址]
   量:
     1) 表格文字截断率:单元格 scrollWidth > clientWidth(真的被省略号切掉)
     2) 数字列对齐:按列头文字匹配 数量/金额/价/成本/率/重/尺寸 等,读 computed text-align
     3) 数字字体:是否 tabular-nums(font-variant-numeric)
     4) 文本对比度:抽样文本节点,按 WCAG 算对比度(<4.5 视为不足)
     5) 点击热区:<40px 的可见按钮/图标按钮清单
     6) 行高/密度:表头与数据行高度
*/
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const TARGET = process.argv[2] || 'INV'
const ROUTE = TARGET.startsWith('#') ? TARGET : `#/panelx/list/${TARGET}`
const BASE = process.argv[3] || 'http://127.0.0.1:8090'
const PORT = 9447
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const API = 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const PROBE = `(() => {
  const out = {};
  const ths = [...document.querySelectorAll('.el-table__header th')].map(t => t.innerText.trim());
  out.cols = ths;
  // 1) 截断率
  const cells = [...document.querySelectorAll('.el-table__body td .cell')];
  out.cellCount = cells.length;
  out.truncated = cells.filter(c => c.scrollWidth > c.clientWidth + 1).length;
  out.truncSamples = cells.filter(c => c.scrollWidth > c.clientWidth + 1).slice(0, 5).map(c => c.innerText.trim().slice(0, 18));
  // 2/3) 数字列对齐 + 等宽数字
  const NUM = /数量|金额|价|成本|率|重|尺寸|长度|宽度|高度|含量|库存|余额|税额|折扣/;
  out.numCols = [];
  [...document.querySelectorAll('.el-table__header th')].forEach((th, i) => {
    const name = th.innerText.trim();
    if (!NUM.test(name)) return;
    const td = document.querySelectorAll('.el-table__body tr:first-child td')[i];
    if (!td) return;
    const cell = td.querySelector('.cell') || td;
    const cs = getComputedStyle(cell);
    out.numCols.push({ col: name, align: cs.textAlign, tabular: cs.fontVariantNumeric || '(未设)' });
  });
  // 4) 对比度抽样(前景/背景 + WCAG 比值)
  function lum(rgb) { const f = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2] }
  function parse(c) { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(s => parseFloat(s)); return p.length >= 3 ? [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]] : null }
  function bgOf(el) { let e = el; while (e && e !== document.documentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0.5) return c; e = e.parentElement } return [255, 255, 255, 1] }
  const samples = [...document.querySelectorAll('.el-table__body td .cell, .el-form-item__label, .el-descriptions__label')].slice(0, 220);
  const low = [];
  for (const el of samples) {
    if (!el.innerText || !el.innerText.trim()) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color); const bg = bgOf(el);
    if (!fg) continue;
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize);
    if (ratio < 4.5 && low.length < 12) low.push({ txt: el.innerText.trim().slice(0, 14), ratio: Math.round(ratio * 100) / 100, px: size, color: cs.color, bg: 'rgb(' + bg.slice(0,3).join(',') + ')' });
  }
  out.lowContrast = low;
  // 5) 点击热区
  const btns = [...document.querySelectorAll('button, .el-button, .el-dropdown-link, .el-tooltip__trigger')]
    .map(b => ({ t: (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 10), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }))
    .filter(x => x.w > 0 && x.h > 0);
  out.smallTargets = btns.filter(x => x.h < 40 || x.w < 40).slice(0, 12);
  out.btnCount = btns.length;
  // 6) 行高
  const th = document.querySelector('.el-table__header th'); const tr = document.querySelector('.el-table__body tr');
  out.rowH = tr ? Math.round(tr.getBoundingClientRect().height) : 0;
  out.headH = th ? Math.round(th.getBoundingClientRect().height) : 0;
  out.dom = document.querySelectorAll('*').length;
  return JSON.stringify(out);
})()`

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  const token = login.data.token, user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-d-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--window-size=1440,900`,
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
    const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); 'ok'`)
    // ⚠ 踩坑台账 E6:同文档只换 hash 不会重新加载 ⇒ 必须经 about:blank 强制一次真加载,否则 store 里没有令牌
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` })
    await sleep(6000)
    const r = JSON.parse(await evaluate(PROBE))
    console.log(`面板 ${PANEL} @ ${BASE}`)
    console.log(`  列数 ${r.cols.length} | 单元格 ${r.cellCount} | DOM ${r.dom} | 行高 ${r.rowH}px / 表头 ${r.headH}px`)
    console.log(`  文字被截断: ${r.truncated}/${r.cellCount} (${(100 * r.truncated / Math.max(1, r.cellCount)).toFixed(1)}%)  样例 ${JSON.stringify(r.truncSamples)}`)
    console.log(`  数字列对齐/等宽:`)
    for (const c of r.numCols) console.log(`    ${c.col.padEnd(14)} text-align=${c.align.padEnd(8)} font-variant-numeric=${c.tabular}`)
    console.log(`  低对比度文本(<4.5): ${r.lowContrast.length} 例`)
    for (const c of r.lowContrast) console.log(`    "${c.txt}" 对比度 ${c.ratio} (${c.px}px, ${c.color} on ${c.bg})`)
    console.log(`  点击热区 <40px: ${r.smallTargets.length}/${r.btnCount} 例`)
    for (const t of r.smallTargets) console.log(`    "${t.t}" ${t.w}x${t.h}`)
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
