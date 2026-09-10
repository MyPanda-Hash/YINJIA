/* ============================================================
   dump-schema-log.sql — 导出目标库的"迁移台账 + 规模快照"(只读,不写任何东西)
   ------------------------------------------------------------
   用途:换包/迁移前判断目标库到底跑到哪一步了。
     · 台账(yj_schema_log)          -> 哪些脚本已被 DbSync 记录执行过
     · 面板/字段 编码清单            -> 与开发库对比,差多少个面板
     · 业务数据量                    -> 决定能否走"全量还原"路线
   执行:sqlcmd -S localhost -d HSDZ_MES -U yinjia -P *** -f i:65001,o:65001 -W -i dump-schema-log.sql
   ============================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

PRINT N'===== 1. LEDGER (yj_schema_log) =====';
IF OBJECT_ID('yj_schema_log') IS NULL
    PRINT N'NO_LEDGER   -- 台账表不存在:这个库从未被 DbSync 记录过任何迁移';
ELSE
BEGIN
    DECLARE @n int = (SELECT COUNT(*) FROM yj_schema_log);
    PRINT N'LEDGER_COUNT=' + CAST(@n AS nvarchar(10));
    SELECT script_name, CONVERT(varchar(19), applied_at, 120) AS applied_at
      FROM yj_schema_log ORDER BY script_name;
END
GO

PRINT N'===== 2. PANELS (yj_panel.panel_code) =====';
IF OBJECT_ID('yj_panel') IS NULL
    PRINT N'NO_PANELS';
ELSE
    SELECT panel_code FROM yj_panel ORDER BY panel_code;
GO

PRINT N'===== 3. SCALE =====';
SELECT N'yj_panel' AS tbl, COUNT(*) AS n FROM yj_panel;
SELECT N'yj_field' AS tbl, COUNT(*) AS n FROM yj_field;
GO

PRINT N'===== 4. BUSINESS VOLUME (only tables that exist) =====';
IF OBJECT_ID('yj_user')        IS NOT NULL SELECT N'yj_user'        AS tbl, COUNT(*) AS n FROM yj_user;
IF OBJECT_ID('yj_doc_status')  IS NOT NULL SELECT N'yj_doc_status'  AS tbl, COUNT(*) AS n FROM yj_doc_status;
IF OBJECT_ID('yj_translation') IS NOT NULL SELECT N'yj_translation' AS tbl, COUNT(*) AS n FROM yj_translation;
IF OBJECT_ID('kucun')          IS NOT NULL SELECT N'kucun'          AS tbl, COUNT(*) AS n FROM kucun;
IF OBJECT_ID('bs_inv_price')   IS NOT NULL SELECT N'bs_inv_price'   AS tbl, COUNT(*) AS n FROM bs_inv_price;
IF OBJECT_ID('rd_approval')    IS NOT NULL SELECT N'rd_approval'    AS tbl, COUNT(*) AS n FROM rd_approval;
IF OBJECT_ID('rd_plan')        IS NOT NULL SELECT N'rd_plan'        AS tbl, COUNT(*) AS n FROM rd_plan;
IF OBJECT_ID('wo_order')       IS NOT NULL SELECT N'wo_order'       AS tbl, COUNT(*) AS n FROM wo_order;
IF OBJECT_ID('yj_form_approval') IS NOT NULL SELECT N'yj_form_approval' AS tbl, COUNT(*) AS n FROM yj_form_approval;
GO

PRINT N'===== 5. TABLES (name + rowcount) =====';
SELECT t.name AS obj, ISNULL(SUM(p.row_count), 0) AS rows_
  FROM sys.tables t
  LEFT JOIN sys.dm_db_partition_stats p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
 GROUP BY t.name ORDER BY t.name;
GO

PRINT N'===== 6. TABLE COLUMN COUNTS =====';
SELECT t.name AS tbl, COUNT(c.column_id) AS cols
  FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
 GROUP BY t.name ORDER BY t.name;
GO

PRINT N'===== 7. VIEWS =====';
SELECT name FROM sys.views ORDER BY name;
GO

PRINT N'===== 8. ROUTINES =====';
SELECT name FROM sys.objects WHERE type IN ('P','FN','IF','TF') ORDER BY name;
GO

PRINT N'===== DUMP-END =====';
GO