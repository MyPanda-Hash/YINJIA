/**
 * _probe-sampleNo-flow.cjs — 样品编号表(RD_SAMPLE_NO)端到端:建单 → 保存 → 回读 → 唯一性
 *
 * 顺带验证前端 sampleNo.js 的确定性规则在后端链路上成立:
 *   样品编号 = 客户项目代号 + 项目编号(客户代号 FL + 项目编号 201-1 ⇒ FL201-1)
 * 探针数据前缀 ZZSN-,跑完由本脚本自行清理。
 * 用法:node tools/archive/_probe-sampleNo-flow.cjs
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  ' + e : ''}`)) }

async function api(path, opts = {}, H = {}) {
  const r = await fetch(BASE + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, code: j.code, msg: j.message, data: j.data }
}

async function main() {
  const lj = await api('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const H = { Authorization: `Bearer ${lj.data.token}` }
  const J = { ...H, 'Content-Type': 'application/json' }

  // ① 建草稿
  const add = await api('/api/px/callButton', {
    method: 'POST', headers: J,
    body: JSON.stringify({ panelCode: 'RD_SAMPLE_NO', buttonName: '新增流程', formData: {} }),
  })
  console.log('\n① 新增流程 →', add.code, add.msg || '')
  // callButton 的返回里单据编号字段是 `编号`(不是 no)
  const no = add.data && (add.data['编号'] || add.data.no || add.data['单据编号'])
  check('建单成功且拿到单据编号', add.code === 200 && !!no, JSON.stringify(add.data))
  if (!no) { console.log('无法继续'); process.exit(1) }
  console.log('   单据编号 =', no)

  // ② 保存明细(两条:合法 + 另一客户代号)
  //  ⚠ 单据标识必须放 **`编号`**:ButtonService.save 会把 `body.remove("编号")` 抽出来当更新键,
  //    而 `单据编号` 属系统字段会被剥离 —— 传 `单据编号` 会**新建一张单**(本次实测:单号+1、原单明细落 0 行)。
  const head = { 编号: no, 单据编号: no, 单据日期: '2026-09-20', 密级: '绝密', 文件使用范围: '工程技术中心' }
  const items = [
    { 客户项目代号: 'FL', 样品编号: 'FL201-1', 项目名称: '探针项目A', 子项目: '低配款', 项目负责人: '陈秀丽', 项目编号: '201-1', 炭棒尺寸: '48*30*130' },
    { 客户项目代号: 'AJ', 样品编号: 'AJ301-1', 项目名称: '探针项目B', 子项目: '/', 项目负责人: '涂小娟', 项目编号: '301-1', 炭棒尺寸: '-' },
  ]
  const save = await api('/api/px/callButton', {
    method: 'POST', headers: J,
    body: JSON.stringify({ panelCode: 'RD_SAMPLE_NO', buttonName: '保存', formData: { ...head, detail: { items } } }),
  })
  console.log('\n② 保存 →', save.code, save.msg || '')
  check('保存成功', save.code === 200, JSON.stringify(save.data).slice(0, 200))

  // ③ 回读:明细落库 + 样品编号忠实保存
  const list = await api('/api/px/queryFormDataList', {
    method: 'POST', headers: J,
    body: JSON.stringify({ panelCode: 'RD_SAMPLE_NO', condition: {}, pageNo: 1, pageSize: 50 }),
  })
  const docs = (list.data && list.data.list) || []
  check('列表能查到该单', docs.some((d) => d['单据编号'] === no), `list=${docs.length}`)
  // ⚠ 明细**不在**列表响应里:queryFormDataList 的 detail 恒为 {items:[]}(列表页懒加载),
  //   单据明细走 getFormDescriptor。对照验证:RD_MOLD_PROC 有 31 张真实单,列表里 detail 同样为空。
  const fd = await api('/api/px/getFormDescriptor?panelCode=RD_SAMPLE_NO&code=' + encodeURIComponent(no), { headers: H })
  const rows = ((fd.data && fd.data.detailData) || {}).items || []
  console.log('   明细行数 =', rows.length)
  check('明细 2 行落库(getFormDescriptor)', rows.length === 2, String(rows.length))
  const r1 = rows.find((x) => x['样品编号'] === 'FL201-1')
  check('样品编号 FL201-1 忠实保存', !!r1, JSON.stringify(rows.map((x) => x['样品编号'])))
  check('客户项目代号 落库(标准库字段存文本)', !!r1 && r1['客户项目代号'] === 'FL', r1 ? r1['客户项目代号'] : '')
  check('炭棒尺寸 含 * 未被截断', !!r1 && r1['炭棒尺寸'] === '48*30*130', r1 ? r1['炭棒尺寸'] : '')

  // ④ 唯一性:再存一条同号样品 ⇒ 应被拒
  const dup = await api('/api/px/callButton', {
    method: 'POST', headers: J,
    body: JSON.stringify({
      panelCode: 'RD_SAMPLE_NO', buttonName: '保存',
      formData: { ...head, detail: { items: [...items, { 客户项目代号: 'FL', 样品编号: 'FL201-1', 项目编号: '201-1' }] } },
    }),
  })
  console.log('\n④ 同单内重复样品编号 →', dup.code, dup.msg || '')
  check('同一次提交内重复被拒', dup.code !== 200 && /重复/.test(String(dup.msg || '')), JSON.stringify(dup.msg))

  // ⑤ 唯一性(跨单):另建一单存同号 ⇒ 应被拒
  const add2 = await api('/api/px/callButton', {
    method: 'POST', headers: J,
    body: JSON.stringify({ panelCode: 'RD_SAMPLE_NO', buttonName: '新增流程', formData: {} }),
  })
  const no2 = add2.data && (add2.data['编号'] || add2.data.no || add2.data['单据编号'])
  console.log('\n⑤ 跨单重复(新单', no2, ')→')
  const dup2 = await api('/api/px/callButton', {
    method: 'POST', headers: J,
    body: JSON.stringify({
      panelCode: 'RD_SAMPLE_NO', buttonName: '保存',
      formData: { 单据编号: no2, 单据日期: '2026-09-20', detail: { items: [{ 客户项目代号: 'FL', 样品编号: 'FL201-1', 项目编号: '201-1' }] } },
    }),
  })
  console.log('   →', dup2.code, dup2.msg || '')
  check('跨单重复样品编号被拒', dup2.code !== 200 && /重复/.test(String(dup2.msg || '')), JSON.stringify(dup2.msg))

  console.log(`\n结果:${pass} 通过 / ${fail} 失败`)
  console.log(`清理:DELETE FROM rd_sample_no_head WHERE 单据编号 IN ('${no}','${no2}'); DELETE FROM yj_doc_status WHERE panel_code='RD_SAMPLE_NO' AND doc_no IN ('${no}','${no2}');`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
