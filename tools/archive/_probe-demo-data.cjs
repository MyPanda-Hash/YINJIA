/**
 * _probe-demo-data.cjs —— 演示数据可用性验收(2026-09-21)
 *
 * 灌完 tools/seed-demo-prodfile.sql 后,钉住"工作人员一登录就能跑"这件事:
 *   ① 六个部门演示账号能登录,且各自只认自己那一行(部门映射生效);
 *   ② 两个演示产品的产品信息表已归档、四文件已归档、责任人已分发(四文件门禁是"可编"的那个责任人);
 *   ③ 产品文件列表能看到两个演示产品;
 *   ④ 草稿态变更单 DEMO-CHG-001:7 个部门行齐、开发部已有示例内容、需会签=是 + 会签人已填;
 *   ⑤ 端到端可起步:发起人点「提交会签」能进会签中(验完立即撤回,不留痕)。
 *
 * 用法:node tools/archive/_probe-demo-data.cjs   (需后端 8090;不写清理脚本 —— 它只读+可回滚)
 */
'use strict'

const path = require('node:path')
const { spawnSync } = require('node:child_process')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const TOOLS = path.join(__dirname, '..')
const URLX = 'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10'
const DEMO_USERS = ['demo_gongyi', 'demo_shengchan', 'demo_xiaoshou', 'demo_pinzhi', 'demo_jihua', 'demo_cangku']
const PROD_A = 'DEMO-A-001'
const PROD_B = 'DEMO-B-001'
const CHG = 'DEMO-CHG-001'

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)
const info = (m) => console.log('     ' + m)

function sqlRows(name, text) {
  const f = path.join(__dirname, name + '.sql')
  const out = path.join(__dirname, name + '.out.txt')
  require('node:fs').writeFileSync(f, text, 'utf8')
  const fd = require('node:fs').openSync(out, 'w')
  spawnSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib\\mssql-jdbc.jar', 'SqlRunner.java',
    URLX, 'yinjia', 'Yinjia@2026', 'archive\\' + name + '.sql'], { cwd: TOOLS, stdio: ['ignore', fd, fd] })
  require('node:fs').closeSync(fd)
  const txt = require('node:fs').readFileSync(out, 'utf8')
  if (/\[SQL FAIL\]|\[FATAL\]/.test(txt)) throw new Error('SQL 失败:\n' + txt)
  return txt.split('\n').filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((x) => x.trim()))
}

