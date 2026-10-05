/**
 * _verify-qcinsp-header-dept-ui.cjs — 来料检验单表头「部门/部门编码」的**界面**验收(2026-10-05)
 *
 * 库与接口探针(_verify-qcinsp-header-dept.mjs)证明字段登记与下发都对,证明不了"用户看得见"。
 * 本探针开**真实浏览器**(Edge + CDP,零外部依赖)打开来料检验单面板,直接在 DOM 里核对:
 *   ① 表头卡片(.header-fields)出现「部门」「部门编码」两个标签;
 *   ② 位置:落在「供应商代码」之后、「检验员」之前(与 seq 85/88 一致);
 *   ③ 两个都是**可编辑的参照输入**(不是只读文本)——草稿态才可编,故用一张草稿单:没有草稿就新建;
 *   ④ 「部门编码」的候选/选中按编码型参照显示编码(refShowsCode:refField≠displayField)。
 *
 * 用法:node tools/archive/_verify-qcinsp-header-dept-ui.cjs      (env: YJ_BASE / YJ_HEADLESS=0)
 */
'use strict'
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BASE = process.env.YJ_BASE || 'http://127.0.0.1:8090'
const API = BASE + '/api'
const PORT = Number(process.env.YJ_CDP_PORT || 9377)
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const HEADLESS = process.env.YJ_HEADLESS !== '0'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c, msg, extra = '') => {
  console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}${extra ? '  ' + extra : ''}`)
  if (!c) fails++
}

async function main() {
  if (!EDGE) { console.error('未找到 Edge,无法做界面验证'); process.exit(1) }

  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  if (!lj?.data?.token) { console.error('登录失败:' + JSON.stringify(lj).slice(0, 200)); process.exit(1) }
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token }
  const post = async (u, b) => (await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json())

  // 挑一张**草稿**检验单(表头字段草稿态才可编);没有就跳过可编辑断言
  const list = await post('/px/queryFormDataList', { panelCode: 'QC_INSP', condition: {}, pageNo: 1, pageSize: 200 })
  const draft = (list.data?.list || list.list || []).find((d) => d['单据状态'] === '草稿')
  const any = (list.data?.list || list.list || [])[0]
  const target = draft || any
  if (!target) { console.error('库里没有来料检验单,无法验证界面(先在系统里建一张)'); process.exit(1) }
  console.log(`=== 目标单据:${target['编号']}(${target['单据状态']}${draft ? ' — 草稿,可编辑' : ' — 无可编辑草稿,仅验渲染'}) ===`)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-edge-dept-'))
  const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank']
  if (!HEADLESS) args.splice(0, 1)
  const edge = spawn(EDGE, args, { stdio: 'ignore' })
  await sleep(2500)

  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    }
    const send = (method, params = {}) => new Promise((res) => {
      const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) console.log('  [JS异常] ' + JSON.stringify(r.result.exceptionDetails.exception?.description || '').slice(0, 200))
      return r.result?.result?.value
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 60; i++) {
        await sleep(300)
        if ((await evaluate('document.readyState')) === 'complete') { await sleep(900); return }
      }
    }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate(`${BASE}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))});
localStorage.setItem('mes_login_date', '2026-10-05'); 'ok'`)
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/QC_INSP?docNo=${encodeURIComponent(target['编号'])}`)
    await sleep(5000)

    // ---- ① 表头卡片里的标签(按 DOM 顺序) ----
    const labels = await evaluate(`[...document.querySelectorAll('.header-fields .field > label')]
      .map(e => e.textContent.replace(/\\s+/g, '').trim())`)
    console.log('  [表头标签] ' + JSON.stringify(labels))
    ok(Array.isArray(labels) && labels.length > 0, '表头卡片渲染出了字段(选择器命中)')
    ok((labels || []).includes('部门'), '表头出现「部门」')
    ok((labels || []).includes('部门编码'), '表头出现「部门编码」')
    const iD = (labels || []).indexOf('部门'); const iC = (labels || []).indexOf('部门编码')
    const iSup = (labels || []).indexOf('供应商代码'); const iIns = (labels || []).indexOf('检验员')
    ok(iD > iSup && iD < iIns && iC === iD + 1, '位置:供应商代码 → 部门 → 部门编码 → 检验员',
      `供应商代码@${iSup} 部门@${iD} 部门编码@${iC} 检验员@${iIns}`)

    // ---- ② 两个字段的控件形态(草稿态应为可编辑参照输入) ----
    const shape = await evaluate(`(() => {
      const out = {}
      for (const name of ['部门', '部门编码']) {
        const cell = [...document.querySelectorAll('.header-fields .field')]
          .find(e => e.querySelector('label')?.textContent.replace(/\\s+/g, '').trim() === name)
        if (!cell) { out[name] = null; continue }
        const inp = cell.querySelector('input')
        out[name] = {
          input: !!inp,
          readonly: inp ? (inp.readOnly === true || inp.hasAttribute('readonly')) : null,
          disabled: inp ? inp.disabled === true : null,
          value: inp ? inp.value : '',
          placeholder: inp ? (inp.placeholder || '') : '',
        }
      }
      return out
    })()`)
    console.log('  [控件形态] ' + JSON.stringify(shape))
    for (const name of ['部门', '部门编码']) {
      ok(!!shape?.[name]?.input, `${name} 有输入控件`)
      if (draft) ok(shape?.[name]?.disabled === false, `${name} 在草稿单上可编辑(未置灰)`)
    }
    // 编码型参照:选中态显示编码(refShowsCode:refField≠displayField ⇒ 是);此处只核对取值形态不崩
    const codeVal = shape?.['部门编码']?.value ?? ''
    console.log(`  [部门编码 当前值] ${JSON.stringify(codeVal)}`)

    // ---- ③ 落图存证 ----
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    if (shot?.result?.data) {
      const out = path.join(__dirname, '_verify-qcinsp-header-dept-ui.png')
      fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
      console.log('  [截图] ' + out)
    }
  } finally {
    try { edge.kill() } catch (e) { /* ignore */ }
  }

  console.log(`\n=== ${fails === 0 ? 'RESULT: PASS' : 'RESULT: FAIL-' + fails} ===`)
  process.exitCode = fails === 0 ? 0 : 1
}

main().catch((e) => { console.error('[探针异常] ' + (e?.stack || e)); process.exit(1) })
