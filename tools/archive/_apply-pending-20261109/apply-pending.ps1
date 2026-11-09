# apply-pending.ps1 — 把本地账套补齐到「仓库清单」那一版(2026-11-09)
#
# 背景:本地开发库落后 26 条迁移(含 2026-11-06 的「加标水配置记录表」试剂用量列/标准库改造),
#   而服务器早就跑过 ⇒ 界面上这几张记录表的**字段对不上**(用户报障:图二服务器有「试剂用量(g)」组,
#   本地没有)。DbSync 默认增量会卡在 migrate-drop-bak-qc-snapshots-20261102.sql 的两道闸门
#   (历史遗留:库里还有 _bak_* 快照表),后面的一律不跑,所以这里逐条 `DbSync run`。
#
# 用法:powershell -ExecutionPolicy Bypass -File tools\archive\_apply-pending-20261109\apply-pending.ps1 [-Db HSDZ_MES]
param([string]$Db = 'HSDZ_MES')

$ErrorActionPreference = 'Continue'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$tools = Join-Path $root 'tools'
$logDir = $PSScriptRoot
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $logDir ("apply-$Db-$stamp.log")

# 清单顺序 != 执行顺序依赖的唯一处:spike-water 的 fix 必须在 layout 之后(清单已保证)
$scripts = @(
  'migrate-drop-bak-qc-snapshots-20261102.sql',
  'migrate-asm-bom-data-full-20261105.sql',
  'migrate-drop-wol-picking-perm-20261105.sql',
  'migrate-approval-customer-ref-20261106.sql',
  'migrate-sample-dev-panels-20261106.sql',
  'migrate-spike-water-layout-20261106.sql',
  'migrate-spike-water-layout-fix-20261106.sql',
  'migrate-approval-customer-ref-fix-20261106.sql',
  'migrate-testlib-spec-order-20261106.sql',
  'migrate-sample-flow-20261106.sql',
  'migrate-testlib-spec-add-missing-20261106.sql',
  'migrate-sample-ext-detail-20261106.sql',
  'migrate-prodinfo-cust-code-20261106.sql',
  'migrate-mold-workshop-stdlib-20261106.sql',
  'migrate-sample-int-flat-20261106.sql',
  'migrate-proc-insp-form-20261106.sql',
  'migrate-qc-insp-twolevel-20261106.sql',
  'migrate-qc-proc-insp-tpl-20261106.sql',
  'migrate-proc-insp-plan-editable-20261106.sql',
  'migrate-drop-bak-tables-20261106.sql',
  'migrate-sample-int-paper-rows-20261106.sql',
  'migrate-sample-int-row-owner-20261106.sql',
  'migrate-work-order-progress-panel-20261108.sql',
  'migrate-wo-report-list-product-cols-20261108.sql',
  'migrate-qc-proc-insp-rename-20261109.sql',
  'migrate-qc-proc-insp-tpl-20261109.sql'
)

function Run-One([string]$script) {
  Push-Location $tools
  try {
    $out = & cmd /c "set YINJIA_SQL_DB=$Db && java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run $script" 2>&1
    $code = $LASTEXITCODE
  } finally { Pop-Location }
  return @{ script = $script; code = $code; out = ($out | Out-String) }
}

function Baseline-One([string]$script) {
  Push-Location $tools
  try {
    $out = & cmd /c "set YINJIA_SQL_DB=$Db && java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java baseline $script" 2>&1
    $code = $LASTEXITCODE
  } finally { Pop-Location }
  return @{ script = $script; code = $code; out = ($out | Out-String) }
}

$fail = @()
$base = @()
foreach ($s in $scripts) {
  $r = Run-One $s
  $ok = ($r.code -eq 0) -and ($r.out -notmatch '\[FAIL|\[SQL FAIL')
  "{0}  {1,-52} {2}" -f $(if ($ok) { 'OK  ' } else { 'FAIL' }), $s, $(if ($ok) { '' } else { ($r.out -split "`n" | Where-Object { $_ -match '\[FAIL|\[SQL FAIL|RESULT' } | Select-Object -First 1) }) | Tee-Object -FilePath $log -Append
  if (-not $ok) {
    # 两支"删备份表"脚本是历史遗留闸门(库里仍有 _bak_* 快照),按仓库既定做法 baseline(只登记不执行)
    if ($s -match 'drop-bak') {
      $b = Baseline-One $s
      $bOk = ($b.code -eq 0) -and ($b.out -notmatch '\[FAIL')
      "      → baseline {0}" -f $(if ($bOk) { 'OK(已登记,未执行)' } else { 'FAIL' }) | Tee-Object -FilePath $log -Append
      if ($bOk) { $base += $s } else { $fail += $s }
    } else {
      $fail += $s
      ($r.out -split "`n" | Select-Object -Last 6) | ForEach-Object { "      $_" } | Tee-Object -FilePath $log -Append
    }
  }
}

"" | Tee-Object -FilePath $log -Append
"=== $Db 汇总:成功 $(($scripts.Count - $fail.Count - $base.Count)) / baseline $($base.Count) / 失败 $($fail.Count) ===" | Tee-Object -FilePath $log -Append
if ($fail.Count) { "失败清单: $($fail -join ', ')" | Tee-Object -FilePath $log -Append }
