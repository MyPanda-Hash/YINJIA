# _probe-insp-i18n3.ps1 — 一次性探针:查出「同键同语言跨 scope 重复」这批行的**来源**
#
# 背景:i18n-insp-plan-redesign.sql 的去重键是 (ref_key, locale)(不带 scope),目的就是避免
#   在合并词典里造出同键同语言两条。跑完后复核却发现 检验项目/检验要求 仍有跨 scope 重复 ——
#   本探针看 source 列判定:source='manual' 的是本脚本写的,其余是**改版前就有的**。
#
# 【必须带 UTF-8 BOM / 不用 sqlcmd】同上两份探针。
# 用法:powershell -NoProfile -File tools/archive/_probe-insp-i18n3.ps1
$ErrorActionPreference = 'Stop'
$cs = 'Server=localhost,1433;Database=HSDZ_MES;User Id=yinjia;Password=Yinjia@2026;TrustServerCertificate=True;Encrypt=False'
$out = Join-Path $PSScriptRoot '_probe-insp-i18n3.out.txt'

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

# source 列分布:manual = 人工/脚本写的,其余是导入或自动生成的
Dump $conn "SELECT scope, ISNULL(source,N'') AS source, COUNT(*) AS 行数 FROM yj_translation GROUP BY scope, source ORDER BY scope, 行数 DESC" 'source 列分布'

# 决定性证据:检验要求/检验项目 的每一行,连 source + id 一起看
Dump $conn "SELECT id, scope, ref_key, locale, text, ISNULL(source,N'') AS source FROM yj_translation WHERE ref_key IN (N'检验要求', N'检验项目') ORDER BY ref_key, locale, scope" '检验要求/检验项目 逐行(带 source 与 id)'

# 产品编号 ja 的两条(唯一的跨 scope 重复)
Dump $conn "SELECT id, scope, ref_key, locale, text, ISNULL(source,N'') AS source FROM yj_translation WHERE ref_key = N'产品编号' AND locale = 'ja'" '产品编号 ja 的两条'

# 本脚本写入的行(source='manual')到底有几条、落在哪些 scope
Dump $conn "SELECT scope, COUNT(*) AS 行数 FROM yj_translation WHERE source = 'manual' AND ref_key IN (N'出货检验项目控制计划',N'若规格书有变动提示管控文件需更新',N'检查频率',N'检验项目',N'检验要求',N'不合格应对措施',N'编写人',N'产品编号') GROUP BY scope" '本脚本实际写入的行数'

# 是否存在触发器把 field 行镜像到别的 scope
Dump $conn "SELECT name, is_disabled FROM sys.triggers WHERE parent_id = OBJECT_ID('yj_translation')" 'yj_translation 上的触发器'

$conn.Close()
[System.IO.File]::WriteAllText($out, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))
Write-Host "OK -> $out"
