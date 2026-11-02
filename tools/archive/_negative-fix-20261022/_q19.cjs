/** 探针:tedious addParameter 的几种绑定方式对比 */
const tds = require('D:/YINJIA-main/deploy/node_modules/tedious')
const conn = new tds.Connection({
  server: '127.0.0.1',
  authentication: { type: 'default', options: { userName: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026' } },
  options: { port: 1433, database: 'HSDZ_MES', encrypt: false, trustServerCertificate: true,
    rowCollectionOnRequestCompletion: true, useColumnNames: true, tdsVersion: '7_4' },
})
const flat = (rows) => JSON.stringify((rows || []).map((cols) => { const o = {}; for (const [k, c] of Object.entries(cols)) o[k] = c && typeof c === 'object' && 'value' in c ? c.value : c; return o }))

/**
 * 用 addParameter 前置声明,再在语句里用 @m
 * 关键差异测试:execSqlBatch vs execSql、DECLARE 是否与 addParameter 冲突
 */
function attempt(label, { useDeclare, useBatch, type, val }) {
  return new Promise((res) => {
    const sql = useDeclare ? 'DECLARE @m decimal(38,10); SELECT @m AS v, -@m AS neg' : 'SELECT @m AS v, -@m AS neg'
    const req = new tds.Request(sql, (err, rc, rows) => {
      if (err) return res(`${label}: ERR ${err.message}`)
      res(`${label}: ${flat(rows)}`)
    })
    req.addParameter('m', type, val)
    if (useBatch) conn.execSqlBatch(req); else conn.execSql(req)
  })
}

conn.on('error', (e) => { console.error('conn', e.message); process.exit(1) })
conn.connect(async (e) => {
  if (e) { console.error('connect', e.message); process.exit(1) }
  console.log(await attempt('① 有DECLARE + execSqlBatch + Decimal', { useDeclare: true, useBatch: true, type: tds.TYPES.Decimal, val: '0.0001' }))
  console.log(await attempt('② 无DECLARE + execSqlBatch + Decimal', { useDeclare: false, useBatch: true, type: tds.TYPES.Decimal, val: '0.0001' }))
  console.log(await attempt('③ 无DECLARE + execSql      + Decimal', { useDeclare: false, useBatch: false, type: tds.TYPES.Decimal, val: '0.0001' }))
  console.log(await attempt('④ 有DECLARE + execSql      + Decimal', { useDeclare: true, useBatch: false, type: tds.TYPES.Decimal, val: '0.0001' }))
  console.log(await attempt('⑤ 无DECLARE + execSql      + Float  ', { useDeclare: false, useBatch: false, type: tds.TYPES.Float, val: 0.0001 }))
  conn.close()
})
