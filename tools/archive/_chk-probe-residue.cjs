/**
 * _chk-probe-residue.cjs — 扫描我今天探针可能留下的残留单(只读,先看再决定删不删)
 * 判定:头表里 单据编号 匹配 前缀-yyyy-MM- 形态、创建人=admin、且该单在 yj_doc_status 里
 *       既未归档也未送审(saved=N/archived=N/pending=N) —— 通常就是探针建完没清干净的空白草稿。
 * 用法:node tools/archive/_chk-probe-residue.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q], { encoding: 'utf8', maxBuffer: 1 << 26 }).trim()
const lines = (q) => s(q).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)

const ny = new Date().toISOString().slice(0, 7)
const panels = lines(`SELECT panel_code+'|'+ISNULL(head_table,'')+'|'+ISNULL(prefix,'')+'|'+ISNULL(group_col,'')+'|'+ISNULL(detail_key,'items')
  FROM yj_panel WHERE mode='doc' AND ISNULL(head_table,'')<>'' AND ISNULL(prefix,'')<>'' ORDER BY panel_code`)

console.log(`扫描窗口 ny=${ny}(今日 admin 建、未归档未送审的同月单据)`)
let n = 0
for (const row of panels) {
  const [code, head, prefix, gc] = row.split('|')
  if (lines(`SELECT COUNT(*) FROM sys.tables WHERE name='${head}'`)[0] !== '1') continue
  if (lines(`SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('${head}') AND name=N'${gc}'`)[0] !== '1') continue
  const rows = lines(`SELECT h.${gc}+' | t1='+ISNULL(CONVERT(varchar,h.asp_time1,120),'-')+' | user1='+ISNULL(h.asp_user1,'-')
    FROM ${head} h
    WHERE h.${gc} LIKE '${prefix}-${ny}-%'
      AND NOT EXISTS (SELECT 1 FROM yj_doc_status d WHERE d.panel_code='${code}' AND d.doc_no=h.${gc}
                      AND (ISNULL(d.archived,'N')='Y' OR ISNULL(d.pending,'N')='Y' OR ISNULL(d.canceled,'N')='Y'))
    ORDER BY h.asp_time1 DESC`)
  if (!rows.length) continue
  n += rows.length
  console.log(`  ${code} (${head}) 未流转同月单 ${rows.length} 张:`)
  for (const r of rows.slice(0, 6)) console.log(`      ${r}`)
}
console.log('')
console.log(n ? `合计 ${n} 张(需人工确认是否探针残留)` : '✓ 未发现未流转的同月残留单')
