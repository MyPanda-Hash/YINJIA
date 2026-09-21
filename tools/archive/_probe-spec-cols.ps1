# _probe-spec-cols.ps1 — 一次性探针:规格书(RD_SPEC_DOC)物理列清单
# 用途:核对 /px/specByProduct 端点 SQL 引用的列名真的存在(列名错了端点会 500)。
# 【为什么写文件而不是打屏】控制台代码页是本机 GBK,中文打出来是乱码 ⇒ 判断"某列在不在"会出错。
# 【必须带 UTF-8 BOM】PS 5.1 无 BOM 时按 ANSI(GBK)读 .ps1,中文 SQL 变乱码 ⇒ ParserError。
# 用法:powershell -NoProfile -File tools/archive/_probe-spec-cols.ps1
$ErrorActionPreference='Stop'
$cs='Server=localhost,1433;Database=HSDZ_MES;User Id=yinjia;Password=Yinjia@2026;TrustServerCertificate=True;Encrypt=False'
$out=Join-Path $PSScriptRoot '_probe-spec-cols.out.txt'
$c=New-Object System.Data.SqlClient.SqlConnection $cs; $c.Open()
$cmd=$c.CreateCommand()
$sb=New-Object System.Text.StringBuilder
foreach($t in @('rd_spec_doc_detail','rd_spec_doc_head','rd_spec_assign')){
  $cmd.CommandText="SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID(@t) ORDER BY c.column_id"
  $cmd.Parameters.Clear() | Out-Null
  $p=$cmd.CreateParameter(); $p.ParameterName='@t'; $p.Value=$t; [void]$cmd.Parameters.Add($p)
  $r=$cmd.ExecuteReader(); $a=@(); while($r.Read()){$a+=$r.GetString(0)}; $r.Close()
  [void]$sb.AppendLine("$t (" + $a.Count + "): " + ($a -join ', '))
}
$c.Close()
[System.IO.File]::WriteAllText($out,$sb.ToString(),(New-Object System.Text.UTF8Encoding $false))
Write-Host "OK -> $out"
