// 2026-11-10 现场(照片):EPSON LQ-635K 连续纸,打印出来「横竖反了 + 缩放/clip」。
// 原因:脚本一律按 A5 横版设置(Landscape=true)。针式机驱动认自己的连续纸纸型,
//       设了 A5/横版后驱动再旋转一次 ⇒ 内容侧着打、右侧列超出可打印区。
// 改法:
//   ① 针式机(名字含 LQ-/ESC\/P2/FX-/针式)自动用自定义纸 241×140mm、**不旋转**;
//   ② 纸张参数支持 LQ/Dot(手工指定),方便没有针式机时验证;
//   ③ 绘制前按**可打印区**等比缩放并居中,纸比内容小时不再被裁掉(解决"缩放有问题");
//   ④ 日志把实际纸型/可打印区/缩放比打出来,现场一眼能核对。
import { readFileSync, writeFileSync } from 'node:fs'

const p = 'D:/YINJIA-main/deploy/print-agent/print-agent.ps1'
let t = readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
if (t.includes('DOT-PAPER-20261110')) {
  console.log('[skip] 已是新版纸张处理')
  process.exit(0)
}

const from = `    $paperKind = if (([string]$Paper).Trim().ToUpper() -eq 'A4') { 'A4' } else { 'A5' }
    try {
        $ps = $doc.PrinterSettings.PaperSizes | Where-Object { $_.Kind -eq $paperKind } | Select-Object -First 1
        if (-not $ps) { $ps = $doc.PrinterSettings.PaperSizes | Where-Object { $_.PaperName -match $paperKind } | Select-Object -First 1 }
        if ($ps) {
            $doc.DefaultPageSettings.PaperSize = $ps
            $doc.DefaultPageSettings.Landscape = $true    # 横打:A5→210×148 / A4→297×210
            $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
            Say ("[版面] 纸张 = {0} 横打(内容仍 210×148mm,不缩放)" -f $paperKind) 'DarkGray'
        } else {
            Say ("[WARN] 打印机没有 {0} 纸型,按默认纸输出" -f $paperKind) 'Yellow'
        }
    } catch {
        Say ("[WARN] 设置纸张({0} 横版)失败,按默认纸输出: {1}" -f $paperKind, $_.Exception.Message) 'Yellow'
    }`

if (!t.includes(from)) throw new Error('找不到纸张选择块')

const to = `    # ── DOT-PAPER-20261110 ─────────────────────────────────────────────
    # 针式打印机(ESC/P2 连续纸)不能按 A5 横版设:驱动会再旋转一次,结果"横竖反了 + 右侧被裁"。
    # 这里:针式机 → 自定义纸 241×140mm(中一刀)、**不旋转**;其它机(激光/PDF)→ 原来的 A5/A4 横版。
    $isDot = $false
    $pn = ''
    try { $pn = [string]$doc.PrinterSettings.PrinterName } catch { }
    if ($pn -match 'LQ-|ESC\\s*/\\s*P2|FX-|针式|Dot\\s*Matrix') { $isDot = $true }
    $paperOpt = ([string]$Paper).Trim().ToUpper()
    if ($paperOpt -eq 'LQ' -or $paperOpt -eq 'DOT') { $isDot = $true }
    $paperKind = if ($paperOpt -eq 'A4') { 'A4' } else { 'A5' }
    try {
        if ($isDot) {
            # 241mm × 140mm = 949 × 551(1/100 英寸);Landscape=false:纸本身就是"宽>高",不再转
            $dotPaper = New-Object System.Drawing.Printing.PaperSize('中一刀 241x140', 949, 551)
            $doc.DefaultPageSettings.PaperSize = $dotPaper
            $doc.DefaultPageSettings.Landscape = $false
            $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
            Say '[版面] 针式打印机 → 自定义纸 241×140mm(中一刀),不旋转' 'DarkGray'
        } else {
            $ps = $doc.PrinterSettings.PaperSizes | Where-Object { $_.Kind -eq $paperKind } | Select-Object -First 1
            if (-not $ps) { $ps = $doc.PrinterSettings.PaperSizes | Where-Object { $_.PaperName -match $paperKind } | Select-Object -First 1 }
            if ($ps) {
                $doc.DefaultPageSettings.PaperSize = $ps
                $doc.DefaultPageSettings.Landscape = $true    # 横打:A5→210×148 / A4→297×210
                $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
                Say ("[版面] 纸张 = {0} 横打(内容仍 210×148mm)" -f $paperKind) 'DarkGray'
            } else {
                Say ("[WARN] 打印机没有 {0} 纸型,按默认纸输出" -f $paperKind) 'Yellow'
            }
        }
    } catch {
        Say ("[WARN] 设置纸张失败,按默认纸输出: {0}" -f $_.Exception.Message) 'Yellow'
    }`

t = t.replace(from, to)

// 绘制回调开头:按可打印区等比缩放(解决纸比内容小时被裁)
const fromDraw = `        $pageW = 827   # 210mm
        $pageH = 583   # 148mm`
if (!t.includes(fromDraw)) throw new Error('找不到 pageW/pageH')
const toDraw = `        $pageW = 827   # 210mm(版式坐标,不随纸张变)
        $pageH = 583   # 148mm
        # 纸比版式小时等比缩小并居中:以前固定坐标直接画,针式连续纸(140mm 高)会把下半截裁掉
        try {
            $mb = $e.MarginBounds
            if ($mb -and $mb.Width -gt 50 -and $mb.Height -gt 50) {
                $sx = [double]$mb.Width / 827.0
                $sy = [double]$mb.Height / 583.0
                $sc = [Math]::Min(1.0, [Math]::Min($sx, $sy))
                $g.TranslateTransform([float]$mb.Left, [float]$mb.Top)
                if ($sc -lt 0.999) {
                    $g.ScaleTransform([float]$sc, [float]$sc)
                    Say ("[版面] 可打印区 {0}×{1} → 缩放 {2:P0}" -f $mb.Width, $mb.Height, $sc) 'DarkGray'
                }
            }
        } catch { }`
t = t.replace(fromDraw, toDraw)

writeFileSync(p, '\uFEFF' + t.replace(/\n/g, '\r\n'), 'utf8')
console.log('[patched] 针式纸型 + 可打印区缩放')
