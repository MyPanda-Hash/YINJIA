# trigger-mt.ps1
# 批量机器翻译:把全部面板名/字段标签(中文)补齐到 en + 8 种语言(yj_translation, source='mt')。
# 步骤:
#   1) 查询 yj_panel.panel_name + yj_field.label 的全集(仅含中文者)作为 keys 真源
#   2) 对每种语言 POST /api/locale/dict -> 后端调阿里云机翻,结果缓存进 scope='ui'
#   3) 把 scope='ui' 的结果按 en 键清单拷贝进 scope='field' / 'panel'(缺哪补哪)
# 幂等:已翻译的语言/词条自动跳过,可重复执行。
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8090'
$keysFile = 'C:\INCER\YINJIA-MES\tools\_all-keys.txt'
$tmpSql = 'C:\INCER\YINJIA-MES\tools\_mt-copy.sql'
$locales = @('en','ja','ko','de','es','fr','ru','th','vi','zh-TW')

# 1) keys 真源:全部面板名 + 全部字段标签
$q = "SET NOCOUNT ON; SELECT DISTINCT panel_name FROM yj_panel; SELECT DISTINCT label FROM yj_field;"
[System.IO.File]::WriteAllText('C:\INCER\YINJIA-MES\tools\_all-keys-q.sql', $q, (New-Object System.Text.UTF8Encoding $false))
sqlcmd -S localhost -U yinjia -P 'Yinjia@2026' -d HSDZ_MES -i 'C:\INCER\YINJIA-MES\tools\_all-keys-q.sql' -h -1 -W -u -o $keysFile
if ($LASTEXITCODE -ne 0) { throw "sqlcmd keys query failed: $LASTEXITCODE" }
$keys = @(Get-Content $keysFile -Encoding Unicode | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '[\u4e00-\u9fff]' } | Sort-Object -Unique)
Write-Host "total chinese keys: $($keys.Count)"

foreach ($loc in $locales) {
    $json = @{ locale = $loc; keys = $keys } | ConvertTo-Json -Depth 4 -Compress
    $r = Invoke-RestMethod -Uri "$base/api/locale/dict" -Method Post `
        -ContentType 'application/json; charset=utf-8' `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) -TimeoutSec 900
    $n = if ($null -eq $r.data.dict) { 0 } else { $r.data.dict.Count }
    Write-Host "locale $loc -> dict=$n (translated + existing)"
}

# ---- scope 拷贝:ui -> field / panel ----
$sql = @"
SET NOCOUNT ON;
INSERT INTO yj_translation (scope, ref_key, locale, text, source, created_at, updated_at)
SELECT DISTINCT 'field', s.ref_key, s.locale, s.text, 'mt', SYSDATETIME(), SYSDATETIME()
FROM yj_translation s
WHERE s.scope IN ('ui','panel') AND s.locale IN ('en','ja','ko','de','es','fr','ru','th','vi','zh-TW')
  AND EXISTS (SELECT 1 FROM yj_field f WHERE f.label = s.ref_key)
  AND NOT EXISTS (SELECT 1 FROM yj_translation f WHERE f.scope='field' AND f.locale=s.locale AND f.ref_key=s.ref_key);

INSERT INTO yj_translation (scope, ref_key, locale, text, source, created_at, updated_at)
SELECT DISTINCT 'panel', s.ref_key, s.locale, s.text, 'mt', SYSDATETIME(), SYSDATETIME()
FROM yj_translation s
WHERE s.scope IN ('ui','field') AND s.locale IN ('en','ja','ko','de','es','fr','ru','th','vi','zh-TW')
  AND EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_name = s.ref_key)
  AND NOT EXISTS (SELECT 1 FROM yj_translation f WHERE f.scope='panel' AND f.locale=s.locale AND f.ref_key=s.ref_key);

SELECT locale,
       SUM(CASE WHEN scope='field' THEN 1 ELSE 0 END) AS field_rows,
       SUM(CASE WHEN scope='panel' THEN 1 ELSE 0 END) AS panel_rows
FROM yj_translation
WHERE locale IN ('en','ja','ko','de','es','fr','ru','th','vi')
GROUP BY locale ORDER BY locale;
"@
[System.IO.File]::WriteAllText($tmpSql, $sql, (New-Object System.Text.UTF8Encoding $false))
sqlcmd -S localhost -U yinjia -P 'Yinjia@2026' -d HSDZ_MES -i $tmpSql -h -1 -W -u -o 'C:\INCER\YINJIA-MES\tools\_mt-copy.txt'
if ($LASTEXITCODE -ne 0) { throw "sqlcmd failed: $LASTEXITCODE" }
Write-Host '---- per-locale field/panel rows after copy ----'
Get-Content 'C:\INCER\YINJIA-MES\tools\_mt-copy.txt' -Encoding Unicode
