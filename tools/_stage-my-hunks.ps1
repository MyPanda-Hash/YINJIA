# _stage-my-hunks.ps1 — 把 RecordSheetPanels.vue 中本任务(检验项目标准库)的 hunk 入暂存,
# 排除并行会话的 coverTailReserve hunk;其余文件按显式清单入暂存。
$ErrorActionPreference = 'Stop'
Set-Location C:\INCER\YINJIA-MES
$file = 'frontend/src/core/views/RecordSheetPanels.vue'

# 1) 该文件整体入暂存,再把含 coverTailReserve 的 hunk 反向撤出暂存
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
$tmp = Join-Path $env:TEMP 'yj-foreign-hunk.patch'
[System.IO.File]::WriteAllText($tmp, $patch.Replace("`r`n", "`n"), [System.Text.UTF8Encoding]::new($false))
git apply --cached -R --ignore-whitespace $tmp
if ($LASTEXITCODE -ne 0) { throw 'reverse-apply failed' }
Write-Host "staged $file minus $($foreign.Count) foreign hunk(s)"

# 2) 其余本任务文件
git add -- CONTEXT.md `
  frontend/src/i18n/locales/de.js frontend/src/i18n/locales/en.js frontend/src/i18n/locales/es.js `
  frontend/src/i18n/locales/fr.js frontend/src/i18n/locales/ja.js frontend/src/i18n/locales/ko.js `
  frontend/src/i18n/locales/ru.js frontend/src/i18n/locales/th.js frontend/src/i18n/locales/vi.js `
  frontend/src/i18n/locales/zh-TW.js `
  tools/gen-testlib-seed.cjs tools/migrate-testlib-seed.sql tools/_i18n-testlib-keys.ps1
git add -f -- tools/_probe-testlib-maintain.cjs tools/_restore-testlib.cjs
git status --porcelain | Select-String '^[MARD]' | Select-Object -First 20
