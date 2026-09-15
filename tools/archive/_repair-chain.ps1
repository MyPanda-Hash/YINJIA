# 一次性修复驱动:按 db-migrations.txt 顺序强制重跑全部已登记脚本(修复 09-15 setup-db 破坏性重跑造成的零散缺失)
# 跳过:setup-db.sql(破坏性重建,现有元数据/用户保留)与 6 个演示数据种子(避免复活测试数据/清空 bs_bom)
$ErrorActionPreference = 'Continue'
Set-Location D:\YINJIA-main\tools
$jar = (Resolve-Path '..\.m2-repo\com\microsoft\sqlserver\mssql-jdbc\12.8.2.jre11\mssql-jdbc-12.8.2.jre11.jar').Path
$skip = @('setup-db.sql','_bs_part3_data.sql','_doc_part3_data.sql','_so_data.sql','seed-rd-progress.sql','migrate-bom-seed-materials.sql','migrate-prod-info-seed.sql')
$manifest = Get-Content db-migrations.txt -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') }
$failed = @()
$pass = 1
$maxPass = 3
while ($pass -le $maxPass) {
  if ($pass -gt 1 -and $failed.Count -eq 0) { break }
  if ($pass -gt 1) { Write-Output "== 第 $pass 遍(重试上遍失败 $($failed.Count) 个) ==" }
  $retry = $failed; $failed = @()
  $i = 0
  foreach ($s in $manifest) {
    $i++
    if ($skip -contains $s) { continue }
    if ($pass -gt 1 -and ($retry -notcontains $s)) { continue }
    $out = & java -cp $jar DbSync.java run $s 2>&1
    $code = $LASTEXITCODE
    $tail = ($out | Select-Object -Last 1)
    if ($code -ne 0) { $failed += $s; Write-Output ("[{0,3}/{1}] FAIL {2} :: {3}" -f $i, $manifest.Count, $s, $tail) }
    else { Write-Output ("[{0,3}/{1}] ok   {2}" -f $i, $manifest.Count, $s) }
  }
  $pass++
}
Write-Output "=== 修复完成:最终失败 $($failed.Count) 个 ==="
if ($failed.Count) { $failed | ForEach-Object { Write-Output "  FAIL: $_" } }