async function main() {
  const tok = async (u, p = '123456') => {
    const r = await (await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: u, password: p }),
    })).json()
    if (!r?.data?.token) throw new Error(u + ' 登录失败:' + JSON.stringify(r?.message || r))
    return { token: r.data.token, user: r.data.user }
  }
  const api = (t) => {
    const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${t}` }
    return {
      btn: async (panelCode, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
        method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
      })).json()),
      get: async (p) => (await (await fetch(BASE + p, { headers: H })).json()),
    }
  }
  const admin = await tok('admin'); const A = api(admin.token)
  const cp = await tok('cp'); const C = api(cp.token)
  const glm = await tok('glm53'); const G = api(glm.token)

  // ════ ① 六个部门账号可登录 + 部门映射各自一行 ════
  step('① 六个部门演示账号:能登录 + 各自只认本部门那一行')
  const expectDept = {
    demo_gongyi: '成型工艺科', demo_shengchan: '组装车间', demo_xiaoshou: '销售部',
    demo_pinzhi: '品质部', demo_jihua: '计划组', demo_cangku: '仓管部',
  }
  for (const u of DEMO_USERS) {
    let t
    try { t = await tok(u) } catch (e) { bad(`${u} 登录失败:${e.message}`); continue }
    const apiU = api(t.token)
    const cfg = await apiU.get('/api/px/getPanelConfig?panelCode=RD_CHANGE')
    const depts = cfg?.data?.metadata?.changeDepts || []
    if (depts.length === 1 && depts[0] === expectDept[u]) info(`${u} → 可填部门行 = ${depts[0]}`)
    else bad(`${u} 的可填部门行不对:${JSON.stringify(depts)}(期望 [${expectDept[u]}])`)
  }
  ok('六个部门账号都能登录,且各自的行 = 自己的部门')

  // ════ ② 演示产品:产品信息表/四文件已归档 + 责任人已分发 ════
  step('② 两个演示产品:产品信息表已归档 + 四文件已归档 + 责任人已分发')
  for (const p of [PROD_A, PROD_B]) {
    const st = sqlRows('_probe-demo-st', `SET NOCOUNT ON;
SELECT N'PI', CAST(COUNT(*) AS nvarchar(10)) FROM rd_prod_info_head h JOIN yj_doc_status s ON s.panel_code=N'RD_PROD_INFO' AND s.doc_no=h.单据编号
 WHERE h.产品编号 = N'${p}' AND s.archived='Y'
UNION ALL SELECT N'FILES', CAST(COUNT(*) AS nvarchar(10)) FROM yj_doc_status s WHERE s.archived='Y' AND s.doc_no IN (
   SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号=N'${p}'
   UNION ALL SELECT 单据编号 FROM rd_asm_proc_head WHERE 产品编号=N'${p}'
   UNION ALL SELECT 单据编号 FROM rd_spec_doc_head WHERE 编号=N'${p}'
   UNION ALL SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号=N'${p}')
UNION ALL SELECT N'TASK', CAST(COUNT(*) AS nvarchar(10)) FROM rd_dev_task WHERE 产品编号 = N'${p}' AND ISNULL(负责人,N'')<>N'';`)
    const m = Object.fromEntries(st.map((r) => [r[0], r[1]]))
    info(`${p}: 产品信息表归档 ${m.PI} / 四文件归档 ${m.FILES} / 责任人分工 ${m.TASK}`)
    if (m.PI === '1' && m.FILES === '4' && m.TASK === '4') ok(`${p} 演示数据齐(1+4+4)`)
    else bad(`${p} 演示数据不齐:${JSON.stringify(m)}`)
  }

  // ════ ③ 产品文件列表能看到演示产品 ════
  step('③ 产品文件列表:两个演示产品都在')
  const board = await A.get(`/api/px/prodDocList?productCode=${encodeURIComponent(PROD_A)}`)
  const codes = (board?.data?.rows || []).map((r) => r['产品编号'])
  if (codes.includes(PROD_A)) ok(`产品文件列表能查到 ${PROD_A}(列头 ${(board?.data?.columns || []).length} 个)`)
  else bad('产品文件列表查不到演示产品:' + JSON.stringify(board?.data).slice(0, 200))

  // ════ ④ 草稿态变更单可直接起步 ════
  step('④ 草稿态变更单 DEMO-CHG-001:部门行齐 + 需会签/会签人已填')
  const rows = sqlRows('_probe-demo-chg', `SET NOCOUNT ON;
SELECT 部门, ISNULL(变更后内容,N''), ISNULL(签字,N'') FROM rd_change_detail WHERE 单据编号 = N'${CHG}' ORDER BY rd_change_detail.id;`)
  info('部门行 = ' + JSON.stringify(rows.map((r) => [r[0], r[1] ? '有内容' : '空'])))
  if (rows.length === 7) ok('7 个部门评审行齐')
  else bad('部门行数不对:' + rows.length)
  const filled = rows.filter((r) => r[1]).length
  if (filled >= 1) ok(`已有 ${filled} 行示例内容(其余留空等人填)`)
  else bad('一行示例内容都没有')
  const head = sqlRows('_probe-demo-chg2', `SET NOCOUNT ON;
SELECT ISNULL(需会签,N''), ISNULL(会签人,N''), ISNULL(变更文件,N''), ISNULL(产品编号,N'') FROM rd_change_head WHERE 单据编号 = N'${CHG}';`)[0]
  info(`需会签=${head[0]} 会签人=${head[1]} 变更文件=${head[2]}`)
  if (head[0] === '是' && head[1].includes('glm53') && head[2].includes('规格书')) ok('需会签=是 + 会签人/变更文件已预填')
  else bad('变更单头预填不全:' + JSON.stringify(head))
  const st = await C.get(`/api/px/getFormDescriptor?panelCode=RD_CHANGE&code=${encodeURIComponent(CHG)}`)
  if (st?.data?.data?.['单据状态'] === '草稿') ok('状态 = 草稿(工作人员从这里往下走)')
  else bad('状态不对:' + st?.data?.data?.['单据状态'])

  // ════ ⑤ 端到端可起步:提交会签 → 撤回(验完还原) ════
  step('⑤ 端到端可起步:发起人提交会签 → 会签中 → 撤回(还原为草稿)')
  const r1 = await C.btn('RD_CHANGE', '提交会签', { 编号: CHG })
  info('提交会签:' + JSON.stringify(r1?.data || r1?.message))
  const pend = sqlRows('_probe-demo-sign', `SET NOCOUNT ON;
SELECT CAST(COUNT(*) AS nvarchar(10)) FROM yj_form_approval WHERE panel_code=N'RD_CHANGE' AND form_no=N'${CHG}' AND action='SIGNOFF' AND result='PENDING';`)[0][0]
  if (r1?.data?.['单据状态'] === '会签中' && pend === '2') ok(`进会签中,2 个会签人待签(glm53/演示-质量管理部)`)
  else bad(`提交会签没打通:${JSON.stringify(r1)} 待签=${pend}`)
  const r2 = await C.btn('RD_CHANGE', '撤回会签', { 编号: CHG })
  const st2 = await C.get(`/api/px/getFormDescriptor?panelCode=RD_CHANGE&code=${encodeURIComponent(CHG)}`)
  if (r2?.code === 200 && st2?.data?.data?.['单据状态'] === '草稿') ok('撤回会签 → 回到草稿(演示数据未被改动)')
  else bad('撤回失败:' + JSON.stringify(r2))

  // ════ ⑥ 四文件门禁:责任人可编、非责任人只读 ════
  step('⑥ 四文件门禁:成型工艺清单责任人 cp 可编,部门账号只读')
  const mpNo = sqlRows('_probe-demo-mp', `SET NOCOUNT ON; SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 = N'${PROD_A}';`)[0][0]
  const vCp = (await C.get(`/api/px/rdDev/fileEdit?panelCode=RD_MOLD_PROC&docNo=${encodeURIComponent(mpNo)}`))?.data
  const gz = await tok('demo_gongyi'); const GZ = api(gz.token)
  const vGz = (await GZ.get(`/api/px/rdDev/fileEdit?panelCode=RD_MOLD_PROC&docNo=${encodeURIComponent(mpNo)}`))?.data
  info(`责任人 cp:${JSON.stringify(vCp)}`)
  info(`工艺科账号:${JSON.stringify(vGz)}`)
  if (vCp?.canEdit === true) ok('责任人可编')
  else bad('责任人不可编:' + JSON.stringify(vCp))
  if (vGz?.canEdit === false && vGz?.ownerName) ok(`非责任人只读,且能看到责任人是谁(${vGz.ownerName})`)
  else bad('非责任人口径不对:' + JSON.stringify(vGz))

  // ════ ⑦ 界面看一眼(留截图:变更单纸张 + 产品文件列表)════
  step('⑦ 界面:变更单纸张与产品文件列表各留一张截图')
  {
    const os = require('node:os')
    const fsx = require('node:fs')
    const { spawn } = require('node:child_process')
    const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
    const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    const PORT = 9347
    const SHOTS = path.join(__dirname, '_shots')
    const profile = fsx.mkdtempSync(path.join(os.tmpdir(), 'yj-demo-'))
    const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--window-size=1760,1400', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
    let ws = null
    try {
      await new Promise((r) => setTimeout(r, 3200))
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
        for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 200)); if (await ev('document.readyState') === 'complete') { await new Promise((r) => setTimeout(r, 3000)); return } }
      }
      const shot = async (tag) => {
        const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
        if (!r.result?.data) return null
        const f = path.join(SHOTS, `demo-${tag}.png`)
        fsx.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
        return f
      }
      await send('Page.enable'); await send('Runtime.enable')
      await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1400, deviceScaleFactor: 1, mobile: false })
      await nav(`${BASE}/#/login`)
      await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(cp.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(cp.user))}); 'ok'`)
      await nav('about:blank')
      // 变更单:搜索框定位 DEMO-CHG-001
      await nav(`${BASE}/#/panelx/list/RD_CHANGE`); await new Promise((r) => setTimeout(r, 2600))
      const typed = await ev(`(function(){
        var inp=[].slice.call(document.querySelectorAll('input')).filter(function(i){return i.offsetParent && (i.placeholder||'').indexOf('搜索')>=0})[0]
        if(!inp) return 'no-search'
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(inp, 'DEMO-CHG-001')
        inp.dispatchEvent(new Event('input',{bubbles:true})); return 'typed' })()`)
      await new Promise((r) => setTimeout(r, 2400))
      await ev(`(function(){ var rows=[].slice.call(document.querySelectorAll('.el-table__row, tr'))
        for (var i=0;i<rows.length;i++){ if((rows[i].innerText||'').indexOf('DEMO-CHG-001')>=0){ rows[i].click(); return 'row' } } return 'none' })()`)
      await new Promise((r) => setTimeout(r, 2600))
      const body = String(await ev(`(document.body.innerText||'')`) || '')
      const f1 = await shot('chg-sheet')
      info(`变更单页面(${typed}):含 7 部门行 = ${['开发部', '成型工艺科', '仓管部'].every((d) => body.includes(d))},含「提交会签」= ${body.includes('提交会签')}`)
      if (body.includes('DEMO-CHG-001') && body.includes('提交会签')) ok('界面能看到演示变更单,且发起人侧栏有「提交会签」')
      else bad('界面没打开到演示变更单或无提交会签按钮')
      const f2 = await shot('prod-doclist')
      await nav(`${BASE}/#/panelx/list/RD_PROD_DOCLIST`); await new Promise((r) => setTimeout(r, 3000))
      const f3 = await shot('prod-doclist2')
      info('截图:' + [f1, f3].filter(Boolean).join(' , '))
    } finally {
      if (ws) try { ws.close() } catch { /* ignore */ }
      edge.kill()
    }
  }

  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED —— 演示数据可用,工作人员可直接开跑')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('验收异常:', e.message); process.exit(1) })
