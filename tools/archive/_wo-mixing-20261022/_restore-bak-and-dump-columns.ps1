# _restore-bak-and-dump-columns.ps1 —— 把服务器备份还原成临时库，导出 wo_mixing_list 的真实结构/数据
# 2026-10-22：本机 SQL Server 的 sa 密码没人知道，但 **当前 Windows 账号(Lenovo)在实例里就是 sysadmin**
#   （sqlcmd -E 实测 SUSER_SNAME()=DESKTOP-JHUNFT6\Lenovo、IS_SRVROLEMEMBER('sysadmin')=1），
#   所以还原根本不需要 sa —— 之前失败是因为命令跑在受限沙箱里（Schannel 拿不到凭证）。
#
# 用法（仓库根）：
#   powershell -ExecutionPolicy Bypass -File tools\archive\_wo-mixing-20261022\_restore-bak-and-dump-columns.ps1
#   ... -Drop            # 导出后立刻删临时库（默认保留，便于继续查）
#
# 产物：_bak-dump-wo_mixing_list.txt（列定义 + 8 行真实数据）
# 安全：临时库名固定 HSDZ_MES_BAK20261021，先 DROP 再 RESTORE，**完全不碰 HSDZ_MES / HSDZ_MES_TEST**。
param(
    [string]$BakPath = 'D:\YINJIA-main\tools\archive\_wo-mixing-20261022\wo_mixing_bak.bak',
    [string]$TempDb  = 'HSDZ_MES_BAK20261021',
    [switch]$Drop
)
$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot '_bak-dump-wo_mixing_list.txt'

if (-not (Test-Path $BakPath)) { throw "备份文件不存在: $BakPath" }

$sql = @"
SET NOCOUNT ON;
IF DB_ID(N'$TempDb') IS NOT NULL
BEGIN
    ALTER DATABASE [$TempDb] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [$TempDb];
END
RESTORE DATABASE [$TempDb] FROM DISK = N'$BakPath'
  WITH MOVE N'ASPSMT'     TO N'C:\Program Files\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\DATA\$TempDb.mdf',
       MOVE N'ASPSMT_log' TO N'C:\Program Files\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\DATA\${TempDb}_log.ldf',
       RECOVERY;
"@
$sql | Out-File -Encoding UTF8 "$env:TEMP\_restore-tmp.sql"
cmd /c "sqlcmd -S localhost -E -f 65001 -i ""$env:TEMP\_restore-tmp.sql"" " | Out-Null

$dump = @"
SET NOCOUNT ON;
SELECT N'=== 列定义 ===' AS section;
SELECT c.column_id AS ord, c.name, TYPE_NAME(c.user_type_id) AS data_type,
       CASE WHEN TYPE_NAME(c.user_type_id) = 'decimal'
            THEN 'decimal(' + CAST(c.precision AS varchar(3)) + ',' + CAST(c.scale AS varchar(3)) + ')'
            WHEN TYPE_NAME(c.user_type_id) IN ('nvarchar','nchar')
            THEN TYPE_NAME(c.user_type_id) + '(' + CAST(CASE WHEN c.max_length < 0 THEN -1 ELSE c.max_length / 2 END AS varchar(6)) + ')'
            WHEN TYPE_NAME(c.user_type_id) IN ('varchar','char')
            THEN TYPE_NAME(c.user_type_id) + '(' + CAST(c.max_length AS varchar(6)) + ')'
            ELSE TYPE_NAME(c.user_type_id) END AS col_type,
       c.is_nullable AS nullable, c.is_identity AS identity_col,
       ISNULL(CAST(ep.value AS nvarchar(200)), '') AS note
  FROM sys.columns c
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
 WHERE c.object_id = OBJECT_ID('dbo.wo_mixing_list')
 ORDER BY c.column_id;
SELECT N'=== 行数 ===' AS section, COUNT(*) AS rows FROM dbo.wo_mixing_list;
SELECT N'=== 数据 ===' AS section;
SELECT * FROM dbo.wo_mixing_list ORDER BY id;
SELECT N'=== 其它引用 wo_mixing_list 的库内对象（视图/过程/函数）===' AS section;
SELECT o.type_desc, o.name FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
 WHERE m.definition LIKE '%wo_mixing_list%';
"@
$dump | Out-File -Encoding UTF8 "$env:TEMP\_dump-tmp.sql"
cmd /c "sqlcmd -S localhost -E -d $TempDb -f 65001 -W -s ""|"" -i ""$env:TEMP\_dump-tmp.sql"" -o ""$out"" " | Out-Null
Write-Host "已导出: $out"

if ($Drop) {
    cmd /c "sqlcmd -S localhost -E -Q ""ALTER DATABASE [$TempDb] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$TempDb];"" " | Out-Null
    Write-Host "临时库 $TempDb 已删除"
} else {
    Write-Host "临时库 $TempDb 保留（用完请删：-Drop 或手工 DROP DATABASE）"
}
