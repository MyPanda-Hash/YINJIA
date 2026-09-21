/**
 * _probe-remote-flow.cjs —— 部署后的「真流程实操」验收(2026-09-21)
 *
 * 与 _probe-remote-accept.cjs 的分工:那个只读(看库/代码/前端换没换),这个**真跑一遍业务**:
 * 造一个一次性产品(产品编号 PROBE-RMT-xxx)→ 两级审批归档 → 分发责任人 → 四文件建单归档 →
 * 门禁(非责任人被拒)→ 发起变更单 → 部门按账号填行(越权被还原)→ 会签 → 冯总审批 → **已生效** →
 * 核对"按勾选文件自动建下一版草稿" → 责任人改新草稿重走审核归档 → 收尾(尽力作废造出来的单)。
 *
 * 全程只走 HTTP(服务器上我没有命令行/库权限),断言全部来自接口应答与列表查询。
 * 一次性单号统一 PROBE-RMT-* 前缀:本地跑完可用 tools/migrate-testdata-cleanup.sql 的 R1 规则清掉。
 *
 * 用法:
 *   node tools/archive/_probe-remote-flow.cjs --local      # 先在本机跑通(自检)
 *   node tools/archive/_probe-remote-flow.cjs              # 打服务器
 *   node tools/archive/_probe-remote-flow.cjs --base URL
 */
'use strict'

const args = process.argv.slice(2)
const LOCAL = args.includes('--local')
const baseArg = args.indexOf('--base')
const BASE = baseArg >= 0 ? args[baseArg + 1] : (LOCAL ? 'http://localhost:8090' : 'http://36.140.66.163:8090')
const TAG = Date.now().toString().slice(-6)
const PROD = 'PROBE-RMT-' + TAG
const PRODNAME = '远程实操产品' + TAG

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)
const info = (m) => console.log('     ' + m)

