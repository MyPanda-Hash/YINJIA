/*
 * _merge-fixture.mjs — 把某面板的 label 基线并入 recordSheetConfigs 的 fixture
 * 用法(仓库根目录): node tools/archive/_merge-fixture.mjs QC_FIN_SPEC tools/_panel-labels.tsv
 * 说明:本机无 sqlcmd(gen-config-key-fixture.cjs 依赖它),故用 jshell 导出 TSV 再并入;
 *      顶层键按字母序重排,缩进保持 1 空格,与既有文件逐字同格式。
 */
import fs from 'node:fs'

const panel = process.argv[2] || 'QC_FIN_SPEC'
const tsvPath = process.argv[3] || '_panel-labels.tsv'
const fixturePath = 'frontend/src/core/views/rdPanelLabels.fixture.json'

const tsv = fs.readFileSync(tsvPath, 'utf8').trim().split(/\r?\n/).filter(Boolean)
const cols = {}
for (const line of tsv) {
  const [c, l] = line.split('\t')
  if (c) cols[c] = l ?? c
}
const labels = [...new Set(Object.values(cols))]

const fx = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
fx[panel] = { cols, labels }
const sorted = Object.fromEntries(Object.keys(fx).sort().map((k) => [k, fx[k]]))
fs.writeFileSync(fixturePath, JSON.stringify(sorted, null, 1) + '\n')
console.log(`[ok] ${panel}: cols=${Object.keys(cols).length} labels=${labels.length}; 顶层面板 ${Object.keys(sorted).length} 个`)
