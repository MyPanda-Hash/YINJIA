# _probe-insp-i18n2.ps1 — 一次性探针:改版后合并词典逐 scope 复核(i18n-insp-plan-redesign.sql 的验收)
#
# 【为什么不用 sqlcmd】sqlcmd 的**输出**编码跟控制台代码页(本机 GBK),中文打出来是乱码。
#   本探针用 System.Data.SqlClient,结果以 UTF-8 **无 BOM** 写文件,再由 Read 读取。
# 【本文件必须带 UTF-8 BOM】PS 5.1 无 BOM 时按 ANSI(GBK)读 .ps1,脚本里的中文 SQL 会变乱码
#   ⇒ ParserError。加 BOM 即可,勿去掉。
#
# 用法:powershell -NoProfile -File tools/archive/_probe-insp-i18n2.ps1
$ErrorActionPreference = 'Stop'
$cs = 'Server=localhost,1433;Database=HSDZ_MES;User Id=yinjia;Password=Yinjia@2026;TrustServerCertificate=True;Encrypt=False'
$out = Join-Path $PSScriptRoot '_probe-insp-i18n2.out.txt'

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

Dump $conn "SELECT scope, COUNT(*) AS 行数 FROM yj_translation GROUP BY scope ORDER BY scope" 'yj_translation 的 scope 分布'

# 本轮 10 个键:逐 (scope, locale) 铺开,直接看有没有**同键同语言跨 scope 撞车**
Dump $conn "SELECT ref_key, scope, COUNT(*) AS 行数, COUNT(DISTINCT locale) AS 语言数 FROM yj_translation WHERE ref_key IN (N'出货检验项目控制计划',N'若规格书有变动提示管控文件需更新',N'检查频率',N'检验项目',N'检验要求',N'不合格应对措施',N'编写人',N'产品编号',N'检验方法',N'检测频率') GROUP BY ref_key, scope ORDER BY ref_key, scope" '本轮 10 键的 scope 铺开'

# 合并词典的真实撞车点:同 ref_key + 同 locale 出现在**两个及以上** scope
Dump $conn "SELECT ref_key, locale, COUNT(*) AS 条数, MIN(scope) AS scope_a, MAX(scope) AS scope_b FROM yj_translation WHERE ref_key IN (N'出货检验项目控制计划',N'若规格书有变动提示管控文件需更新',N'检查频率',N'检验项目',N'检验要求',N'不合格应对措施',N'编写人',N'产品编号',N'检验方法',N'检测频率') GROUP BY ref_key, locale HAVING COUNT(*) > 1 ORDER BY ref_key, locale" '⚠ 同键同语言的重复行(0 行最好)'

# 新面板改版后 label 若有重复,fieldMap 会"后者覆盖前者" ⇒ 逐条列出来判定影响
Dump $conn "SELECT label, place, seq, col_name FROM yj_field WHERE panel_code=N'RD_INSP_PLAN' AND label IN (SELECT label FROM yj_field WHERE panel_code=N'RD_INSP_PLAN' GROUP BY label HAVING COUNT(*)>1) ORDER BY label, place, seq" 'RD_INSP_PLAN 内重复 label(改版前就有的)'

# rd_insp_plan_detail 的 [检验类别] 是否真的落在 detail place(明细查询只取 place=detail 的列)
Dump $conn "SELECT place, seq, col_name, label, ISNULL(alias,N'') AS alias, data_type, visible FROM yj_field WHERE panel_code=N'RD_INSP_PLAN' AND col_name IN (N'检验类别',N'备注',N'序号',N'控制方法',N'检测频率') ORDER BY col_name, place" '检验类别/备注/序号 的 place 归属'

$conn.Close()
[System.IO.File]::WriteAllText($out, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))
Write-Host "OK -> $out"
