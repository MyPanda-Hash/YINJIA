# _probe-pick-prod.ps1 — 一次性探针:挑一个真实产品编号(自动填充端到端验证的夹具要用它当 编号)
# 【必须带 UTF-8 BOM / 不用 sqlcmd】同前几份探针。用法:powershell -NoProfile -File tools/archive/_probe-pick-prod.ps1
$ErrorActionPreference='Stop'
$cs='Server=localhost,1433;Database=HSDZ_MES;User Id=yinjia;Password=Yinjia@2026;TrustServerCertificate=True;Encrypt=False'
$out=Join-Path $PSScriptRoot '_probe-pick-prod.out.txt'
$c=New-Object System.Data.SqlClient.SqlConnection $cs; $c.Open()
$cmd=$c.CreateCommand()
$cmd.CommandText="SELECT TOP 5 产品编号, 产品名称, 产品功能类别 FROM rd_prod_info_head WHERE ISNULL(asp_cancel,'N')<>'Y' AND 产品编号 IS NOT NULL AND 产品编号<>N'' ORDER BY id DESC"
$r=$cmd.ExecuteReader()
$sb=New-Object System.Text.StringBuilder
[void]$sb.AppendLine('产品编号' + "`t" + '产品名称' + "`t" + '产品功能类别')
while($r.Read()){ $v=@(); for($i=0;$i -lt 3;$i++){ $x=$r.GetValue($i); if($x -is [System.DBNull]){$v+=''}else{$v+=[string]$x} }; [void]$sb.AppendLine(($v -join "`t")) }
$r.Close(); $c.Close()
[System.IO.File]::WriteAllText($out,$sb.ToString(),(New-Object System.Text.UTF8Encoding $false))
Write-Host "OK -> $out"
