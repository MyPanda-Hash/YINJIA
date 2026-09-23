-- migrate-wo-report-upgrade.sql — 工序报工单升级(对照参考库 scjl,2026-09-23 用户拍板执行)
-- 依据:docs/design/工序报工表-scjl-修改底稿.md。
-- ①wo_report 删旧状态三件套(真源 yj_doc_status,同加工单口径)+加 批号/生产线/入库单号(scjl 对齐:批次快照/产线/入库回执);
-- ②面板字段:注销3+注册3+工序下拉五道(混料/成型/切炭/组装/装箱)+生产线下拉=启用档案;
-- ③v_manu_schedule 重建加「已报工」列(五道完成数 MAX;SQL Server 2019 无 GREATEST 用 VALUES MAX);
--   报工扣减口径(链路):未交量 = 排产数量 − CASE WHEN 入库≥已报工 THEN 入库 ELSE 已报工 END(取大防双扣,Service 层)。
-- 幂等:IF COL_LENGTH/IF NOT EXISTS/视图先删后建。依赖:migrate-manu-prune-legacy.sql(v_manu_schedule 基线)。
SET NOCOUNT ON;

-- ① wo_report 删列(单据状态带默认约束先删)
IF EXISTS (SELECT 1 FROM sys.default_constraints dc JOIN sys.columns c
           ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
           WHERE dc.parent_object_id = OBJECT_ID('wo_report') AND c.name = N'单据状态')
  ALTER TABLE wo_report DROP CONSTRAINT [DF__wo_report__单据状态__66642E18];
GO
IF COL_LENGTH('wo_report', N'单据状态') IS NOT NULL ALTER TABLE wo_report DROP COLUMN [单据状态];
GO
IF COL_LENGTH('wo_report', N'审核人') IS NOT NULL ALTER TABLE wo_report DROP COLUMN [审核人];
GO
IF COL_LENGTH('wo_report', N'审核时间') IS NOT NULL ALTER TABLE wo_report DROP COLUMN [审核时间];
GO

-- ① wo_report 加列(scjl: lot_no 批号 / scx 产线 / post_no 入库单号)
IF COL_LENGTH('wo_report', N'批号') IS NULL ALTER TABLE wo_report ADD [批号] nvarchar(60) NULL;
IF COL_LENGTH('wo_report', N'生产线') IS NULL ALTER TABLE wo_report ADD [生产线] nvarchar(100) NULL;
IF COL_LENGTH('wo_report', N'入库单号') IS NULL ALTER TABLE wo_report ADD [入库单号] nvarchar(60) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('wo_report') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID('wo_report'),N'批号','ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'报工批次快照(参照带入工单头.批号,可改;扫码按批追溯锚点,参考库 scjl.lot_no)',
       N'SCHEMA', N'dbo', N'TABLE', N'wo_report', N'COLUMN', N'批号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('wo_report') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID('wo_report'),N'生产线','ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'报工产线(下拉=启用产线档案,默认带入工单指派线;参考库 scjl.scx)',
       N'SCHEMA', N'dbo', N'TABLE', N'wo_report', N'COLUMN', N'生产线';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('wo_report') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID('wo_report'),N'入库单号','ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'自动入库回执回填(切炭直销双出口生成成品入库后回写;参考库 scjl.post_no)',
       N'SCHEMA', N'dbo', N'TABLE', N'wo_report', N'COLUMN', N'入库单号';
GO

-- ② 面板字段:注销旧状态三件套(列表状态列由引擎从 yj_doc_status 附加,展示不受影响)
DELETE FROM yj_field WHERE panel_code = N'WO_REPORT' AND col_name IN (N'单据状态', N'审核人', N'审核时间');
GO

