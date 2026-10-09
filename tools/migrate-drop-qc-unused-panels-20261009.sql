-- migrate-drop-qc-unused-panels-20261009.sql — 下架品质管理「制程品质 / 不良处理 / 品质追溯」5 张从未使用的面板
--
-- 用户口径(2026-10-09):「品质管理下的制程品质、不良处理与品质追溯都是没有用到的吧」→ 确认后**连批号追溯一起删**。
--
-- ══════ 逐个列明删了什么(便于日后追溯)══════
--   面板 5 个:QC_OP 工序质检单 / QC_RECORD 检验记录单 / QC_DISPOSAL 不良品处理单 /
--             ROD_RETURN 炭棒不良退货登记 / LOT_TRACE 批号追溯
--   yj_field       77 行(15+19+15+11+17)
--   yj_role_panel  20 行(5 × 4 个角色)
--   yj_translation 0 行(这 5 张面板名**本来就没有译名** —— 也是 DbNormAudit 第 09 项「缺 en 译名」的存量之一;
--                  字段标签侧无孤儿标签,故无译名可删)
--   视图 1 个:v_lot_trace(批号追溯;八事件 UNION 时间线,222 行)
--   物理表 7 张:qc_op / qc_op_detail / qc_record / qc_record_detail / qc_disposal /
--               rod_return / rod_return_detail(**全部 0 行**)
--
-- ══════ 依据(2026-10-09 实测,证据见 tools/archive/_panel-age/)══════
--   · **从未使用**:这 5 张面板在 yj_usage_log(3437 行、记录到面板级动作:送料暂收单 644、采购入库单 582、
--     来料检验单 402…)里 **操作留痕 = 0**;7 张表 **0 行**、yj_doc_status **0 行**、单据状态 0;
--     ⇒ 建好之后一张单都没录过(录单/审核/弃审必然留痕)。
--     (LOT_TRACE 是只读报表、本不写动作日志,但用户已确认「按批号查料」这个能力也不要了。)
--   · 依赖:DB 侧只有 v_lot_trace 自己的定义引用 qc_op/qc_disposal(视图本次一并删,故无悬空);
--     无外键、无 yj_field.ref_panel 引用、无生单链路、无附件/审批/列设置/批号表/修改日志/归档日志(全 0);
--     后端有专属服务 QcDisposalService(111 行,审核时按 原仓→隔离仓/不良品仓 移仓、报废只扣不入)——
--     随本脚本同批删除,并摘掉 ButtonService 里的两处钩子调用。
--   · 回退抓手:tools/archive/_panel-age/_backup-20261009-qc/
--     (yj_panel/yj_field/yj_role_panel CSV + restore-metadata.sql + views.sql 视图定义 + tables-ddl.sql 表结构骨架)
--   · ⚠ 影响声明:v_lot_trace 的八事件里「工序质检(qc_op)」「不良处置(qc_disposal)」两段随之消失
--     (这两段本来也是 0 行 —— 少的是能力不是数据);批号追溯面板整体下线。
--
-- 幂等:每步带存在性守卫,重跑为 no-op。
-- 两账套都要执行(先正式、后测试):
--   正式 tools> java -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-qc-unused-panels-20261009.sql
--   测试 tools> set YINJIA_SQL_DB=HSDZ_MES_TEST && java -cp lib\mssql-jdbc.jar DbSync.java run migrate-drop-qc-unused-panels-20261009.sql
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库时不得被切走)
GO
PRINT N'[库] ' + DB_NAME() + N' — 下架 制程品质/不良处理/品质追溯 5 张面板(含批号追溯)';
GO
-- ═══ 清单(临时表跨批可用)═══
IF OBJECT_ID('tempdb..#p') IS NOT NULL DROP TABLE #p;
CREATE TABLE #p (code varchar(40) PRIMARY KEY);
INSERT INTO #p(code) VALUES ('QC_OP'), ('QC_RECORD'), ('QC_DISPOSAL'), ('ROD_RETURN'), ('LOT_TRACE');
IF OBJECT_ID('tempdb..#names')  IS NOT NULL DROP TABLE #names;
IF OBJECT_ID('tempdb..#labels') IS NOT NULL DROP TABLE #labels;
SELECT DISTINCT panel_name AS name INTO #names  FROM dbo.yj_panel WHERE panel_code IN (SELECT code FROM #p);
SELECT DISTINCT label      AS name INTO #labels FROM dbo.yj_field WHERE panel_code IN (SELECT code FROM #p);
DECLARE @np int = (SELECT COUNT(*) FROM #p), @nf int = (SELECT COUNT(*) FROM #labels);
PRINT N'[清单] 面板 ' + CAST(@np AS nvarchar(10)) + N' 个 / 字段标签 ' + CAST(@nf AS nvarchar(10)) + N' 个';
GO
-- ═══ ① 安全闸:7 张待删表必须都是空表(下架口径「0 行」),否则拒绝执行 ═══
SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#t') IS NOT NULL DROP TABLE #t;
CREATE TABLE #t (name sysname PRIMARY KEY);
INSERT INTO #t(name) VALUES ('qc_op'),('qc_op_detail'),('qc_record'),('qc_record_detail'),
 ('qc_disposal'),('rod_return'),('rod_return_detail');
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
  PRINT N'[安全闸] 7 张待删表均为空表,可下架';
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
-- ═══ ⑥ 译名(面板名:仅当已无任何面板同名;字段标签:仅当已无任何字段行用它)═══
DELETE t FROM dbo.yj_translation t
 WHERE t.scope = 'panel' AND t.ref_key IN (SELECT name FROM #names)
   AND NOT EXISTS (SELECT 1 FROM dbo.yj_panel p WHERE p.panel_name = t.ref_key);
PRINT N'[删] yj_translation(panel 名) ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
DELETE t FROM dbo.yj_translation t
 WHERE t.scope = 'field' AND t.ref_key IN (SELECT name FROM #labels)
   AND NOT EXISTS (SELECT 1 FROM dbo.yj_field f WHERE f.label = t.ref_key);
PRINT N'[删] yj_translation(孤儿字段标签) ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
-- ═══ ⑦ 视图(先删视图:它的定义引用了 qc_op / qc_disposal,留着会成悬空)═══
IF OBJECT_ID('dbo.v_lot_trace','V') IS NOT NULL DROP VIEW dbo.v_lot_trace;
PRINT N'[删] 视图 v_lot_trace(不存在则跳过)';
GO
-- ═══ ⑧ 物理表(7 张;行表先删)═══
IF OBJECT_ID('dbo.qc_op_detail','U')     IS NOT NULL DROP TABLE dbo.qc_op_detail;
IF OBJECT_ID('dbo.qc_op','U')            IS NOT NULL DROP TABLE dbo.qc_op;
IF OBJECT_ID('dbo.qc_record_detail','U') IS NOT NULL DROP TABLE dbo.qc_record_detail;
IF OBJECT_ID('dbo.qc_record','U')        IS NOT NULL DROP TABLE dbo.qc_record;
IF OBJECT_ID('dbo.qc_disposal','U')      IS NOT NULL DROP TABLE dbo.qc_disposal;
IF OBJECT_ID('dbo.rod_return_detail','U') IS NOT NULL DROP TABLE dbo.rod_return_detail;
IF OBJECT_ID('dbo.rod_return','U')       IS NOT NULL DROP TABLE dbo.rod_return;
PRINT N'[删] 7 张物理表(不存在则跳过)';
GO
-- ═══ ⑨ 自检(期望值写在「值」列)═══
SELECT N'yj_panel 残留(期望 0)' AS 检查项, COUNT(*) AS 值 FROM dbo.yj_panel WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'yj_field 残留(期望 0)', COUNT(*) FROM dbo.yj_field WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'yj_role_panel 残留(期望 0)', COUNT(*) FROM dbo.yj_role_panel WHERE panel_code IN (SELECT code FROM #p)
UNION ALL SELECT N'物理对象残留(期望 0)', COUNT(*) FROM sys.objects WHERE name IN
        ('qc_op','qc_op_detail','qc_record','qc_record_detail','qc_disposal','rod_return','rod_return_detail','v_lot_trace')
UNION ALL SELECT N'保留的品质面板(期望 12)', COUNT(*) FROM dbo.yj_panel
        WHERE panel_code IN ('QC_INSP','QC_TC_IN','QC_CATALOG','QC_INSP_REC','QC_INSP_REQ','QC_INSP_REQ_SERIES',
                             'QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY')
UNION ALL SELECT N'库存三报表仍在(期望 3)', COUNT(*) FROM dbo.yj_panel
        WHERE panel_code IN ('STOCK_BALANCE','STOCK_SUMMARY','STOCK_LEDGER')
UNION ALL SELECT N'面板总数(应 = 128 − 5 = 123)', COUNT(*) FROM dbo.yj_panel
UNION ALL SELECT N'字段总数(应 = 3712 − 77 = 3635)', COUNT(*) FROM dbo.yj_field
UNION ALL SELECT N'悬空 panel 引用的字段(期望 0)', COUNT(*) FROM dbo.yj_field f
        WHERE f.ref_panel IS NOT NULL AND f.ref_panel <> '' AND NOT EXISTS (SELECT 1 FROM dbo.yj_panel p WHERE p.panel_code = f.ref_panel)
UNION ALL SELECT N'指向不存在表/视图的面板(期望 0)', COUNT(*) FROM dbo.yj_panel p
        WHERE (p.line_table IS NOT NULL AND p.line_table <> '' AND OBJECT_ID(p.line_table) IS NULL)
           OR (p.head_table IS NOT NULL AND p.head_table <> '' AND OBJECT_ID(p.head_table) IS NULL)
UNION ALL SELECT N'仍有对象引用被删表(期望 0)', COUNT(*) FROM sys.sql_modules m
        WHERE m.definition LIKE N'%qc_op%' OR m.definition LIKE N'%qc_record%'
           OR m.definition LIKE N'%qc_disposal%' OR m.definition LIKE N'%rod_return%';
GO
