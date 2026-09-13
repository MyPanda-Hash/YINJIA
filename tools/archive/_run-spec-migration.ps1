# _run-spec-migration.ps1 — 执行规格书多类型迁移
$conn = New-Object System.Data.SqlClient.SqlConnection
$conn.ConnectionString = "Data Source=localhost,1433;Initial Catalog=HSDZ_MES;Integrated Security=True;Connect Timeout=10"
$raw = [System.IO.File]::ReadAllText("C:\INCER\YINJIA-MES\tools\migrate-rd-spec-multi.sql", [System.Text.Encoding]::UTF8)
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
$f = $conn.CreateCommand()
$f.CommandText = "SELECT COUNT(*) FROM yj_field WHERE panel_code='RD_SPEC_DOC'"
Write-Output ("RD_SPEC_DOC fields: " + $f.ExecuteScalar())
$c = $conn.CreateCommand()
$c.CommandText = "SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('rd_spec_doc_head') AND name IN (N'规格书种类',N'适用范围',N'整体规格参数',N'产品主要性能',N'包装方式',N'运输要求',N'存储环境')"
Write-Output ("new columns: " + $c.ExecuteScalar() + "/7")
$conn.Close()
