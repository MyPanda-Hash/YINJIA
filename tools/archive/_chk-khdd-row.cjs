/**
 * _chk-khdd-row.cjs — 看 KHDD/OD-2026-09-0001 到底是探针空壳还是有内容(只读)
 * KHDD 用的是遗留表:头 order_bt / 明细 order_bs,分组列 od_no(不是 单据编号!)
 * 用法:node tools/archive/_chk-khdd-row.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const base = ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026']
const s = (q) => execFileSync('sqlcmd', [...base, '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
  { encoding: 'utf8', maxBuffer: 1 << 26 }).trim()
/** FOR JSON 版:不能用 -h -1(与 -y 0 互斥),自己丢两行表头 */
const jsonQ = (q) => {
  const out = execFileSync('sqlcmd', [...base, '-s', '|', '-y', '0', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
    { encoding: 'utf8', maxBuffer: 1 << 26 }).split(/\r?\n/)
  return out.slice(2).join('\n').trim()
}

const NO = 'OD-2026-09-0001'
console.log('=== 头行(order_bt,分组列 od_no)===')
console.log(jsonQ(`SELECT (SELECT * FROM order_bt WHERE od_no='${NO}' FOR JSON PATH, INCLUDE_NULL_VALUES) AS j`))

console.log('')
console.log('=== 明细行(order_bs)===')
console.log(jsonQ(`SELECT (SELECT * FROM order_bs WHERE od_no='${NO}' FOR JSON PATH, INCLUDE_NULL_VALUES) AS j`))

console.log('')
console.log('=== 该单在 yj_doc_status ===')
console.log(s(`SELECT ISNULL(doc_no,'-')+' saved='+ISNULL(saved,'-')+' pending='+ISNULL(pending,'-')+' archived='+ISNULL(archived,'-') FROM yj_doc_status WHERE panel_code='KHDD' AND doc_no='${NO}'`))
