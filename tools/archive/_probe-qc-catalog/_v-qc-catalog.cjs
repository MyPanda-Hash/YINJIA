/* _v-qc-catalog.cjs — 检验目录面板(QC_CATALOG)接口冒烟:
   ① getPanelConfig:singleDoc/查询位字段/明细字段/表头字段
   ② queryFormDataList:唯一目录单可见
   ③ getFormDescriptor:表头+明细行(阻垢料/HP-12/260807/51Kg)
   ④ condition 按批次号过滤(EXISTS 行表路径)
   用法:node tools/archive/_probe-qc-catalog/_v-qc-catalog.cjs(需后端 8090 已起) */
const BASE = 'http://localhost:8090/api'
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login?.data?.token
  ok('登录', !!token)
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // ① 面板配置
  const cfg = (await (await fetch(`${BASE}/px/getPanelConfig?panelCode=QC_CATALOG`, { headers: H })).json())?.data
  ok('metadata.singleDoc = true', cfg?.metadata?.singleDoc === true)
  ok('面板名 = 检验目录', cfg?.metadata?.panelName === '检验目录', cfg?.metadata?.panelName)
  const qf = (cfg?.tablePage?.queryFields || cfg?.metadata?.panelPageDto?.tablePages?.[0]?.queryFields || []).map(f => f.dataName)
  for (const k of ['检测物料类别', '物料名称', '批次号', '检验状态', '是否合格'])
    ok(`查询字段:${k}`, qf.includes(k), qf.join(','))
  const tabs = cfg?.detail?.tabs || []
  const detailFields = (tabs[0]?.fields || []).map(f => f.dataName)
  for (const k of ['检测物料类别', '物料名称', '批次号', '数量', '检验状态', '是否合格'])
    ok(`明细字段:${k}`, detailFields.includes(k), detailFields.join(','))
  const st = detailFields.find(f => f === '检验状态')
  const stField = (tabs[0]?.fields || []).find(f => f.dataName === '检验状态')
  ok('检验状态下拉两值', JSON.stringify(stField?.options) === JSON.stringify(['正在检验中', '已完成检验']), JSON.stringify(stField?.options))
  const qfField = (tabs[0]?.fields || []).find(f => f.dataName === '是否合格')
  ok('是否合格下拉两值', JSON.stringify(qfField?.options) === JSON.stringify(['合格', '不合格']), JSON.stringify(qfField?.options))
  const headerFields = (cfg?.dataSchema?.fields || []).map(f => f.dataName)
  ok('表头仅单据身份字段', JSON.stringify(headerFields) === JSON.stringify(['单据编号', '单据日期', '备注']), headerFields.join(','))

  // ② 单据列表(唯一目录单)
  const list = (await (await fetch(`${BASE}/px/queryFormDataList`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'QC_CATALOG', pageNo: 1, pageSize: 20, condition: {} }),
  })).json())?.data
  const rows = list?.rows || list?.list || []
  ok('唯一目录单 JYML-2026-09-0001', rows.length === 1 && rows[0]['单据编号'] === 'JYML-2026-09-0001', `rows=${rows.length}`)

  // ③ 表单取数(头 + 明细行)——GET /px/getFormDescriptor?panelCode=&code=
  const fdBody = await (await fetch(`${BASE}/px/getFormDescriptor?panelCode=QC_CATALOG&code=${encodeURIComponent('JYML-2026-09-0001')}`, { headers: H })).json()
  const fd = fdBody?.data
  const d = fd?.data || {}
  const items = fd?.detailData?.items || []
  ok('明细两行(260807/260907)', items.length === 2, `items=${items.length}`)
  const first = items[0] || {}
  ok('示例行一比一', first['检测物料类别'] === '阻垢料' && first['物料名称'] === 'HP-12' && first['批次号'] === '260807' && first['数量'] === '51Kg',
    JSON.stringify(first))

  // ④ 按批次号过滤(明细条件 → EXISTS 行表)
  const filtered = (await (await fetch(`${BASE}/px/queryFormDataList`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'QC_CATALOG', pageNo: 1, pageSize: 20, condition: { 批次号: '260807' } }),
  })).json())?.data
  const fRows = filtered?.rows || filtered?.list || []
  ok('批次号=260807 命中唯一单', fRows.length === 1 && fRows[0]['单据编号'] === 'JYML-2026-09-0001', `rows=${fRows.length}`)
  const miss = (await (await fetch(`${BASE}/px/queryFormDataList`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'QC_CATALOG', pageNo: 1, pageSize: 20, condition: { 批次号: 'NOTEXIST' } }),
  })).json())?.data
  ok('批次号=NOTEXIST 零命中', (miss?.rows || miss?.list || []).length === 0)

  console.log(process.exitCode ? '\n== 有失败项 ==' : '\n== 全部通过 ==')
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
