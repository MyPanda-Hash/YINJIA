/* ═══════════════════════════════════════════════════════════════════════════════
   backup-db.sql — 全量部署:动手换库**之前**先把服务器现有库整个备份(回滚点)
   由 deploy-all.bat 在 GO 档调用;**备份失败就硬停**(诀不在没有回滚点的情况下改库)。
   备份落到服务器本地盘 C:\yinjia\backup\ —— **不能**直接写 \\tsclient\ 重定向盘,
   因为 SQL Server 服务账号不在 RDP 登录会话里、看不到那个映射。
   人工跑:sqlcmd -S localhost -E -f i:65001,o:65001 -i backup-db.sql
   结论行纯 ASCII:grep "RESULT:"
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
DECLARE @dir nvarchar(400) = N'C:\yinjia\backup';
DECLARE @stamp nvarchar(20) = REPLACE(REPLACE(CONVERT(nvarchar(19), GETDATE(), 120), N'-', N''), N':', N'');
DECLARE @bak nvarchar(400) = @dir + N'\pre-deploy-' + @stamp + N'.bak';
DECLARE @e int;

IF DB_ID(N'HSDZ_MES') IS NULL
  PRINT N'RESULT: BACKUP-SKIPPED (服务器上还没有 HSDZ_MES,无需备份)';
ELSE
BEGIN
  EXEC master.dbo.xp_create_subdir @dir;

  BEGIN TRY
    BACKUP DATABASE [HSDZ_MES] TO DISK = @bak WITH FORMAT, INIT, NAME = N'pre-deploy server backup', STATS = 25;
    PRINT N'RESULT: BACKUP-OK ' + @bak;
  END TRY
  BEGIN CATCH
    PRINT N'RESULT: BACKUP-FAILED ' + ERROR_MESSAGE();
    RAISERROR(N'[STOP] 服务器库备份失败,不允许继续换库(先解决磁盘空间/权限)', 20, 1) WITH LOG;
  END CATCH

  -- 备份成功也再确认一次文件真在(历史上踩过"报成功但没落盘")
  EXEC master.dbo.xp_fileexist @bak, @e OUTPUT;
  PRINT N'RESULT: BACKUP-FILE-EXISTS ' + CAST(@e AS varchar(1)) + N' ' + @bak;
END
GO
