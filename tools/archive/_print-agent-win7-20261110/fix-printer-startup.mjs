// 2026-11-10:启动时把配置的打印机名也与系统清单核对,health/日志显示"实际会用哪台";
// 打印任务里先 Resolve 再回退,避免拿着已删的「…(副本 1)」去打印。
import { readFileSync, writeFileSync } from 'node:fs'

const p = 'D:/YINJIA-main/deploy/print-agent/print-agent.ps1'
let t = readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
if (t.includes('$resolvedStartup')) {
  console.log('[skip] 启动核对已加')
  process.exit(0)
}

const oldEff = `$effective = if ($Printer) { $Printer } elseif ($defaultPrinter) { "$defaultPrinter(系统默认)" } else { '(未检测到默认打印机!)' }`
if (!t.includes(oldEff)) throw new Error('找不到 $effective')
const newEff = `# 配置的打印机名可能已失效(现场 "…(副本 1)" 被删,打印报「已删除指定的打印机。」)
$resolvedStartup = Resolve-PrinterName $Printer
if ($Printer -and -not $resolvedStartup) {
    Say ("[打印机] 配置的「{0}」在这台电脑上不存在,打印时会自动改用可用打印机" -f $Printer) 'Yellow'
    foreach ($n in (Get-InstalledPrinterNames)) { Say ("          可选: " + $n) 'DarkGray' }
}
$effective = if ($resolvedStartup) { $resolvedStartup } elseif ($Printer) { $Printer + '(未找到!)' } elseif ($defaultPrinter) { "$defaultPrinter(系统默认)" } else { '(未检测到默认打印机!)' }`
t = t.replace(oldEff, newEff)

const oldReal = `        $real = Get-RealPrinterName -Prefer $printerN`
if (!t.includes(oldReal)) throw new Error('找不到 Get-RealPrinterName -Prefer')
const newReal = `        # 先按系统清单核对配置名(忽略 (副本 N)),对不上就换可用真机
        $real = Resolve-PrinterName $printerN
        if (-not $real) { $real = Get-RealPrinterName -Prefer '' }
        if ($real -and $printerN -and $real -ne $printerN) { Say ("[打印机] 配置的「{0}」不在系统里,改用「{1}」" -f $printerN, $real) 'Yellow' }`
t = t.replace(oldReal, newReal)

writeFileSync(p, '\uFEFF' + t.replace(/\n/g, '\r\n'), 'utf8')
console.log('[patched] 启动核对 + 打印前解析')
