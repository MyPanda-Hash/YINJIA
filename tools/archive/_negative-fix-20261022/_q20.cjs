/** 确认 Decimal 为何变 0:试各种传值形态 */
const tds = require('D:/YINJIA-main/deploy/node_modules/tedious')
const conn = new tds.Connection({
  server: '127.0.0.1',
  authentication: { type: 'default', options: { userName: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026' } },
  options: { port: 1433, database: 'HSDZ_MES', encrypt: false, trustServerCertificate: true,
    rowCollectionOnRequestCompletion: true, useColumnNames: true, tdsVersion: '7_4' },
})
const flat = (rows) => JSON.stringify((rows || []).map((cols) => { const o = {}; for (const [k, c] of Object.entries(cols)) o[k] = c && typeof c === 'object' && 'value' in c ? c.value : c; return o }))
const tryIt = (label, type, val) => new Promise((res) => {
  const req = new tds.Request('SELECT @m AS v, -@m AS neg', (err, rc, rows) => res(`${label}: ${err ? 'ERR ' + err.message : flat(rows)}`))
  req.addParameter('m', type, val)
  conn.execSql(req)
})
conn.on('error', (e) => { console.error('conn', e.message); process.exit(1) })
conn.connect(async (e) => {
  if (e) { console.error('connect', e.message); process.exit(1) }
  console.log(await tryIt('Decimal string "0.0001" ', tds.TYPES.Decimal, '0.0001'))
  console.log(await tryIt('Decimal number 0.0001   ', tds.TYPES.Decimal, 0.0001))
  console.log(await tryIt('Decimal 1               ', tds.TYPES.Decimal, '1'))
  console.log(await tryIt('Decimal 782587.2        ', tds.TYPES.Decimal, '782587.2'))
  console.log(await tryIt('Money   "0.0001"        ', tds.TYPES.Money, '0.0001'))
  console.log(await tryIt('Float   number 0.0001   ', tds.TYPES.Float, 0.0001))
  console.log(await tryIt('Float   string "0.0001" ', tds.TYPES.Float, '0.0001'))
  console.log(await tryIt('Numeric "782587.2"      ', tds.TYPES.Numeric, '782587.2'))
  console.log(await tryIt('Int     5               ', tds.TYPES.Int, 5))
  console.log(await tryIt('BigInt  "5"             ', tds.TYPES.BigInt, '5'))
  conn.close()
})
