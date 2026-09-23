/**
 * _chk-dupe-heads.cjs — 全库扫描"同一单据编号在头表出现多行"(编号重发的实际损坏证据,只读)
 * 用法:node tools/archive/_chk-dupe-heads.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q], { encoding: 'utf8', maxBuffer: 1 << 26 }).trim()
const lines = (q) => s(q).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)

// 候选头表:yj_panel 里登记了 head_table 的
const heads = lines(`SELECT DISTINCT head_table+'|'+group_col FROM yj_panel
  WHERE mode='doc' AND ISNULL(head_table,'')<>'' AND ISNULL(group_col,'')<>''`)
console.log(`候选头表 ${heads.length} 张,逐张扫描"同号多行"…`)
let total = 0
const hits = []
for (const row of heads) {
  const [h, gc] = row.split('|')
  const has = lines(`SELECT COUNT(*) FROM sys.tables WHERE name='${h}'`)[0]
  if (has !== '1') continue
  const hasCol = lines(`SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('${h}') AND name=N'${gc}'`)[0]
  if (hasCol !== '1') continue
  const dupes = lines(`SELECT TOP 5 ${gc}+' x'+CAST(COUNT(*) AS varchar) FROM ${h}
    WHERE ISNULL(${gc},N'')<>N'' GROUP BY ${gc} HAVING COUNT(*)>1 ORDER BY COUNT(*) DESC`)
  if (!dupes.length) continue
  const n = lines(`SELECT COUNT(*) FROM (SELECT ${gc} FROM ${h} WHERE ISNULL(${gc},N'')<>N''
    GROUP BY ${gc} HAVING COUNT(*)>1) x`)[0]
  total += Number(n)
  hits.push({ h, n, dupes })
  console.log(`  ✗ ${h}: ${n} 个编号有多行  例:${dupes.join(' , ')}`)
}
console.log('')
console.log(total ? `受影响头表 ${hits.length} 张 / 重复编号 ${total} 组` : '✓ 未发现同号多行')
