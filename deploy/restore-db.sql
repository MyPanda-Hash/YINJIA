/* ═══════════════════════════════════════════════════════════════════════════════
   restore-db.sql — 全量部署:用开发机的干净账整体覆盖服务器库(2026-09-21)

   路线:部署说明.md 「二、A. 全量恢复(已实测走通)」——第三次走这条(前两次 2026-09-10 / 09-14)。
   在**服务器**上执行:SSMS 连 localhost(Windows 身份验证)打开本文件整段执行;
   或命令行 sqlcmd -S localhost -E -f i:65001,o:65001 -i restore-db.sql

   做什么:
     ① 先修跨服务器还原的孤儿登录(登录不存在就建)
     ② **一个批次内**做完"校验备份在不在 → 强删旧库 → RESTORE + MOVE"——见下
     ③ 重新映射库内 yinjia 用户到登录(跨服务器还原不带原机器 SID,不修就报"用户 'yinjia' 登录失败";
        更阴的是 Tomcat 先监听、健康检查拿 200 假阳性,随后缓存预热查库失败 → 进程退出 → 外网 refused)
     ④ 授权 db_datareader / db_datawriter / db_ddladmin(应用要建表、写元数据)
     ⑤ 自查:表数 + 演示数据(纯 ASCII 标记,便于回传日志里 grep RESULT:)

   ⚠ 守卫为什么写成"同一批次内自守卫"(2026-09-21 本地临时库演练发现并修正):
     · 原来用 RAISERROR(…, 20, 1) WITH LOG —— 严重级 ≥20 要求 sysadmin;登录不是 sysadmin 时
       这句**自己报权限错**,脚本继续往下跑 ⇒ 先把库 DROP 了才发现没得还原。
     · 改用跨批次的 SET NOEXEC ON —— 依赖"跨批次保持",实测不可靠(变体A 没停住,继续跑到 USE 报错)。
     · 现在:DROP 与 RESTORE 跟文件校验**放在同一批次**的条件分支里,且 xp_fileexist 取不到值
       (NULL)一律按"文件不存在"处理(fail-safe)。备份不在 ⇒ 一个字节都不会动。
     ⚠ 成功标记只有一个:② 的成功分支打的 RESULT: RESTORE-DONE(失败分支打
       RESULT: NOT-RESTORED)。deploy-all.bat 的还原闸门只认 RESTORE-DONE ——
       别改成认 ④ 的 DB-PRESENT:守卫拦下时服务器上那个旧库照样在,照样打得出那行。
   备份文件路径 = C:\yinjia\HSDZ_MES.bak(**要换路径就改下面第 ② 步那一行**;
   deploy-all.bat 会自动把包里的备份搬成这个路径,并把服务器上同名旧文件先归档到 backup\)
   ═══════════════════════════════════════════════════════════════════════════════ */
USE master;
GO

-- ① 修/建应用登录(必须在还原前:还原后库里那个 yinjia 用户要映射到它)
IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'yinjia')
BEGIN
  CREATE LOGIN [yinjia] WITH PASSWORD = N'Yinjia@2026', CHECK_POLICY = OFF;
  PRINT N'[1/5] 已创建登录 yinjia';
END
ELSE PRINT N'[1/5] 登录 yinjia 已存在';
GO

-- ② 自守卫批次:校验备份 → 删旧库 → 还原(全在一个批次里,条件不成立就一步都不做)
DECLARE @bak nvarchar(400) = N'C:\yinjia\HSDZ_MES.bak';
DECLARE @exists int = NULL;
EXEC master.dbo.xp_fileexist @bak, @exists OUTPUT;

IF ISNULL(@exists, 0) <> 1
BEGIN
  PRINT N'[STOP] 备份文件不存在或读不到:' + @bak + N' —— 先把它放到该路径再执行;本次不做任何改动';
  PRINT N'RESULT: NOT-RESTORED';   -- 机器可读的"没还原"标记(见文件头 ⚠ 第二段)
