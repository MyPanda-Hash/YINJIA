/*
 * _verify-asm-insp-sections.mjs — 成品检验单「三区分区渲染」界面实测(2026-10-16,一次性探针)
 *
 * 用户口径:「按三区实现,没有数据的时候显示和当前截图形式相当即可」。
 * 验:
 *   ① 明细区不再是"一张大表",而是**分区块**:A.外观 / B.尺寸 / C.出货重量(字母按类别首现自动编);
 *   ② 每区有**自己的区标题 + 列头**;
 *   ③ 外观区的列 = 端盖两头 | 管身两侧 | 按照外观检验项目填充(固定项来自 yj_panel.config.fixedItems);
 *      尺寸/出货重量区 = 各自的「按照X检验项目填充」组列;
 *   ④ **没有数据时也铺出这三区**(截图形式):区内有可点的空格提示;
 *   ⑤ 点空格/占位行能在该区新增一行(预置 表区),且**不点保存不入库**。
 * ⚠ 只读性质:新增的行只在页面内存里,不点保存(库里不留痕)。
 * 用法: node tools/archive/_verify-asm-insp-sections.mjs [base]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9471
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = import.meta.dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
/* 面板字段配置:用于断言"分区里的列 = 用户调好的字段排列原样"(口径「字段保留我原来修改好的字段实现」) */
const cfg = (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=QC_ASM_INSP`,
  { headers: { Authorization: 'Bearer ' + login.data.token } }).then((r) => r.json())).data

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-sec-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1760,1200',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(3000)
try {
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let n = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++n; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/QC_ASM_INSP` }); await sleep(7000)

  /* 翻到草稿(已审核单只读,看不到可编辑的格子) */
  const findDraft = async () => {
    for (let i = 0; i < 8; i++) {
      if (await ev(`!!document.querySelector('.header-fields.is-draft')`)) return true
      const c = await ev(`(()=>{const b=[...document.querySelectorAll('.page-btn')].find(x=>(x.getAttribute('title')||'')==='下一张');if(!b)return 'NO';b.click();return 'OK'})()`)
      if (c !== 'OK') return false
      await sleep(1800)
    }
    return false
  }
  ok('翻到一张草稿', await findDraft())

  /* ① 分区块存在 */
  const titles = await ev(`[...document.querySelectorAll('.arch-section-title')].map(x=>(x.innerText||'').trim().split('\\n')[0])`)
  console.log('   分区标题: ' + JSON.stringify(titles))
  ok('明细区按表区切成多个分区块(不是一张大表)', Array.isArray(titles) && titles.length >= 1, JSON.stringify(titles))
  ok('出现「A.外观」区', (titles || []).some((t) => /外观/.test(t)))
  ok('出现「B.尺寸」区', (titles || []).some((t) => /尺寸/.test(t)))
  ok('出现「C.出货重量」区', (titles || []).some((t) => /出货重量|重量/.test(t)))

  /* ② 每区有自己的列头 */
  const secCols = await ev(`[...document.querySelectorAll('.arch-section')].map(s=>({
      title: (s.querySelector('.arch-section-title')?.innerText||'').trim().split('\\n')[0],
      cols: [...s.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,'')).filter(Boolean)
    }))`)
  for (const s of secCols || []) console.log('     · ' + s.title + ' → ' + s.cols.join(' | '))
  ok('每个分区都有自己的列头', (secCols || []).every((s) => s.cols.length > 0), JSON.stringify(secCols).slice(0, 200))
  /* ⚠ 口径(2026-10-16 用户拍板「**字段保留我原来修改好的字段实现**」):分区只按表区切块,
     **不对列做裁剪/重排** —— 每区的列集与顺序 = 面板字段配置(与下面「明细行」列表一致),
     只排除结构性隐藏列 表区/行号。 */
  const cfgCols = (cfg.detail?.tabs?.[0]?.fields || [])
    .filter((f) => f.dataName && f.dataName !== '表区' && f.dataName !== '行号' && f.visible !== false)
    .map((f) => f.dataName)
  console.log('   配置列(应为每区一致的列集): ' + cfgCols.join('|'))
  const app = (secCols || []).find((s) => /外观/.test(s.title)) || { cols: [] }
  const appCols = (app.cols || []).filter((c) => c !== '序号' && c !== '操作')
  ok('外观区列 = 面板字段配置原样(不裁剪、不重排)',
    JSON.stringify(appCols) === JSON.stringify(cfgCols), appCols.join('|'))
  ok('外观区仍保留 测量值1..5(字段保留,不因"定性区"被裁掉)',
    ['测量值1', '测量值2', '测量值3', '测量值4', '测量值5'].every((c) => appCols.includes(c)), appCols.join('|'))
  ok('外观区仍保留 检验结果 / 产线常规功能性结果 / 备注',
    ['检验结果', '产线常规功能性结果', '备注'].every((c) => appCols.includes(c)), appCols.join('|'))
  const appRows = await ev(`(()=>{const s=[...document.querySelectorAll('.arch-section')].find(x=>/外观/.test(x.querySelector('.arch-section-title')?.innerText||''));
      return s? [...s.querySelectorAll('.el-table__body tbody tr')].map(tr=>(tr.innerText||'').replace(/\\s+/g,' ').trim()).join(' || ') : ''})()`)
  console.log('   外观区固定项行: ' + String(appRows).slice(0, 200))
  ok('外观区**默认就有**固定项真行(端盖两头 / 管身两侧,可填 — 不是占位行)',
    /端盖两头/.test(String(appRows)) && /管身两侧/.test(String(appRows)), String(appRows).slice(0, 160))
  const size = (secCols || []).find((s) => /尺寸/.test(s.title)) || { cols: [] }
  const sizeCols = (size.cols || []).filter((c) => c !== '序号' && c !== '操作')
  ok('尺寸区列 = 面板字段配置原样(与外观区同一套)',
    JSON.stringify(sizeCols) === JSON.stringify(cfgCols), sizeCols.join('|'))

  /* ③ 分区**下面仍有明细行列表**(用户口径「中间为固定的检验项目、下面为明细行」;
     照旧系统截图:上面 A~E 分区,下面是明细列表条)。分区不替代明细表。 */
  const detailBand = await ev(`(()=>{const d=[...document.querySelectorAll('.arch-detail-band .arch-section-title')].map(x=>(x.innerText||'').trim().split('\\n')[0]);return d})()`)
  console.log('   明细行列表带标题: ' + JSON.stringify(detailBand))
  ok('分区下面有「明细行」列表区(分区不替代明细表)', (detailBand || []).some((x) => /明细行/.test(x)), JSON.stringify(detailBand))
  /* 明细行列表 = 通用 el-table:数它自己的列头(应包含全量明细列,如 备注/检查频率 等) */
  const flatHeads = await ev(`(()=>{const band=document.querySelector('.arch-detail-band');
      const el=band && band.nextElementSibling;
      if(!el) return [];
      const hs=[...el.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,'')).filter(Boolean);
      return hs})()`)
  console.log('   明细行列表头: ' + (flatHeads || []).join('|').slice(0, 220))
  ok('明细行列表带全量明细列(含「备注」等分区里没有的列)', (flatHeads || []).includes('备注'), (flatHeads || []).join('|'))

  /* ④ 没有数据的区也铺出来了(截图形式):区里有"暂无数据 + 本区固定项"指引 */
  const empties = await ev(`[...document.querySelectorAll('.arch-section')].filter(s=>s.querySelector('.arch-section-hint')).map(s=>(s.querySelector('.arch-section-title')?.innerText||'').replace(/\\s+/g,' ').trim())`)
  console.log('   空数据区(带提示): ' + JSON.stringify(empties))
  ok('没有数据的固定区也铺出(带"暂无数据…在下方明细行新增或带入"提示)', (empties || []).length > 0, JSON.stringify(empties))
  /* ⚠ 2026-10-16 口径:固定项**自动补成真行**(端盖两头/管身两侧) ⇒ 外观区通常不是空区;
     尺寸/出货重量 没有声明固定项 ⇒ 仍是空区(带提示)。 */
  const emptySize = (empties || []).some((x) => /尺寸/.test(x))
  ok('尺寸区(无固定项)仍以空区+提示铺出', emptySize, JSON.stringify(empties))

  /* ⑤ 分区**不提供加行入口**(用户口径「不需要增加除去最底下的明细行的增加行的实现」):
     - 没有「＋新增检验项」这类动作;
     - 点区里的空态行**不加行**;
     - 加行只在下方「明细行」列表里做(该列表有「新增数据」按钮)。 */
  const addActs = await ev(`[...document.querySelectorAll('.arch-section .arch-section-act, .arch-section-acts')].length`)
  ok('分区里没有任何"加行"动作入口(无 ＋新增检验项)', (addActs || 0) === 0, 'acts=' + addActs)
  const realRows = () => ev(`[...document.querySelectorAll('.arch-section')].map(s=>
      [...s.querySelectorAll('.el-table__body tbody tr')].filter(tr=>!tr.className.includes('ph-row')).length)`)
  const before = await realRows()
  const pt = JSON.parse(String(await ev(`(()=>{const s=document.querySelector('.arch-section');
      const tr=[...s.querySelectorAll('.el-table__body tbody tr')][0]; if(!tr) return JSON.stringify({err:true});
      const r=tr.getBoundingClientRect(); return JSON.stringify({x:Math.round(r.x+40), y:Math.round(r.y+r.height/2)}) })()`)))
  if (!pt.err) {
    for (const t of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type: t, x: pt.x, y: pt.y, button: 'left', clickCount: 1 })
    }
  }
  await sleep(1200)
  const after = await realRows()
  console.log('   点空态行后真实行数: ' + JSON.stringify(before) + ' → ' + JSON.stringify(after))
  ok('点区里的空态行**不会**新增行(分区不加行)', JSON.stringify(after) === JSON.stringify(before), `${JSON.stringify(before)} → ${JSON.stringify(after)}`)
  const listAddBtn = await ev(`(()=>{const band=document.querySelector('.arch-detail-band'); const box=band&&band.parentElement;
      return [...box.querySelectorAll('button,.el-button,.dt-ic')].map(x=>(x.innerText||'').trim()).filter(Boolean).join('|')})()`)
  console.log('   明细行列表的动作: ' + String(listAddBtn).slice(0, 160))
  ok('加行入口在「明细行」列表(有「新增数据」)', /新增数据/.test(String(listAddBtn)), String(listAddBtn).slice(0, 120))

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot?.result?.data) {
    const out = path.join(HERE, '_verify-asm-insp-sections.png')
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
    console.log('   截图: ' + out)
  }
} finally { try { edge.kill() } catch {} }

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)
