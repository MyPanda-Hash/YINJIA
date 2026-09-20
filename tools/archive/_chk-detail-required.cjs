/**
 * _chk-detail-required.cjs — 明细级必填字段盘点(后端目前只校验 header 级)
 * ⚠ 筛选必须 place LIKE '%detail%':place 是逗号复合值('query,detail'/'header,detail'),
 *   用 = 会漏字段(踩过:漏掉 123 个 query,detail 字段,盘点结果偏小)。
 * 用法:node tools/archive/_chk-detail-required.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const s = (q) => execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
  '-W', '-s', '|', '-h', '-1', '-Q', 'SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ' + q],
{ encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

console.log('=== 研发管理:明细级必填字段 ===')
console.log(s(`SELECT panel_code+' | '+col_name+' | label='+label+' | req='+CAST(required AS varchar)
  FROM yj_field WHERE place LIKE '%detail%' AND required=1
    AND panel_code IN (SELECT panel_code FROM yj_panel WHERE module_group=N'研发管理')
  ORDER BY panel_code, seq`))

console.log('')
console.log('=== 全库:有明细必填的面板数 / 字段数 ===')
console.log(s(`SELECT '面板数=' + CAST(COUNT(DISTINCT panel_code) AS varchar) + ' 字段数=' + CAST(COUNT(*) AS varchar)
  FROM yj_field WHERE place LIKE '%detail%' AND required=1`))

console.log('')
console.log('=== 研发管理面板的 detail_key + 明细行数(是否有现成行) ===')
console.log(s(`SELECT p.panel_code+' | detail_key='+ISNULL(p.detail_key,'(null)')+' | line_table='+ISNULL(p.line_table,'(null)')
  FROM yj_panel p WHERE p.module_group=N'研发管理' AND EXISTS (
    SELECT 1 FROM yj_field f WHERE f.panel_code=p.panel_code AND f.place LIKE '%detail%' AND f.required=1)
  ORDER BY p.panel_code`))

console.log('')
console.log('=== yj_panel.config 里 detail.tabs 是否带 isRequired(抽样 2 个面板) ===')
for (const pc of ['RD_SAMPLE_NO', 'RD_SOAK']) {
  const cfg = s(`SELECT TOP 1 CONVERT(nvarchar(max), config) FROM yj_panel WHERE panel_code='${pc}'`)
  const hasTabs = /"tabs"/.test(cfg)
  const hasReq = /"isRequired"\s*:\s*true/.test(cfg)
  console.log(`  ${pc}: config 长度=${cfg.length} 含tabs=${hasTabs} 含isRequired=${hasReq}`)
  const m = cfg.match(/"tabs"\s*:\s*\[[\s\S]{0,600}/)
  if (m) console.log('    ' + m[0].slice(0, 500).replace(/\s+/g, ' '))
}
