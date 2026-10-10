/**
 * _probe-rd-progress-ui.cjs —— 项目进度查询(RD_PROGRESS)重设计的**界面**验收(2026-10-09)
 *
 * 为什么单独一支:接口探针(_e2e-rd-progress-path.cjs)只能证明**后端落库对**,
 * 证明不了界面上的三件事 —— 用户报的正是界面:
 *   ① 控制列表纸面是不是真的 11 列(改 progressColumns.js 却忘改组件的那次就是这样漏的);
 *   ② 单元格是不是真的点不进去(汇总查看面板,人工不再往里写);
 *   ③ 侧栏按钮分类是不是理顺了(「文档输出」必须排在动作按钮**之后**,
 *      否则 新增/保存/审批 全被归到「文档输出」标题下面 —— 用户报的"按钮分类混乱")。
 *
 * 目标页:5173(vite,源码即时生效);/api 由 vite 代理到 8090。
 * 账套:YJ_TEST(登录后硬断言 JWT 账套;本探针**只读**,不造单、无清理脚本)。
 * 用法:node tools/archive/_probe-rd-progress-ui.cjs
 * 产物:tools/archive/_shots/rdprogress-*.png + stdout 逐项 ok/FAIL
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.env.YINJIA_PAGE || 'http://localhost:5173'
const FACTORY = process.env.FACTORY || 'YJ_TEST'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
/** ⚠ 端口必须避开 Windows 保留段,否则 Edge 报 `bind() … 0x271D(WSAEACCES)`,
 *  DevToolsActivePort 永不生成 → /json/new 直接 fetch failed。本机保留段实测:
 *  8408-8507 / 8508-8607 / 8708-8807 / 8808-8907 / 8908-9007 / 9181-9280 /
 *  9281-9380 / 9481-9580 / 9581-9680 / 41900-42147 / 50000-50059。
 *  查:`netsh interface ipv4 show excludedportrange protocol=tcp`(9339/9341/9377 全在 9281-9380 里)。 */
const PORT = 9777
const SHOTS = path.join(__dirname, '_shots')

/** 纸面应有 11 列(唯一真源 = frontend/src/core/progress/progressColumns.js 的 PROGRESS_COLUMNS) */
const EXPECT_COLS = ['项目定级', '项目名称', '子项目/尺寸', '项目编号', '内容',
  '项目发起人', '项目负责人', '立项日期', '预计完成日期', '状态', '测试情况']
/** 2026-10-09 用户口径撤下的三列 —— 纸面上必须一列都不剩 */
const DROPPED_COLS = ['技术目标达成', '是否市场转化', '未转换原因']

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(userName) {
  const r = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password: '123456', factory: FACTORY }),
  })).json()
  if (!r?.data?.token) throw new Error(`${userName} 登录失败:${JSON.stringify(r).slice(0, 200)}`)
  if (r.data.user?.factory !== FACTORY) throw new Error(`令牌账套不是 ${FACTORY}(实为 ${r.data.user?.factory}),已中止`)
  return { token: r.data.token, user: r.data.user }
}

