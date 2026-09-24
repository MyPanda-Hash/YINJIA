-- migrate-schedule-capacity.sql — 产线产能设定 + 待产/完工口径(2026-09-22,对齐用户流程图 ⑤⑦)
-- 背景(用户流程图):⑤「产能依据:先设定各产线产能,系统提供各产线排产柱状图参考」;
--   ⑦「待产/完工合并一个界面:需求量/开产量/完成量,支持按条件查询导出」。
-- 本轮落地:
--   ①新建 **bs_line_capacity 产线产能**(生产线=排产时指派的生产线名,可含车间/日产能/小时产能),
--     带中文表注明与列注明、生产线唯一索引;产能是"设定值",与排产负荷比对出"是否超载"。
--   ②重建 v_manu_schedule:补 **开产量** 与 **生产状态**。
--     开产量口径:首道"有报工"的工序完成数量(混料→成型→切炭→组装→装箱),即该单已实际开工的数量;
--     生产状态:完工(入库数量≥排产数量且排产>0)/ 在产(开产量>0)/ 待产(已指派产线或车间)/ 未排产。
--   ③MANU_SCHEDULE 面板登记 开产量 / 生产状态 + en 译名。
-- 幂等:OBJECT_ID / IF NOT EXISTS / 视图先删后建,可重复执行。
SET NOCOUNT ON;

-- ① 产线产能设定表
IF OBJECT_ID('bs_line_capacity') IS NULL
CREATE TABLE bs_line_capacity (
  id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
  [生产线] nvarchar(100) NOT NULL,
  [生产车间] nvarchar(100) NULL,
  [日产能] decimal(18,4) NULL,
  [小时产能] decimal(18,4) NULL,
  [排序] int NULL,
  [备注] nvarchar(200) NULL,
  [asp_user1] nvarchar(50) NULL,
  [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL,
  [asp_time2] datetime2 NULL,
  [asp_cancel] char(1) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ux_bs_line_capacity_line' AND object_id=OBJECT_ID('bs_line_capacity'))
  CREATE UNIQUE INDEX ux_bs_line_capacity_line ON bs_line_capacity([生产线]);

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('bs_line_capacity') AND ep.minor_id=0 AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'产线产能设定(排产依据:生产线维度的日产能/小时产能;排产柱状图按此判定是否超载)',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_line_capacity';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('bs_line_capacity') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID('bs_line_capacity'),N'生产线','ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'生产线(排产时指派的生产线名,如 成型1线;唯一)',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_line_capacity', N'COLUMN', N'生产线';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('bs_line_capacity') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID('bs_line_capacity'),N'日产能','ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'日产能(该产线每日可完成数量,排产负荷>日产能 记超载)',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_line_capacity', N'COLUMN', N'日产能';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('bs_line_capacity') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID('bs_line_capacity'),N'小时产能','ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'小时产能(该产线每小时可完成数量,产能/小时;与 工序工时 gxgs 口径互补)',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_line_capacity', N'COLUMN', N'小时产能';

-- ② 重建排产视图:补 开产量 / 生产状态
IF OBJECT_ID('v_manu_schedule','V') IS NOT NULL DROP VIEW v_manu_schedule;
GO
CREATE VIEW v_manu_schedule AS
SELECT x.*,
       -- 开产量 = 首道有报工的工序完成数量(混料→成型→切炭→组装→装箱):该单已实际开工的数量
       CASE WHEN x.[混料完成] > 0 THEN x.[混料完成]
            WHEN x.[成型完成] > 0 THEN x.[成型完成]
            WHEN x.[切炭完成] > 0 THEN x.[切炭完成]
            WHEN x.[组装完成] > 0 THEN x.[组装完成]
            ELSE x.[装箱完成] END AS 开产量,
       CASE WHEN ISNULL(x.[排产数量],0) > 0 AND ISNULL(x.[入库数量],0) >= ISNULL(x.[排产数量],0) THEN N'完工'
            WHEN (CASE WHEN x.[混料完成] > 0 THEN x.[混料完成]
                       WHEN x.[成型完成] > 0 THEN x.[成型完成]
                       WHEN x.[切炭完成] > 0 THEN x.[切炭完成]
                       WHEN x.[组装完成] > 0 THEN x.[组装完成]
                       ELSE x.[装箱完成] END) > 0 THEN N'在产'
            WHEN ISNULL(x.[生产线],N'') <> N'' OR ISNULL(x.[生产车间],N'') <> N'' THEN N'待产'
            ELSE N'未排产' END AS 生产状态
FROM (
SELECT l.id AS id, h.[合同号] AS 加工单号, h.[单据日期] AS 单据日期, h.[销售订单号] AS 销售订单号,
       h.[客户] AS 客户, ISNULL(pt.[客户价格等级], N'') AS 客户等级,
       h.[生产线] AS 生产线, h.[生产车间] AS 生产车间,
       ISNULL(h.[重点管控], N'否') AS 重点管控,
       ISNULL(wc.[产量/小时], 0) AS [产能/小时],
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
LEFT JOIN dbo.bs_inv iv ON iv.[存货编码] = l.[产品编码]
LEFT JOIN dbo.bs_wc wc ON wc.[工作中心名称] = h.[生产车间] OR wc.[工作中心编码] = h.[生产车间]
LEFT JOIN dbo.bl_so_order so ON so.[单据编号] = h.[销售订单号] AND so.[存货编码] = l.[产品编码]
WHERE ISNULL(h.asp_cancel,'N') <> 'Y'
) x;
GO

-- ③ 面板登记 + en 译名
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'开产量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'开产量',N'开产量',N'小数',N'query,detail',150,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'生产状态') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'生产状态',N'生产状态',N'文本',N'query,detail',45,90,0,0,0,1);

INSERT INTO yj_translation (scope,ref_key,locale,text,source)
SELECT N'field', v.k, 'en', v.t, 'manual'
FROM (VALUES (N'开产量', N'Started Qty'), (N'生产状态', N'Production Status'), (N'产线产能', N'Line Capacity'),
             (N'日产能', N'Daily Capacity'), (N'小时产能', N'Hourly Capacity')) AS v(k,t)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope=N'field' AND x.ref_key=v.k AND x.locale='en');
INSERT INTO yj_translation (scope,ref_key,locale,text,source)
SELECT N'panel', N'产线产能', 'en', N'Line Capacity', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope=N'panel' AND x.ref_key=N'产线产能' AND x.locale='en');

SELECT N'bs_line_capacity 表' AS 检查, COUNT(*) AS 数量 FROM sys.tables WHERE name='bs_line_capacity'
UNION ALL SELECT N'v_manu_schedule 列', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('v_manu_schedule')
UNION ALL SELECT N'新增视图列(开产量/生产状态)', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('v_manu_schedule') AND name IN (N'开产量',N'生产状态')
UNION ALL SELECT N'MANU_SCHEDULE 新字段', COUNT(*) FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name IN (N'开产量',N'生产状态');
PRINT N'migrate-schedule-capacity 完成';
GO