END
ELSE
BEGIN
  PRINT N'[2/5] 备份文件在:' + @bak;

  IF DB_ID(N'HSDZ_MES') IS NOT NULL
  BEGIN
    EXEC(N'ALTER DATABASE [HSDZ_MES] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [HSDZ_MES];');
    PRINT N'[3/5] 旧库已删除';
  END
  ELSE PRINT N'[3/5] 服务器上本来没有 HSDZ_MES,直接新建';

  DECLARE @data nvarchar(400) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400));
  DECLARE @sql nvarchar(max) = N'RESTORE DATABASE [HSDZ_MES] FROM DISK = N''' + @bak + N''' WITH RECOVERY, '
      + N'MOVE N''ASPSMT''     TO ''' + @data + N'HSDZ_MES.mdf'', '
      + N'MOVE N''ASPSMT_log'' TO ''' + @data + N'HSDZ_MES_log.ldf''';
  PRINT N'[4/5] 数据目录:' + @data;
  EXEC(@sql);
  PRINT N'[4/5] 还原完成';
  PRINT N'RESULT: RESTORE-DONE';   -- ★ 唯一权威的成功标记:deploy-all.bat 只认这一行
END
GO

-- ③ 映射库内用户到登录 + 授权(库不存在时跳过,别把整个脚本炸掉)
IF DB_ID(N'HSDZ_MES') IS NULL
  PRINT N'[!] HSDZ_MES 不存在(上一步可能被守卫拦下),跳过登录映射';
ELSE
BEGIN
  USE [HSDZ_MES];
  ALTER USER [yinjia] WITH LOGIN = [yinjia];
  EXEC sp_addrolemember N'db_datareader', N'yinjia';
  EXEC sp_addrolemember N'db_datawriter', N'yinjia';
  EXEC sp_addrolemember N'db_ddladmin',  N'yinjia';
  PRINT N'[5/5] yinjia 登录已重新映射并授权';
END
GO

-- ④ 自查(结论行是纯 ASCII,回传日志里直接 grep RESULT:)
--   ⚠ 这里的 DB-PRESENT 只说明"库在",**不能**当"这次还原成功"用:守卫拦下时
--     服务器上那个旧库照样在,旧库也照样能打出这些行 ⇒ 曾经会 fail-open,让部署
--     带着新 jar 跑在旧库上。判定成败只看 ② 里的 RESULT: RESTORE-DONE。
IF DB_ID(N'HSDZ_MES') IS NOT NULL
BEGIN
  USE [HSDZ_MES];
  SELECT N'RESULT: DB-PRESENT' AS chk, CAST(COUNT(*) AS nvarchar(10)) AS n FROM sys.tables;
  SELECT N'RESULT: DEMO-PROD-INFO' AS chk, CAST(COUNT(*) AS nvarchar(10)) AS n FROM rd_prod_info_head WHERE 产品编号 LIKE N'DEMO-%';
  SELECT N'RESULT: DEMO-FILES' AS chk, CAST(COUNT(*) AS nvarchar(10)) AS n FROM (
    SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'DEMO-%'
    UNION ALL SELECT 单据编号 FROM rd_asm_proc_head  WHERE 产品编号 LIKE N'DEMO-%'
    UNION ALL SELECT 单据编号 FROM rd_spec_doc_head  WHERE 编号     LIKE N'DEMO-%'
    UNION ALL SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'DEMO-%') t;
  SELECT N'RESULT: DEMO-CHANGE' AS chk, CAST(COUNT(*) AS nvarchar(10)) AS n FROM rd_change_head WHERE 产品编号 LIKE N'DEMO-%';
  SELECT N'RESULT: DEMO-USERS' AS chk, CAST(COUNT(*) AS nvarchar(10)) AS n FROM yj_user WHERE username LIKE N'demo[_]%';
  SELECT N'RESULT: PANELS' AS chk, CAST(COUNT(*) AS nvarchar(10)) AS n FROM yj_panel;
  SELECT N'RESULT: RD-CHANGE-PANEL' AS chk, CAST(COUNT(*) AS nvarchar(10)) AS n FROM yj_panel WHERE panel_code = N'RD_CHANGE';
END
ELSE
  SELECT N'RESULT: NOT-RESTORED' AS chk, N'(守卫拦下,库未改动)' AS n;
GO
PRINT N'[done] 库恢复流程结束 —— 接着跑 deploy-all.bat GO APP 换 app.jar 并起服务(deploy-all.bat GO 已包含)';
GO
