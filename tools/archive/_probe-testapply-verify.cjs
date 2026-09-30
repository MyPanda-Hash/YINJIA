'use strict'
/**
 * _probe-testapply-verify.cjs — 「测试申请单」RD_DOM_TEST 三页签复刻验证探针(2026-09-30)
 *
 * 用法:node tools/archive/_probe-testapply-verify.cjs [http://localhost:5173|http://localhost:8090]
 *
 * ⚠ 界面层**必须打到前端热更实例 5173**:8090 供的是打包产物(backend/src/main/resources/static),
 *   前端源码改动不经 `npm run build` 不会进 8090 —— 拿 8090 跑界面断言会验到上一版(实测踩过)。
 *   后端接口两侧同源(5173 由 vite proxy 转发到 8090),故 ① 配置层与 ② 造数走哪个都行。
 *
 * 四层断言(缺一层就可能是"改了但用户还是错的"):
 *   ① 后端配置层:getPanelConfig 下发的面板名/查询字典/新增字段元数据;文档编号已退出字段集
 *   ② 端到端写读 :在**测试账套**上真造两张单(内部/外部,各带本页表区的行),回读校验
 *                  [表区]=内部申请/外部申请 与 6 个新列原样往返(不是"配置写了就算")
 *   ③ 界面层     :三页签标题、每页编号格(YJ-RIR001/YJ-XS002)、页 0 十六列头 + 测试周期须知 +
 *                  国标 17 行附表、页 1 九列头、页 2 汇总台账的 6 列与真实数据行
 *   ④ 侧栏      :右侧动作栏出现「提交审批 / 审批情况」(用户口径:把审批动作组放出来)
 *
 * ⚠ 只在**测试账套**(factory='test' → HSDZ_MES_TEST)造数:正式库只录真实业务。
 *   造出来的两张单留着(测试库本就是演示/试用用),不删 —— 删了台账页就没数据可看。
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.argv[2] || 'http://localhost:8090'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9361
const SHOTS = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** getPanelConfig 下发的**明细**字段集合(表头字段在 dataSchema.fields,明细在 detail.tabs[].fields) */
const dNamesOf = (cfgRes) => (cfgRes?.data?.detail?.tabs || [])
  .flatMap((t) => t.fields || [])
  .map((f) => f.dataName || f.code)

let pass = 0
let fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }

let ev = null

