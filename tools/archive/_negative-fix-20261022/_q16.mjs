/** 复查:为什么脚本查到 0 行负结存(参数/查询问题) */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('裸查询')
for (const r of await q(`SELECT COUNT(*) AS n FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -0.0001`))
  console.log('   n=' + r.n)

line('带 @m 参数(模拟脚本)')
console.log('   见 app 端;这里用 DECLARE 模拟')
for (const r of await q(`DECLARE @m decimal(38,10) = 0.0001;
                         SELECT COUNT(*) AS n FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -@m`))
  console.log('   n=' + r.n)

line('脚本实际用的原句(带 ORDER BY RTRIM 列)')
try {
  const r = await q(`SELECT id, RTRIM(wzdm) AS w, CAST(ISNULL(yl,0) AS decimal(18,4)) AS yl
                       FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -0.0001
                      ORDER BY wzdm, ckdm, lot_no`)
  console.log('   行数=' + r.length)
} catch (e) { console.log('   报错: ' + e.message) }

line('tedious 参数绑定探针:同一句经 tedious 跑')
const path = await import('node:path')
const tds = (await import('../../../deploy/node_modules/tedious/index.js')).default
await pool.close()

const conn = new tds.Connection({
  server: '127.0.0.1',
  authentication: { type: 'default', options: { userName: 'yinjia', password: 'Yinjia@2026' } },
  options: { port: 1433, database: db, encrypt: false, trustServerCertificate: true,
    rowCollectionOnRequestCompletion: true, useColumnNames: true, tdsVersion: '7_4' },
})
const run = (sql, params = {}) => new Promise((res, rej) => {
  let declare = ''
  for (const k of Object.keys(params)) declare += typeof params[k] === 'number' ? `DECLARE @${k} decimal(38,10); ` : `DECLARE @${k} nvarchar(500); `
  const req = new tds.Request(declare + sql, (err, rc, rows) => err ? rej(err) : res({ rc, rows }))
  for (const [k, v] of Object.entries(params)) req.addParameter(k, typeof v === 'number' ? tds.TYPES.Decimal : tds.TYPES.NVarChar, typeof v === 'number' ? String(v) : v)
  conn.execSqlBatch(req)
})
conn.on('error', (e) => { console.error('conn', e.message); process.exit(1) })
conn.connect(async (e) => {
  if (e) { console.error('connect', e.message); process.exit(1) }
  try {
    const a = await run(`SELECT COUNT(*) AS n FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -@m`, { m: 0.0001 })
    console.log('   [无 ORDER BY] rows=', JSON.stringify(a.rows))
    const b = await run(`SELECT COUNT(*) AS n FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -@m`, { m: 0.0001 })
    console.log('   [第二次]   rows=', JSON.stringify(b.rows))
    // 关键:脚本里同一连接会连跑多条 execSqlBatch;试一条 SELECT 之后紧跟 UPDATE 风格的多语句
    const c = await run(`SELECT COUNT(*) AS n FROM kucun WHERE ISNULL(yl,0) < -@m`, { m: 0.0001 })
    console.log('   [简化条件] rows=', JSON.stringify(c.rows))
  } catch (err) { console.log('   tedious 报错: ' + err.message) }
  conn.close()
})
