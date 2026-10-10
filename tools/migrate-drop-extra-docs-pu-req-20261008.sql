-- migrate-drop-extra-docs-pu-req-20261008.sql — 下架「请购单 + 其他入库/其他出库/委外入库/委外发料」共 13 个面板
--
-- 用户口径(2026-10-08):「请购单还有部分出入库单是不需要的」。据此:
--   **保留**:采购入库单 PURCHASE_IN / 销售出库单 SALE_OUT / 材料出库单 MATERIAL_OUT
--            / 产成品入库单 FINISH_IN(工单完工入库的唯一载体,用户明确「先稳一步」保留)
--   **下架**:PU_REQ 请购单;OTHER_IN 其他入库单、OTHER_OUT 其他出库单、
--            OUTSOURCE_IN 委外入库单、OUTSOURCE_ISSUE 委外发料单 —— 每类含 单据 + 明细表 + 统计表
--
-- ══════ 逐个列明删了什么(便于日后追溯;AGENTS.md「整体下架」口径)══════
--   yj_panel      13 行:PU_REQ / OTHER_IN / OTHER_IN_DETAIL / OTHER_IN_STATS
--                       / OTHER_OUT / OTHER_OUT_DETAIL / OTHER_OUT_STATS
--                       / OUTSOURCE_IN / OUTSOURCE_IN_DETAIL / OUTSOURCE_IN_STATS
--                       / OUTSOURCE_ISSUE / OUTSOURCE_ISSUE_DETAIL / OUTSOURCE_ISSUE_STATS
--   yj_field      258 行(这 13 面板的全部字段登记)
--   yj_role_panel  52 行(13 × 4 个角色)
--   yj_translation 面板名译名 117 行(13 个中文名 × 9 语言)+ 孤儿字段标签译名(22 个标签,只被这些面板用)
--   视图 8 个:v_other_in_detail / v_other_in_stats / v_other_out_detail / v_other_out_stats
--              / v_outsource_in_detail / v_outsource_in_stats
--              / v_outsource_issue_detail / v_outsource_issue_stats
--   物理表 10 张:bd_pu_req / bl_pu_req / bd_other_in / bl_other_in / bd_other_out / bl_other_out
--                / bd_outsource_in / bl_outsource_in / bd_outsource_issue / bl_outsource_issue
--
-- ══════ 下架依据(2026-10-08 实测,证据见 tools/archive/_panel-age/)══════
--   · 单据量:bd_pu_req / bd_other_in / bd_other_out / bd_outsource_in / bd_outsource_issue **全部 0 张**;
--     库存流水 inh/outh 里只有「采购入库单 / 销售出库单 / 期初结存」三种类型 ⇒ 这些单据从未发生过业务;
--   · 依赖:后端只有 StockFlowService/StockLedgerService(记账分支)与 PanelConfigService(按钮/生单映射);
--     数据库侧无任何视图/存储过程引用这些表或视图、无外键、无 yj_field.ref_panel 引用,
--     其余 panel 引用表(yj_attachment / yj_form_approval / report_column_settings / yj_doc_modify_log /
--     yj_archive_change_log / yj_plan_term / yj_ext_bind_log / yj_doc_batch)对这 13 个面板**全 0 行**;
--   · git 取证:这 13 张面板「9 月后零更新」—— 见 docs/development/面板老化盘点-品质管理与智能供应链.md;
--   · 回退抓手:tools/archive/_panel-age/_backup-20261008/
--     (yj_panel.csv / yj_field.csv / yj_role_panel.csv / yj_translation-panel.csv
--      + restore-metadata.sql 一键回插 + views.sql 视图定义 + tables-ddl.sql 表结构骨架)
--
-- 幂等:每步都带存在性/行存在守卫,重跑为 no-op。
-- 两账套都要执行(先正式、后测试):
--   正式 tools> java -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-extra-docs-pu-req-20261008.sql
--   测试 tools> set YINJIA_SQL_DB=HSDZ_MES_TEST && java -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-extra-docs-pu-req-20261008.sql
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库时不得被切走)
GO
PRINT N'[库] ' + DB_NAME() + N' — 下架 请购单 + 其他入库/其他出库/委外入库/委外发料(13 个面板)';
GO
-- ═══ 清单(临时表,跨批可用)═══
IF OBJECT_ID('tempdb..#p') IS NOT NULL DROP TABLE #p;
CREATE TABLE #p (code varchar(40) PRIMARY KEY);
INSERT INTO #p(code) VALUES
 ('PU_REQ'),
 ('OTHER_IN'), ('OTHER_IN_DETAIL'), ('OTHER_IN_STATS'),
 ('OTHER_OUT'), ('OTHER_OUT_DETAIL'), ('OTHER_OUT_STATS'),
 ('OUTSOURCE_IN'), ('OUTSOURCE_IN_DETAIL'), ('OUTSOURCE_IN_STATS'),
 ('OUTSOURCE_ISSUE'), ('OUTSOURCE_ISSUE_DETAIL'), ('OUTSOURCE_ISSUE_STATS');
