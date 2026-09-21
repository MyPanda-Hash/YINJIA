# _probe-insp-i18n.ps1 — 一次性探针:出货检验项目控制计划重设计所需的译名现状
#
# 【为什么不用 sqlcmd】sqlcmd 的**输出**编码跟控制台代码页(本机 GBK),中文打出来是乱码,
#   据此判断"某键缺不缺译名"会得出错误结论。本探针用 System.Data.SqlClient,结果以
#   UTF-8 **无 BOM** 写文件,再由 Read 读取,所见即库中所存。
#
# 【本文件必须带 UTF-8 BOM】Windows PowerShell 5.1 无 BOM 时按 ANSI(本机 GBK)读 .ps1,
#   脚本里的中文 SQL 会被解成乱码 ⇒ ParserError。加 BOM 即可,勿去掉。
#
# 用法:powershell -NoProfile -File tools/archive/_probe-insp-i18n.ps1
$ErrorActionPreference = 'Stop'
$cs = 'Server=localhost,1433;Database=HSDZ_MES;User Id=yinjia;Password=Yinjia@2026;TrustServerCertificate=True;Encrypt=False'
$out = Join-Path $PSScriptRoot '_probe-insp-i18n.out.txt'

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

Dump $conn "SELECT scope, COUNT(*) AS 行数, COUNT(DISTINCT locale) AS 语言数, COUNT(DISTINCT ref_key) AS 键数 FROM yj_translation GROUP BY scope ORDER BY scope" 'yj_translation 的 scope 分布'

# 本轮要用的键:新字段名 / 改名后的显示名 / 报告头大标题 / 表尾注 / 被 alias 顶掉的旧名
Dump $conn "SELECT ref_key, locale, text FROM yj_translation WHERE scope = 'field' AND ref_key IN (N'检验方法',N'检测频率',N'检查频率',N'出货检验项目控制计划',N'伊可普碱性炭棒出货检验项目控制计划',N'若规格书有变动提示管控文件需更新',N'客户项目名称',N'产品功能类别',N'产品整体尺寸',N'使用范围',N'不合格应对措施',N'备注',N'版本号',N'审核人',N'编写人',N'管理人',N'表单管理人',N'客户名',N'客户名称',N'产品编号',N'主要性能',N'滤芯尺寸',N'授权使用人',N'序号',N'序 号') ORDER BY ref_key, locale" '本轮相关 field 译名'

# 表尾注那种长句在库里有没有先例(若有,说明"长句也建译名"是这个库的既有口径)
Dump $conn "SELECT TOP 20 ref_key, locale FROM yj_translation WHERE ref_key LIKE N'%知悉%' OR ref_key LIKE N'%规格书有变动%' ORDER BY ref_key, locale" '长句译名先例'

# tt() 走的是 field+ui 合并后的 biz 词典 ⇒ 同一 ref_key 在两个 scope 都有行会撞车。先查 ui 侧。
Dump $conn "SELECT scope, ref_key, locale, text FROM yj_translation WHERE ref_key IN (N'检验方法',N'检查频率',N'检测频率',N'出货检验项目控制计划',N'序 号') AND scope = 'ui' ORDER BY ref_key, locale" 'ui 侧同名键(冲突预检)'

# 表头大标题在库里怎么建:看已重设计的组装工艺清单用了哪个键
Dump $conn "SELECT scope, ref_key, COUNT(*) AS 语言数 FROM yj_translation WHERE ref_key LIKE N'%工艺控制%' GROUP BY scope, ref_key ORDER BY scope, ref_key" '已重设计面板的标题键'

$conn.Close()
[System.IO.File]::WriteAllText($out, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))
Write-Host "OK -> $out"
