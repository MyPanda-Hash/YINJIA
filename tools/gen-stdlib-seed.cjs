/** gen-stdlib-seed.cjs — 由 spec-section-lib.generated.js 生成 yj_std_lib 种子 SQL(幂等) */
const fs = require('fs')
const path = require('path')
const lib = require(path.join(__dirname, '_walk/spec-section-lib.generated.js'))
const esc = (s) => String(s).replace(/'/g, "''")
let sql = "-- migrate-stdlib-seed.sql — 规格书章节标准库种子(《规格书示例》提取;gen-stdlib-seed.cjs 生成)\nSET NOCOUNT ON;\nGO\n"
let n = 0
for (const [item, arr] of Object.entries(lib)) {
  arr.forEach((t, i) => {
    n++
    sql += `IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code=N'spec.section' AND item_code=N'${esc(item)}' AND content=N'${esc(t)}') INSERT INTO yj_std_lib (lib_code, item_code, content, seq, asp_user1) VALUES (N'spec.section', N'${esc(item)}', N'${esc(t)}', ${(i + 1) * 10}, N'seed');\n`
  })
}
sql += "GO\nPRINT N'章节标准库种子完成: ' + CAST(" + n + " AS nvarchar(10)) + N' 条';\nGO\n"
fs.writeFileSync(path.join(__dirname, 'migrate-stdlib-seed.sql'), sql, 'utf8')
console.log('seed rows=' + n)
