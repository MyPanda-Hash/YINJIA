// analyze-panels.cjs — 解析导出的 18 面板配置,输出结构摘要(字段/类型/明细页签)
const fs = require('fs')
const path = require('path')
const lines = fs.readFileSync(path.join(__dirname, 'base-panels-export.jsonl'), 'utf8')
  .replace(/^\uFEFF/, '')
  .split(/\r?\n/).filter((l) => l.trim())
for (const line of lines) {
  const row = JSON.parse(line.replace(/^\uFEFF/, ''))
  let cfg
  try { cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config } catch (e) { console.log(`${row.panel_code}: config 解析失败 ${e.message}`); continue }
  const schemaFields = (cfg.dataSchema && cfg.dataSchema.fields) || []
  const tabs = ((cfg.detail && cfg.detail.tabs) || [])
  const meta = cfg.metadata || {}
  console.log(`\n### ${row.panel_code} ${row.panel_name} [${row.category}] singleDoc=${meta.singleDoc} mode=${meta.panelCategory || ''}`)
  console.log(`  schema(${schemaFields.length}): ` + schemaFields.map((f) => `${f.dataName}[${f.dataType || '?'}${f.isRequired ? '*' : ''}]`).join(' '))
  for (const t of tabs) {
    console.log(`  tab "${t.key}"(${(t.fields || []).length}): ` + (t.fields || []).map((f) => `${f.dataName}[${f.dataType || '?'}${f.isRequired ? '*' : ''}]`).join(' '))
  }
  const qf = (cfg.metadata && cfg.metadata.panelPageDto && cfg.metadata.panelPageDto.tablePages && cfg.metadata.panelPageDto.tablePages[0] && cfg.metadata.panelPageDto.tablePages[0].queryFields) || []
  if (qf.length) console.log(`  query(${qf.length}): ` + qf.map((f) => f.dataName).join(' '))
}
