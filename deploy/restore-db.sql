/* ═══════════════════════════════════════════════════════════════════════════════
   restore-db.sql — 全量部署:用开发机的干净账整体覆盖服务器库(2026-09-21)

   路线:部署说明.md 「二、A. 全量恢复(已实测走通)」——第三次走这条(前两次 2026-09-10 / 09-14)。
   在**服务器**上执行:SSMS 连 localhost(Windows 身份验证)打开本文件整段执行;
   或命令行 sqlcmd -S localhost -E -f i:65001,o:65001 -i restore-db.sql

   做什么(按顺序,失败即停):
     ① 校验备份文件在不在(不在就**会话级硬停**,绝不先删库)
     ② 强删现有 HSDZ_MES(SINGLE_USER + ROLLBACK IMMEDIATE)
     ③ 自动探测实例默认数据目录,从 .bak 还原(备份里的逻辑名是 ASPSMT / ASPSMT_log)
     ④ 修**跨服务器还原的孤儿登录**:库里的 yinjia 用户带着原机器 SID,必须 ALTER USER 重新映射
        (不修的症状:报"用户 'yinjia' 登录失败";更阴的是 Tomcat 先监听、健康检查拿到 200 假阳性,
         随后启动期缓存预热查库失败 → 进程退出 → 外网 connection refused)
     ⑤ 授权 db_datareader / db_datawriter / db_ddladmin(应用要建表、写元数据)
     ⑥ 自查:表数 + 演示数据在不在(纯 ASCII 标记,便于回传日志里 grep)

   备份文件路径 = C:\yinjia\HSDZ_MES.bak(**要换路径就改下面第 ① 步那一行**)
   ⚠ 执行前必须先备份服务器现有库(见 部署步骤.md 第 2 步);本脚本不替你做备份。
   ═══════════════════════════════════════════════════════════════════════════════ */
USE master;
GO

-- ① 备份文件校验(不在就硬停 —— 严重级 20 会终止本次会话,后面的批次一条都不会执行)
DECLARE @bak nvarchar(400) = N'C:\yinjia\HSDZ_MES.bak';
DECLARE @exists int;
EXEC master.dbo.xp_fileexist @bak, @exists OUTPUT;
IF @exists <> 1
BEGIN
  DECLARE @m nvarchar(400) = N'[STOP] 备份文件不存在:' + @bak + N' —— 先把它放到 C:\yinjia\ 再执行';
  RAISERROR(@m, 20, 1) WITH LOG;
END
PRINT N'[1/5] 备份文件在:' + @bak;
GO

-- ② 强删现有库
IF DB_ID(N'HSDZ_MES') IS NOT NULL
BEGIN
    EXEC(N'ALTER DATABASE [HSDZ_MES] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [HSDZ_MES];');
    PRINT N'[2/5] 旧库已删除';
END
ELSE PRINT N'[2/5] 服务器上本来没有 HSDZ_MES,直接新建';
GO

-- ③ 自动探测数据目录并还原
DECLARE @data NVARCHAR(400) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS NVARCHAR(400));
DECLARE @sql NVARCHAR(MAX) = N'RESTORE DATABASE [HSDZ_MES] FROM DISK = N''C:\yinjia\HSDZ_MES.bak'' WITH RECOVERY, '
    + N'MOVE N''ASPSMT''     TO ''' + @data + N'HSDZ_MES.mdf'', '
    + N'MOVE N''ASPSMT_log'' TO ''' + @data + N'HSDZ_MES_log.ldf''';
PRINT N'[3/5] 数据目录:' + @data;
EXEC(@sql);
PRINT N'[3/5] 还原完成';
GO

-- ④ 修孤儿登录(登录不存在就先建)
IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'yinjia')
    CREATE LOGIN [yinjia] WITH PASSWORD = N'Yinjia@2026', CHECK_POLICY = OFF;
GO
USE [HSDZ_MES];
GO
ALTER USER [yinjia] WITH LOGIN = [yinjia];
GO
EXEC sp_addrolemember N'db_datareader', N'yinjia';
EXEC sp_addrolemember N'db_datawriter', N'yinjia';
EXEC sp_addrolemember N'db_ddladmin',  N'yinjia';
PRINT N'[4/5] yinjia 登录已重新映射并授权';
GO

-- ⑤ 自查(结论行是纯 ASCII,回传日志里直接 grep RESULT:)
SELECT N'RESULT: DB-OK' AS chk, CAST(COUNT(*) AS nvarchar(10)) AS n FROM sys.tables;
SELECT N'RESULT: DEMO-PROD-INFO' AS chk, CAST(COUNT(*) AS nvarchar(10)) AS n FROM rd_prod_info_head WHERE 产品编号 LIKE N'DEMO-%';
SELECT N'RESULT: DEMO-FILES' AS chk, CAST(COUNT(*) AS nvarchar(10)) AS n FROM (
  SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'DEMO-%'
  UNION ALL SELECT 单据编号 FROM rd_asm_proc_head  WHERE 产品编号 LIKE N'DEMO-%'
  UNION ALL SELECT 单据编号 FROM rd_spec_doc_head  WHERE 编号     LIKE N'DEMO-%'
  UNION ALL SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'DEMO-%') t;
SELECT N'RESULT: DEMO-CHANGE' AS chk, CAST(COUNT(*) AS nvarchar(10)) AS n FROM rd_change_head WHERE 产品编号 LIKE N'DEMO-%';
SELECT N'RESULT: DEMO-USERS' AS chk, CAST(COUNT(*) AS nvarchar(10)) AS n FROM yj_user WHERE username LIKE N'demo[_]%';
SELECT N'RESULT: PANELS' AS chk, CAST(COUNT(*) AS nvarchar(10)) AS n FROM yj_panel;
PRINT N'[5/5] 库恢复完成 —— 接着跑 swap-app.bat GO 换 app.jar 并起服务';
GO
