/**
 * _probe-restart-smoke.cjs — 重启后整体冒烟:前端入口 + 2 个新面板元数据
 * 用法:node tools/archive/_probe-restart-smoke.cjs
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  ' + e : ''}`)) }

async function main() {
  const r = await fetch(BASE + '/')
  const html = await r.text()
  console.log(`GET / → HTTP ${r.status}, ${html.length} chars`)
  check('前端入口可访问', r.status === 200 && html.length > 0)
  check('返回 SPA 外壳(含 app 挂载点)', html.includes('id="app"'))

  const lj = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const H = { Authorization: `Bearer ${lj.data.token}` }

  console.log('\n-- RD_PROD_DOCLIST --')
  const a = await (await fetch(BASE + '/api/px/getPanelConfig?panelCode=RD_PROD_DOCLIST', { headers: H })).json()
  const am = (a.data && a.data.metadata) || {}
  console.log('   panelName =', am.panelName, '| singleDoc =', am.singleDoc, '| docArchive =', am.docArchive)
  check('面板可读且名称为 产品文件列表', am.panelName === '产品文件列表', String(am.panelName))
  check('登记为单单据面板(singleDoc=true,矩阵只有一张单)', am.singleDoc === true, String(am.singleDoc))
  check('docArchive=false(只读派生视图,刻意不入归档闭环)', !am.docArchive, String(am.docArchive))
  // 承载单据必须存在:单单据面板只隐藏"新增"入口,单据本身不存在的话 queryDocs 返回空列表、矩阵不渲染
  const lst = await (await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ panelCode: 'RD_PROD_DOCLIST', condition: {}, pageNo: 1, pageSize: 20 }),
  })).json()
  const docs = (lst.data && lst.data.list) || []
  console.log('   承载单据数 =', docs.length, docs.map((d) => d['单据编号']).join(','))
  check('承载单据存在(矩阵有宿主可挂载)', docs.length >= 1, `docs=${docs.length}`)
  check('单据编号 = PDL-0001', docs.some((d) => d['单据编号'] === 'PDL-0001'))

  console.log('\n-- RD_SAMPLE_NO --')
  const b = await (await fetch(BASE + '/api/px/getPanelConfig?panelCode=RD_SAMPLE_NO', { headers: H })).json()
  const bm = (b.data && b.data.metadata) || {}
  console.log('   panelName =', bm.panelName, '| docArchive =', bm.docArchive)
  check('面板可读且名称为 样品编号表', bm.panelName === '样品编号表', String(bm.panelName))
  // ⚠ 修改组按钮(申请修改/修改记录)由**前端模板**按 metadata.docArchive 渲染,不在 buttonGroups 里 ——
  //   故这里断言 docArchive 这个开关本身,不要去 buttonGroups 里找按钮名(会假失败)。
  check('docArchive=true(发号台账入归档闭环 ⇒ 前端出修改组)', bm.docArchive === true, String(bm.docArchive))

  console.log(`\n结果:${pass} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
