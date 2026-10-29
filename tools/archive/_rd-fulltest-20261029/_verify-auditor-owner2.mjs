/**
 * _verify-auditor-owner2.mjs —— 三项验收(修正测试顺序:可修改要在**草稿态**测)
 * 用法: node _verify-auditor-owner2.mjs [base]
 *
 * 上一版 ② 失败是我的测试顺序错:单据保存后已自动送审(pending=Y),
 * 归档/审批中不允许再改 —— 这是业务规则不是缺陷。"可修改"必须在**送审前**验。
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const { execFileSync } = await import('node:child_process')
const PROD = 'YJ-VERIFY-1030'
let fails = 0
const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) fails++; return !!c }
const q = (sql) => execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
  'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
  'yinjia', 'Yinjia@2026', sql], { cwd: 'C:/INCER/YINJIA-MES/tools', encoding: 'utf8' }).trim()

const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const tk = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }
const call = async (panel, btn, data) => await (await fetch(BASE + '/api/px/callButton', {
  method: 'POST', headers: H, body: JSON.stringify({ panelCode: panel, buttonName: btn, formData: data, buttonParam: {} }),
})).json()

q(`UPDATE rd_prod_info_head SET asp_cancel='Y' WHERE 产品编号='${PROD}'; DELETE FROM mate WHERE m_no='${PROD}';`)

// ── ①「保存为草稿」:验证默认值写入 + 可人工修改 ──
const mk = await call('RD_PROD_INFO', '新增', {})
const no = String(mk?.data?.['编号'] || '')
console.log('\n新建 =', no)
// 保存为草稿不流转状态,便于反复改
const d1 = await call('RD_PROD_INFO', '保存为草稿', {
  编号: no, 产品编号: PROD, 产品名称: '审核人验证件2', 单据日期: '2026-10-29',
})
console.log('保存为草稿 =', d1.code, d1.message)
const h1 = q(`SELECT 审核人一级, 审核人二级 FROM rd_prod_info_head WHERE 单据编号='${no}'`)
console.log('默认值 =', h1)
ok(/冯敏/.test(h1) && /陈秀丽/.test(h1), '① 两级审核人默认值自动写入(冯敏 / 陈秀丽)')

// 人工改
const d2 = await call('RD_PROD_INFO', '保存为草稿', {
  编号: no, 产品编号: PROD, 产品名称: '审核人验证件2', 单据日期: '2026-10-29',
  审核人一级: '刘磊', 审核人二级: '柴善银',
})
const h2 = q(`SELECT 审核人一级, 审核人二级 FROM rd_prod_info_head WHERE 单据编号='${no}'`)
console.log('人工改 =', d2.code, '|', h2)
ok(/刘磊/.test(h2) && /柴善银/.test(h2), '② 审核人可人工修改并落库')

// 再保存一次(不改)⇒ 不能被默认值抢回去
const d3 = await call('RD_PROD_INFO', '保存为草稿', {
  编号: no, 产品编号: PROD, 产品名称: '审核人验证件2', 单据日期: '2026-10-29',
  审核人一级: '刘磊', 审核人二级: '柴善银',
})
const h3 = q(`SELECT 审核人一级, 审核人二级 FROM rd_prod_info_head WHERE 单据编号='${no}'`)
ok(/刘磊/.test(h3) && /柴善银/.test(h3), '② 再次保存不会把人工改的值抢回默认值')

console.log(`\n════ 结论: 失败 ${fails} 项 ════`)
