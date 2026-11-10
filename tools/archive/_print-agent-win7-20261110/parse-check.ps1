$files = @('安装.ps1','卸载.ps1','print-agent.ps1')
foreach ($f in $files) {
  $p = Join-Path 'D:\YINJIA-main\deploy\print-agent' $f
  $errs = $null
  [void][System.Management.Automation.Language.Parser]::ParseFile($p, [ref]$null, [ref]$errs)
  if ($errs -and $errs.Count -gt 0) { Write-Output ("[FAIL] $f : " + $errs[0].Message) }
  else { Write-Output ("[OK] $f") }
}