-- ② 面板字段:注册新列(批号/生产线可编辑;入库单号只读回执)+工序列补五道下拉+生产线下拉=启用档案
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'批号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WO_REPORT', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 55, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'生产线')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WO_REPORT', N'生产线', N'生产线', N'文本',
          N'SELECT [生产线] FROM bs_prod_line WHERE ISNULL(asp_cancel,''N'')<>''Y'' AND ISNULL(停用,0)=0 ORDER BY ISNULL(排序,999),[生产线]',
          NULL, NULL, NULL, N'query,header', 56, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'入库单号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WO_REPORT', N'入库单号', N'入库单号', N'文本', NULL, NULL, NULL, NULL, N'header', 57, 140, 0, 0, 0, 1);
-- 工序下拉:五道(VALUES 常量,BOM.计量单位 同款样例)
UPDATE yj_field SET dict_sql = N'SELECT v FROM (VALUES (N''混料''),(N''成型''),(N''切炭''),(N''组装''),(N''装箱'')) AS t(v)'
WHERE panel_code = 'WO_REPORT' AND col_name = N'工序' AND (dict_sql IS NULL OR dict_sql = N'');
GO

-- ③ v_manu_schedule 重建:prune 基线 + 「已报工」列(五道完成数取 MAX;报工扣减链路的数据源)
IF OBJECT_ID('v_manu_schedule','V') IS NOT NULL DROP VIEW v_manu_schedule;
GO
CREATE VIEW v_manu_schedule AS
SELECT x.*,
       CASE WHEN x.[混料完成] > 0 THEN x.[混料完成]
            WHEN x.[成型完成] > 0 THEN x.[成型完成]
            WHEN x.[切炭完成] > 0 THEN x.[切炭完成]
            WHEN x.[组装完成] > 0 THEN x.[组装完成]
            ELSE x.[装箱完成] END AS 开产量,
       (SELECT MAX(v) FROM (VALUES (x.[混料完成]), (x.[成型完成]), (x.[切炭完成]), (x.[组装完成]), (x.[装箱完成])) AS t(v)) AS 已报工,
       CASE WHEN ISNULL(x.[排产数量],0) > 0 AND ISNULL(x.[入库数量],0) >= ISNULL(x.[排产数量],0) THEN N'完工'
            WHEN (CASE WHEN x.[混料完成] > 0 THEN x.[混料完成]
                       WHEN x.[成型完成] > 0 THEN x.[成型完成]
                       WHEN x.[切炭完成] > 0 THEN x.[切炭完成]
                       WHEN x.[组装完成] > 0 THEN x.[组装完成]
                       ELSE x.[装箱完成] END) > 0 THEN N'在产'
            WHEN ISNULL(x.[生产线],N'') <> N'' THEN N'待产'
            ELSE N'未排产' END AS 生产状态
