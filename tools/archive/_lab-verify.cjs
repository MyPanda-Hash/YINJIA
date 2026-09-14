/**
 * _lab-verify.cjs — 实验室 4 面板全链路验证(API 保存/读回 + 浏览器渲染/变体切换)
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9348
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function api(method, p, body, token) {
  const res = await fetch(API + p, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}
async function main() {
  const lr = await api('POST', '/auth/login', { userName: 'admin', password: '123456' })
  const token = lr.json.data.token

  // 1) API:每面板 建草稿→带数据保存→列表读回
  const docs = {}
  const plans = [
    ['RD_SPIKE_WATER', { 测试项目: 'NSF 53-除铅（PH8.5）' }, [{ 测试日期: '2026.09.04', 项目名称: '需求2除铅', 测试装置: '加标系统1#', 测试工位: '1#', 配水量: '50', 配置用水: '纯水', 硫酸镁: '1.2', 二水氯化钙: '3.3', 碳酸氢钠: '5.1', '4%次氯酸钠': '0.8', 盐酸或氢氧化钠: '适量', 可溶性铅: '0.5', 不可溶性铅: '0.2', PH: '8.5', TDS: '320', 水温: '20', 负责人: '陈秀丽' }]],
    ['RD_DOM_TEST', { 申请单类型: '开发性', 文件管理人: '陈秀丽', 密级: '保密', 文件使用范围: '工程技术中心' }, [{ 序号: '1', 日期: '2026.09.04', 申请人: '林宇', '背景/目的': '开发测试', 尺寸: '30*10*113', 配方: '标准配方', 密度: '0.58', 方法: '直冲 1.5L/min', 标准: 'NSF53', 目标: '寿命1000L', 组装方式: '无', 样品处理: '保存', 期望完成日期: '2026.10.01' }]],
    ['RD_EQUIP_USE', { 设备名称: '加标测试系统3#' }, [{ 使用日期: '2026.09.04', 测试项目: '除铅', 测试标准: 'NSF53', 使用工位: '3#', 设备状态: '正常', 使用人: '冯敏' }]],
    ['RD_INSTR_USE', { '仪器名称/型号': 'PH计-梅特勒FE28' }, [{ 使用日期: '2026.09.04', 起止时间: '09:00-10:00', 仪器状态: '√', 是否内校: '√', '项目名称/内容': '碱性寿命测试', 用途: 'PH测定', 样品数量: '5', 使用人: '冯敏' }]],
  ]
  for (const [pc, head, items] of plans) {
    const s1 = await api('POST', '/px/callButton', { panelCode: pc, buttonName: '保存', formData: {}, buttonParam: {} }, token)
    const no = s1.json?.data?.['编号']
    const s2 = await api('POST', '/px/callButton', { panelCode: pc, buttonName: '保存', formData: { 编号: no, ...head, detail: { items } }, buttonParam: {} }, token)
    const list = await api('POST', '/px/queryFormDataList', { panelCode: pc, condition: {}, pageNo: 1, pageSize: 3 }, token)
    const rows = list.json?.data?.list || []
    const mine = rows.find((r) => r['编号'] === no)
    console.log('[api] ' + pc + ' ' + no + ' -> ' + (s2.json?.data?.['单据状态']) + ' 读回items=' + ((mine?.detail?.items) || []).length)
    docs[pc] = no
  }

  // 2) 浏览器:渲染检查 + 变体切换
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-lab-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
    const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 40; i++) { await sleep(300); if ((await evaluate('document.readyState')) === 'complete') { await sleep(1000); return } }
    }
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1000, deviceScaleFactor: 1, mobile: false })
    await navigate(`${FRONT}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.json.data.user))}); localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await navigate('about:blank')

    const snap = () => evaluate(`(() => {
  const t = (sel) => document.querySelector(sel)?.textContent?.trim() || ''
  const ths = [...document.querySelectorAll('.rsp-sheet .rs-dt .rs-th')].map((e) => e.textContent.trim())
  const g1 = [...document.querySelectorAll('.rsp-sheet .rs-grp > .rs-th')].map((e) => e.textContent.trim() + (e.rowSpan === 2 ? '(r2)' : 'x' + e.colSpan))
  const foot = !!document.querySelector('.rsp-sheet .rsp-footnote')
  const subtitle = [...document.querySelectorAll('.rsp-sheet .rsp-subtitle-row')].map((e) => e.textContent.trim().slice(0, 40)).join(' | ')
  const title = t('.rsp-sheet .rsp-plain-title') || t('.rsp-sheet .rs-topic')
  const company = !!document.querySelector('.rsp-sheet .rs-company-cell')
  return { title: title.slice(0, 30), company, headCount: ths.length, head1: g1.slice(0, 6).join('/'), foot, subtitle }
})()`)

    for (const pc of ['RD_SPIKE_WATER', 'RD_DOM_TEST', 'RD_EQUIP_USE', 'RD_INSTR_USE']) {
      await navigate(`${FRONT}/#/panelx/list/${pc}`)
      await sleep(3200)
      console.log('[dom] ' + pc + ': ' + JSON.stringify(await snap()))
    }
    // 变体切换:加标水 除铅→除VOC(草稿态才有下拉;先建个草稿)
    const s1 = await api('POST', '/px/callButton', { panelCode: 'RD_SPIKE_WATER', buttonName: '保存', formData: {}, buttonParam: {} }, token)
    const draftNo = s1.json?.data?.['编号']
    await navigate(`${FRONT}/#/panelx/list/RD_SPIKE_WATER`)
    await sleep(3200)
    const before = await snap()
    const switched = await evaluate(`(() => {
  const sel = document.querySelector('.rsp-sheet .rsp-subtitle-row .el-select')
  if (!sel) return 'NO_SELECT'
  sel.click()
  return 'OPENED'
})()`)
    await sleep(700)
    const picked = await evaluate(`(() => {
  const opts = [...document.querySelectorAll('.el-select-dropdown__item')]
  const hit = opts.find((o) => o.textContent.includes('除VOC'))
  if (!hit) return 'NO_OPT(' + opts.length + ')'
  hit.click(); return 'PICKED'
})()`)
    await sleep(900)
    const after = await snap()
    console.log('[variant] 草稿' + draftNo + ' 下拉=' + switched + '/' + picked + ' 表头数 ' + before.headCount + ' → ' + after.headCount + ' 首组 ' + after.head1)
    // 清理
    for (const [pc, no] of Object.entries(docs)) await api('POST', '/px/callButton', { panelCode: pc, buttonName: '删除', formData: { 编号: no }, buttonParam: {} }, token)
    await api('POST', '/px/callButton', { panelCode: 'RD_SPIKE_WATER', buttonName: '删除', formData: { 编号: draftNo }, buttonParam: {} }, token)
    console.log('CLEANED')
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
