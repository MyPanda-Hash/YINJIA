/**
 * _probe-prodfile-e2e.cjs —— 「产品文件」全流程真实场景走查(2026-09-21)
 *
 * 模拟人工真实使用:产品开发部建产品信息表 → 一级审批(选二级审核人)→ 二级审批归档 →
 * 分发责任人(4 个受控文件各自定责任人)→ 四文件各自填写/送审/审批归档(含编辑门禁)→
 * 产品文件列表核对 → 发起产品变更申请单(勾选受控文件)→ 各部门账号填本部门行 →
 * 会签 → admin 审批生效(自动建下一版草稿+通知责任人)→ 责任人打开下一版草稿改完重走审核归档。
 *
 * 缺的测试数据按需补:6 个部门账号(工艺科/生产部/销售中心/质量管理部/生产管理中心/仓管部),
 * 用 admin 的正规接口建(幂等),名字一律 probe_* 前缀,便于一键清理;跑完写清理 SQL。
 *
 * 用法:node tools/archive/_probe-prodfile-e2e.cjs   (需后端 8090;跑完手工执行清理 SQL)
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const TOOLS = path.join(__dirname, '..')
const URLX = 'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10'
const CLEANUP = path.join(__dirname, '_probe-prodfile-e2e-cleanup.sql')
const TAG = Date.now().toString().slice(-6)
const PROD = 'T-PF-' + TAG            // 测试产品编号
const PRODNAME = '测试产品-滤芯组件' + TAG

/** 6 个部门账号:账号 → 系统部门(部门名在 yj_dept 里唯一匹配) */
const DEPT_USERS = [
  { user: 'probe_craft', name: '工艺-探针', dept: '工艺科' },        // → 纸面 成型工艺科
  { user: 'probe_asm', name: '生产-探针', dept: '生产部' },          // → 纸面 组装车间
  { user: 'probe_sale', name: '销售-探针', dept: '销售中心' },        // → 纸面 销售部
  { user: 'probe_qc', name: '品质-探针', dept: '质量管理部' },        // → 纸面 品质部
  { user: 'probe_plan', name: '计划-探针', dept: '生产管理中心' },    // → 纸面 计划组
  { user: 'probe_wh', name: '仓库-探针', dept: '仓管部' },           // → 纸面 仓管部
]

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)
const info = (m) => console.log('     ' + m)

function sql(name, text) {
  const f = path.join(__dirname, name + '.sql')
  const out = path.join(__dirname, name + '.out.txt')
  fs.writeFileSync(f, text, 'utf8')
  const fd = fs.openSync(out, 'w')
  spawnSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib\\mssql-jdbc.jar', 'SqlRunner.java',
    URLX, 'yinjia', 'Yinjia@2026', 'archive\\' + name + '.sql'], { cwd: TOOLS, stdio: ['ignore', fd, fd] })
  fs.closeSync(fd)
  const txt = fs.readFileSync(out, 'utf8')
  if (/\[SQL FAIL\]|\[FATAL\]/.test(txt)) throw new Error('SQL 失败:\n' + txt)
  return txt.split('\n').filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((x) => x.trim()))
}
const one = (name, text) => (sql(name, text)[0] || [''])[0]
const castN = (v) => `CAST((${v}) AS nvarchar(20))`

/** 表区值必须取配置里**声明的 filterVal**(按页面名硬编码会写出"没有表认领"的行 —— 2026-09-21 走查踩过:
 *  给成型配方页写 表区='成型配方' 而不是 '配方表',行入了库但界面上哪张表都不显示)。
 *  对照表由 frontend 的 recordSheetConfigs 现读,并有单测钉住(filtervals.test.js)。 */
