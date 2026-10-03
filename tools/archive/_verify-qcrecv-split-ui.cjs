/**
 * _verify-qcrecv-split-ui.cjs — 送料暂收单「生单」分流的**界面**验证(2026-10-05)
 *
 * 后端探针(_verify-qcrecv-split.mjs)证明数据落得对,证明不了"用户看到的按钮长什么样、点完说了什么"。
 * 本探针开真实浏览器(Edge + CDP,零外部依赖,Node 自带 WebSocket),断言的是**渲染结果**:
 *   ① 工具栏「生单」只剩**一个**动作:该组**没有 ▼ 下拉**(旧的两个按钮会渲染出 ▼),
 *      且工具栏上不再出现「生成来料检验单 / 生成采购入库单」字样;
 *   ② 未审核单据上该按钮**置灰**(动作名以「生成」开头 → 走既有"仅已审核可生单"闸门);
 *   ③ 已审核的两行暂收单(行1 来料检验=是 / 行2 =否)点一次「生单」→ 弹出提示里
 *      **同时列出** 来料检验单 与 采购入库单 两张单号,并跳到第一张(来料检验单)。
 *
 * 跑在**测试账套**(登录 factory=YJ_TEST),自己在测试库造单、跑完清理;页面用 8090 上的构建产物。
 * 用法:node tools/archive/_verify-qcrecv-split-ui.cjs   (env: YJ_BASE / YJ_HEADLESS=0 可开有头)
 */