-- 面板名 / 字段标签(删行前先抓走,供译名清理用)
IF OBJECT_ID('tempdb..#names')  IS NOT NULL DROP TABLE #names;
IF OBJECT_ID('tempdb..#labels') IS NOT NULL DROP TABLE #labels;
SELECT DISTINCT panel_name AS name INTO #names FROM dbo.yj_panel WHERE panel_code IN (SELECT code FROM #p);
SELECT DISTINCT label      AS name INTO #labels FROM dbo.yj_field WHERE panel_code IN (SELECT code FROM #p);
DECLARE @np int = (SELECT COUNT(*) FROM #p), @nn int = (SELECT COUNT(*) FROM #names);
PRINT N'[清单] 待下架面板 ' + CAST(@np AS nvarchar(10)) + N' 个 / 面板名 ' + CAST(@nn AS nvarchar(10)) + N' 个';
GO
-- ═══ ① 安全闸:10 张表必须都是空表(下架口径「全部 0 行」),否则拒绝执行 ═══
SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#t') IS NOT NULL DROP TABLE #t;
CREATE TABLE #t (name sysname PRIMARY KEY);
INSERT INTO #t(name) VALUES
 ('bd_pu_req'),('bl_pu_req'),('bd_other_in'),('bl_other_in'),('bd_other_out'),('bl_other_out'),
 ('bd_outsource_in'),('bl_outsource_in'),('bd_outsource_issue'),('bl_outsource_issue');
DECLARE @tb sysname, @sql nvarchar(300), @n int, @bad nvarchar(400) = N'';
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM #t;
OPEN cur; FETCH NEXT FROM cur INTO @tb;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(@tb) IS NOT NULL
  BEGIN
    SET @sql = N'SELECT @x = COUNT(*) FROM dbo.' + QUOTENAME(@tb);
    EXEC sp_executesql @sql, N'@x int OUTPUT', @n OUTPUT;
    IF @n > 0 SET @bad = @bad + @tb + N'(' + CAST(@n AS nvarchar(10)) + N' 行) ';
  END
  FETCH NEXT FROM cur INTO @tb;
END
CLOSE cur; DEALLOCATE cur;
IF @bad <> N''
  RAISERROR(N'[中止] 待删表非空,拒绝下架:%s —— 请先确认这些单据是不是真的不要了', 16, 1, @bad);
ELSE
  PRINT N'[安全闸] 10 张待删表均为空表,可下架';
GO
-- ═══ ② 生单链路占用行 ═══
DELETE FROM dbo.form_flow_link
 WHERE source_panel_code IN (SELECT code FROM #p) OR target_panel_code IN (SELECT code FROM #p);
PRINT N'[删] form_flow_link ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ═══ ③ 角色授权 ═══
DELETE FROM dbo.yj_role_panel WHERE panel_code IN (SELECT code FROM #p);
PRINT N'[删] yj_role_panel ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ═══ ④ 字段登记 ═══
DELETE FROM dbo.yj_field WHERE panel_code IN (SELECT code FROM #p);
PRINT N'[删] yj_field ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ═══ ⑤ 面板登记 ═══
DELETE FROM dbo.yj_panel WHERE panel_code IN (SELECT code FROM #p);
PRINT N'[删] yj_panel ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ═══ ⑥ 译名:① 面板名(仅当已无任何面板同名)② 孤儿字段标签(仅当已无任何字段行用它)═══
DELETE t FROM dbo.yj_translation t
 WHERE t.scope = 'panel'
   AND t.ref_key IN (SELECT name FROM #names)
   AND NOT EXISTS (SELECT 1 FROM dbo.yj_panel p WHERE p.panel_name = t.ref_key);
PRINT N'[删] yj_translation(panel 名) ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
DELETE t FROM dbo.yj_translation t
 WHERE t.scope = 'field'
   AND t.ref_key IN (SELECT name FROM #labels)
   AND NOT EXISTS (SELECT 1 FROM dbo.yj_field f WHERE f.label = t.ref_key);
PRINT N'[删] yj_translation(孤儿字段标签) ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ═══ ⑦ 视图(8 个)═══
IF OBJECT_ID('dbo.v_other_in_detail','V')        IS NOT NULL DROP VIEW dbo.v_other_in_detail;
IF OBJECT_ID('dbo.v_other_in_stats','V')         IS NOT NULL DROP VIEW dbo.v_other_in_stats;
IF OBJECT_ID('dbo.v_other_out_detail','V')       IS NOT NULL DROP VIEW dbo.v_other_out_detail;
IF OBJECT_ID('dbo.v_other_out_stats','V')        IS NOT NULL DROP VIEW dbo.v_other_out_stats;
IF OBJECT_ID('dbo.v_outsource_in_detail','V')    IS NOT NULL DROP VIEW dbo.v_outsource_in_detail;
IF OBJECT_ID('dbo.v_outsource_in_stats','V')     IS NOT NULL DROP VIEW dbo.v_outsource_in_stats;
IF OBJECT_ID('dbo.v_outsource_issue_detail','V') IS NOT NULL DROP VIEW dbo.v_outsource_issue_detail;
IF OBJECT_ID('dbo.v_outsource_issue_stats','V')  IS NOT NULL DROP VIEW dbo.v_outsource_issue_stats;
PRINT N'[删] 8 个明细/统计视图(不存在则跳过)';
GO
-- ═══ ⑧ 物理表(10 张;行表先删,避免残留指向)═══
IF OBJECT_ID('dbo.bl_pu_req','U')              IS NOT NULL DROP TABLE dbo.bl_pu_req;
IF OBJECT_ID('dbo.bd_pu_req','U')              IS NOT NULL DROP TABLE dbo.bd_pu_req;
IF OBJECT_ID('dbo.bl_other_in','U')            IS NOT NULL DROP TABLE dbo.bl_other_in;
IF OBJECT_ID('dbo.bd_other_in','U')            IS NOT NULL DROP TABLE dbo.bd_other_in;
IF OBJECT_ID('dbo.bl_other_out','U')           IS NOT NULL DROP TABLE dbo.bl_other_out;
IF OBJECT_ID('dbo.bd_other_out','U')           IS NOT NULL DROP TABLE dbo.bd_other_out;
IF OBJECT_ID('dbo.bl_outsource_in','U')        IS NOT NULL DROP TABLE dbo.bl_outsource_in;
IF OBJECT_ID('dbo.bd_outsource_in','U')        IS NOT NULL DROP TABLE dbo.bd_outsource_in;
IF OBJECT_ID('dbo.bl_outsource_issue','U')     IS NOT NULL DROP TABLE dbo.bl_outsource_issue;
IF OBJECT_ID('dbo.bd_outsource_issue','U')     IS NOT NULL DROP TABLE dbo.bd_outsource_issue;
PRINT N'[删] 10 张物理表(不存在则跳过)';
GO
-- ═══ ⑨ 自检(期望值写在「值」列;越界口径:不该没的一张都不能少)═══
SELECT N'yj_panel 残留(期望 0)' AS 检查项, COUNT(*) AS 值 FROM dbo.yj_panel WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'yj_field 残留(期望 0)', COUNT(*) FROM dbo.yj_field WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'yj_role_panel 残留(期望 0)', COUNT(*) FROM dbo.yj_role_panel WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'视图残留(期望 0)', COUNT(*) FROM sys.objects WHERE name IN
        ('v_other_in_detail','v_other_in_stats','v_other_out_detail','v_other_out_stats',
         'v_outsource_in_detail','v_outsource_in_stats','v_outsource_issue_detail','v_outsource_issue_stats')
UNION ALL SELECT N'物理表残留(期望 0)', COUNT(*) FROM sys.objects WHERE name IN
        ('bd_pu_req','bl_pu_req','bd_other_in','bl_other_in','bd_other_out','bl_other_out',
         'bd_outsource_in','bl_outsource_in','bd_outsource_issue','bl_outsource_issue')
UNION ALL SELECT N'保留的 6 张出入库/委外单据面板(期望 6)', COUNT(*) FROM dbo.yj_panel
        WHERE panel_code IN ('PURCHASE_IN','SALE_OUT','MATERIAL_OUT','FINISH_IN','OUTSOURCE_ORDER','PU_ORDER')
UNION ALL SELECT N'库存三报表仍在(期望 3)', COUNT(*) FROM dbo.yj_panel
        WHERE panel_code IN ('STOCK_BALANCE','STOCK_SUMMARY','STOCK_LEDGER')
UNION ALL SELECT N'面板总数(应 = 下架前 141 − 13 = 128)', COUNT(*) FROM dbo.yj_panel
UNION ALL SELECT N'字段总数(参考:正式库下架前 3970 − 258 = 3712)', COUNT(*) FROM dbo.yj_field
UNION ALL SELECT N'悬空 panel 引用的字段(期望 0)', COUNT(*) FROM dbo.yj_field f
        WHERE f.ref_panel IS NOT NULL AND f.ref_panel <> '' AND NOT EXISTS (SELECT 1 FROM dbo.yj_panel p WHERE p.panel_code = f.ref_panel)
UNION ALL SELECT N'指向不存在表的面板(期望 0)', COUNT(*) FROM dbo.yj_panel p
        WHERE (p.line_table IS NOT NULL AND p.line_table <> '' AND OBJECT_ID(p.line_table) IS NULL)
           OR (p.head_table IS NOT NULL AND p.head_table <> '' AND OBJECT_ID(p.head_table) IS NULL);
GO
