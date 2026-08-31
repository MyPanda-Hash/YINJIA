# verify-i18n.ps1 — 多语言规范校验(§3.1)
# 检查 yj_panel / yj_field 中缺失译名的行;缺失即退出码 1(CI/提交前跑)。
# 用法: pwsh tools\verify-i18n.ps1  [-Locale en]  [-SqlCmd <sqlcmd路径>]
param(
  [string]$Locale = "en",
  [string]$SqlCmd = "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE"
)
$ErrorActionPreference = "Stop"
if (-not (Test-Path $SqlCmd)) { $SqlCmd = "sqlcmd" }

$query = @"
SET NOCOUNT ON;
SELECT 'field' AS scope, f.panel_code, f.label,
       (SELECT COUNT(DISTINCT t.locale) FROM yj_translation t WHERE t.scope='field' AND t.ref_key = f.label) AS langs
FROM yj_field f
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key = f.label AND t.locale = '$Locale')
GROUP BY f.panel_code, f.label
UNION ALL
SELECT 'panel' AS scope, p.panel_code, p.panel_name,
       (SELECT COUNT(DISTINCT t.locale) FROM yj_translation t WHERE t.scope='panel' AND t.ref_key = p.panel_name) AS langs
FROM yj_panel p
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key = p.panel_name AND t.locale = '$Locale');
"@

Write-Host "=== 多语言规范校验(目标语言:$Locale)===" -ForegroundColor Cyan
$out = & $SqlCmd -S localhost -E -d HSDZ_MES -W -f 65001 -Q $query 2>$null
$missing = @($out | Where-Object { $_ -match '^(field|panel)\s' })

if ($missing.Count -eq 0) {
  Write-Host "PASS:所有面板与字段均有 '$Locale' 译名(§3.1 规范满足)" -ForegroundColor Green
  exit 0
}

Write-Host "FAIL:以下 $($missing.Count) 项缺少 '$Locale' 译名(规范 §3.1,见 AGENTS.md):" -ForegroundColor Red
$missing | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
Write-Host ""
Write-Host "补齐模板:" -ForegroundColor Cyan
Write-Host "INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'<中文标签>', '$Locale', N'<译名>', 'manual');"
exit 1