FROM (
SELECT l.id AS id, h.[合同号] AS 加工单号, h.[单据日期] AS 单据日期, h.[销售订单号] AS 销售订单号,
       h.[客户] AS 客户, ISNULL(pt.[客户价格等级], N'') AS 客户等级,
       h.[生产线] AS 生产线,
       ISNULL(h.[重点管控], N'否') AS 重点管控,
       ISNULL(pl.[小时产能], 0) AS [产能/小时],
       l.[产品编码] AS 产品编码, l.[产品名称] AS 产品名称,
       ISNULL(NULLIF(l.[规格型号], N''), iv.[规格型号]) AS 规格型号, l.[生产单位] AS 生产单位,
       l.[批号] AS 批号,
       ISNULL(so.[数量], 0) AS 销售订单数量,
       ISNULL(l.[需求数量], ISNULL(l.[数量], 0)) AS 需求数量,
       ISNULL(l.[数量], ISNULL(l.[排产数量], 0)) AS 生产订单数量,
       ISNULL(l.[排产数量], 0) AS 排产数量,
       ISNULL(l.[排产数量], 0) AS 生产计划数量,
       ISNULL(l.[每箱数量], 0) AS 每箱数量,
       CASE WHEN ISNULL(l.[每箱数量], 0) > 0
            THEN CAST(ISNULL(l.[排产数量], 0) / l.[每箱数量] AS decimal(18,2)) ELSE 0 END AS 箱数,
       COALESCE(h.[入库数量], ISNULL(l.[入库数量], 0)) AS 入库数量,
       COALESCE(h.[入库数量], ISNULL(l.[入库数量], 0)) AS 实际完成数量,
       ISNULL(l.[排产数量], 0) - COALESCE(h.[入库数量], ISNULL(l.[入库数量], 0)) AS 余量,
       CAST(h.[预开工日] AS date) AS 计划开工日,
       CAST(h.[预完工日] AS date) AS 交期,
       CAST(h.[预完工日] AS date) AS 工序交期,
       CASE WHEN h.[预完工日] IS NULL THEN NULL
            ELSE DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) END AS [交期紧迫度(天)],
       CASE WHEN h.[预完工日] IS NOT NULL AND DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) <= 7
            THEN ISNULL(l.[排产数量], 0) ELSE 0 END AS [7天已排产],
       CASE WHEN h.[预完工日] IS NOT NULL AND DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) BETWEEN 8 AND 15
            THEN ISNULL(l.[排产数量], 0) ELSE 0 END AS [15天已排产],
       CASE WHEN h.[预完工日] IS NOT NULL AND DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) > 15
            THEN ISNULL(l.[排产数量], 0) ELSE 0 END AS [大于15天],
       h.[结案] AS 结案,
       ISNULL(l.[排产数量], 0) AS 混料计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'混料' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 混料完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'混料' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 混料未完成,
       ISNULL(l.[排产数量], 0) AS 成型计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'成型' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 成型完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'成型' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 成型未完成,
       ISNULL(l.[排产数量], 0) AS 切炭计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'切炭' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 切炭完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'切炭' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 切炭未完成,
       ISNULL(l.[排产数量], 0) AS 组装计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'组装' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 组装完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'组装' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 组装未完成,
       ISNULL(l.[排产数量], 0) AS 装箱计划,
       ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'装箱' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 装箱完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'装箱' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 装箱未完成,
       ISNULL(l.[排产数量], 0) - ISNULL((SELECT SUM(p.[完成数量]) FROM dbo.wo_progress p WHERE p.[单据编号] = h.[合同号] AND p.[工序] = N'装箱' AND ISNULL(p.asp_cancel,'N') <> 'Y'), 0) AS 未完成数量,
       CASE WHEN ISNULL(st.canceled,'Y') = 'Y' THEN N'已作废'
            WHEN ISNULL(st.stopped,'N') = 'Y' THEN N'已中止'
            WHEN st.shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END AS 单据状态,
       ISNULL(h.[源工单号], N'') AS 源工单号,
       CAST(NULL AS char(1)) AS asp_cancel
FROM dbo.bd_manu_order h
JOIN dbo.bl_manu_order l ON l.[合同号] = h.[合同号] AND ISNULL(l.asp_cancel,'N') <> 'Y'
LEFT JOIN dbo.yj_doc_status st ON st.panel_code = 'MANU_ORDER' AND st.doc_no = h.[合同号]
LEFT JOIN dbo.bs_partner pt ON pt.[往来单位编码] = h.[客户编码] OR (ISNULL(h.[客户编码],N'') = N'' AND pt.[往来单位名称] = h.[客户])
LEFT JOIN dbo.bs_prod_line pl ON pl.[生产线] = h.[生产线] AND ISNULL(pl.asp_cancel,'N') <> 'Y'
LEFT JOIN dbo.bs_inv iv ON iv.[存货编码] = l.[产品编码]
LEFT JOIN dbo.bl_so_order so ON so.[单据编号] = h.[销售订单号] AND so.[存货编码] = l.[产品编码]
WHERE ISNULL(h.asp_cancel,'N') <> 'Y'
) x;
GO

-- 验证输出
SELECT N'wo_report 列数' AS 检查, COUNT(*) AS v FROM sys.columns WHERE object_id=OBJECT_ID('wo_report')
UNION ALL SELECT N'WO_REPORT 字段', COUNT(*) FROM yj_field WHERE panel_code=N'WO_REPORT'
UNION ALL SELECT N'v_manu_schedule 已报工列', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('v_manu_schedule') AND name=N'已报工';
PRINT N'migrate-wo-report-upgrade 完成';
GO
