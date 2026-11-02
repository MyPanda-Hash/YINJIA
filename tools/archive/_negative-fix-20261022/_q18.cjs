/** 探针:用 balance-negative-stock.js 里的 makeSession 逻辑复现绑定问题 */
const tds = require('D:/YINJIA-main/deploy/node_modules/tedious')
const isNum = (v) => typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v))
const conn = new tds.Connection({
  server: '127.0.0.1',
  authentication: { type: 'default', options: { userName: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026' } },
  options: { port: 1433, database: 'HSDZ_MES', encrypt: false, trustServerCertificate: true,
    rowCollectionOnRequestCompletion: true, useColumnNames: true, tdsVersion: '7_4' },
})
const run = (sql, params = {}) => new Promise((res, rej) => {
  let declare = ''
  for (const n of Object.keys(params)) declare += isNum(params[n]) ? `DECLARE @${n} decimal(38,10); ` : `DECLARE @${n} nvarchar(500); `
  const req = new tds.Request(declare + sql, (err, rc, rows) => err ? rej(err) : res({ rc, rows }))
  for (const [k, v] of Object.entries(params)) req.addParameter(k, isNum(v) ? tds.TYPES.Decimal : tds.TYPES.NVarChar, String(v))
  conn.execSqlBatch(req)
})
conn.on('error', (e) => { console.error('conn', e.message); process.exit(1) })
conn.connect(async (e) => {
  if (e) { console.error('connect', e.message); process.exit(1) }
  const dump = (rows) => JSON.stringify((rows || []).map((cols) => { const o = {}; for (const [k, c] of Object.entries(cols)) o[k] = c && typeof c === 'object' && 'value' in c ? c.value : c; return o }))
  // 与脚本第 226 行完全一致的查询
  const sql = `
      SELECT id, RTRIM(wzdm) AS w, ISNULL(RTRIM(ckdm),'') AS c, ISNULL(RTRIM(lot_no),'') AS l,
             CAST(ISNULL(yl,0) AS decimal(18,4)) AS yl, ISNULL(预警数量,0) AS warnq, ISNULL(asp_user1,'') AS u1
        FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -@m
       ORDER BY wzdm, ckdm, lot_no`
  const a = await run(sql, { m: 0.0001 })
  console.log('脚本原句 rows=', (a.rows || []).length, ' rowCount=', a.rc)
  const b = await run(`SELECT -@m AS neg`, { m: 0.0001 })
  console.log('参数负值 =', dump(b.rows))
  conn.close()
})
