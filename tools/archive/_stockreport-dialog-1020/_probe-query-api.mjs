/**
 * _probe-query-api.mjs — 库存台账/收发存汇总的「查询」后端口径回归(不经浏览器)
 *
 * 面板弹窗把条件落成 condition = { 仓库编码(_whCode), 存货编码(_itemCode), 开始日期, 结束日期 }。
 * 本脚本逐条核对:①无条件可查;②按编码过滤真的收窄(不再 LIKE 串仓);③日期段生效;
 * ④台账期初/期末合成行随仓库+存货+日期段出现。
 *
 * 用法: node tools/archive/_stockreport-dialog-1020/_probe-query-api.mjs [host]
 */
const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const lines = []
const say = (s) => { console.log(s); lines.push(s) }

const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg?.data?.token
if (!token) { console.error('[FATAL] 登录失败'); process.exit(1) }

const query = async (body) => {
  const r = await (await fetch(host + '/api/px/queryFormDataList', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })).json()
  if (!r?.data) throw new Error(JSON.stringify(r).slice(0, 300))
  return r.data
}

for (const code of ['STOCK_LEDGER', 'STOCK_SUMMARY']) {
  say(`\n=== ${code} ===`)
  const all = await query({ panelCode: code, pageNo: 1, pageSize: 50 })
  say(`① 无条件: totalSize=${all.totalSize} 返回=${all.list.length}`)
  const sample = all.list.find((r) => r['仓库编码'] && r['存货编码'])
  if (!sample) { say('   ⚠ 无可用样本行'); continue }
  const wh = sample['仓库编码'], item = sample['存货编码'], whName = sample['仓库'], itemName = sample['存货']
  say(`   样本: 仓库=${whName}(${wh}) 存货=${itemName}(${item})`)

  const byCode = await query({ panelCode: code, pageNo: 1, pageSize: 50,
    condition: { _whCode: wh, _itemCode: item, 仓库: whName, 存货: itemName } })
  const wrongWh = byCode.list.filter((r) => r['仓库编码'] !== wh).length
  const wrongItem = byCode.list.filter((r) => r['存货编码'] !== item).length
  say(`② 按编码: totalSize=${byCode.totalSize} 返回=${byCode.list.length} 越界行(他仓/他存货)=${wrongWh}/${wrongItem}`)

  const byName = await query({ panelCode: code, pageNo: 1, pageSize: 50,
    condition: { 仓库: whName, 存货: itemName } })
  say(`③ 仅名称(旧口径对照): totalSize=${byName.totalSize}(参照字段应等值,不该串仓)`)

  const range = await query({ panelCode: code, pageNo: 1, pageSize: 50,
    condition: { _whCode: wh, _itemCode: item, 仓库: whName, 存货: itemName,
      开始日期: '2000-01-01', 结束日期: '2030-12-31' } })
  const types = range.list.map((r) => r['单据类型'] || r['期次'] || '').filter(Boolean)
  say(`④ 加日期段: totalSize=${range.totalSize} 返回=${range.list.length} 首行类型=${types[0]} 末行类型=${types[types.length - 1]}`)

  const future = await query({ panelCode: code, pageNo: 1, pageSize: 50,
    condition: { _whCode: wh, _itemCode: item, 开始日期: '2099-01-01', 结束日期: '2099-12-31' } })
  say(`⑤ 2099 空区间(台账应只留期初/期末两合成行): totalSize=${future.totalSize} 类型=${JSON.stringify(future.list.map((r) => r['单据类型']))}`)
}
