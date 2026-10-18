/**
 * _probe-ledger-filter.mjs — 台账「查询只出期初/期末两行」的根因定位(纯后端口径,不经界面)
 *
 * 根因(见 QueryService#queryFlat + #appendDirectFilters):
 *   台账按面板码把 condition['仓库']/['存货'] 当作**编码**写死
 *     `AND RTRIM(t.[仓库编码]) = 仓库值 AND RTRIM(t.[存货编码]) = 存货值`
 *   —— 而弹窗草稿里 仓库/存货 放的是**名称**(弹窗回显 + 参照下拉 label),
 *   编码在控制键 `_whCode`/`_itemCode` 里,而 `_whCode` 那段又被上游
 *   `byWhCode = _whCode 有值 && l2c 有"仓库编码"` 短路(台账的「仓库编码」place=detail,没进查询字段表
 *   ⇒ l2c 里没有这个标签)⇒ **编码过滤永远不生效**,只剩名称被当编码比 ⇒ 明细 0 行。
 *
 * 本脚本把四种送法并列,用来钉死口径差(界面层用的是②/①,即用户的"查询查不出东西")。
 *
 * 用法: node tools/archive/_stockreport-dialog-1020/_probe-ledger-filter.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const host = 'http://127.0.0.1:8090'
const SYNTH = new Set(['期初结存', '期末结存'])
const det = (rows) => rows.filter((r) => !SYNTH.has(String(r['单据类型'] || '')))

const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const H = { Authorization: `Bearer ${lg.data.token}`, 'Content-Type': 'application/json; charset=utf-8' }
const query = async (body) => (await (await fetch(host + '/api/px/queryFormDataList', {
  method: 'POST', headers: H, body: JSON.stringify(body),
})).json()).data

const whCode = 'CP-02', whName = '成品B仓', itemCode = 'A-48-19', itemName = 'PP复合阻垢炭棒/滤芯'
const range = { 开始日期: '1900-01-01', 结束日期: '2099-12-31' }

const cases = [
  ['① 名称 + 控制键 _whCode/_itemCode(弹窗按编码联动的原意)', { 仓库: whName, 存货: itemName, _whCode: whCode, _itemCode: itemCode, ...range }],
  ['② 只送名称(参照下拉没带出编码时 = 用户实际遇到的)', { 仓库: whName, 存货: itemName, ...range }],
  ['③ 只送编码(容器里不夹名称)', { 仓库: whCode, 存货: itemCode, ...range }],
  ['④ 名称位直接放编码(唯一能出明细的送法)', { 仓库: whCode, 存货: itemCode, ...range }],
]
const out = []
for (const [name, condition] of cases) {
  const r = await query({ panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 50, condition })
  const line = `${name}: totalSize=${r.totalSize} 明细=${det(r.list).length} 合成=${r.list.length - det(r.list).length}`
  console.log(line); out.push(line)
}
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'probe-ledger-filter.out'), out.join('\n') + '\n')
