# 语法检查:四个 .ps1 必须能被 PowerShell 解析(2026-11-10)
$files = @('安装.ps1', '卸载.ps1', 'print-agent.ps1', 'compat-ps2.ps1')
foreach ($f in $files) {
    $p = Join-Path 'D:\YINJIA-main\deploy\print-agent' $f
    $errs = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($p, [ref]$null, [ref]$errs)
    if ($errs -and $errs.Count -gt 0) {
        Write-Output ("[FAIL] $f : " + $errs[0].Message + " @line " + $errs[0].Extent.StartLineNumber)
    } else {
        Write-Output ("[OK] $f")
    }
}
