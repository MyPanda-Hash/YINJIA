/** 探针:tedious 参数绑定的真实行为 */
const tds = require('D:/YINJIA-main/deploy/node_modules/tedious')

const conn = new tds.Connection({
  server: '127.0.0.1',
  authentication: { type: 'default', options: { userName: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026' } },
  options: { port: 1433, database: 'HSDZ_MES', encrypt: false, trustServerCertificate: true,
    rowCollectionOnRequestCompletion: true, useColumnNames: true, tdsVersion: '7_4' },
})
const run = (sql, params = {}) => new Promise((res, rej) => {
  let declare = ''
  for (const k of Object.keys(params)) declare += typeof params[k] === 'number' ? `DECLARE @${k} decimal(38,10); ` : `DECLARE @${k} nvarchar(500); `
  const req = new tds.Request(declare + sql, (err, rc, rows) => err ? rej(err) : res({ rc, rows }))
  for (const [k, v] of Object.entries(params)) {
    req.addParameter(k, typeof v === 'number' ? tds.TYPES.Decimal : tds.TYPES.NVarChar, typeof v === 'number' ? String(v) : v)
  }
  conn.execSqlBatch(req)
})
const flat = (rows) => (rows || []).map((cols) => { const o = {}; for (const [k, c] of Object.entries(cols)) o[k] = c && typeof c === 'object' && 'value' in c ? c.value : c; return o })

conn.on('error', (e) => { console.error('conn', e.message); process.exit(1) })
conn.connect(async (e) => {
  if (e) { console.error('connect', e.message); process.exit(1) }
  try {
    const a = await run(`SELECT COUNT(*) AS n FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -@m`, { m: 0.0001 })
    console.log('A 带参数+DECLARE:', JSON.stringify(flat(a.rows)))
    const b = await run(`SELECT COUNT(*) AS n FROM kucun WHERE ISNULL(yl,0) < -@m`, { m: 0.0001 })
    console.log('B 简化条件:', JSON.stringify(flat(b.rows)))
    const c = await run(`SELECT @m AS mv, -@m AS negm`, { m: 0.0001 })
    console.log('C 直接看参数值:', JSON.stringify(flat(c.rows)))
    const d = await run(`SELECT COUNT(*) AS n FROM kucun WHERE ISNULL(yl,0) < -0.0001`)
    console.log('D 字面量:', JSON.stringify(flat(d.rows)))
    // 脚本原句:多列 + ORDER BY
    const g = await run(`SELECT id, RTRIM(wzdm) AS w, CAST(ISNULL(yl,0) AS decimal(18,4)) AS yl
                           FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -@m
                          ORDER BY wzdm, ckdm, lot_no`, { m: 0.0001 })
    console.log('G 脚本原句 行数=', (g.rows || []).length)
    // 第二参数(带 @m 的自增 ID 情况)
    const h = await run(`SELECT COUNT(*) AS n, CAST(SUM(yl) AS decimal(18,4)) AS s
                           FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -@m`, { m: 0.0001 })
    console.log('H 两列聚合:', JSON.stringify(flat(h.rows)))
  } catch (err) { console.log('错误: ' + err.message) }
  conn.close()
})
