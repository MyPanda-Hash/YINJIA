/* _v-qc-catalog-auto.cjs — 检验目录自动化联动 端到端核查(纯接口,不启浏览器)
   链路:已审核暂收单 →「生成来料检验单」→ 自动建 检验数据记录草稿 + 检验目录行
   断言:① 目录行:类别来自商品档案「所属类别」/数量=送检数量+单位/检验状态=正在检验中/两个单号都在;
        ② 完成闸门:挂靠单据未审批时「完成」被拒;
        ③ 审批后「完成」成功(带是否合格);④ 已完成时反审核挂靠单据被拒;
        ⑤ 「修改」回弹 + 写修改记录 → 反审核放行;⑥ 删除目录记录守卫(挂靠单据还在时被拒)。
   用法:node tools/archive/_probe-qc-logic/_v-qc-catalog-auto.cjs */
const BASE = 'http://localhost:8090/api'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`)
  if (!cond) process.exitCode = 1
}
let TOKEN = ''
const H = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` })
async function api(path, body, method = 'POST') {
  const res = await fetch(`${BASE}${path}`, { method, headers: H(), body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => ({}))
  if (json && json.code && json.code !== 200) throw new Error(json.message || 'API 失败')
  return json?.data ?? json
}
async function callButton(panelCode, buttonName, formData) {
  return api('/px/callButton', { panelCode, buttonName, formData: { ...formData }, buttonParam: {} })
}
async function list(panelCode, condition = {}) {
  const d = await api('/px/queryFormDataList', { panelCode, pageNo: 1, pageSize: 50, condition })
  return d?.list || d?.rows || []
}
async function desc(panelCode, code) {
  return api(`/px/getFormDescriptor?panelCode=${panelCode}&code=${encodeURIComponent(code)}`, null, 'GET')
}

async function main() {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json())
  TOKEN = login.data.token

  // ── 找一张「已审核且还有剩余可送」的暂收单;没有则以已有单为模板新建一张并审核(自备数据) ──
  const recvs = await list('QC_RECV')
  const audited = recvs.filter((r) => r['单据状态'] === '已审核')
  ok('存在已审核的送料暂收单', audited.length > 0, `共 ${recvs.length} 张, 已审核 ${audited.length}`)

  /** 逐张试生单;全部失败则自建一张暂收单 */
  const tryGenerate = async () => {
    for (const r of audited.slice(0, 30)) {
      const no = r['单据编号'] || r['编号']
      try { return { gen: await callButton('QC_RECV', '生成来料检验单', { 编号: no }), recvNo: no } } catch { /* 剩余量已满,换下一张 */ }
    }
    return null
  }
  let attempt = null // 固定走「自备数据」,确保用有类别的物料,类别映射断言非空验证
  if (!attempt) {
    console.log('   暂收单均无可送剩余 → 以模板自建一张并审核')
    const tpl = await desc('QC_RECV', audited[0]['单据编号'] || audited[0]['编号'])
    const tplHead = tpl?.data || {}
    const tplLine = (tpl?.detailData?.items || [])[0] || {}
    const head = {}
    for (const k of ['单据日期', '供应商', '供应商代码', '采购订单号', '部门', '部门名称', '业务员', '仓库']) {
      if (tplHead[k] !== undefined) head[k] = tplHead[k]
    }
    head['单据日期'] = new Date().toISOString().slice(0, 10)
    const line = {}
    for (const k of ['规格型号', '单位', '计量单位', '采购订单行号', '行号']) {
      if (tplLine[k] !== undefined) line[k] = tplLine[k]
    }
    // 挑一个「商品档案有 所属类别」的物料(实测:折叠棉类 YJ-YCYX-008 所属类别=折叠棉),
    // 让类别映射断言非空验证;面板列表按类别过滤不可靠,故按编码取
    const invs = await list('INV', { 存货编码: 'YJ-YCYX-008' })
    const withCat = invs.find((x) => String(x['所属类别'] || '').trim() && x['存货编码'])
      || { 存货编码: 'YJ-YCYX-008', 存货名称: '折叠棉', 所属类别: '折叠棉' }
    line['物料编码'] = withCat ? withCat['存货编码'] : tplLine['物料编码']
    line['物料名称'] = withCat ? withCat['存货名称'] : tplLine['物料名称']
    if (withCat) console.log(`   选用有类别物料: ${withCat['存货编码']} (${withCat['所属类别']})`)
    line['数量'] = 100
    const created = await callButton('QC_RECV', '新增', {})
    const no = created?.['编号'] || created?.formNo
    await callButton('QC_RECV', '保存', { 编号: no, ...head, detail: { items: [line] } })
    await callButton('QC_RECV', '审核', { 编号: no })
    const st = (await list('QC_RECV')).find((x) => (x['单据编号'] || x['编号']) === no)
    ok('自建暂收单并审核', st?.['单据状态'] === '已审核', `${no} / ${st?.['单据状态']}`)
    attempt = { gen: await callButton('QC_RECV', '生成来料检验单', { 编号: no }), recvNo: no, expectCat: withCat['所属类别'] }
  }
  const gen = attempt?.gen
  const recvNo = attempt?.recvNo || ''
  const EXPECT_CAT = attempt?.expectCat || ''
  ok('生成来料检验单成功', !!gen?.编号, gen ? `暂收单=${recvNo} 检验单=${gen.编号}` : '(失败)')
  if (!gen?.编号) { console.log('== 生单失败,中止 =='); process.exit(1) }
  console.log('   暂收单:', recvNo, '→ 检验单:', gen.编号)
  const inspNo = gen?.编号
  // 检验单明细(拿物料/数量/单位做核对基准)
  const inspDoc = await desc('QC_INSP', inspNo)
  const inspRows = inspDoc?.detailData?.items || []
  ok('检验单有明细行', inspRows.length > 0, `行数=${inspRows.length}`)

  // 目录行(doc 面板:单据列表只回头表字段,明细行必须走 getFormDescriptor 取)
  const catalogNo = (await list('QC_CATALOG'))[0]?.['单据编号'] || (await list('QC_CATALOG'))[0]?.['编号']
  ok('存在唯一目录单', !!catalogNo, String(catalogNo))
  const catDoc = await desc('QC_CATALOG', catalogNo)
  const catRows = (catDoc?.detailData?.items || []).filter((r) => r['检验单号'] === inspNo)
  ok('检验目录已自动生成对应行', catRows.length === inspRows.length, `目录行=${catRows.length} 检验行=${inspRows.length}`)
  const r0 = catRows[0] || {}
  const insp0 = inspRows.find((x) => x['物料编码'] === r0['物料编码']) || inspRows[0] || {}
  console.log('   目录行样例:', JSON.stringify({ 物料编码: r0['物料编码'], 类别: r0['检测物料类别'], 数量: r0['数量'], 状态: r0['检验状态'], 检验单号: r0['检验单号'], 记录单号: r0['检验数据记录单号'] }))
  ok('目录行带物料编码', !!r0['物料编码'], String(r0['物料编码']))
  ok('目录行带检验单号', r0['检验单号'] === inspNo)
  ok('目录行带检验数据记录单号', /^JYSJ/.test(String(r0['检验数据记录单号'] || '')), String(r0['检验数据记录单号']))
  ok('检验状态开局=正在检验中', r0['检验状态'] === '正在检验中', String(r0['检验状态']))
  const qtyExpect = (insp0['送检数量'] ?? insp0['数量'] ?? '') + (insp0['单位'] || insp0['计量单位'] || '')
  ok('数量=检验单送检数量+单位', String(r0['数量']) === String(qtyExpect), `目录=${r0['数量']} 期望=${qtyExpect}`)
  // 类别来自商品档案「所属类别」(基准=生单时选用的物料所属类别)
  ok('检测物料类别取自商品档案「所属类别」', String(r0['检测物料类别'] || '') === String(EXPECT_CAT || ''),
    `目录=${r0['检测物料类别']} 商品档案=${EXPECT_CAT}`)
  ok('类别非空(非空验证,证明映射真的生效)', !!String(r0['检测物料类别'] || '').trim(), String(r0['检测物料类别']))

  // 检验数据记录草稿确实建出来了
  const recDoc = await desc('QC_INSP_REC', r0['检验数据记录单号'])
  ok('检验数据记录已自动建草稿', !!(recDoc?.data && (recDoc.data['物料编码'] || recDoc.data['物料名称'])),
    JSON.stringify(recDoc?.data || null).slice(0, 160))

  // ── ② 完成闸门:挂靠单据未审批 → 被拒 ──
  let blocked = ''
  try { await callButton('QC_CATALOG', '完成', { 编号: (await list('QC_CATALOG'))[0]?.['单据编号'] || '', id: r0.id, 是否合格: '合格' }) } catch (e) { blocked = e.message }
  ok('挂靠单据未审批时「完成」被拒', /尚未审批/.test(blocked), blocked)

  // ── ③ 审批挂靠单据:检验单审核 + 报告归档(保存即归档) ──
  await callButton('QC_INSP', '审核', { 编号: inspNo })
  const recNo = String(r0['检验数据记录单号'])
  await callButton('QC_INSP_REC', '保存', { 编号: recNo, 物料名称: recDoc?.data?.['物料名称'] || '样例', 物料批次: recDoc?.data?.['物料批次'] || 'B1', detail: {} })
  const recStatus = (await list('QC_INSP_REC')).find((x) => (x['单据编号'] || x['编号']) === recNo)
  console.log('   检验单/报告状态:', (await list('QC_INSP')).find((x) => (x['单据编号'] || x['编号']) === inspNo)?.['单据状态'], '/', recStatus?.['单据状态'])

  // ── ④ 完成(带是否合格) ──
  let doneRes
  try { doneRes = await callButton('QC_CATALOG', '完成', { 编号: catalogNo, id: r0.id, 是否合格: '合格' }) } catch (e) { doneRes = { err: e.message } }
  ok('审批后「完成」成功', doneRes?.['检验状态'] === '已完成检验', JSON.stringify(doneRes))
  const afterDoc = await desc('QC_CATALOG', catalogNo)
  const after = (afterDoc?.detailData?.items || []).find((x) => x.id === r0.id) || {}
  ok('目录行状态=已完成检验 且 是否合格=合格', after['检验状态'] === '已完成检验' && after['是否合格'] === '合格', JSON.stringify({ s: after['检验状态'], q: after['是否合格'] }))

  // ── ⑤ 已完成 → 反审核被拒 ──
  let unBlocked = ''
  try { await callButton('QC_INSP', '弃审', { 编号: inspNo }) } catch (e) { unBlocked = e.message }
  ok('已完成时反审核检验单被拒', /检验目录/.test(unBlocked), unBlocked)

  // ── ⑥ 「修改」回弹 + 写修改记录 → 反审核放行 ──
  const reopen = await callButton('QC_CATALOG', '修改', { 编号: catalogNo, id: r0.id })
  ok('「修改」回弹成功', reopen?.['检验状态'] === '正在检验中', JSON.stringify(reopen))
  const logs = await callButton('QC_CATALOG', '修改记录', { 编号: catalogNo })
  ok('写入修改记录', (logs?.records || []).length > 0, `记录数=${(logs?.records || []).length}`)
  let unauditOk = true, unauditErr = ''
  try { await callButton('QC_INSP', '弃审', { 编号: inspNo }) } catch (e) { unauditOk = false; unauditErr = e.message }
  ok('取消完成后反审核放行', unauditOk, unauditErr)

  // ── ⑦ 删除目录记录守卫(挂靠单据还在) ──
  let delBlocked = ''
  try { await callButton('QC_CATALOG', '删除记录', { 编号: catalogNo, id: r0.id }) } catch (e) { delBlocked = e.message }
  ok('挂靠单据还在时删除目录记录被拒', /挂靠/.test(delBlocked), delBlocked)

  console.log(process.exitCode ? '\n== 有失败项 ==' : '\n== 全部通过 ==')
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
