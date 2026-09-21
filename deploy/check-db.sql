/* ═══════════════════════════════════════════════════════════════════════════════
   check-db.sql — 全量部署:服务器现状只读自查(不改任何东西)
   由 deploy-all.bat 在 CHECK 档调用;也可以人工跑:
     sqlcmd -S localhost -E -f i:65001,o:65001 -i check-db.sql
   输出结论行一律纯 ASCII(回传日志里 grep "RESULT:")。
   ═══════════════════════════════════════════════════════════════════════════════ */
SET NOCOUNT ON;
SELECT N'RESULT: SYSADMIN ' + CAST(IS_SRVROLEMEMBER('sysadmin') AS varchar(1));
SELECT N'RESULT: DB-EXISTS ' + CAST(CASE WHEN DB_ID('HSDZ_MES') IS NULL THEN 0 ELSE 1 END AS varchar(1));
SELECT N'RESULT: SQLVER ' + CAST(SERVERPROPERTY('ProductVersion') AS varchar(40));
GO
IF DB_ID('HSDZ_MES') IS NOT NULL
BEGIN
  USE HSDZ_MES;
  SELECT N'RESULT: PANELS ' + CAST(COUNT(*) AS varchar(10)) FROM yj_panel;
  SELECT N'RESULT: USERS ' + CAST(COUNT(*) AS varchar(10)) FROM yj_user;
  SELECT N'RESULT: DEMO-PROD-INFO ' + CAST(COUNT(*) AS varchar(10)) FROM rd_prod_info_head WHERE 产品编号 LIKE N'DEMO-%';
  SELECT N'RESULT: DEMO-FILES ' + CAST(COUNT(*) AS varchar(10)) FROM (
    SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'DEMO-%'
    UNION ALL SELECT 单据编号 FROM rd_asm_proc_head  WHERE 产品编号 LIKE N'DEMO-%'
    UNION ALL SELECT 单据编号 FROM rd_spec_doc_head  WHERE 编号     LIKE N'DEMO-%'
    UNION ALL SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'DEMO-%') t;
  SELECT N'RESULT: DEMO-CHANGE ' + CAST(COUNT(*) AS varchar(10)) FROM rd_change_head WHERE 产品编号 LIKE N'DEMO-%';
  SELECT N'RESULT: RD-CHANGE-PANEL ' + CAST(COUNT(*) AS varchar(10)) FROM yj_panel WHERE panel_code = N'RD_CHANGE';
END
ELSE
  SELECT N'RESULT: PANELS 0(cold start)';
GO
-- 服务器上现有的库文件位置(换库前后对照用)
SELECT N'RESULT: DATA-PATH ' + CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(200));
SELECT N'RESULT: BAK-PATH-FREE ' + CAST(CASE WHEN EXISTS (SELECT 1 FROM sys.master_files WHERE physical_name LIKE N'C:\yinjia\%') THEN 1 ELSE 0 END AS varchar(1));
GO
