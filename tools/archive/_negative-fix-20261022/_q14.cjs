/** 探针:tedious Request 回调的 rows 结构(适配 rowCollectionOnRequestCompletion) */
const path = require('node:path')
const tds = require(path.join('D:/YINJIA-main/deploy/node_modules/tedious'))
const conn = new tds.Connection({
  server: '127.0.0.1',
  authentication: { type: 'default', options: { userName: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026' } },
  options: { port: 1433, database: 'HSDZ_MES', encrypt: false, trustServerCertificate: true,
    rowCollectionOnRequestCompletion: true, useColumnNames: true, tdsVersion: '7_4' },
})
conn.on('error', (e) => { console.error('conn error', e.message); process.exit(1) })
conn.connect((err) => {
  if (err) { console.error('connect', err.message); process.exit(1) }
  const req = new tds.Request('SELECT TOP 2 [wzdm], CAST(yl AS decimal(18,4)) AS yl FROM kucun', (e, rowCount, rows) => {
    if (e) { console.error('req', e.message); process.exit(1) }
    console.log('rowCount=', rowCount)
    console.log('Array.isArray(rows)=', Array.isArray(rows), 'typeof=', typeof rows, 'len=', rows && rows.length)
    console.log('rows[0] keys=', rows && rows[0] && Object.keys(rows[0]))
    const r0 = rows && rows[0]
    console.log('r0.wzdm=', r0 && r0.wzdm, ' r0.yl=', r0 && r0.yl)
    console.log('sample=', JSON.stringify(r0))
    conn.close()
  })
  conn.execSqlBatch(req)
})
