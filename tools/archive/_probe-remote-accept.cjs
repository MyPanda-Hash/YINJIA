/**
 * _probe-remote-accept.cjs —— 服务器部署验收(2026-09-21 第三次全量部署)
 *
 * 用途:部署前后各跑一次,给出**可对比**的结论。
 *   · 部署前(基线):应看到 RD_CHANGE 面板不存在 / 没有 DEMO- 数据 ⇒ 证明服务器还是旧版
 *   · 部署后(验收):8 项全绿 ⇒ 库、代码、前端三样都换到位了
 *
 * 用法:
 *   node tools/archive/_probe-remote-accept.cjs              # 默认打服务器 36.140.66.163:8090
 *   node tools/archive/_probe-remote-accept.cjs --local      # 打本机 localhost:8090(自检探针本身)
 *   node tools/archive/_probe-remote-accept.cjs --base http://x.x.x.x:8090
 *
 * 钉八件事(都用"真的会查库"的接口,不用健康检查):
 *   ① admin 登录签发 token;② RD_CHANGE 面板已注册;③ 两个演示产品在;④ 草稿态变更单在;
 *   ⑤ 四文件各一张且已归档;⑥ 部门演示账号能登录且只认本部门那一行;
 *   ⑦ 四文件门禁口径(责任人可编 / 非责任人只读);⑧ 前端静态资源与开发机当前构建一致。
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const args = process.argv.slice(2)
const LOCAL = args.includes('--local')
const baseArg = args.indexOf('--base')
const BASE = baseArg >= 0 ? args[baseArg + 1] : (LOCAL ? 'http://localhost:8090' : 'http://36.140.66.163:8090')
const LOCAL_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html')

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)
const info = (m) => console.log('     ' + m)

async function main() {
  console.log(`目标: ${BASE}${LOCAL ? '  (本机自检)' : ''}`)
  const tok = async (u, p = '123456') => {
    const r = await (await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: u, password: p }),
    })).json()
    if (!r?.data?.token) throw new Error(`${u} 登录失败:${JSON.stringify(r?.message || r)}`)
    return { token: r.data.token, user: r.data.user }
  }
  const api = (t) => {
    const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${t}` }
    return {
      get: async (p) => (await (await fetch(BASE + p, { headers: H })).json()),
      post: async (p, b) => (await (await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json()),
    }
  }

  // ════ ① 登录(真查库)════
  step('① admin 登录(接口要读 yj_user,健康检查不算数)')
  let admin
  try { admin = await tok('admin') } catch (e) { bad(e.message); console.log('\n目标不可用,后续断言无法进行'); process.exit(1) }
  ok(`登录成功,签发 token(${(admin.token || '').slice(0, 12)}…)`)
  const A = api(admin.token)

  // ════ ② RD_CHANGE 面板 ════
  step('② 产品变更申请单面板(RD_CHANGE)已注册')
  const cfg = await A.get('/api/px/getPanelConfig?panelCode=RD_CHANGE')
  const pname = cfg?.data?.metadata?.panelName
  info('panelName = ' + JSON.stringify(pname))
  if (cfg?.code === 200 && pname) ok(`RD_CHANGE 在(${pname})—— 说明新库已就位`)
  else bad('RD_CHANGE 面板不存在 —— 服务器库还是旧版(部署前基线就应该是这个结果)')

  // ════ ③ 演示产品 ════
  step('③ 产品信息表里的两个演示产品')
  const q = async (panelCode, keyword, pageSize = 10) => (await A.post('/api/px/queryFormDataList',
    { panelCode, keyword, pageNo: 1, pageSize, condition: {} }))?.data
  const pi = await q('RD_PROD_INFO', 'DEMO')
  const piRows = (pi?.rows || pi?.list || []).map((r) => r['产品编号'])
  info('查到 = ' + JSON.stringify(piRows))
  if (piRows.includes('DEMO-A-001') && piRows.includes('DEMO-B-001')) ok('两个演示产品都在')
  else bad('演示产品不在(部署前基线正常)')

  // ════ ④ 草稿态变更单 ════
  step('④ 草稿态变更申请单 DEMO-CHG-001')
  const chg = await q('RD_CHANGE', 'DEMO')
  const chgRows = (chg?.rows || chg?.list || [])
  const chgRow = chgRows.find((r) => (r['单据编号'] || '') === 'DEMO-CHG-001')
  info('查到 = ' + JSON.stringify(chgRows.map((r) => [r['单据编号'], r['单据状态']])))
  if (chgRow && String(chgRow['单据状态']).includes('草稿')) ok('DEMO-CHG-001 在且是草稿(工作人员可直接往下走)')
  else bad('DEMO-CHG-001 不在或状态不对')

  // ════ ⑤ 四文件已归档 ════
  step('⑤ 四个受控文件(演示产品 A)各一张且已归档')
  const panels = [['RD_MOLD_PROC', 'DEMO'], ['RD_ASM_PROC', 'DEMO'], ['RD_SPEC_DOC', 'DEMO'], ['RD_INSP_PLAN', 'DEMO']]
  const fileNos = {}
  for (const [p, kw] of panels) {
    const d = await q(p, kw)
    const rows = (d?.rows || d?.list || [])
    const hit = rows.find((r) => String(JSON.stringify(r)).includes('DEMO-'))
    const no = hit ? (hit['单据编号'] || '') : ''
    const st = hit ? String(hit['单据状态'] || '') : ''
    fileNos[p] = no
    info(`${p}: ${no || '(无)'} ${st}`)
    if (no && st.includes('已归档')) ok(`${p} 已归档`)
    else bad(`${p} 缺演示单或未归档(部署前基线正常)`)
  }

  // ════ ⑥ 部门演示账号 ════
  step('⑥ 部门演示账号 demo_gongyi:能登录 + 只认本部门那一行')
  try {
    const gz = await tok('demo_gongyi')
    const gzApi = api(gz.token)
    const c2 = await gzApi.get('/api/px/getPanelConfig?panelCode=RD_CHANGE')
    const depts = c2?.data?.metadata?.changeDepts || []
    info('可填部门行 = ' + JSON.stringify(depts))
    if (depts.length === 1 && depts[0] === '成型工艺科') ok('demo_gongyi 只能填「成型工艺科」那一行')
    else bad('部门行映射不对:' + JSON.stringify(depts))
  } catch (e) { bad('demo_gongyi 登录失败:' + e.message) }

  // ════ ⑦ 四文件门禁 ════
  step('⑦ 四文件编辑门禁:责任人可编 / 非责任人只读')
  const mpNo = fileNos.RD_MOLD_PROC
  if (!mpNo) bad('没有成型工艺清单演示单,门禁无法验(部署前基线正常)')
  else {
    const vCp = (await A.get(`/api/px/rdDev/fileEdit?panelCode=RD_MOLD_PROC&docNo=${encodeURIComponent(mpNo)}`))?.data
    info('admin 视角 = ' + JSON.stringify(vCp))
    const cp = await tok('cp'); const C = api(cp.token)
    const vOwner = (await C.get(`/api/px/rdDev/fileEdit?panelCode=RD_MOLD_PROC&docNo=${encodeURIComponent(mpNo)}`))?.data
    const gz = await tok('demo_gongyi'); const GZ = api(gz.token)
    const vOther = (await GZ.get(`/api/px/rdDev/fileEdit?panelCode=RD_MOLD_PROC&docNo=${encodeURIComponent(mpNo)}`))?.data
    info('责任人 cp = ' + JSON.stringify(vOwner))
    info('非责任人 = ' + JSON.stringify(vOther))
    if (vOwner?.canEdit === true && vOther?.canEdit === false) ok(`门禁口径正确(责任人=${vOwner.ownerName},非责任人只读并看得到责任人)`)
    else bad('门禁口径不对')
  }

  // ════ ⑧ 前端构建一致性 ════
  step('⑧ 服务器前端资源与开发机当前构建是否同一份')
  try {
    const html = await (await fetch(BASE + '/', { headers: { 'Cache-Control': 'no-cache' } })).text()
    const m = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/)
    const remoteAsset = m ? m[1] : '(未取到)'
    const localHtml = fs.readFileSync(LOCAL_DIST, 'utf8')
    const lm = localHtml.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/)
    const localAsset = lm ? lm[1] : '(本地无 dist)'
    info(`服务器 = ${remoteAsset}`)
    info(`开发机 = ${localAsset}`)
    if (remoteAsset === localAsset) ok('前端是同一份构建(部署已生效)')
    else bad('前端不是同一份 —— 服务器还是旧构建(部署前基线正常)')
  } catch (e) { bad('取首页失败:' + e.message) }

  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED —— 服务器与开发机同版本,演示数据可用')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('验收异常:', e.message); process.exit(1) })
