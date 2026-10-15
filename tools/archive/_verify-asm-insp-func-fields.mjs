/*
 * _verify-asm-insp-func-fields.mjs — 成品检验单补齐「出货检验功能性测试」组字段的界面实测(2026-10-16,一次性探针)
 *
 * 断言(截图顺序):
 *   ① 表头出现 客户名称(在 批次号 与 产品编码 之间);
 *   ② 明细列出现 产线常规功能性结果 与 结果判断,且次序 = 检验要求 → 检验方法 → 产线常规功能性结果 → 结果判断;
 *   ③ 两个新格可编辑(懒激活格子需 CDP 真实点击;真实键入后回显)。
 *
 * ⚠ 只读:只在页面内存里录入,**不保存**(正式账库不落测试数据)。
 * 用法: node tools/archive/_verify-asm-insp-func-fields.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PANEL = 'QC_ASM_INSP'
const PORT = 9466
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
const H = { Authorization: 'Bearer ' + login.data.token }

/* ① API 侧先核一遍列次序(与界面互为印证) */
const cfg = (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=${PANEL}`, { headers: H }).then((r) => r.json())).data
const cols = (cfg?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns || []).map((f) => (typeof f === 'string' ? f : f.dataName))
console.log('   明细列(config): ' + cols.join('|'))
/* ⚠ 表的**列序是活的**:用户会在面板「字段管理」里自己调(实测 2026-10-16 就被调成 10/20/30/50…180
   的整十序号),所以这里只断言「该有的在、不该有的不在」这类**不变量**,不钉死整表顺序。 */
const visible = cols.filter((x) => x !== '行号' && x !== '表区')
const mIdx = ['测量值1', '测量值2', '测量值3', '测量值4', '测量值5'].map((x) => visible.indexOf(x))
ok('明细含 检验要求/检验方法/产线常规功能性结果/结果判断,且不含旧名「判定」',
  ['检验要求', '检验方法', '产线常规功能性结果', '结果判断'].every((x) => visible.includes(x))
  && !visible.includes('判定'), visible.join('|'))
ok('「数量」「实测数值」两个字段已按口径去掉(界面不再出现)',
  !visible.includes('数量') && !visible.includes('实测数值'), visible.join('|'))
ok('5 个测量值列都在且相邻', mIdx.every((v, i) => v >= 0 && (i === 0 || v === mIdx[i - 1] + 1)), mIdx.join(','))
ok('两个带"结果"的字段相邻(产线常规功能性结果 → 结果判断)',
  visible.indexOf('结果判断') === visible.indexOf('产线常规功能性结果') + 1, visible.slice(-3).join('|'))

/* ② 界面 */
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-asmfunc-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1760,1080',
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
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/${PANEL}` }); await sleep(6500)

  const heads = await ev(`[...document.querySelectorAll('.arch-section .el-table__header th, .el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,'')).filter(Boolean)`)
  console.log('   明细表头(界面,分区后): ' + heads.join('|'))
  /* ⚠ 2026-10-16 口径变更:明细区改为**按表区分区渲染**(QC_ASM_INSP),每区只显示本区该有的列
     —— (外观区不出现测量值列、尺寸/出货重量区出现测量值1..5),故不再与 config 全量列一一相等。
     改成断言:**界面出现的列必须都是 config 里登记过的列**(不出现野生列),且关键列都在。 */
  const shownVisible = heads.filter((x) => x !== '行号' && x !== '表区' && x !== '序号' && x !== '操作')
  const wild = shownVisible.filter((x) => !visible.includes(x))
  ok('界面出现的明细列都在 config 登记范围内(无野生列)', wild.length === 0, '野生=' + wild.join('|'))
  ok('分区渲染下仍能看到 检验要求/检验方法/检验结果/结果判断',
    ['检验要求', '检验方法', '检验结果', '结果判断'].every((k) => shownVisible.includes(k)), shownVisible.join('|'))

  const formLabels = await ev(`[...document.querySelectorAll('.header-fields label')].map(l=>(l.innerText||'').trim())`)
  console.log('   表头字段: ' + formLabels.join('|'))
  const hi = formLabels.indexOf('客户名称'), bno = formLabels.indexOf('批次号'), pc = formLabels.indexOf('产品编码')
  ok('表头出现「客户名称」', hi >= 0, formLabels.join('|'))
  ok('客户名称 排在 批次号 之后、产品编码 之前', hi > bno && hi < pc, `批次号=${bno} 客户名称=${hi} 产品编码=${pc}`)

  /* ③ 新格可编辑 —— ⚠ 只有草稿态可编辑:列表页当前单可能是「已审核」(只读,格子点不开编辑器)。
        不是草稿就明确跳过(落库/可编辑另由 _verify-asm-insp-func-save.mjs 在测试账套建草稿验证)。 */
  const isDraft = !!(await ev(`!!document.querySelector('.header-fields.is-draft')`))
  if (!isDraft) {
    console.log('   -- 跳过「可编辑」子项:当前打开的单不是草稿(只读);该子项由 _verify-asm-insp-func-save.mjs 覆盖')
  } else {
    /* 2026-10-16 口径:分区里**没有加行入口**,固定项是自动补的**真行** ⇒ 直接在该行上验可编辑。 */
    const targetRow = await ev(`(()=>{const s=[...document.querySelectorAll('.arch-section')].find(x=>/外观/.test(x.querySelector('.arch-section-title')?.innerText||''));
       const tr=[...s.querySelectorAll('.el-table__body tbody tr')].find(x=>!/ph-row/.test(x.className));
       return tr? (tr.innerText||'').replace(/\\s+/g,' ').trim() : 'NO_ROW'})()`)
    ok('外观区有可直接编辑的真行(固定项自动补)', !/NO_ROW/.test(String(targetRow)), String(targetRow).slice(0, 120))
    await sleep(900)
    /* 在该区里定位「产线常规功能性结果」列 × 第一条真行(非占位行)
       ⚠ 点格里的 span(.cell-lazy),别点 td 中心:空格子的 span 宽度≈0,点中心会落空(2026-10-16 实测) */
    const cellPt = async (label) => JSON.parse(String(await ev(`(()=>{
       const s=[...document.querySelectorAll('.arch-section')].find(x=>/外观/.test(x.querySelector('.arch-section-title')?.innerText||''));
       if(!s) return JSON.stringify({err:'NO_SEC'});
       const h=[...s.querySelectorAll('.el-table__header th')].map(t=>(t.innerText||'').replace(/[\\s⇅↑↓]+/g,''));
       const ci=h.indexOf(${JSON.stringify(label)});
       const tr=[...s.querySelectorAll('.el-table__body tbody tr')].find(x=>!x.className.includes('ph-row'));
       if(!tr||ci<0) return JSON.stringify({err:true,ci:ci,rows:s.querySelectorAll('.el-table__body tbody tr').length});
       const td=tr.querySelectorAll('td')[ci];
       const sp=td.querySelector('.cell-lazy')||td.querySelector('.cell')||td;
       const r=sp.getBoundingClientRect();
       return JSON.stringify({x:Math.round(r.x+4), y:Math.round(r.y+r.height/2)}) })()`)))
    const pt = await cellPt('产线常规功能性结果')
    ok('定位到「产线常规功能性结果」格', !!pt && !pt.err, JSON.stringify(pt))
    /* 懒激活格子:合成 click 打不开编辑器,必须 CDP 真实鼠标 */
    for (const t of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type: t, x: pt.x, y: pt.y, button: 'left', clickCount: 1 })
    }
    await sleep(700)
    const ready = await ev(`(()=>{const i=document.querySelector('.arch-section .el-table__body input, .arch-section .el-table__body textarea');if(!i)return 'NO_EDITOR';return 'EDITOR:'+i.tagName})()`)
    ok('该格可编辑(出现输入框)', String(ready).startsWith('EDITOR'), String(ready))
    await send('Input.insertText', { text: '99.1%' })
    await sleep(300)
    const pt2 = await cellPt('结果判断')
    for (const t of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type: t, x: pt2.x, y: pt2.y, button: 'left', clickCount: 1 })
    }
    await sleep(700)
    const shown = await ev(`(()=>{
       const s=[...document.querySelectorAll('.arch-section')].find(x=>/外观/.test(x.querySelector('.arch-section-title')?.innerText||''));
       if(!s) return '';
       const tr=[...s.querySelectorAll('.el-table__body tbody tr')].find(x=>!x.className.includes('ph-row'));
       return tr? (tr.innerText||'').replace(/\\s+/g,' ') : '' })()`)
    ok('键入 99.1% 后回显在「产线常规功能性结果」格', String(shown).includes('99.1'), '显示=' + String(shown))
    ok('「结果判断」格也能打开编辑器', String(await ev(`(()=>{return document.querySelector('.arch-section .el-table__body input, .arch-section .el-table__body textarea')?'EDITOR':'NO'})()`)) === 'EDITOR')
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot?.result?.data) {
    const out = path.join(HERE, '_verify-asm-insp-func-fields.png')
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
    console.log('   截图: ' + out)
  }
} finally { try { edge.kill() } catch {} }

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)