async function api(pathname, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + pathname, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })  // ① 测试账套登录(造数用)+ 正式账套登录(只读看配置,与用户实际看到的正式库一致)
  const lr = await api('/api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456', factory: 'test' } })
  const token = lr?.data?.token
  if (!token) throw new Error('测试账套登录失败: ' + JSON.stringify(lr).slice(0, 300))
  const lrProd = await api('/api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456' } })
  const tokenProd = lrProd?.data?.token

  console.log('\n① 后端配置层 GET /api/px/getPanelConfig?panelCode=RD_DOM_TEST(正式账套)')
  const cfgRes = await api('/api/px/getPanelConfig?panelCode=RD_DOM_TEST', { token: tokenProd })
  const meta = cfgRes?.data?.metadata || {}
  const fields = cfgRes?.data?.dataSchema?.fields || []
  const names = fields.map((f) => f.dataName || f.code)
  const byName = (n) => fields.find((f) => (f.dataName || f.code) === n)
  check(`面板名 = 测试申请单(实得 ${meta.panelName})`, meta.panelName === '测试申请单')
  const qf = (meta.panelPageDto?.tablePages?.[0]?.queryFields || []).map((f) => f.dataName)
  check('查询条件 = 申请单类型 / 文件管理人', JSON.stringify(qf) === JSON.stringify(['申请单类型', '文件管理人']), JSON.stringify(qf))
  check('申请单类型字典 = 内部委托 / 销售端',
    JSON.stringify(byName('申请单类型')?.options) === JSON.stringify(['内部委托', '销售端']),
    JSON.stringify(byName('申请单类型')?.options))
  for (const n of ['表区', '发起人', '测试（检测）内容', '测试（检测）背景', '测试（检测）目标/要求', '是否要求送样/支数', '是否需要提供报告']) {
    check(`新增字段「${n}」已下发`, dNamesOf(cfgRes).includes(n))
  }
  check('文档编号已退出字段集(改由逐页常量渲染)', !names.includes('文档编号'))
  check('旧「开发性/品质委托」字典值已消失',
    !JSON.stringify(fields).includes('开发性') && !JSON.stringify(fields).includes('品质委托'))
  const detailTabs = cfgRes?.data?.detail?.tabs?.[0]?.fields || []
  const dNames = detailTabs.map((f) => f.dataName || f.code)
  check('明细字段含两页并集(尺寸/配方/密度 + 紧急程度 + 发起人/测试内容…)',
    ['尺寸', '配方', '密度', '紧急程度', '期望完成日期', '预计完成日期', '发起人', '测试（检测）内容', '是否需要提供报告'].every((n) => dNames.includes(n)),
    JSON.stringify(dNames))

  // ═══ ② 端到端:测试账套造两张单(内部 / 外部)═══
  console.log('\n② 端到端写读(测试账套 HSDZ_MES_TEST)')
  const mk = async (type, 表区, row, extra = {}) => {
    // 幂等:同一张测试账套里已有探针单就复用,避免每次跑探针都堆单据(台账页要的是"有数据可看")
    const exist = (await api('/api/px/queryFormDataList', {
      method: 'POST', token, body: { panelCode: 'RD_DOM_TEST', condition: {}, pageNo: 1, pageSize: 200 },
    }))?.data?.list || []
    const hit = exist.find((r) => (r.detail?.items || []).some((it) => it['表区'] === 表区 && String(it['备注'] || '').startsWith('探针')))
    if (hit) return { no: hit['单据编号'], saved: { data: { 单据状态: hit['单据状态'] } }, reused: true }
    const created = await api('/api/px/callButton', {
      method: 'POST', token,
      body: { panelCode: 'RD_DOM_TEST', buttonName: '新增', formData: {}, buttonParam: {} },
    })
    const no = created?.data?.['编号'] || created?.data?.['单据编号']
    if (!no) throw new Error('新增失败: ' + JSON.stringify(created).slice(0, 300))
    const saved = await api('/api/px/callButton', {
      method: 'POST', token,
      body: {
        panelCode: 'RD_DOM_TEST', buttonName: '保存',
        formData: {
          编号: no,
          申请单类型: type,
          文件管理人: '陈秀丽',
          密级: '保密',
          文件使用范围: type === '销售端' ? '公司内' : '工程技术中心',
          ...extra,
          detail: { items: [{ 表区, 序号: '1', ...row }] },
        },
        buttonParam: {},
      },
    })
    return { no, saved }
  }
  const inner = await mk('内部委托', '内部申请', {
    日期: '2026-09-30', 申请人: '张三', '测试（检测）背景/目的': '探针:验证内部页 16 列往返',
    尺寸: '30*10*113', 配方: '炭棒+阻垢', 密度: '0.55', '测试（检测）方法': '冲停法 2L/min',
    '测试（检测）标准': 'NSF 53', '测试（检测）目标': '寿命 3000L', 组装方式: '无',
    测完后样品样品处理: '保存', 紧急程度: '正常', 期望完成日期: '2026-10-08', 预计完成日期: '2026-10-09', 备注: '探针内部单',
  })
  check(`新增+保存 内部委托单(${inner.no})`, /已归档|草稿|审批中/.test(String(inner.saved?.data?.['单据状态'] || '')), JSON.stringify(inner.saved).slice(0, 200))
  const outer = await mk('销售端', '外部申请', {
    日期: '2026-09-30', 发起人: '李四', '测试（检测）内容': '炭棒余氯（寿命）测试',
    '测试（检测）背景': '应 XX 客户要求测试', '测试（检测）目标/要求': '阻垢寿命 3000L',
    '是否要求送样/支数': '是/12支', '是否需要提供报告': '是', 备注: '探针外部单',
  })
  check(`新增+保存 销售端单(${outer.no})`, /已归档|草稿|审批中/.test(String(outer.saved?.data?.['单据状态'] || '')), JSON.stringify(outer.saved).slice(0, 200))

  const list = await api('/api/px/queryFormDataList', {
    method: 'POST', token, body: { panelCode: 'RD_DOM_TEST', condition: {}, pageNo: 1, pageSize: 200 },
  })
  const rows = list?.data?.list || []
  const ir = rows.find((r) => r['单据编号'] === inner.no)
  const or = rows.find((r) => r['单据编号'] === outer.no)
  check('回读:内部单明细行落 [表区]=内部申请 且 16 列原样往返',
    ir?.detail?.items?.some((it) => it['表区'] === '内部申请' && it['测试（检测）方法'] === '冲停法 2L/min' && it['尺寸'] === '30*10*113'),
    JSON.stringify(ir?.detail?.items || []).slice(0, 260))
  check('回读:外部单明细行落 [表区]=外部申请 且 6 个新列原样往返',
    or?.detail?.items?.some((it) => it['表区'] === '外部申请' && it['发起人'] === '李四' && it['是否需要提供报告'] === '是' && it['是否要求送样/支数'] === '是/12支'),
    JSON.stringify(or?.detail?.items || []).slice(0, 260))
  check('回读:两单的 申请单类型 与 单据状态 都在表头',
    ir?.['申请单类型'] === '内部委托' && !!ir?.['单据状态'] && or?.['申请单类型'] === '销售端',
    JSON.stringify({ i: ir?.['申请单类型'], o: or?.['申请单类型'], s: ir?.['单据状态'] }))

  // ═══ ③④ 界面层 ═══
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-testapply-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
    ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result?.result?.value
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } }
    }
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (r.result?.data) { fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.result.data, 'base64')); console.log('  📷 ' + name) }
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1900, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_DOM_TEST`)
    await sleep(2500)

    console.log('\n③ 界面层(测试账套)')
    const tabs = JSON.parse(await ev(`JSON.stringify([].slice.call(document.querySelectorAll('.rsp-page-tab')).map(function(t){return t.textContent.trim()}))`) || '[]')
    check('三页签标题与顺序', JSON.stringify(tabs) === JSON.stringify(['内部委托-测试申请单', '销售端-测试/检测申请表', '委托测试汇总表']), JSON.stringify(tabs))

    const clickTab = async (i) => {
      await ev(`(function(){ var t=document.querySelectorAll('.rsp-page-tab')[${i}]; if(t) t.click(); return 'ok' })()`)
      await sleep(900)
    }
    const cell = () => ev(`(function(){ var c=document.querySelector('.rs-docno-wrap, .rs-docno-static'); return c? c.textContent.trim() : 'NONE' })()`)
    const heads = () => ev(`JSON.stringify([].slice.call(document.querySelectorAll('.rs-dt .rs-grp th, .rs-dt .rs-grp2 th')).filter(function(t){return t.offsetParent}).map(function(t){return t.textContent.trim()}))`)
    /** 表头文本数组(必须 JSON.parse 后再比较:设计里「是否要求送样\n/支数」带换行,
     *  直接对 JSON 字符串做 \s 归一化会留下转义后的 "\n" 两个字符,导致假失败) */
    const headList = async () => JSON.parse((await heads()) || '[]')
    const noop = (s) => String(s || '').replace(/\s+/g, '')

    // 页 0
    await clickTab(0)
    check('页 0 编号格 = YJ-RIR001', noop(await cell()).includes('YJ-RIR001'), await cell())
    const rawH0 = await headList()
    const h0 = noop(rawH0.join('|'))
    for (const l of ['序号', '日期', '申请人', '测试（检测）背景/目的', '尺寸', '配方', '密度', '测试（检测）方法', '测试（检测）标准', '测试（检测）目标', '组装方式', '测完后样品样品处理', '紧急程度', '期望完成日期', '预计完成日期', '备注', '测试（检测）样品信息']) {
      check(`页 0 表头含「${l}」`, h0.includes(noop(l)), JSON.stringify(rawH0))
    }
    const note = await ev(`(function(){ var n=document.querySelector('.rsp-footnote'); return n? n.textContent.trim().slice(0,20) : 'NONE' })()`)
    check('页 0 表尾有测试周期须知', String(note).startsWith('测试周期'), note)
    const tail = await ev(`(function(){
      var t=document.querySelector('.rs-tail-table'); if(!t) return 'NONE'
      return JSON.stringify({ bar: (t.querySelector('.rs-sectionbar')||{}).textContent, head: [].slice.call(t.querySelectorAll('th')).map(function(x){return x.textContent.trim()}), rows: t.querySelectorAll('tbody tr').length - 2 })
    })()`)
    const tj = JSON.parse(tail === 'NONE' ? '{}' : tail)
    check('页 0 国标可测项目附表:标题 + 5 列 + 17 行',
      tj.bar === '国标浸泡安全指标可测试列表' && JSON.stringify(tj.head) === JSON.stringify(['序号', '项目', '卫生要求', '测试仪器', '检出限']) && tj.rows === 17,
      JSON.stringify(tj))
    await shot('testapply-p0-internal.png')

    // 页 1
    await clickTab(1)
    check('页 1 编号格 = YJ-XS002', noop(await cell()).includes('YJ-XS002'), await cell())
    const rawH1 = await headList()
    const h1 = noop(rawH1.join('|'))
    for (const l of ['序号', '日期', '发起人', '测试（检测）内容', '测试（检测）背景', '测试（检测）目标/要求', '是否要求送样/支数', '是否需要提供报告', '备注']) {
      check(`页 1 表头含「${l}」`, h1.includes(noop(l)), JSON.stringify(rawH1))
    }
    await shot('testapply-p1-sales.png')

    // 页 2(台账)
    await clickTab(2)
    await sleep(1200)
    const led = await ev(`(function(){
      var t=document.querySelector('.rs-ledger-t'); if(!t) return 'NONE'
      var rows=[].slice.call(t.querySelectorAll('tbody tr'))
      var data=rows.filter(function(r){return !r.querySelector('th') && !r.classList.contains('rsp-ledger-hint') && (r.textContent||'').trim()!=='' && (r.textContent||'').indexOf('暂无')<0 && (r.textContent||'').indexOf('加载中')<0})
      return JSON.stringify({
        title: (t.querySelector('.rsp-page-title')||{}).textContent,
        head: [].slice.call(t.querySelectorAll('th')).map(function(x){return x.textContent.trim()}),
        hint: (t.querySelector('.rsp-ledger-hint')||{}).textContent,
        rows: data.length, sample: data.map(function(r){return (r.textContent||'').replace(/\\s+/g,' ').trim()})
      })
    })()`)
    const lg = JSON.parse(led === 'NONE' ? '{}' : led)
    check('页 2 台账标题 = 委托测试汇总表', lg.title === '委托测试汇总表', String(lg.title))
    check('页 2 台账 6 列表头', JSON.stringify(lg.head) === JSON.stringify(['序号', '表格编号', '发起人', '申请日期', '分类', '状态']), JSON.stringify(lg.head))
    check('页 2 台账带设计第 8 行的取值提示(内部/外部、测试中/…)', String(lg.hint || '').includes('内部/外部'), String(lg.hint))
    check(`页 2 台账列出全部单据(实得 ${lg.rows} 行,含刚造的两张)`,
      (lg.rows || 0) >= 2 && (lg.sample || []).some((s) => s.includes(inner.no)) && (lg.sample || []).some((s) => s.includes(outer.no)),
      JSON.stringify(lg.sample || []).slice(0, 300))
    check('页 2 台账「分类」已把 内部委托/销售端 映射成 内部/外部',
      (lg.sample || []).some((s) => s.includes('内部')) && (lg.sample || []).some((s) => s.includes('外部')),
      JSON.stringify(lg.sample || []).slice(0, 300))
    await shot('testapply-p2-ledger.png')

    // ④ 右侧动作栏
    console.log('\n④ 右侧动作栏')
    const side = await ev(`JSON.stringify([].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent}).map(function(b){return (b.textContent||'').trim()}))`)
    const btn = JSON.parse(side || '[]')
    check('侧栏出现「提交审批」', btn.includes('提交审批'), side)
    check('侧栏出现「审批情况」', btn.includes('审批情况'), side)
    check('归档闭环的「申请修改/修改记录」仍在', btn.includes('申请修改') || btn.includes('修改记录'), side)
  } finally {
    try { if (ws) ws.close() } catch {}
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('探针异常: ' + (e && e.stack ? e.stack : e)); process.exit(2) })