async function main() {
  console.log(`\n=== 项目进度查询(RD_PROGRESS)界面验收 —— 页 ${BASE} / 账套 ${FACTORY} ===`)
  const admin = await login('admin')
  ok(`登录成功(${admin.user.realName},账套 ${admin.user.factory} 已断言)`)

  fs.mkdirSync(SHOTS, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rdprogress-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1500', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await sleep(3000)
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3400); return } }
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `rdprogress-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1500, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(admin.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(admin.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_PROGRESS`)
    await sleep(2500)
    // 关掉可能的「初始化」引导弹窗(否则挡住测量)
    await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      for (var i=0;i<ds.length;i++){ var t=(ds[i].innerText||'')
        if (t.indexOf('初始化')>=0){ var bs=[].slice.call(ds[i].querySelectorAll('button,span,a'))
          for (var j=0;j<bs.length;j++){ if((bs[j].textContent||'').trim()==='下次再说'){ bs[j].click(); return 'dismissed' } } } }
      return 'none' })()`)
    await sleep(1200)

    // ── 对照组:先证明选择器打得到东西(否则后面"没命中"全是假绿)──
    step('⓪ 对照组:页面确实渲染出了控制列表')
    const thCount = await ev(`document.querySelectorAll('.ps-table thead th').length`)
    const ctrlTh = await ev(`document.querySelectorAll('.ps-table thead th').length > 0`)
    if (ctrlTh) ok(`对照组通过:.ps-table thead th 命中 ${thCount} 个`)
    else { bad(`对照组失败:.ps-table thead th 命中 ${thCount} —— 页面没渲染/选择器失效,后续断言无意义`); throw new Error('对照组失败') }

    // ── ① 纸面 11 列 ──
    step('① 控制列表纸面列 = PROGRESS_COLUMNS 的 11 列(撤掉的三列必须一列不剩)')
    const ths = await ev(`[].slice.call(document.querySelectorAll('.ps-table thead th')).map(function(x){return (x.textContent||'').trim()})`)
    console.log(`     实际表头(${ths.length})= ${JSON.stringify(ths)}`)
    if (JSON.stringify(ths) === JSON.stringify(EXPECT_COLS)) ok(`表头与期望 11 列逐列一致`)
    else bad(`表头不符\n         期望=${JSON.stringify(EXPECT_COLS)}\n         实际=${JSON.stringify(ths)}`)
    const leftovers = DROPPED_COLS.filter((c) => ths.includes(c))
    if (leftovers.length === 0) ok(`撤下的三列(${DROPPED_COLS.join('/')})均未出现`)
    else bad(`纸面上仍有撤下的列:${leftovers.join('/')}`)

    const tds = await ev(`(function(){ var tr=document.querySelector('.ps-table tbody tr'); return tr?tr.querySelectorAll('td').length:-1 })()`)
    if (tds === EXPECT_COLS.length) ok(`首行单元格数 = ${tds}(与 11 列表头对齐,无操作列)`)
    else bad(`首行单元格数 = ${tds},期望 ${EXPECT_COLS.length}(列数错位会让整张表串位)`)

    // ── ② 单元格只读 ──
    step('② 单元格恒只读(汇总查看面板:数据由流程自动导入)')
    const inputs = await ev(`document.querySelectorAll('.ps-table tbody input, .ps-table tbody textarea').length`)
    if (inputs === 0) ok('表体里没有任何 input/textarea —— 点不进去')
    else bad(`表体里仍有 ${inputs} 个可输入控件(应为 0)`)
    const psv = await ev(`(function(){ var e=document.querySelector('.ps-table tbody .ps-cell-text'); return e?(e.textContent||'').trim().slice(0,40):null })()`)
    console.log(`     首个只读文本格 = ${JSON.stringify(psv)}`)

    // ── ③ 底部写入口 ──
    step('③ 底部只剩「同步阶段进度」(新增项目 / 导入Excel 已撤)')
    const bar = await ev(`(function(){ var e=document.querySelector('.ps-addbar'); return e?(e.innerText||'').replace(/\\s+/g,' ').trim():null })()`)
    console.log(`     .ps-addbar = ${JSON.stringify(bar)}`)
    if (bar && bar.indexOf('同步阶段进度') >= 0) ok('「⟳ 同步阶段进度」在(重跑自动导入的入口保留)')
    else bad('「同步阶段进度」不见了 —— 它不该跟着 editable 一起消失')
    if (bar && bar.indexOf('新增项目') < 0 && bar.indexOf('导入Excel') < 0) ok('「＋ 新增项目」「⬆ 导入Excel」均已撤')
    else bad(`底部仍有写入口:${bar}`)

    // ── ④ 单单据面板:单据切换 / 状态胶囊不渲染 ──
    step('④ 单单据面板:侧栏「单据状态胶囊 + 单据切换分页器」整块不渲染')
    const pager = await ev(`document.querySelectorAll('.as-side-pager, .as-side-status-row').length`)
    if (pager === 0) ok('分页器与状态胶囊均未渲染(singleDocMode 生效)')
    else bad(`仍有 ${pager} 个单据切换/状态胶囊节点`)

    // ── ⑤ 侧栏按钮分类:文档输出排在动作按钮之后 ──
    step('⑤ 侧栏分类:「文档输出」必须排在动作按钮**之后**(否则动作全被归到它下面)')
    const order = await ev(`(function(){
      var box=document.querySelector('.approval-side'); if(!box) return null
      return [].slice.call(box.querySelectorAll('.as-side-section, .as-side-btn')).map(function(e){
        return { kind: e.classList.contains('as-side-section') ? 'SEC' : 'BTN', text: (e.textContent||'').replace(/\\s+/g,' ').trim() }
      }) })()`)
    if (!Array.isArray(order) || !order.length) { bad(`读不到侧栏结构:${JSON.stringify(order)}`) }
    else {
      console.log(`     侧栏顺序 = ${order.map((x) => (x.kind === 'SEC' ? `【${x.text}】` : x.text)).join(' > ')}`)
      const secIdx = order.map((x, i) => (x.kind === 'SEC' ? i : -1)).filter((i) => i >= 0)
      const lastSec = secIdx.length ? order[secIdx[secIdx.length - 1]].text : ''
      if (lastSec === '文档输出') ok('最后一个分节标题 = 「文档输出」(已在侧栏末尾)')
      else bad(`最后一个分节标题 = 「${lastSec}」,期望「文档输出」`)
      const idxOf = (t) => order.findIndex((x) => x.kind === 'BTN' && x.text === t)
      const iOut = idxOf('导出'), iScan = idxOf('扫描填单'), iSave = idxOf('保存'), iDocSec = order.findIndex((x) => x.kind === 'SEC' && x.text === '文档输出')
      if (iOut > iDocSec && iScan > iDocSec) ok('「导出」「扫描填单」都在「文档输出」分节之下')
      else bad(`导出 idx=${iOut} / 扫描填单 idx=${iScan} / 文档输出分节 idx=${iDocSec}(两者都应 > 分节 idx)`)
      if (iSave >= 0 && iSave < iDocSec) ok(`「保存」在「文档输出」之前(idx=${iSave} < ${iDocSec})—— 动作按钮不再被归到文档输出下`)
      else bad(`「保存」idx=${iSave} 未排在「文档输出」分节(idx=${iDocSec})之前`)
      const misgrouped = order.slice(0, iDocSec).filter((x) => x.kind === 'BTN' && ['打印', '导出报表'].includes(x.text))
      if (misgrouped.length === 0) ok('「打印」「导出报表」未被留在上面的动作组里')
      else bad(`「文档输出」的两个按钮仍留在上方动作组:${misgrouped.map((x) => x.text).join('/')}`)
    }

    // ── ⑥ 截图 ──
    step('⑥ 截图留证')
    const f1 = await shot('panel')
    console.log(`     ${f1}`)
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }

  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