async function main() {
  console.log(`目标: ${BASE}${LOCAL ? '  (本机自检)' : ''}   一次性产品: ${PROD}`)
  const tok = async (u, p = '123456') => {
    const r = await (await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: u, password: p }),
    })).json()
    if (!r?.data?.token) throw new Error(`${u} 登录失败`)
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
      status: async (panelCode, no) => (await (await fetch(`${BASE}/api/px/getFormDescriptor?panelCode=${panelCode}&code=${encodeURIComponent(no)}`, { headers: H })).json())?.data?.data?.['单据状态'],
      // ⚠ 列表接口的字段名是 data.list(不是 rows);keyword 空串会返回 0 行,必须给关键字
      rows: async (panelCode, keyword) => {
        const r = await (await fetch(`${BASE}/api/px/queryFormDataList`, {
          method: 'POST', headers: H, body: JSON.stringify({ panelCode, keyword, pageNo: 1, pageSize: 50, condition: {} }),
        })).json()
        return r?.data?.list || r?.data?.rows || []
      },
    }
  }
  const A0 = await tok('admin'); const A = api(A0.token)
  const cp = await tok('cp'); const C = api(cp.token)
  const glm = await tok('glm53'); const G = api(glm.token)
  let qc = null
  try { const t = await tok('demo_pinzhi'); qc = api(t.token) } catch { info('(没有 demo_pinzhi 账号,门禁用 glm53 顶替)'); qc = G }

  const created = []   // 收尾用
  const track = (panel, no) => { if (no) created.push([panel, no]) }

  // ════ ① 产品信息表:两次保存 ════
  step('① 产品开发部建产品信息表(cp):新增 → 填完保存 = 自动送审')
  const pi0 = await C.btn('RD_PROD_INFO', '新增', {})
  const piNo = pi0?.data?.['编号']; track('RD_PROD_INFO', piNo)
  if (!piNo) throw new Error('新建产品信息表失败:' + JSON.stringify(pi0))
  const pi1 = await C.btn('RD_PROD_INFO', '保存', {
    编号: piNo, 产品编号: PROD, 产品名称: PRODNAME, 产品类别: '滤芯',
    客户项目名称: '远程实操-' + TAG, 产品负责人: cp.user.realName || '陈秀丽', 产品形态: '成品',
  })
  info(`保存 → ${pi1?.data?.['单据状态']}`)
  if (pi1?.data?.['单据状态'] === '审批中') ok('普通用户保存自动进审批')
  else bad('保存后状态不对:' + JSON.stringify(pi1?.data))

  // ════ ②③ 两级审批 ════
  step('②③ 冯总一级审批(选二级=glm53)→ 二级通过 → 归档')
  const s2 = await A.btn('RD_PROD_INFO', '审批通过', { 编号: piNo, 二级审批人: 'glm53', 审批意见: '转二级' })
  info('一级 → ' + s2?.data?.['单据状态'])
  if (s2?.data?.['单据状态'] === '待二级审批') ok('一级通过转待二级')
  else bad('一级审批结果不对:' + JSON.stringify(s2?.data))
  const s3 = await G.btn('RD_PROD_INFO', '审批通过', { 编号: piNo, 审批意见: '同意' })
  info('二级 → ' + s3?.data?.['单据状态'])
  if (s3?.data?.['单据状态'] === '已归档') ok('二级通过即归档')
  else bad('二级审批结果不对:' + JSON.stringify(s3?.data))

  // ════ ④ 分发责任人 ════
  step('④ 二级审核人分发四个受控文件责任人')
  const s4 = await G.btn('RD_PROD_INFO', '分发责任人', { 编号: piNo, 分发责任人: { RD_MOLD_PROC: 'cp', RD_ASM_PROC: 'glm53', RD_SPEC_DOC: 'cp', RD_INSP_PLAN: 'glm53' } })
  info(JSON.stringify(s4?.data?.assigns || s4?.message))
  if (s4?.code === 200) ok('分发成功(四文件各一个责任人)')
  else bad('分发失败:' + JSON.stringify(s4?.message))

  // ════ ⑤ 四文件建单并归档 ════
  step('⑤ 四个受控文件各自建单 → 送审 → 冯总审批 → 归档')
  const docs = {}
  const m1 = await C.btn('RD_MOLD_PROC', '保存', { 产品编号: PROD, 产品名称: PRODNAME, detail: { items: [{ 表区: '配方表', 序号: '1', 物料种类: '粉料', 物料名称: '远程实操粉料' }] } })
  docs.RD_MOLD_PROC = m1?.data?.['编号']; track('RD_MOLD_PROC', docs.RD_MOLD_PROC)
  const a1 = await G.btn('RD_ASM_PROC', '保存', { 产品编号: PROD, 产品名称: PRODNAME, detail: { items: [{ 表区: '物料清单', 物料名: '远程实操包材', 用量: '1' }] } })
  docs.RD_ASM_PROC = a1?.data?.['编号']; track('RD_ASM_PROC', docs.RD_ASM_PROC)
  const s0 = await A.btn('RD_SPEC_DOC', '保存为草稿', { 规格书种类: '产品规格书', 名称: PRODNAME, 编号: PROD })   // ⚠ 规格书的「编号」= 单据标识,只能给单号
  docs.RD_SPEC_DOC = s0?.data?.['编号']; track('RD_SPEC_DOC', docs.RD_SPEC_DOC)
  await C.btn('RD_SPEC_DOC', '保存', { 编号: docs.RD_SPEC_DOC, 规格书种类: '产品规格书', 名称: PRODNAME, 整体规格参数: '远程实操:外径 30mm' })
  const i1 = await G.btn('RD_INSP_PLAN', '保存', { 标题: PRODNAME, 产品编号: PROD, detail: { items: [{ 检验类别: '必测项', 序号: '1', 控制项目: '外观', 控制标准及要求: '无破损' }] } })
  docs.RD_INSP_PLAN = i1?.data?.['编号']; track('RD_INSP_PLAN', docs.RD_INSP_PLAN)
  info(JSON.stringify(docs))
  if (Object.values(docs).every(Boolean)) ok('四文件都建起来了')
  else bad('有文件没建起来:' + JSON.stringify(docs))
  let arch = 0
  for (const [panel, no] of Object.entries(docs)) {
    if (!no) continue
    await A.btn(panel, '审批通过', { 编号: no, 审批意见: '同意归档' })
    if (String(await A.status(panel, no)).includes('已归档')) arch++
  }
  if (arch === 4) ok('四文件全部归档')
  else bad(`只有 ${arch}/4 归档`)

  // ════ ⑥ 门禁 ════
  step('⑥ 四文件门禁:非责任人改不动')
  const gate = await qc.btn('RD_MOLD_PROC', '保存', { 产品编号: PROD, 产品名称: PRODNAME })
  if (gate?.code !== 200) ok('非责任人被拒:' + gate.message)
  else bad('非责任人竟能保存')

  // ════ ⑦ 发起变更单 + 部门填行 ════
  step('⑦ 发起变更单(勾成型工艺清单+规格书,需会签)+ 部门按账号填行')
  const c1 = await C.btn('RD_CHANGE', '保存为草稿', {
    产品编号: PROD, 产品名称: PRODNAME, 申请人: cp.user.realName || '陈秀丽', 申请部门: '产品开发部', 性质: '变更',
    变更事由: '远程实操:长度公差收紧为 -0.2/+0.6mm', 验证数据: '远程实操验证数据', 变更文件: '成型工艺清单、规格书',
    需会签: '是', 会签人: 'glm53,demo_pinzhi',
  })
  const chgNo = c1?.data?.['编号']; track('RD_CHANGE', chgNo)
  info('变更单 = ' + chgNo)
  if (!chgNo) throw new Error('建变更单失败:' + JSON.stringify(c1))
  const rowOf = async (dept) => {
    const d = await A.get(`/api/px/getFormDescriptor?panelCode=RD_CHANGE&code=${encodeURIComponent(chgNo)}`)
    const items = d?.data?.detailData?.items || []
    return items.find((r) => r['部门'] === dept)
  }
  const devRow = await rowOf('开发部')
  if (devRow) ok('建单即铺好部门行(含开发部)')
  else bad('部门行没铺出来')
  const fill = await C.btn('RD_CHANGE', '保存为草稿', { 编号: chgNo, detail: { items: [{ id: devRow?.id, 表区: '部门评审意见', 部门: '开发部', 变更后内容: '远程实操:开发部同意' }] } })
  const devAfter = await rowOf('开发部')
  info(`开发部行 → 内容=${JSON.stringify(devAfter?.['变更后内容'])} 签字=${JSON.stringify(devAfter?.['签字'])}`)
  if (String(devAfter?.['变更后内容']).includes('开发部同意') && devAfter?.['签字']) ok('本部门行填上且系统自动盖章')
  else bad('本部门行填写/盖章不对:' + JSON.stringify(fill?.message))
  const qcRow = await rowOf('品质部')
  await qc.btn('RD_CHANGE', '保存为草稿', { 编号: chgNo, detail: { items: [{ id: devRow?.id, 表区: '部门评审意见', 部门: '开发部', 变更后内容: '越权改写' }] } })
  const devAfter2 = await rowOf('开发部')
  if (!String(devAfter2?.['变更后内容']).includes('越权')) ok('越权改别部门行被服务端还原')
  else bad('越权写入竟然生效')
  if (qcRow) ok('品质部行存在(等着品质账号填)')

  // ════ ⑧ 会签 → 自动进审批 ════
  step('⑧ 提交会签 → 两个会签人通过 → 自动进审批')
  const cs = await C.btn('RD_CHANGE', '提交会签', { 编号: chgNo })
  info('提交会签 → ' + cs?.data?.['单据状态'])
  const g1 = await G.btn('RD_CHANGE', '会签通过', { 编号: chgNo, 审批意见: '同意' })
  const q1 = await qc.btn('RD_CHANGE', '会签通过', { 编号: chgNo, 审批意见: '同意' })
  const st8 = await A.status('RD_CHANGE', chgNo)
  info(`glm53 → ${g1?.data?.['单据状态']} ; 品质 → ${q1?.data?.['单据状态']} ; 最终 ${st8}`)
  if (st8 === '审批中') ok('全部会签通过自动转审批中')
  else bad('未自动进审批:' + st8)

  // ════ ⑨ 审批 → 生效 + 下一版草稿 ════
  step('⑨ 冯总审批通过 → 已生效 → 按勾选文件自动建下一版草稿')
  const ap = await A.btn('RD_CHANGE', '审批通过', { 编号: chgNo, 审批意见: '同意变更' })
  info('审批 → ' + ap?.data?.['单据状态'])
  if (ap?.data?.['单据状态'] === '已生效') ok('已生效')
  else bad('未生效:' + JSON.stringify(ap?.data))
  // ⚠ 定位"下一版草稿"不能靠列表关键字搜索:①列表接口 keyword 空返回 0 行、②它也不搜「变更来源单号」列。
  //   可靠办法是读本单的**审批情况**:生效那一步会留一条
  //   `EFFECT / APPLIED / 已生成下一版草稿：规格书 SD-…；成型工艺清单 MP-…`(带新单号)。
  const hist = (await A.btn('RD_CHANGE', '审批情况', { 编号: chgNo }))?.data?.list || []
  const eff = hist.find((x) => x.action === 'EFFECT')
  const effTxt = String(eff?.opinion || '')
  info('生效留痕 = ' + effTxt)
  const newNos = effTxt.match(/(?:MP|AP|SD|IP)-\d{4}-\d{2}-\d{4}/g) || []
  const newMp = newNos.find((n) => n.startsWith('MP-')) || ''
  const newSd = newNos.find((n) => n.startsWith('SD-')) || ''
  info(`新版成型工艺清单 = ${newMp || '(无)'} ; 新版规格书 = ${newSd || '(无)'}`)
  if (newMp && newSd) ok('勾选的两个文件各生成了下一版草稿(留痕里带单号)')
  else bad('下一版草稿没生成:' + effTxt)
  // 再确认这张新草稿真的在、且是草稿态(它的「变更来源单号」落在库里,但**列表行模型里没有这一列** ——
  // 走查发现:该字段登记成 place='query'/hidden=1 后并没进列表列集,所以"列表可见"这条没兑现,
  // 目前追溯靠上面那条 EFFECT 留痕 + 库内 rd_*_head.变更来源单号;要不要补到列表/纸张另行决定)
  if (newMp) {
    const st = await A.status('RD_MOLD_PROC', newMp)
    info(`新草稿 ${newMp} 状态 = ${st}`)
    if (String(st).includes('草稿')) ok('下一版草稿已建好且是草稿态(等责任人编辑)')
    else bad('新草稿状态不对:' + st)
  }

  // ════ ⑩ 责任人改新版 → 重走审核 → 归档 ════
  step('⑩ 责任人改下一版草稿 → 自动送审 → 冯总通过 → 归档(变更闭环)')
  if (!newMp) bad('没有新版单可改')
  else {
    track('RD_MOLD_PROC', newMp)
    const e1 = await C.btn('RD_MOLD_PROC', '保存', { 编号: newMp, 产品编号: PROD, 产品名称: PRODNAME })
    info('保存 → ' + (e1?.data?.['单据状态'] || e1?.message))
    if (e1?.data?.['单据状态'] === '审批中') ok('责任人保存自动送审(重走受控审核)')
    else bad('新版保存后没进审批')
    await A.btn('RD_MOLD_PROC', '审批通过', { 编号: newMp, 审批意见: '同意' })
    const st10 = await A.status('RD_MOLD_PROC', newMp)
    if (String(st10).includes('已归档')) ok('新版归档,变更闭环完成')
    else bad('新版未归档:' + st10)
  }

  // ════ 收尾:尽力作废造出来的一次性单 ════
  step('⑪ 收尾:作废本次造出来的一次性单(失败不影响验收结论)')
  let cleaned = 0
  for (const [panel, no] of created) {
    if (!no) continue
    const r = await A.btn(panel, '删除', { 编号: no })
    if (r?.code === 200) cleaned++
  }
  info(`已作废 ${cleaned}/${created.length} 张(PROBE-RMT-* 前缀,本地可用 migrate-testdata-cleanup.sql 的 R1 规则清)`)

  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED —— 变更全流程在该实例上真跑通了')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('实操异常:', e.message); process.exit(1) })
