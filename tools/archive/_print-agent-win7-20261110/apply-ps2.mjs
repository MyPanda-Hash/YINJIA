#!/usr/bin/env node
/**
 * 把安装/卸载/代理三个脚本改成「Win7 自带 PowerShell 2.0 也能一键跑」:
 *   - 不再要求客户先装 WMF 5.1;
 *   - PS<3 时加载同目录 compat-ps2.ps1(补 ConvertFrom-Json / ConvertTo-Json / Invoke-WebRequest);
 *   - 顺手清掉 PS3+ 才有的语法(`-in` / `[pscustomobject]` / `$PSCommandPath`);
 *   - 代理的轮询跑在 Start-Job 子进程里 → 把兼容层路径传进去并在 job 内 dot-source。
 *
 * 用法:node tools/archive/_print-agent-win7-20261110/apply-ps2.mjs [目录]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] || 'D:\\YINJIA-main\\deploy\\print-agent'

const VERSION_BLOCK = `if ($PSVersionTable.PSVersion.Major -lt 3) {
    Say '[FAIL] 这台电脑的 PowerShell 版本太低(需要 3.0 及以上)。' 'Red'
    Say '       Win7 请先装 WMF 5.1:https://www.microsoft.com/download/details.aspx?id=54616'
    exit 1
}`

const COMPAT_LOAD = `# PS2(Win7 自带):没有 ConvertFrom-Json / ConvertTo-Json / Invoke-WebRequest(都是 3.0+ 才有)。
# 用户口径「要兼容,能够一键完成,不要多余操作」⇒ 加载同目录兼容层,不让客户去装 WMF。
$script:HereDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
if ($PSVersionTable.PSVersion.Major -lt 3) {
    $compatFile = Join-Path $script:HereDir 'compat-ps2.ps1'
    if (-not (Test-Path $compatFile)) { Say "[FAIL] 同目录缺少 compat-ps2.ps1,请把整个文件夹一起拷贝: $compatFile" 'Red'; exit 1 }
    . $compatFile
}`

function patch(file, edits, label) {
  const p = join(root, file)
  let t = readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (t.includes('compat-ps2.ps1')) {
    console.log(`[skip] ${file} 已接兼容层`)
    return
  }
  if (!t.includes(VERSION_BLOCK)) throw new Error(`${file}: 找不到版本闸门块`)
  t = t.replace(VERSION_BLOCK, COMPAT_LOAD)
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error(`${file}: 找不到片段\n${from.slice(0, 100)}`)
    t = t.split(from).join(to)
  }
  writeFileSync(p, '\uFEFF' + t.replace(/\n/g, '\r\n'), 'utf8')
  console.log(`[patched] ${file} ${label || ''}`)
}

patch('安装.ps1', [], '')

patch('卸载.ps1', [], '')

patch('print-agent.ps1', [
  // PS2 没有 $PSCommandPath
  [`$ScriptPath = $PSCommandPath`,
   `$ScriptPath = if ($PSCommandPath) { $PSCommandPath } else { $MyInvocation.MyCommand.Path }`],
  // PS2 没有 -in
  [`if ($m -in @('Auto', 'Printer', 'Pdf')) { $script:Mode = $m }`,
   `if (@('Auto', 'Printer', 'Pdf') -contains $m) { $script:Mode = $m }`],
  // PS2 没有 [pscustomobject]
  [`$r = Invoke-PrintJob -Job ([pscustomobject]@{
                    标题 = '打印代理测试'
                    工单号 = 'TEST-0001'
                    工单行号 = 1
                    产品名称 = '测试标签'
                    规格型号 = '75x100mm'
                    二维码内容 = '0@TEST-0001@1001'
                })`,
   `$r = Invoke-PrintJob -Job (New-Object PSObject -Property @{
                    标题 = '打印代理测试'
                    工单号 = 'TEST-0001'
                    工单行号 = 1
                    产品名称 = '测试标签'
                    规格型号 = '75x100mm'
                    二维码内容 = '0@TEST-0001@1001'
                })`],
  // 轮询在 Start-Job 子进程里:把兼容层路径传进去,并在 job 内加载
  [`    $pollArgs = @($srvBase, $User, $Pass, $Factory, $Station, $Port, $Mode, $PdfDir, $Printer)
    $script:pollJob = Start-Job -ScriptBlock {
        param($Srv, $Usr, $Pwd, $Fac, $Sta, $AgentPort, $ModeX, $PdfDirX, $PrinterX)`,
   `    $compatForJob = Join-Path $script:HereDir 'compat-ps2.ps1'
    $pollArgs = @($compatForJob, $srvBase, $User, $Pass, $Factory, $Station, $Port, $Mode, $PdfDir, $Printer)
    $script:pollJob = Start-Job -ScriptBlock {
        param($Cmp, $Srv, $Usr, $Pwd, $Fac, $Sta, $AgentPort, $ModeX, $PdfDirX, $PrinterX)
        if ($PSVersionTable.PSVersion.Major -lt 3) { . $Cmp }`],
], '(JSON/HTTP/语法/Job)')
