// 2026-11-10 补充:针式机实际可打印宽度约 203mm(8in),而版式是 210mm ⇒ 右侧列会出界。
// 针式纸型下把目标宽度收到 198mm、高度留 1mm 余量,再等比缩放;日志打出来。
import { readFileSync, writeFileSync } from 'node:fs'

const p = 'D:/YINJIA-main/deploy/print-agent/print-agent.ps1'
let t = readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
if (t.includes('$script:IsDotPaper')) {
  console.log('[skip] 已有针式缩放')
  process.exit(0)
}

const a = `            Say '[版面] 针式打印机 → 自定义纸 241×140mm(中一刀),不旋转' 'DarkGray'`
if (!t.includes(a)) throw new Error('找不到针式纸日志')
t = t.replace(a, a + `\n            $script:IsDotPaper = $true`)

const b = `        try {
            $mb = $e.MarginBounds
            if ($mb -and $mb.Width -gt 50 -and $mb.Height -gt 50) {
                $sx = [double]$mb.Width / 827.0
                $sy = [double]$mb.Height / 583.0
                $sc = [Math]::Min(1.0, [Math]::Min($sx, $sy))`
if (!t.includes(b)) throw new Error('找不到缩放块')
const nb = `        try {
            $mb = $e.MarginBounds
            if ($mb -and $mb.Width -gt 50 -and $mb.Height -gt 50) {
                # 针式机:实际可打印宽度约 203mm(8in),版式 210mm ⇒ 目标宽收到 198mm;
                # 高度减 1mm 余量,避免 140mm 纸刚好压线。
                $targetW = 827.0
                $targetH = 583.0
                if ($script:IsDotPaper) { $targetW = 780.0; $targetH = 575.0 }
                $sx = [Math]::Min([double]$mb.Width, $targetW) / 827.0
                $sy = [Math]::Min([double]$mb.Height, $targetH) / 583.0
                $sc = [Math]::Min(1.0, [Math]::Min($sx, $sy))`
t = t.replace(b, nb)

writeFileSync(p, '\uFEFF' + t.replace(/\n/g, '\r\n'), 'utf8')
console.log('[ok] 针式宽度收敛')
