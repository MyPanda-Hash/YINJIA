// 2026-11-10:打印候选再补"本机所有真机" —— 配置那台可能名字在、驱动/端口已删,
// 必须能试到另一台(如不带「(副本 1)」的同型号)。
import { readFileSync, writeFileSync } from 'node:fs'

const p = 'D:/YINJIA-main/deploy/print-agent/print-agent.ps1'
let t = readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
if (t.includes('再兜所有真机')) {
  console.log('[skip] 已补全候选')
  process.exit(0)
}
const from = `        $realFallback = Get-RealPrinterName -Prefer ''
        if ($realFallback) { $script:PrintCandidates += $realFallback }`
const to = from + `
        # 再兜所有真机:配置那台可能只是驱动残留(名字在、端口/驱动已删)
        foreach ($n in (Get-InstalledPrinterNames)) {
            if (-not (Test-VirtualPrinter $n)) { $script:PrintCandidates += $n }
        }`
if (!t.includes(from)) throw new Error('找不到候选段')
t = t.replace(from, to)
writeFileSync(p, '\uFEFF' + t.replace(/\n/g, '\r\n'), 'utf8')
console.log('[ok] 候选补全')
