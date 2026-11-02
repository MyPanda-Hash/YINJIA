/** 复现 "Incorrect syntax near ':'" —— 找出是哪条语句 */
const fs = require('node:fs')
const src = fs.readFileSync('D:/YINJIA-main/tools/balance-negative-stock.js', 'utf8')

// 抽出 expand 函数原样跑
const start = src.indexOf('const expand = (sql, params = {}) => {')
const end = src.indexOf('return { sql: body, used, params }', start)
const fnSrc = src.slice(start, end) + 'return { sql: body, used, params } }'
const expand = eval('(function(){ const String_ = String; ' + fnSrc + '; return expand })()')

const stmts = {
  '补建档案': `IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE 存货编码 = :c)
               INSERT INTO bs_inv (存货编码, 存货名称, 规格型号, 计量单位, 状态, asp_user1, asp_time1, asp_cancel)
               VALUES (:c, :n, :s, :u, N'启用', :who, GETDATE(), 'N')`,
  '单据头': `INSERT INTO bd_other_in (单据日期, 单据编号, 备注, asp_user1, asp_cancel)
             VALUES (:d, :no, :rmk, :u, 'N')`,
  '明细': `INSERT INTO bl_other_in (单据编号, 数量, 批号) VALUES (:no, :q, :lot)`,
  'MERGE状态': `MERGE yj_doc_status AS t USING (VALUES (:p, :no)) AS s(panel_code, doc_no)
                ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no
                WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, shr) VALUES (s.panel_code, s.doc_no, :u);`,
}
const params = { c: 'YJ-GL-047', n: '纸箱', s: '单支装内盒', u: '个', who: 'balance-fix',
  d: '2026-10-13', no: 'QTRK-20261013-00093', rmk: '负库存配平', u2: 'admin', q: 312, lot: null, p: 'OTHER_IN' }
for (const [name, sql] of Object.entries(stmts)) {
  const out = expand(sql, { ...params, u: 'admin' })
  const leftover = [...out.sql.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[0])
  console.log(`--- ${name} ---`)
  console.log(out.sql.replace(/\s+/g, ' ').slice(0, 260))
  if (leftover.length) console.log('   ⚠ 未替换的占位符: ' + leftover.join(', '))
}