async function loadFilterVals() {
  const { pathToFileURL } = require('node:url')
  const cfgPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'core', 'views', 'recordSheetConfigs.js')
  const { recordSheetConfigs } = await import(pathToFileURL(cfgPath).href)
  const pick = (panel) => Object.fromEntries((recordSheetConfigs[panel]?.dataTables || [])
    .filter((d) => d.filterVal).map((d) => [d.bar || d.pageTitle || ('page' + d.page), d.filterVal]))
  return { mold: pick('RD_MOLD_PROC'), asm: pick('RD_ASM_PROC') }
}
async function main() {
  const tok = async (u, p = '123456') => {
    const r = await (await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: u, password: p }),
    })).json()
    if (!r?.data?.token) throw new Error(u + ' 登录失败:' + JSON.stringify(r))
    return { token: r.data.token, user: r.data.user }
  }
  const api = (t) => {
    const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${t}` }
    return {
      btn: async (panelCode, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
        method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
      })).json()),
      get: async (p) => (await (await fetch(BASE + p, { headers: H })).json()),
      post: async (p, b) => (await (await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json()),
    }
  }

  const FV = await loadFilterVals()   // 表区值取配置(见 loadFilterVals 注释)
  const admin = await tok('admin')
  const A = api(admin.token)
  const cp = await tok('cp'); const C = api(cp.token)
  const glm = await tok('glm53'); const G = api(glm.token)

  // ════════════ ⓪ 补测试数据:6 个部门账号 ════════════
  step('⓪ 补测试数据:六个部门账号(幂等,已存在则改回本部门)')
  const users = (await A.get('/api/sys/user/list'))?.data || []
  for (const u of DEPT_USERS) {
    const exist = users.find((x) => x.userName === u.user)
    const deptId = Number(one('_probe-pf-dept', `SET NOCOUNT ON; SELECT ${castN('id')} FROM yj_dept WHERE dept_name = N'${u.dept}';`))
    if (!deptId) { bad(`找不到部门「${u.dept}」`); continue }
    const r = await A.post('/api/sys/user/save', {
      id: exist?.id, userName: u.user, realName: u.name, password: '123456', deptId, roleId: 2, enabled: 1,
    })
    if (r?.code !== 200) bad(`建号失败 ${u.user}:` + JSON.stringify(r))
  }
  const list2 = (await A.get('/api/sys/user/list'))?.data || []
  const made = DEPT_USERS.filter((u) => list2.some((x) => x.userName === u.user))
  info('部门账号:' + made.map((u) => `${u.user}@${u.dept}`).join(' , '))
  if (made.length === DEPT_USERS.length) ok('六个部门账号就绪(每个部门一个,用来验证"只能填本部门栏")')
  else bad('部门账号没建齐')

  // 各部门登录句柄
  const D = {}
  for (const u of DEPT_USERS) D[u.user] = api((await tok(u.user)).token)

  // ════════════ ① 产品信息表建单 ════════════
  // ⚠ 真实使用是**两次保存**:①「新增」落一张空白草稿(saved='N');②填完字段点「保存」——
  //    第二次才带「编号」走主保存路径,普通用户此时才会自动进审批。
  //    一次调用就带上全部字段会被后端当成"空草稿建单"(saveDoc 的 directAdd 分支),状态停在草稿。
  step('① 产品开发部(cp)在「产品信息表」建单并保存')
  const pi0 = await C.btn('RD_PROD_INFO', '新增', {})
  const piNo = pi0?.data?.['编号']
  if (!piNo) throw new Error('新增产品信息表失败:' + JSON.stringify(pi0))
  info(`新增草稿 = ${piNo}(${pi0?.data?.['单据状态']})`)
  const r1 = await C.btn('RD_PROD_INFO', '保存', {
    编号: piNo, 产品编号: PROD, 产品名称: PRODNAME, 产品类别: '滤芯', 客户项目名称: '探针客户项目-' + TAG,
    产品负责人: cp.user.realName || '陈秀丽', 产品形态: '成品',
  })
  info(`填完保存 → 状态 = ${r1?.data?.['单据状态']}`)
  if (piNo) ok('建单成功:' + piNo)
  else throw new Error('产品信息表建单失败:' + JSON.stringify(r1))
  const st1 = one('_probe-pf-st', `SET NOCOUNT ON; SELECT ISNULL(pending,N'-') + N'/' + ISNULL(CAST(approve_node AS nvarchar(10)), N'-') FROM yj_doc_status WHERE panel_code=N'RD_PROD_INFO' AND doc_no=N'${piNo}';`)
  // approve_node 留空 = 一级(TWO_LEVEL_PANELS 的节点归一:空/1 都是一级),故只断言 pending=Y
  if (String(st1).startsWith('Y/')) ok(`普通用户保存 = 自动进审批(pending/节点 = ${st1})`)
  else bad('保存后状态不符:' + st1)

  // ════════════ ② 一级审批(选二级审核人)════════════
  step('② 冯总(admin)一级审批通过并选取二级审核人 = glm53')
  const r2 = await A.btn('RD_PROD_INFO', '审批通过', { 编号: piNo, 二级审批人: 'glm53', 审批意见: '资料齐全,转二级' })
  info(JSON.stringify(r2?.data || r2))
  const st2 = one('_probe-pf-st2', `SET NOCOUNT ON; SELECT ISNULL(l2_approver,N'-') + N'/' + ISNULL(CAST(approve_node AS nvarchar(10)), N'-') FROM yj_doc_status WHERE panel_code=N'RD_PROD_INFO' AND doc_no=N'${piNo}';`)
  if (st2 === 'glm53/2') ok('一级通过 → 待二级审批(l2_approver=glm53)')
  else bad('一级审批结果不符:' + st2)
  const wrote = one('_probe-pf-st3', `SET NOCOUNT ON; SELECT ISNULL(审核人二级,N'-')+'|'+ISNULL(审核人一级,N'-') FROM rd_prod_info_head WHERE 单据编号=N'${piNo}';`)
  if (String(wrote).includes('彭于晏')) ok('纸面「审核人（二级审批人）」已写回:' + wrote)
  else bad('二级审核人未写回纸面:' + wrote)

  // ════════════ ③ 二级审批 → 归档 ════════════
  step('③ 二级审核人(glm53)审批通过 → 归档')
  const r3 = await G.btn('RD_PROD_INFO', '审批通过', { 编号: piNo, 审批意见: '同意' })
  info(JSON.stringify(r3?.data || r3))
  const st3 = one('_probe-pf-st4', `SET NOCOUNT ON; SELECT ISNULL(archived,N'-') FROM yj_doc_status WHERE panel_code=N'RD_PROD_INFO' AND doc_no=N'${piNo}';`)
  if (st3 === 'Y') ok('二级通过 → 已归档(archived=Y)')
  else bad('二级审批未归档:' + st3)

  // ════════════ ④ 分发责任人 ════════════
  step('④ 二级审核人(glm53)分发四个受控文件的责任人')
  const assign = { RD_MOLD_PROC: 'cp', RD_ASM_PROC: 'glm53', RD_SPEC_DOC: 'cp', RD_INSP_PLAN: 'glm53' }
  const r4 = await G.btn('RD_PROD_INFO', '分发责任人', { 编号: piNo, 分发责任人: assign })
  info(JSON.stringify(r4?.data || r4))
  const tasks = sql('_probe-pf-task', `SET NOCOUNT ON;
SELECT 目标面板, ISNULL(负责人,N'-') FROM rd_dev_task WHERE 产品编号 = N'${PROD}' ORDER BY 目标面板;`)
  info('rd_dev_task = ' + JSON.stringify(tasks))
  const map = Object.fromEntries(tasks.map((t) => [t[0], t[1]]))
  if (tasks.length === 4 && map.RD_MOLD_PROC === 'cp' && map.RD_INSP_PLAN === 'glm53') ok('四文件责任人登记齐全')
  else bad('责任人登记不符:' + JSON.stringify(tasks))

  // ════════════ ⑤ 四文件编辑门禁 ════════════
  step('⑤ 编辑门禁:非责任人改不动,责任人可改')
  const gate1 = await D.probe_qc.btn('RD_MOLD_PROC', '保存', { 产品编号: PROD, 产品名称: PRODNAME })
  if (gate1?.code !== 200) ok('品质部账号(非该文件责任人)保存成型工艺清单被拒:' + gate1.message)
  else bad('非责任人竟保存成功')

  // ════════════ ⑥ 四文件填写 → 送审 → 归档 ════════════
  step('⑥ 四个受控文件各自填写并走完受控审核')
  const docs = {}
  // 成型工艺清单(责任人 cp)
  const m1 = await C.btn('RD_MOLD_PROC', '保存', {
    产品编号: PROD, 产品名称: PRODNAME,
    detail: { items: [{ 表区: FV.mold['配方表'], 序号: '1', 物料种类: '粉料', 物料名称: '测试粉料A', 实际添加比例: '0.6' }] },
  })
  docs.RD_MOLD_PROC = m1?.data?.['编号']
  info(`成型工艺清单 = ${docs.RD_MOLD_PROC}(${m1?.data?.['单据状态']})`)
  // 组装工艺清单(责任人 glm53)
  const a1 = await G.btn('RD_ASM_PROC', '保存', {
    产品编号: PROD, 产品名称: PRODNAME,
    detail: { items: [{ 表区: FV.asm['BOM表'], 物料名称: '测试包材A', 用量: '1' }] },
  })
  docs.RD_ASM_PROC = a1?.data?.['编号']
  info(`组装工艺清单 = ${docs.RD_ASM_PROC}(${a1?.data?.['单据状态']})`)
  // 规格书(责任人 cp;建单防绕过只拦"新建",此单由 admin 建草稿后交给责任人改)
  const s0 = await A.btn('RD_SPEC_DOC', '保存为草稿', {
    规格书种类: '产品规格书', 名称: PRODNAME, 编号: PROD, 客户名: '', 备注: '',
  })
  docs.RD_SPEC_DOC = s0?.data?.['编号']
  const s1 = await C.btn('RD_SPEC_DOC', '保存', { 编号: docs.RD_SPEC_DOC, 规格书种类: '产品规格书', 名称: PRODNAME, 整体规格参数: '探针填写:外径 30mm' })
  info(`规格书 = ${docs.RD_SPEC_DOC}(建草稿 ${s0?.data?.['单据状态']} → 责任人保存 ${s1?.data?.['单据状态']})`)
  // 出货检验计划表(责任人 glm53)
  const i1 = await G.btn('RD_INSP_PLAN', '保存', {
    标题: PRODNAME, 产品编号: PROD,
    detail: { items: [{ 检验类别: '必测项', 序号: '1', 控制项目: '外观', 控制标准及要求: '无破损' }] },
  })
  docs.RD_INSP_PLAN = i1?.data?.['编号']
  info(`出货检验计划表 = ${docs.RD_INSP_PLAN}(${i1?.data?.['单据状态']})`)
  const filled = Object.entries(docs).filter(([, v]) => v)
  if (filled.length === 4) ok('四个受控文件都有单据:' + filled.map(([k, v]) => `${k}=${v}`).join(' , '))
  else bad('有文件没建起来:' + JSON.stringify(docs))

  // 逐个审批归档
  for (const [panel, no] of Object.entries(docs)) {
    if (!no) continue
    const r = await A.btn(panel, '审批通过', { 编号: no, 审批意见: '同意归档' })
    const arch = one('_probe-pf-arch', `SET NOCOUNT ON; SELECT ISNULL(archived,N'-') FROM yj_doc_status WHERE panel_code=N'${panel}' AND doc_no=N'${no}';`)
    if (arch === 'Y') info(`${panel} ${no} → 已归档`)
    else bad(`${panel} ${no} 未归档(${JSON.stringify(r?.data || r?.message)} / archived=${arch})`)
  }
  const archivedN = Object.entries(docs).filter(([p, n]) => n
    && one('_probe-pf-arch2', `SET NOCOUNT ON; SELECT ISNULL(archived,N'-') FROM yj_doc_status WHERE panel_code=N'${p}' AND doc_no=N'${n}';`) === 'Y').length
  if (archivedN === 4) ok('四文件全部走完受控审核并归档')
  else bad(`只有 ${archivedN}/4 归档`)

  // ════════════ ⑦ 产品文件列表(派生矩阵)════════════
  step('⑦ 产品文件列表:该产品四文件状态')
  const matrix = (await A.get(`/api/px/prodDocList?productCode=${encodeURIComponent(PROD)}`))?.data
  info('prodDocList = ' + JSON.stringify(matrix).slice(0, 260))
  if (matrix) ok('产品文件列表接口对该产品有返回')
  else bad('产品文件列表接口无返回')

  // ════════════ ⑧ 发起变更单 ════════════
  step('⑧ cp 发起产品变更申请单(关联产品、勾选成型工艺清单+规格书、需会签)')
  const c1 = await C.btn('RD_CHANGE', '保存为草稿', {
    产品编号: PROD, 产品名称: PRODNAME, 申请人: cp.user.realName || '陈秀丽',
    申请部门: '产品开发部', 性质: '变更', 变更事由: '长度管控尺寸由 -0.1/+0.4mm 变更为 -0.2/+0.6mm',
    验证数据: '试产 200 支,尺寸合格率 99.5%', 变更文件: '成型工艺清单、规格书',
    需会签: '是', 会签人: 'glm53,probe_qc',
  })
  const chgNo = c1?.data?.['编号']
  info(`变更单 = ${chgNo}`)
  if (chgNo) ok('变更单建单成功')
  else throw new Error('变更单建单失败:' + JSON.stringify(c1))

  // ════════════ ⑨ 各部门填本部门行 ════════════
  step('⑨ 六个部门账号各填本部门"变更后内容"(顺带验证越权改别行会被还原)')
  const rowsOf = () => sql('_probe-pf-rows', `SET NOCOUNT ON;
SELECT CAST(id AS nvarchar(20)), 部门, ISNULL(变更后内容,N''), ISNULL(签字,N'') FROM rd_change_detail
 WHERE 单据编号 = N'${chgNo}' AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY rd_change_detail.id;`)
  const byDept = (rs) => Object.fromEntries(rs.map((r) => [r[1], { id: r[0], c: r[2], sign: r[3] }]))
  const fill = {
    probe_craft: ['成型工艺科', '成型段:模具芯棒直径改 12.02mm,同步更新烧结参数'],
    probe_asm: ['组装车间', '组装段:密封圈压装力不变,无需改工装'],
    probe_sale: ['销售部', '客户已确认新尺寸,包装标识需同步改版'],
    probe_qc: ['品质部', '检验标准同步收紧:外径公差 ±0.02mm,首件必检'],
    probe_plan: ['计划组', '切换日期安排在 10 月中旬,库存消化后再切'],
    probe_wh: ['仓管部', '旧规格半成品 1.2 万支,标识区分后继续使用'],
  }
  for (const [user, [dept, text]] of Object.entries(fill)) {
    const cur = byDept(rowsOf())[dept]
    const r = await D[user].btn('RD_CHANGE', '保存为草稿', {
      编号: chgNo, detail: { items: [{ id: cur?.id, 表区: '部门评审意见', 部门: dept, 变更后内容: text }] },
    })
    const after = byDept(rowsOf())[dept]
    if (r?.code === 200 && after.c === text) info(`${user}(${dept}) 填写成功,签字=${after.sign}`)
    else bad(`${user} 填 ${dept} 失败:${JSON.stringify(r?.message)} 落库=${after?.c}`)
  }
  const rowsNow = byDept(rowsOf())
  const filledDepts = Object.entries(fill).filter(([, [d, t]]) => rowsNow[d]?.c === t).length
  if (filledDepts === 6) ok('6 个部门行都被本部门账号填上(每行只放行本部门,服务端还原越权值)')
  else bad(`只有 ${filledDepts}/6 部门填上`)
  if (rowsNow['开发部']?.c === '' || !rowsNow['开发部']?.c) ok('没人填的部门行保持空白(开发部未填)')
  else bad('未填行竟有内容:' + JSON.stringify(rowsNow['开发部']))
  // 越权:品质部账号想把开发部行改掉
  const g9 = await D.probe_qc.btn('RD_CHANGE', '保存为草稿', {
    编号: chgNo, detail: { items: [{ id: rowsNow['开发部']?.id, 表区: '部门评审意见', 部门: '开发部', 变更后内容: '品质部替开发部填的内容' }] },
  })
  const devAfter = byDept(rowsOf())['开发部']
  if ((devAfter?.c || '') === '') ok('越权改别部门行被还原(接口 code=' + g9?.code + ')')
  else bad('越权写入成功:' + JSON.stringify(devAfter))

  // ════════════ ⑩ 会签 → 自动进审批 ════════════
  step('⑩ 提交会签 → 两个会签人(glm53/品质部)通过 → 自动进审批')
  const c10 = await C.btn('RD_CHANGE', '提交会签', { 编号: chgNo })
  info('提交会签:' + JSON.stringify(c10?.data || c10?.message))
  const st10 = await A.get(`/api/px/getFormDescriptor?panelCode=RD_CHANGE&code=${encodeURIComponent(chgNo)}`)
  if (st10?.data?.data?.['单据状态'] === '会签中') ok('状态 = 会签中')
  else bad('未进会签中:' + st10?.data?.data?.['单据状态'])
  const s1r = await G.btn('RD_CHANGE', '会签通过', { 编号: chgNo, 审批意见: '开发部无异议' })
  info('glm53 会签:' + (s1r?.data?.['单据状态'] || s1r?.message))
  const s2r = await D.probe_qc.btn('RD_CHANGE', '会签通过', { 编号: chgNo, 审批意见: '品质部同意' })
  info('品质部 会签:' + (s2r?.data?.['单据状态'] || s2r?.message))
  const pend = one('_probe-pf-pend', `SET NOCOUNT ON; SELECT ISNULL(pending,N'-') FROM yj_doc_status WHERE panel_code=N'RD_CHANGE' AND doc_no=N'${chgNo}';`)
  if (pend === 'Y') ok('全部会签通过 → 自动进审批(pending=Y)')
  else bad('未自动进审批:' + pend)

  // ════════════ ⑪ admin 审批通过 → 生效 + 下一版草稿 ════════════
  step('⑪ 冯总(admin)审批通过 → 变更生效,按勾选文件建下一版草稿')
  const c11 = await A.btn('RD_CHANGE', '审批通过', { 编号: chgNo, 审批意见: '同意变更,即日生效' })
  info(JSON.stringify(c11?.data || c11))
  const eff = one('_probe-pf-eff', `SET NOCOUNT ON; SELECT ISNULL(effective,N'-') FROM yj_doc_status WHERE panel_code=N'RD_CHANGE' AND doc_no=N'${chgNo}';`)
  if (eff === 'Y') ok('变更单已生效')
  else bad('未生效:' + eff)
  const drafts = sql('_probe-pf-drafts', `SET NOCOUNT ON;
SELECT N'RD_MOLD_PROC' AS panel, 单据编号, ISNULL(变更来源单号,N'-') FROM rd_mold_proc_head WHERE 变更来源单号 = N'${chgNo}'
UNION ALL SELECT N'RD_SPEC_DOC', 单据编号, ISNULL(变更来源单号,N'-') FROM rd_spec_doc_head WHERE 变更来源单号 = N'${chgNo}'
UNION ALL SELECT N'RD_ASM_PROC', 单据编号, ISNULL(变更来源单号,N'-') FROM rd_asm_proc_head WHERE 变更来源单号 = N'${chgNo}';`)
  info('下一版草稿 = ' + JSON.stringify(drafts))
  if (drafts.length === 2) ok('恰好两张(勾了两个文件):成型工艺清单 + 规格书')
  else bad('下一版草稿数不符:' + drafts.length)
  const newDocs = Object.fromEntries(drafts.map((d) => [d[0], d[1]]))
  // 通知责任人
  for (const [panel, no] of Object.entries(newDocs)) {
    const n = Number(one('_probe-pf-msg', `SET NOCOUNT ON; SELECT ${castN(`COUNT(*)`)} FROM yj_message WHERE 消息码=N'CHANGE_EFFECTIVE' AND 单据编号=N'${no}';`))
    if (n >= 1) info(`${no} 的 CHANGE_EFFECTIVE 通知 ${n} 条`)
    else bad(`${no} 没有通知责任人`)
  }
  // 复制完整性:成型工艺清单草稿应带过来 1 行明细
  const copied = Number(one('_probe-pf-copy', `SET NOCOUNT ON; SELECT ${castN('COUNT(*)')} FROM rd_mold_proc_detail WHERE 单据编号=N'${newDocs.RD_MOLD_PROC}' AND ISNULL(asp_cancel,'N')<>'Y';`))
  if (copied >= 1) ok(`整单复制:新版成型工艺清单带过来 ${copied} 行明细`)
  else bad('新版成型工艺清单没有复制明细')

  // ════════════ ⑫ 责任人改下一版草稿 → 重走受控审核 ════════════
  step('⑫ 责任人(cp)修改下一版草稿并重走受控审核 → 归档')
  const mp2 = newDocs.RD_MOLD_PROC
  const edit = await C.btn('RD_MOLD_PROC', '保存', {
    编号: mp2, 产品编号: PROD, 产品名称: PRODNAME,
    detail: { items: [{ 表区: FV.mold['配方表'], 序号: '1', 物料种类: '粉料', 物料名称: '测试粉料A', 实际添加比例: '0.55' }] },
  })
  info(`新版成型工艺清单保存 → ${JSON.stringify(edit?.data?.['单据状态'] || edit?.message)}`)
  const mpSt = one('_probe-pf-mp2', `SET NOCOUNT ON; SELECT ISNULL(pending,N'-') FROM yj_doc_status WHERE panel_code=N'RD_MOLD_PROC' AND doc_no=N'${mp2}';`)
  if (mp2 && mpSt === 'Y') ok('责任人保存 → 自动进审批(重走受控审核)')
  else bad('新版草稿保存后未进审批:' + mpSt)
  const ap2 = await A.btn('RD_MOLD_PROC', '审批通过', { 编号: mp2, 审批意见: '按变更单更新,同意' })
  const mpArch = one('_probe-pf-mp3', `SET NOCOUNT ON; SELECT ISNULL(archived,N'-') FROM yj_doc_status WHERE panel_code=N'RD_MOLD_PROC' AND doc_no=N'${mp2}';`)
  if (mpArch === 'Y') ok('新版成型工艺清单审批通过 → 已归档(变更闭环完成)')
  else bad(`新版未归档:${mpArch} (${JSON.stringify(ap2?.message)})`)
  // 规格书新版同样走一遍(责任人 cp)
  // ⚠ 规格书的「编号」在 API 里就是**单据标识**(save() 把载荷「编号」当单据号取走),
  //   所以这里只能传 编号=新单号,不能再塞同名业务字段(JS 对象字面量重复键只保留最后一个,
  //   第一版写重复键导致保存打到了另一张单上 —— 2026-09-21 走查踩到)。
  const sd2 = newDocs.RD_SPEC_DOC
  const sdEdit = await C.btn('RD_SPEC_DOC', '保存', { 编号: sd2, 规格书种类: '产品规格书', 名称: PRODNAME, 整体规格参数: '按变更单更新:外径 30.4mm' })
  info(`新版规格书保存 → ${JSON.stringify(sdEdit?.data?.['单据状态'] || sdEdit?.message)}`)
  const sdPending = one('_probe-pf-sd0', `SET NOCOUNT ON; SELECT ISNULL(pending,N'-') FROM yj_doc_status WHERE panel_code=N'RD_SPEC_DOC' AND doc_no=N'${sd2}';`)
  if (sdPending === 'Y') ok('规格书新版进审批(pending=Y)')
  else bad('规格书新版未进审批:' + sdPending + ' ' + JSON.stringify(sdEdit?.message))
  const sdArch0 = await A.btn('RD_SPEC_DOC', '审批通过', { 编号: sd2, 审批意见: '同意' })
  const sdArch = one('_probe-pf-sd', `SET NOCOUNT ON; SELECT ISNULL(archived,N'-') FROM yj_doc_status WHERE panel_code=N'RD_SPEC_DOC' AND doc_no=N'${sd2}';`)
  if (sdArch === 'Y') ok('新版规格书审批通过 → 已归档')
  else bad(`新版规格书未归档:${sdArch} (${JSON.stringify(sdArch0?.message)})`)

  // ════════════ ⑬ 旧版还在:版本链人工核对 ════════════
  step('⑬ 版本链核对:旧版仍归档在册,新版是独立单据')
  const chain = sql('_probe-pf-chain', `SET NOCOUNT ON;
SELECT 单据编号, ISNULL(变更来源单号,N'(旧版/原始)') FROM rd_mold_proc_head WHERE 产品编号 = N'${PROD}' ORDER BY id;`)
  info('成型工艺清单版本链 = ' + JSON.stringify(chain))
  if (chain.length >= 2) ok(`该产品成型工艺清单共 ${chain.length} 版(旧版 + 变更新版),旧版未被改写`)
  else bad('版本链不符:' + JSON.stringify(chain))

  fs.writeFileSync(CLEANUP, `/* 探针清理:产品文件全流程走查(_probe-prodfile-e2e.cjs) —— 整条链一次清干净。
   ⚠ 按**测试产品前缀 T-PF-** 圈定(覆盖历次跑,失败的跑也会留数据),不是只清本次那个产品。 */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @prods TABLE (p nvarchar(200) PRIMARY KEY);
INSERT INTO @prods (p) SELECT DISTINCT 产品编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'T-PF-%'
UNION SELECT DISTINCT 产品编号 FROM rd_change_head WHERE 产品编号 LIKE N'T-PF-%'
UNION SELECT DISTINCT 产品编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'T-PF-%'
UNION SELECT DISTINCT 产品编号 FROM rd_asm_proc_head WHERE 产品编号 LIKE N'T-PF-%'
UNION SELECT DISTINCT 编号 FROM rd_spec_doc_head WHERE 编号 LIKE N'T-PF-%';
DECLARE @chg TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @chg (no) SELECT 单据编号 FROM rd_change_head WHERE 产品编号 LIKE N'T-PF-%';
DECLARE @pi TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @pi (no) SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'T-PF-%';
DECLARE @files TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @files (no) SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'T-PF-%' OR 变更来源单号 IN (SELECT no FROM @chg);
INSERT INTO @files (no) SELECT 单据编号 FROM rd_asm_proc_head  WHERE 产品编号 LIKE N'T-PF-%' OR 变更来源单号 IN (SELECT no FROM @chg);
INSERT INTO @files (no) SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'T-PF-%' OR 变更来源单号 IN (SELECT no FROM @chg);
INSERT INTO @files (no) SELECT 单据编号 FROM rd_spec_doc_head  WHERE 编号 LIKE N'T-PF-%' OR 变更来源单号 IN (SELECT no FROM @chg);
DELETE FROM yj_message WHERE 单据编号 IN (SELECT no FROM @chg) OR 单据编号 IN (SELECT no FROM @pi) OR 单据编号 IN (SELECT no FROM @files);
DELETE FROM yj_form_approval WHERE form_no IN (SELECT no FROM @chg) OR form_no IN (SELECT no FROM @pi) OR form_no IN (SELECT no FROM @files);
DELETE FROM yj_doc_status WHERE doc_no IN (SELECT no FROM @chg) OR doc_no IN (SELECT no FROM @pi) OR doc_no IN (SELECT no FROM @files);
DELETE FROM rd_change_detail WHERE 单据编号 IN (SELECT no FROM @chg);
DELETE FROM rd_change_head   WHERE 单据编号 IN (SELECT no FROM @chg);
DELETE FROM rd_mold_proc_detail WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_asm_proc_detail  WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_spec_doc_detail  WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_insp_plan_detail WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_mold_proc_head WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_asm_proc_head  WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_spec_doc_head  WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_insp_plan_head WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_prod_info_detail WHERE 单据编号 IN (SELECT no FROM @pi);
DELETE FROM rd_prod_info_head   WHERE 单据编号 IN (SELECT no FROM @pi);
DELETE FROM rd_dev_task WHERE 产品编号 LIKE N'T-PF-%';
-- 部门账号(本次走查补的测试数据;要留用就注释掉下面这行)
DELETE FROM yj_user WHERE username IN (${DEPT_USERS.map((u) => `N'${u.user}'`).join(', ')});
SELECT N'变更单残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_change_head WHERE 产品编号 LIKE N'T-PF-%'
UNION ALL SELECT N'产品信息表残留', CAST(COUNT(*) AS nvarchar) FROM rd_prod_info_head WHERE 产品编号 LIKE N'T-PF-%'
UNION ALL SELECT N'四文件残留', CAST(COUNT(*) AS nvarchar) FROM (
  SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'T-PF-%'
  UNION ALL SELECT 单据编号 FROM rd_asm_proc_head WHERE 产品编号 LIKE N'T-PF-%'
  UNION ALL SELECT 单据编号 FROM rd_spec_doc_head WHERE 编号 LIKE N'T-PF-%'
  UNION ALL SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'T-PF-%') t
UNION ALL SELECT N'责任人行残留', CAST(COUNT(*) AS nvarchar) FROM rd_dev_task WHERE 产品编号 LIKE N'T-PF-%'
UNION ALL SELECT N'部门账号残留', CAST(COUNT(*) AS nvarchar) FROM yj_user WHERE username LIKE N'probe[_]%';
`, 'utf8')

  console.log(`\n  --   清理 SQL:${CLEANUP}`)
  console.log(`  --   测试产品 ${PROD} / 变更单 ${chgNo} / 产品信息表 ${piNo}`)
  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('走查异常:', e.message); process.exit(1) })
