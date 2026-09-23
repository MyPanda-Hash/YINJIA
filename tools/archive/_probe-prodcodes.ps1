# _probe-prodcodes.ps1 — 一次性探针:挑几个真实产品编号 + 看规格书表的列型(给自动填充做夹具用)
# 【必须带 UTF-8 BOM / 不用 sqlcmd】同前几份探针。用法:powershell -NoProfile -File tools/archive/_probe-prodcodes.ps1
$ErrorActionPreference='Stop'
$cs='Server=localhost,1433;Database=HSDZ_MES;User Id=yinjia;Password=Yinjia@2026;TrustServerCertificate=True;Encrypt=False'
$out=Join-Path $PSScriptRoot '_probe-prodcodes.out.txt'
$c=New-Object System.Data.SqlClient.SqlConnection $cs; $c.Open()
$sb=New-Object System.Text.StringBuilder
function D($sql,$t){
  [void]$sb.AppendLine("===== $t =====")
  try{
    $cmd=$c.CreateCommand(); $cmd.CommandText=$sql
    $r=$cmd.ExecuteReader()
    $cols=@(); for($i=0;$i -lt $r.FieldCount;$i++){$cols+=$r.GetName($i)}
    [void]$sb.AppendLine(($cols -join "`t"))
    while($r.Read()){ $v=@(); for($i=0;$i -lt $r.FieldCount;$i++){ $x=$r.GetValue($i); if($x -is [System.DBNull]){$v+=''}else{$v+=[string]$x} }; [void]$sb.AppendLine(($v -join "`t")) }
    $r.Close()
  }catch{ [void]$sb.AppendLine('[查询失败] '+$_.Exception.Message) }
  [void]$sb.AppendLine('')
}
D "SELECT TOP 8 产品编号, 产品名称, 产品功能类别 FROM rd_prod_info WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC" 'rd_prod_info 最近 8 条(挑编号)'
D "SELECT c.name, t.name AS type, c.max_length/2 AS chars, c.is_nullable FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('rd_spec_doc_detail') ORDER BY c.column_id" 'rd_spec_doc_detail 列型'
D "SELECT c.name, t.name AS type, c.max_length/2 AS chars, c.is_nullable FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('rd_spec_doc_head') AND c.name IN (N'单据编号',N'编号',N'客户项目名称',N'产品类别',N'整体规格参数',N'单据日期',N'名称') ORDER BY c.column_id" 'rd_spec_doc_head 相关列型'
D "SELECT c.name, t.name AS type, c.max_length/2 AS chars, c.is_nullable FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('rd_spec_assign') ORDER BY c.column_id" 'rd_spec_assign 列型'
D "SELECT COLUMNPROPERTY(OBJECT_ID('rd_spec_doc_head'),'单据编号','IsIdentity') AS head_单据编号_自增, COLUMNPROPERTY(OBJECT_ID('rd_spec_doc_detail'),'id','IsIdentity') AS detail_id_自增" '自增标记'
$c.Close()
[System.IO.File]::WriteAllText($out,$sb.ToString(),(New-Object System.Text.UTF8Encoding $false))
Write-Host "OK -> $out"
