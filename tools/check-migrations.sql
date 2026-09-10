/* ============================================================
   YINJIA-MES 迁移到位自查(在目标库 HSDZ_MES 上执行,只读不写)
   用途:部署/换包后确认"代码依赖的对象"是否都已在库里 —— 逐项打印 期望/实际/状态。
   执行:sqlcmd -S localhost -d HSDZ_MES -E -f 65001 -i tools\check-migrations.sql
   判读:出现任何「缺失」行,就在 tools 目录执行对应脚本强制补跑:
         java -cp lib\mssql-jdbc.jar DbSync.java run <脚本名>
   ============================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

DECLARE @r TABLE (seq int IDENTITY(1,1), item nvarchar(120), expect nvarchar(60), actual nvarchar(60), ok bit);
DECLARE @n int;

-- ① 项目实施计划阶段字段(migrate-rd-plan-stages.sql)
SELECT @n = COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('rd_plan') AND name LIKE N'阶段%';
INSERT INTO @r (item, expect, actual, ok) VALUES (N'rd_plan 阶段列(阶段1..10 × 5 + 旧阶段N)', N'>=50', CAST(@n AS nvarchar(10)), CASE WHEN @n >= 50 THEN 1 ELSE 0 END);

SELECT @n = COUNT(*) FROM yj_field WHERE panel_code = 'RD_PLAN' AND col_name LIKE N'阶段%[_]%';
INSERT INTO @r (item, expect, actual, ok) VALUES (N'yj_field RD_PLAN 阶段字段', N'>=50', CAST(@n AS nvarchar(10)), CASE WHEN @n >= 50 THEN 1 ELSE 0 END);

-- ② 辅助材料台账/仓库列(migrate-aux-stock.sql / migrate-aux-line-wh.sql)
SELECT @n = COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('bl_other_in') AND name IN (N'存货编码', N'批号');
INSERT INTO @r (item, expect, actual, ok) VALUES (N'bl_other_in.存货编码/批号', N'2', CAST(@n AS nvarchar(10)), CASE WHEN @n = 2 THEN 1 ELSE 0 END);

SELECT @n = COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('bl_outsource_in') AND name = N'仓库';
INSERT INTO @r (item, expect, actual, ok) VALUES (N'bl_outsource_in.仓库', N'1', CAST(@n AS nvarchar(10)), CASE WHEN @n = 1 THEN 1 ELSE 0 END);

-- ③ 批次/切炭双出口(migrate-product-lot-dualout.sql)
SELECT @n = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('wo_order') AND name = N'产品批号')
         + (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('wo_report') AND name = N'直销数量');
INSERT INTO @r (item, expect, actual, ok) VALUES (N'wo_order.产品批号 + wo_report.直销数量', N'2', CAST(@n AS nvarchar(10)), CASE WHEN @n = 2 THEN 1 ELSE 0 END);

-- ④ 生产相关明细表(migrate-prod-forms*.sql)
SELECT @n = COUNT(*) FROM sys.tables WHERE name IN ('gran_record_detail', 'wh_record_detail', 'pack_confirm_detail', 'rod_return_detail');
INSERT INTO @r (item, expect, actual, ok) VALUES (N'生产明细表(gran/wh/pack/rod_return)', N'4', CAST(@n AS nvarchar(10)), CASE WHEN @n = 4 THEN 1 ELSE 0 END);

SELECT @n = COUNT(*) FROM yj_field WHERE panel_code IN ('QC_RECORD', 'DAY_REPORT', 'KHDD', 'SAMPLE_REQ');
INSERT INTO @r (item, expect, actual, ok) VALUES (N'生产面板字段(QC_RECORD/DAY_REPORT/KHDD/SAMPLE_REQ)', N'>=40', CAST(@n AS nvarchar(10)), CASE WHEN @n >= 40 THEN 1 ELSE 0 END);

-- ⑤ 报表视图(migrate-view-id.sql / migrate-view-ascancel.sql)
SELECT @n = COUNT(*) FROM sys.views WHERE name IN ('v_wo_schedule', 'v_wo_kit', 'v_lot_trace');
INSERT INTO @r (item, expect, actual, ok) VALUES (N'视图 v_wo_schedule/v_wo_kit/v_lot_trace', N'3', CAST(@n AS nvarchar(10)), CASE WHEN @n = 3 THEN 1 ELSE 0 END);

SELECT @n = COUNT(*) FROM sys.sql_modules m JOIN sys.views v ON v.object_id = m.object_id
  WHERE v.name IN ('v_wo_schedule', 'v_wo_kit', 'v_lot_trace') AND m.definition LIKE '%asp_cancel%';
INSERT INTO @r (item, expect, actual, ok) VALUES (N'上述视图含 asp_cancel 列', N'3', CAST(@n AS nvarchar(10)), CASE WHEN @n = 3 THEN 1 ELSE 0 END);

-- ⑥ 数据记录表/实施计划「文档编号」参照立项申请(migrate-rd-docno-ref.sql / migrate-rd-plan-docno-ref.sql)
SELECT @n = COUNT(*) FROM yj_field
  WHERE col_name = N'文档编号' AND ref_panel = 'RD_APPROVAL' AND ref_field = N'文档编号' AND ISNULL(hidden, 0) = 0 AND required = 1;
INSERT INTO @r (item, expect, actual, ok) VALUES (N'文档编号→参照立项申请(9 面板:8 记录表+实施计划)', N'9', CAST(@n AS nvarchar(10)), CASE WHEN @n = 9 THEN 1 ELSE 0 END);

SELECT @n = COUNT(*) FROM yj_field WHERE panel_code = 'RD_APPROVAL' AND col_name = N'文档编号' AND ISNULL(hidden, 0) = 0 AND required = 1;
INSERT INTO @r (item, expect, actual, ok) VALUES (N'RD_APPROVAL 文档编号 可见+必填', N'1', CAST(@n AS nvarchar(10)), CASE WHEN @n = 1 THEN 1 ELSE 0 END);

SELECT @n = COUNT(*) FROM sys.default_constraints dc JOIN sys.columns c
    ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  WHERE c.name = N'文档编号' AND OBJECT_NAME(dc.parent_object_id) IN
        ('rd_approval', 'rd_plan', 'rd_filter_eff_head', 'rd_alkaline_head', 'rd_mineral_head',
         'rd_antibact_head', 'rd_scale_head', 'rd_ro_protect_head', 'rd_soak_head', 'rd_drop_prec_head');
INSERT INTO @r (item, expect, actual, ok) VALUES (N'立项申请+实施计划+8 记录表 文档编号默认值已删', N'0', CAST(@n AS nvarchar(10)), CASE WHEN @n = 0 THEN 1 ELSE 0 END);

-- ⑦ 项目档案客户参照改名称口径(fix-proj-customer-ref.sql)
SELECT @n = COUNT(*) FROM yj_field WHERE panel_code = 'PROJ' AND col_name = N'客户' AND ref_field = N'mc';
INSERT INTO @r (item, expect, actual, ok) VALUES (N'PROJ.客户 参照改 mc(名称)', N'1', CAST(@n AS nvarchar(10)), CASE WHEN @n = 1 THEN 1 ELSE 0 END);

-- ⑧ 基础:账号/面板/字段总量(过小说明库是旧的或空库)
SELECT @n = COUNT(*) FROM yj_user;
INSERT INTO @r (item, expect, actual, ok) VALUES (N'账号 yj_user 行数', N'>=1', CAST(@n AS nvarchar(10)), CASE WHEN @n >= 1 THEN 1 ELSE 0 END);

SELECT @n = COUNT(*) FROM yj_panel;
INSERT INTO @r (item, expect, actual, ok) VALUES (N'面板 yj_panel 行数', N'>=120', CAST(@n AS nvarchar(10)), CASE WHEN @n >= 120 THEN 1 ELSE 0 END);

SELECT @n = COUNT(*) FROM yj_field;
INSERT INTO @r (item, expect, actual, ok) VALUES (N'字段 yj_field 行数', N'>=2000', CAST(@n AS nvarchar(10)), CASE WHEN @n >= 2000 THEN 1 ELSE 0 END);

SELECT item AS 检查项, expect AS 期望, actual AS 实际, CASE WHEN ok = 1 THEN N'✓ 到位' ELSE N'✗ 缺失' END AS 状态 FROM @r ORDER BY seq;

DECLARE @bad int = (SELECT COUNT(*) FROM @r WHERE ok = 0);
IF @bad > 0 PRINT N'=== 有 ' + CAST(@bad AS nvarchar(10)) + N' 项缺失:按上表逐项 DbSync run 对应脚本 ==='
ELSE PRINT N'=== 全部到位:库与当前代码同版 ===';
