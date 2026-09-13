/**
 * _prod-verify.cjs — 产品文件 6 面板验证(API 保存 + 浏览器渲染)
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9349
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function api(method, p, body, token) {
  const res = await fetch(API + p, { method, headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: res.status, json: await res.json().catch(() => null) }
}
async function main() {
  const lr = await api('POST', '/auth/login', { userName: 'admin', password: '123456' })
  const token = lr.json.data.token
  const plans = [
    ['RD_MOLD_PROC', { 表单管理人: '刘磊', 密级: '保密', 使用范围: '工艺科/成型车间', 版本号: '26082201', 产品编号: 'C-95-43', 产品名称: '1217项目后置副龙头芯', 炭棒规格1: '80', 炭棒规格2: '35', 炭棒规格3: '184', 烧结炉参数: '185度', 最短长度mm: '194.5', 外径mm: '79', 外径公差: '±1', 压降标准kpa: '≤90kpa/' }, []],
    ['RD_MOLD_FORMULA', { 表单管理人: '刘磊', 产品编号: 'C-95-43', 产品名称: '1217项目后置副龙头芯', 配料要求: '按配方表准确称量' }, [
      { 序号: '1', 物料种类: '炭粉', 物料编号: 'YJ-XH-002', 物料名称: '鑫恒酸洗（80-250）', 实际添加比例: '0.62', 单支物料含量: '290.26', 设计添加量: '0.62' },
      { 序号: '2', 物料种类: '炭粉', 物料编号: 'YJ-YKRS-008', 物料名称: '英克瑞斯酸洗(150-400)', 实际添加比例: '0.1', 单支物料含量: '46.82', 设计添加量: '0.1' },
      { 序号: '3', 物料种类: '胶粉', 物料编号: 'YJ-ZX-001', 物料名称: 'M4-D胶粉', 实际添加比例: '0.28', 单支物料含量: '131.09', 设计添加量: '0.28' },
    ]],
    ['RD_ASM_BOM', {}, [
      { 物料名: '炭棒', 物料编号: 'C-95-23(除铅）', 物料规格: '外径79+0.5/-1mm 内径35±0.5mm 长度245±0.5mm', 外观要求: '清洁、无破损', 用量: '2' },
      { 物料名: '连接件', 物料编号: 'YJ-SX-008', 物料规格: '大胖连接件', 外观要求: '无脏污、破损', 用量: '1' },
    ]],
    ['RD_ASM_PROC', {}, [
      { 工序: '投首', 工序控制内容: '炭棒尺寸：长度、内径、外径；炭棒外观', 管控要求: '外径79-80mm,内径34.5-35.5mm,长度244.5-245.5mm', 检查比例: '3%' },
      { 工序: '套折叠棉（翻棉）', 工序控制内容: '折叠棉尺寸、外观', 管控要求: '无褶皱，长度与炭棒一致', 检查比例: '全检' },
    ]],
    ['RD_SPEC_DOC', { 名称: '矿化后置烧结矿化棒', 编号: 'B-85-06', 客户名: '傲美', 客户料号: '30501080014', 版本: 'V20260826', 日期: '2026年08月26日', 制订日期: '杨茂林/2026.08.26' }, [
      { 表区: '检验要求', 序号: '1', 检验项目: '*外观', 检验要求: '表面色泽均匀', 检验方法: '目视', 检验依据: '银嘉测试标准' },
      { 表区: '检验要求', 序号: '2', 检验项目: '尺寸', 检验要求: '外径27.5±0.5mm', 检验方法: '游标卡尺', 检验依据: '银嘉测试标准' },
      { 表区: '物料清单', 序号: '1', 物料编码: 'B-85-06', 物料名称: '矿化烧结棒', 规格参数: '外径27.5±0.5mm', 数量: '1', 备注: '/' },
      { 表区: '修订记录', 序号: '1', 更改内容: '初次发行', 更改时间: '2026.08.26', 责任人: '杨茂林', 备注: '/' },
    ]],
    ['RD_INSP_PLAN', { 标题: '伊可普20寸折叠复合除铅大胖出货检验控制计划', 版本号: 'A260413', 密级: '保密', 产品编号: 'C-95-23', 客户名: '青岛伊可普', 管理人: '冯敏', 编写人: '冯敏', 审核人: '冯加劲' }, [
      { 控制项目: '*外观', 质量控制内容: '外观', 检测仪器: '目视', 控制标准及要求: '外观均匀完好，无弯曲变形', 检验: 'IQC', 不合格应对措施: '1.暂停生产 2.复核方法 3.扩大抽检', 检测频率: '每批次', 取样方式: '生产量*1%', 检验内容: '检验外观', 控制方法: '常规抽检' },
      { 控制项目: '*成品尺寸', 质量控制内容: '尺寸', 检测仪器: '游标卡尺', 控制标准及要求: '108.5mm±1mm', 检验: 'IQC', 不合格应对措施: '同上', 检测频率: '每批次', 取样方式: '生产量*1%', 检验内容: '检验尺寸', 控制方法: '常规抽检' },
    ]],
  ]
  const docs = {}
  for (const [pc, head, items] of plans) {
    const s1 = await api('POST', '/px/callButton', { panelCode: pc, buttonName: '保存', formData: {}, buttonParam: {} }, token)
    const no = s1.json?.data?.['编号']
    const s2 = await api('POST', '/px/callButton', { panelCode: pc, buttonName: '保存', formData: { 编号: no, ...head, detail: { items } }, buttonParam: {} }, token)
    const list = await api('POST', '/px/queryFormDataList', { panelCode: pc, condition: {}, pageNo: 1, pageSize: 3 }, token)
    const mine = (list.json?.data?.list || []).find((r) => r['编号'] === no)
    console.log('[api] ' + pc + ' ' + no + ' -> ' + (s2.json?.data?.['单据状态'] || JSON.stringify(s2.json).slice(0, 80)) + ' items=' + ((mine?.detail?.items) || []).length)
    docs[pc] = no
  }
  // 浏览器 DOM 检查
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-prod-'))
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
    for (const pc of Object.keys(docs)) {
      await navigate(`${FRONT}/#/panelx/list/${pc}`)
      await sleep(3200)
      const out = await evaluate(`(() => {
  const t = (sel) => document.querySelector(sel)?.textContent?.trim() || ''
  const bars = [...document.querySelectorAll('.rsp-sheet .rs-sectionbar')].map((e) => e.textContent.trim())
  const ths = [...document.querySelectorAll('.rsp-sheet .rs-dt .rs-th')].map((e) => e.textContent.trim().replace(/\\n/g, '·'))
  const stages = [...document.querySelectorAll('.rsp-sheet .rsp-stage')].map((e) => e.textContent.trim() + '(' + e.rowSpan + ')')
  const total = t('.rsp-sheet .rsp-total') ? [...document.querySelectorAll('.rsp-sheet .rsp-total')].map((e) => e.textContent.trim()).join('/') : ''
  const title = t('.rsp-sheet .rsp-plain-title') || t('.rsp-sheet .rs-topic')
  return { title: title.slice(0, 24), bars: bars.join('|').slice(0, 60), heads: ths.slice(0, 5).join('/'), stages: stages.join(','), total, rows: document.querySelectorAll('.rsp-sheet .rs-dt tbody tr').length }
})()`)
      console.log('[dom] ' + pc + ': ' + JSON.stringify(out))
    }
    for (const [pc, no] of Object.entries(docs)) await api('POST', '/px/callButton', { panelCode: pc, buttonName: '删除', formData: { 编号: no }, buttonParam: {} }, token)
    console.log('CLEANED')
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
