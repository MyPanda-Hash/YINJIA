/**
 * _q-save-bom.mjs —— 验证产品信息表「产品BOM表」新增行能真正落库(新建探针单→保存→查库→作废)
 * 用法: node _q-save-bom.mjs [base]
 *
 * 为什么必须验:recordSheetConfigs 里那张表是新加的,列名(物料编号/物料名称/尺寸规格/数量)
 *   与既有两张表(物料编码/规格参数)不同 —— 后端 labelsToCols 按 label 反查列,
 *   label 对不上就**静默丢值**(本仓反复踩过的坑),界面上看不出来。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const CODE = 'ZZ-PROBE-BOM-01'

const form = {
  产品编号: CODE,
  产品名称: '探针BOM验证',
  项目编号: 'ZZ-PROBE-PRJ',
  项目名称: '探针项目',
  客户名称: '探针客户',
  应用场景: '探针场景',
  detail: { items: [
    { 序号: '1', 物料编号: 'M-PROBE-1', 物料名称: '探针物料一', 尺寸规格: '33*12*110±0.5', 数量: '2' },
    { 序号: '2', 物料编号: 'M-PROBE-2', 物料名称: '探针物料二', 尺寸规格: '含尺寸公差', 数量: '1' },
  ] },
}

const res = await (await fetch(BASE + '/api/px/callButton', {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'RD_PROD_INFO', buttonName: '保存', formData: form, buttonParam: {} }),
})).json()
const no = String(res?.data?.['编号'] || res?.data?.['单据编号'] || '')
console.log('保存结果 =', JSON.stringify(res).slice(0, 300))

function q(sql) {
  const out = execFileSync('java', [
    '-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
    'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
    'yinjia', 'Yinjia@2026', sql,
  ], { cwd: 'C:/INCER/YINJIA-MES/tools', encoding: 'utf8' })
  return out.trim()
}

if (no) {
  console.log('--- 头字段 ---')
  console.log(q(`SELECT 单据编号,项目编号,项目名称,客户名称,应用场景 FROM rd_prod_info_head WHERE 单据编号='${no}'`))
  console.log('--- 明细行 ---')
  console.log(q(`SELECT 序号,物料编号,物料名称,尺寸规格,数量 FROM rd_prod_info_detail WHERE 单据编号='${no}' ORDER BY 序号`))
  // 作废探针单
  console.log('--- 清理 ---')
  console.log(q(`UPDATE rd_prod_info_head SET asp_cancel='Y' WHERE 单据编号='${no}'; UPDATE rd_prod_info_detail SET asp_cancel='Y' WHERE 单据编号='${no}'; SELECT 单据编号,ISNULL(asp_cancel,'N') AS 作废 FROM rd_prod_info_head WHERE 单据编号='${no}'`))
} else {
  console.log('!! 没拿到单号,检查返回体')
}