'use strict'
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BASE = process.env.YJ_BASE || 'http://127.0.0.1:8090'
const API = BASE + '/api'
const PORT = Number(process.env.YJ_CDP_PORT || 9361)
const INS_CODE = 'YJ-XH-001'
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

  // ---------- ① 测试账套令牌 + 造一张"一是一否"的已审核暂收单 ----------
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  if (!lj?.data?.token) { console.error('登录失败:' + JSON.stringify(lj).slice(0, 200)); process.exit(1) }
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token }
  const post = async (u, b) => {
    const j = await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json()
    if (j.code !== 0 && j.code !== 200) throw new Error(u + ' → ' + j.message)
    return j.data
  }
  const tryPost = async (u, b) =>
    (await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json())
  const docOf = async (p, no) =>
    (await post('/px/queryFormDataList', { panelCode: p, condition: { 单据编号: no }, pageNo: 1, pageSize: 5 })).list[0]

  const auditRecv = async (no) => {
    let a = await tryPost('/px/callButton', { panelCode: 'QC_RECV', buttonName: '审核', formData: { 编号: no }, buttonParam: {} })
    if (a.code === 409 && /仓库/.test(String(a.message))) {
      const full = await docOf('QC_RECV', no)
      await post('/px/callButton', {
        panelCode: 'QC_RECV', buttonName: '保存',
        formData: { ...full, detail: { items: (full.detail?.items || []).map((it) => ({ ...it, 仓库: '恒亿仓' })) } }, buttonParam: {},
      })
      a = await tryPost('/px/callButton', { panelCode: 'QC_RECV', buttonName: '审核', formData: { 编号: no }, buttonParam: {} })
    }
    if (!(a.code === 0 || a.code === 200)) throw new Error('审核失败:' + a.message)
  }

  // 草稿单:先给「未审核 → 按钮置灰」用(不审核)
  const list = await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 200 })
  let pick = null
  for (const d of (list.list || []).filter((x) => x['单据状态'] === '已审核')) {
    const st = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: d['编号'] })
    const usable = (st.lines || []).filter((l) => Number(l.剩余数量) >= 2)
    if (usable.length >= 2) { pick = { poNo: d['编号'], lines: usable.slice(0, 2) }; break }
  }
  if (!pick) { console.error('找不到两行都有剩余的已审核采购订单'); process.exit(1) }

  const made = []
  const newRecv = async () => {
    const g = await post('/px/batchFlow/generate', {
      sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.poNo,
      lines: pick.lines.map((l) => ({ lineKey: l.lineKey, qty: 2 })),
    })
    made.push(['QC_RECV', g['编号']])
    const full = await docOf('QC_RECV', g['编号'])
    const items = full.detail.items
    items[0]['物料编码'] = INS_CODE
    items[0]['物料名称'] = '鑫恒（80-250）'
    await post('/px/callButton', { panelCode: 'QC_RECV', buttonName: '保存', formData: { ...full, detail: { items } }, buttonParam: {} })
    return g['编号']
  }

  const draftNo = await newRecv()          // ② 置灰用(保持草稿)
  const auditedNo = await newRecv()        // ③ 实点用
  await auditRecv(auditedNo)
  console.log(`=== 测试账套造单:草稿 ${draftNo} / 已审核 ${auditedNo}(行1 ${INS_CODE}=是,行2=否) ===`)

  // ---------- ② 开浏览器 ----------
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-edge-'))
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
      return r.result?.result?.value
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 50; i++) {
        await sleep(300)
        if ((await evaluate('document.readyState')) === 'complete') { await sleep(700); return }
      }
    }
    await send('Page.enable'); await send('Runtime.enable')

    // 登录态注入(应用启动时才读 localStorage → 注入后整页重载)→ 定位到指定单据
    await navigate(`${BASE}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))});
localStorage.setItem('mes_login_date', '2026-10-03'); 'ok'`)

    // ---- ① 按钮形态(草稿单:同时看置灰) ----
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/QC_RECV?docNo=${encodeURIComponent(draftNo)}`)
    await sleep(4500)
    const toolbar = await evaluate(`[...document.querySelectorAll('.tools .tb-main')].map(e => e.querySelector('.act-name')?.textContent?.trim())`)
    console.log('  [toolbar] ' + JSON.stringify(toolbar))
    const shengdan = await evaluate(`(() => {
      const g = [...document.querySelectorAll('.tools .tb-group')].find(x => x.querySelector('.act-name')?.textContent?.trim() === '生单')
      if (!g) return null
      return { actions: g.querySelectorAll('.tb-menu .ctx-item').length, hasCaret: !!g.querySelector('.tb-caret'),
               disabled: g.querySelector('.tb-main')?.classList.contains('disabled') }
    })()`)
    console.log('  [生单组] ' + JSON.stringify(shengdan))
    ok(!!shengdan, '工具栏有「生单」按钮')
    ok(shengdan && !shengdan.hasCaret, '「生单」组没有 ▼ 下拉(只有一个动作)', JSON.stringify(shengdan))
    ok(!toolbar.includes('生成来料检验单') && !toolbar.includes('生成采购入库单'),
      '工具栏不再出现旧的两个生单按钮', JSON.stringify(toolbar))
    ok(shengdan?.disabled === true, '草稿单上「生单」置灰(仅已审核可生单)')

    // ---- ② 已审核单:实点一次,看提示与跳转 ----
    await navigate('about:blank')
    await navigate(`${BASE}/#/panelx/list/QC_RECV?docNo=${encodeURIComponent(auditedNo)}`)
    await sleep(4500)
    const shengdan2 = await evaluate(`(() => {
      const g = [...document.querySelectorAll('.tools .tb-group')].find(x => x.querySelector('.act-name')?.textContent?.trim() === '生单')
      return g ? g.querySelector('.tb-main')?.classList.contains('disabled') : null
    })()`)
    ok(shengdan2 === false, '已审核单上「生单」可点')
    const cur = await evaluate(`document.querySelector('.tools .doc-chip')?.textContent?.trim() || ''`)
    console.log('  [当前单据] ' + cur)

    const clicked = await evaluate(`(() => {
      const g = [...document.querySelectorAll('.tools .tb-group')].find(x => x.querySelector('.act-name')?.textContent?.trim() === '生单')
      if (!g) return 'NOT_FOUND'
      g.querySelector('.tb-main').click(); return 'CLICKED'
    })()`)
    ok(clicked === 'CLICKED', '已点击「生单」')
    // ⚠ ElMessage 默认 3 秒自动消失 —— 等 6 秒再读只会读到空。
    // 改为点击后**连续采样**把出现过的提示都收下来(生单+跳转需要几秒,消息可能一闪而过)。
    const seen = new Set()
    for (let i = 0; i < 40; i++) {
      await sleep(200)
      const t = await evaluate(`[...document.querySelectorAll('.el-message')].map(e => e.textContent.trim()).join(' | ')`)
      if (t) for (const part of String(t).split(' | ')) if (part.trim()) seen.add(part.trim())
    }
    const toast = [...seen].join(' | ')
    console.log('  [toast] ' + toast)
    ok(/来料检验单/.test(toast) && /采购入库单/.test(toast), '提示里同时列出 来料检验单 与 采购入库单', toast)
    const toastNos = [...toast.matchAll(/(IJ|PI)-[0-9-]+/g)].map((m) => m[0])
    ok(toastNos.length >= 2, '提示里带两张单号', JSON.stringify(toastNos))

    // 跳转:面板标题变来料检验单(第一张)
    const landed = await evaluate(`document.querySelector('.tools .doc-chip')?.textContent?.trim() || document.title`)
    const panelName = await evaluate(`[...document.querySelectorAll('.el-tabs__item')].map(e => e.textContent.trim()).join(',')`)
    console.log('  [跳转后] chip=' + landed + ' tabs=' + panelName)
    ok(/IJ-/.test(String(landed)) || /来料检验单/.test(String(panelName)),
      '跳到第一张(来料检验单)', 'chip=' + landed + ' tabs=' + panelName)

    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }

  // ---------- 清理 ----------
  for (const [panel, no] of made.reverse()) {
    for (const b of ['弃审', '删除']) {
      try { await post('/px/callButton', { panelCode: panel, buttonName: b, formData: { 编号: no }, buttonParam: {} }) } catch (e) { /* 未审核/已删 */ }
    }
  }
  console.log('\n   清理:已弃审/删除 ' + made.map(([, n]) => n).join(', '))
  console.log('\n' + (fails ? `❌ ${fails} 项失败` : '✅ 全部通过'))
  process.exit(fails ? 1 : 0)
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
