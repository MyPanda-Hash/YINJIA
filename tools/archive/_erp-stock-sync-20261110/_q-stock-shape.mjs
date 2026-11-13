/**
 * _q-stock-shape.mjs — 只读取证:库存口径现状(kucun 列/行数/负行、v_stock_* 视图、STOCK_STATUS 面板数据源)
 * 由来:2026-11-10 用户口径「同步脚本要实时同步金蝶真实账套的库存数量,以金蝶的库存数量为准」。
 *   动手前的取证:覆盖 kucun.yl 会牵动哪些对象、面板读的是表还是视图、启动自检拿什么比。
 *
 * 用法:node tools/archive/_erp-stock-sync-20261110/_q-stock-shape.mjs [HSDZ_MES|HSDZ_MES_TEST]
 * 只读,不写任何数据。
 */
import { readFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.argv[2] || 'HSDZ_MES'
const base = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).database
const pool = await mssql.connect({
  server: base.server, port: base.port, database: db, user: base.user, password: base.password,
  options: { encrypt: false, trustServerCertificate: true }, pool: { max: 4, min: 0, idleTimeoutMillis: 5000 },
})
const q = async (sql) => (await pool.request().query(sql)).recordset
const show = (t, rows) => {
  console.log(`\n===== ${t} =====`)
  if (!rows.length) { console.log('(空)'); return }
  for (const r of rows) console.log(Object.entries(r).map(([k, v]) => `${k}=${v}`).join(' | '))
}

console.log(`### 库 ${db}`)

// ① kucun 列
show('kucun 列', await q(`SELECT c.name AS 列名, t.name AS 类型, c.max_length AS 长度, c.is_nullable AS 可空,
  CAST(ep.value AS nvarchar(200)) AS 中文名
  FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
  WHERE c.object_id = OBJECT_ID('dbo.kucun') ORDER BY c.column_id`))

// ② 行数/负行/合计
show('kucun 概况', await q(`SELECT COUNT(*) AS 行数,
  SUM(CASE WHEN ISNULL(yl,0) < 0 THEN 1 ELSE 0 END) AS 负行,
  CAST(ISNULL(SUM(yl),0) AS decimal(18,2)) AS 余量合计,
  SUM(CASE WHEN ISNULL(lot_no,'') = '' THEN 1 ELSE 0 END) AS 空批号行,
  SUM(CASE WHEN lot_no = 'PC0000' THEN 1 ELSE 0 END) AS PC0000行
  FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y'`))

// ③ 视图清单
show('v_stock_* 视图', await q(`SELECT name AS 视图名, (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = v.object_id) AS 列数
  FROM sys.views v WHERE name LIKE 'v_stock%' ORDER BY name`))

// ④ STOCK_STATUS / STOCK_DETAIL 面板的数据源(表名/视图名)
show('库存类面板', await q(`SELECT * FROM dbo.yj_panel WHERE name IN (N'STOCK_STATUS', N'STOCK_DETAIL', N'STOCK_BALANCE', N'STOCK_PICK', N'STOCK_SUMMARY')`))

// ⑤ v_stock_balance 定义(前 800 字)
const vb = await q(`SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.v_stock_balance')) AS d`)
if (vb.length) console.log('\n===== v_stock_balance 定义 =====\n' + String(vb[0].d).slice(0, 1200))

// ⑥ 是否已有 ERP 库存快照类对象(避免重复造)
show('既有 erp 表', await q(`SELECT name AS 表名 FROM sys.tables WHERE name LIKE 'erp%' ORDER BY name`))

await pool.close()
