/* ============================================================
   _cleanup-prod-lw.sql — 一次性清理:正式库上被误导入的联网设备台账(LW-001..LW-129)

   为什么会有这份脚本:
   2026-10-19 首次执行 migrate-dc-device-import-20261019.sql 时,「只导测试账套」的闸门用
   RETURN 写在**单独的批**里,而 RETURN 只结束当前批 ⇒ 后面的 INSERT 批照样执行,
   正式库 HSDZ_MES 因此被灌入 129 行 LW-* 设备台账(用户口径:这些数据只进测试账套)。
   闸门已改为与 INSERT 同批(migrate-dc-device-import-20261019.sql 头注有记录),本脚本清理误入数据。

   安全边界:
   - 只删 code LIKE 'LW-%' 且 asp_user1 = 'migration' 且**从未有过采样/报警数据**的行;
   - 只在 HSDZ_MES(非测试库)执行,其它库上下文直接 RETURN(同批,不会再犯上面的错);
   - 生产环境执行前请人工确认:SELECT * FROM bs_dc_device WHERE code LIKE N'LW-%'。

   执行(在 tools 目录):
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run archive/_dc-device-import-20261019/_cleanup-prod-lw.sql
   ============================================================ */
SET NOCOUNT ON;
GO

IF DB_NAME() = N'HSDZ_MES_TEST'
BEGIN
  PRINT N'[SKIP] 本脚本用于清理正式库的误入数据;测试账套的 LW-* 是**要保留**的导入结果';
  RETURN;
END

DECLARE @before int = (SELECT COUNT(*) FROM dbo.bs_dc_device WHERE code LIKE N'LW-%');
PRINT N'[INFO] 清理前 LW-* 设备 ' + CAST(@before AS nvarchar(10)) + N' 行';

DELETE d
  FROM bs_dc_device d
 WHERE d.code LIKE N'LW-%'
   AND d.asp_user1 = N'migration'
   AND NOT EXISTS (SELECT 1 FROM bs_dc_sample s WHERE s.device_id = d.id)
   AND NOT EXISTS (SELECT 1 FROM bs_dc_alarm a WHERE a.device_id = d.id);

DECLARE @after int = (SELECT COUNT(*) FROM dbo.bs_dc_device WHERE code LIKE N'LW-%');
DECLARE @left int = (SELECT COUNT(*) FROM dbo.bs_dc_device WHERE ISNULL(asp_cancel,'N') <> 'Y');
PRINT N'[OK] 删除 ' + CAST(@before - @after AS nvarchar(10)) + N' 行,LW-* 剩 ' + CAST(@after AS nvarchar(10))
      + N' 行;正式库设备台账现 ' + CAST(@left AS nvarchar(10)) + N' 台';
GO
