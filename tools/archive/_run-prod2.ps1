# _run-prod2.ps1 — 执行产品文件升级迁移并验证
$conn = New-Object System.Data.SqlClient.SqlConnection
$conn.ConnectionString = "Data Source=localhost,1433;Initial Catalog=HSDZ_MES;Integrated Security=True;Connect Timeout=10"
$raw = [System.IO.File]::ReadAllText("C:\INCER\YINJIA-MES\tools\migrate-rd-prod2.sql", [System.Text.Encoding]::UTF8)
$batches = $raw -split "(?m)^\s*GO\s*$"
$conn.Open()
$i = 0
foreach ($batch in $batches) {
  $t = $batch.Trim()
  if ($t.Length -eq 0) { continue }
  $i++
  $cmd = $conn.CreateCommand(); $cmd.CommandText = $t; $cmd.CommandTimeout = 60
  $null = $cmd.ExecuteNonQuery()
}
Write-Output "EXECUTED $i batches"
$c = $conn.CreateCommand()
$c.CommandText = "SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('rd_prod_info_head')"
Write-Output ("prod_info_head cols: " + $c.ExecuteScalar())
$c2 = $conn.CreateCommand()
$c2.CommandText = "SELECT panel_code, COUNT(*) AS n FROM yj_field WHERE panel_code IN ('RD_PROD_INFO','RD_ASM_BOM','RD_INSP_PLAN') GROUP BY panel_code"
$r = $c2.ExecuteReader(); while ($r.Read()) { Write-Output ("FIELDS: " + $r["panel_code"] + " = " + $r["n"]) }; $r.Close()
$conn.Close()
