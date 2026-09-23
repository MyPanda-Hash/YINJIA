# _probe-insp-fields.ps1 — 一次性探针:出货检验计划表(RD_INSP_PLAN)改版后字段/库/规格书数据现状
#
# 【为什么不用 sqlcmd】sqlcmd 的**输出**编码跟控制台代码页(本机 GBK),中文打出来是乱码,
#   据此判断"字段在不在"会得出错误结论。本探针用 System.Data.SqlClient,结果以
#   UTF-8 **无 BOM** 写文件,再由 Read 读取,所见即库中所存。
#
# 【本文件必须带 UTF-8 BOM】Windows PowerShell 5.1 无 BOM 时按 ANSI(本机 GBK)读 .ps1,
#   脚本里的中文 SQL 会被解成乱码 ⇒ ParserError。加 BOM 即可,勿去掉。
#
# 用法:powershell -NoProfile -File tools/archive/_probe-insp-fields.ps1
$ErrorActionPreference = 'Stop'
$cs = 'Server=localhost,1433;Database=HSDZ_MES;User Id=yinjia;Password=Yinjia@2026;TrustServerCertificate=True;Encrypt=False'
$out = Join-Path $PSScriptRoot '_probe-insp-fields.out.txt'

$sb = New-Object System.Text.StringBuilder

function Dump($conn, $sql, $title) {
  [void]$sb.AppendLine("===== $title =====")
  try {
    $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql
    $rd = $cmd.ExecuteReader()
    $cols = @(); for ($i = 0; $i -lt $rd.FieldCount; $i++) { $cols += $rd.GetName($i) }
    [void]$sb.AppendLine(($cols -join "`t"))
    while ($rd.Read()) {
      $vals = @()
      for ($i = 0; $i -lt $rd.FieldCount; $i++) {
        $v = $rd.GetValue($i)
        if ($v -is [System.DBNull]) { $vals += '' } else { $vals += [string]$v }
      }
      [void]$sb.AppendLine(($vals -join "`t"))
    }
    $rd.Close()
  } catch {
    [void]$sb.AppendLine("[查询失败] " + $_.Exception.Message)
  }
  [void]$sb.AppendLine('')
}

$conn = New-Object System.Data.SqlClient.SqlConnection $cs
$conn.Open()

# 1. 本面板的全部字段(改版后应见 3 个新 header 行 + 两处 alias)
Dump $conn "SELECT place, seq, col_name, label, ISNULL(alias,N'') AS alias, data_type, ISNULL(ref_panel,N'') AS ref_panel, ISNULL(ref_field,N'') AS ref_field, ISNULL(display_field,N'') AS display_field, editable, hidden, visible FROM yj_field WHERE panel_code = N'RD_INSP_PLAN' ORDER BY place, seq" 'RD_INSP_PLAN 字段全景'

# 1b. docDefaults 要写的 5 个键 + 设计头的 3 个新格 是否都在 yj_field 里
Dump $conn "SELECT col_name, label, place, data_type FROM yj_field WHERE panel_code = N'RD_INSP_PLAN' AND col_name IN (N'管理人',N'密级',N'使用范围',N'审核人',N'版本号',N'编写人',N'客户项目名称',N'产品整体尺寸',N'产品功能类别',N'客户项目名称') ORDER BY col_name" 'docDefaults/表头 目标键是否落地'

# 2. 物理列(3 个新列应到手;检验类别/表区 是否真有)
Dump $conn "SELECT c.name AS col_name, t.name AS type, c.max_length/2 AS chars FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('rd_insp_plan_detail') ORDER BY c.column_id" 'rd_insp_plan_detail 物理列'

# 3. 检验类别 字段选项(分组下拉的来源)。⚠ 选项不在 yj_field 里存值,而是存一句**字典 SQL**
#    (dict_sql),由 PanelConfigService.dictOptions() 执行后取首列 —— 所以要连 SQL 一起看。
Dump $conn "SELECT col_name, label, data_type, ISNULL(dict_sql,N'') AS dict_sql FROM yj_field WHERE panel_code=N'RD_INSP_PLAN' AND col_name IN (N'检验类别',N'检测频率',N'密级')" '分组/频率/密级 字段的字典 SQL'

# 4. 规格书数据现状(自动填充端到端验证的前置:有没有可用的规格书)
Dump $conn "SELECT TOP 10 单据编号, ISNULL(编号,N'') AS 编号, ISNULL(客户项目名称,N'') AS 客户项目名称, ISNULL(产品类别,N'') AS 产品类别, LEFT(ISNULL(整体规格参数,N''),40) AS 整体规格参数 FROM rd_spec_doc_head ORDER BY id DESC" 'rd_spec_doc_head 最近 10 条'

Dump $conn "SELECT 表区, COUNT(*) AS 行数 FROM rd_spec_doc_detail GROUP BY 表区" 'rd_spec_doc_detail 各表区行数'

Dump $conn "SELECT COUNT(*) AS 行数 FROM rd_spec_assign" 'rd_spec_assign 行数'

# 5. insp.plan 标准库条目(勾选落分组的真源)
Dump $conn "SELECT id, item_code, seq, enabled, LEFT(content, 60) AS content_head FROM yj_std_lib WHERE lib_code=N'insp.plan' ORDER BY item_code, seq, id" 'insp.plan 标准库条目'

$conn.Close()
[System.IO.File]::WriteAllText($out, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))
Write-Host "OK -> $out"
