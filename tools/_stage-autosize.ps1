# _stage-autosize.ps1 — 暂存本任务(表单自适应+去重脚本)改动,排除并行会话 coverTailReserve hunk
$ErrorActionPreference = 'Stop'
Set-Location C:\INCER\YINJIA-MES
$file = 'frontend/src/core/views/RecordSheetPanels.vue'
git add -- $file
$diff = (git diff --cached -U3 -- $file) -join "`n"
$headerEnd = $diff.IndexOf("@@ ")
$header = $diff.Substring(0, $headerEnd)
$hunks = [System.Collections.Generic.List[string]]::new()
$cur = $null
foreach ($line in ($diff.Substring($headerEnd) -split "`n")) {
  if ($line -like '@@ *') { if ($cur) { $hunks.Add(($cur -join "`n")) }; $cur = [System.Collections.Generic.List[string]]::new() }
  if ($null -ne $cur) { $cur.Add($line) }
}
if ($cur) { $hunks.Add(($cur -join "`n")) }
$foreign = $hunks | Where-Object { $_ -match 'coverTailReserve' }
if (-not $foreign) { throw 'expected coverTailReserve hunk not found - abort' }
$patch = $header + (($foreign -join "`n")) + "`n"
$tmp = Join-Path $env:TEMP 'yj-foreign-hunk2.patch'
[System.IO.File]::WriteAllText($tmp, $patch.Replace("`r`n", "`n"), [System.Text.UTF8Encoding]::new($false))
git apply --cached -R --ignore-whitespace $tmp
if ($LASTEXITCODE -ne 0) { throw 'reverse-apply failed' }
Write-Host "staged minus $($foreign.Count) foreign hunk(s)"
# 清理本轮调试脚本(被 migrate-testlib-dedup.sql / 探针取代)
Remove-Item tools\_dupcheck.sql, tools\_list-nonseed.sql, tools\_prodcheck.sql, tools\_re-enable-seed.sql, tools\_dupscan.cjs, tools\_dupview.cjs, tools\_stage-my-hunks.ps1 -ErrorAction SilentlyContinue
git add -- tools/migrate-testlib-dedup.sql
git add -f -- tools/_probe-lib-autosize.cjs
git status --porcelain | Select-String '^[MARD]'
