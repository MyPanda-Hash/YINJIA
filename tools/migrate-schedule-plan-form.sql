-- migrate-schedule-plan-form.sql — 排单计划表(手写表)口径落地 + 快速排产改锚生产加工单(2026-09-22)
-- 依据:用户提供的《排单计划表格.xlsx》(订单排产计划,手写单据格式)与 V1.2 §8.1;
--   表格列 = 客户等级 | 客户名称 | 生产单号 | 产品编号 | 型号 | 是否重点管控产品 | 工序车间 |
--            销售订单数量 | 生产计划数量/实际完成数量 | 生产订单数量 | 工序交期 | 交期紧迫度 |
--            7天已排产 | 15天已排产 | 大于15天 | 逐日网格(P..BS);
--   表格行 = 订单主行 + 每道工序「计划 / 完成数 / 未完成数」三行(成型/切炭/组装/装箱…)。
-- 本轮落地:
--   ①bd_manu_order 补「重点管控」列(手写表「是否重点管控产品」的落点,排产时可勾,银嘉口径 是/否);
--   ②重建 v_manu_schedule:补 重点管控 / 生产订单数量 / 每箱数量 / 箱数,
--     并把五工序(混料·成型·切炭·组装·装箱)的「计划数量 / 未完成数量」显式成列
--     (完成数量自 migrate-manu-order-schedule 起已按 wo_progress 报工求和);
--     口径:切炭/组装/装箱计划 = 排产数量(手写表「等于订单数」),成型计划 = 排产数量
--     (手写表为「按工艺单上1切几折算」,1切几 未建档,暂等同,建档后单点替换),
--     未完成 = 计划 − 完成。
--   ③MANU_SCHEDULE(生产排产)面板登记上述新列 + en 译名。
-- 幂等:COL_LENGTH / IF NOT EXISTS / 视图先删后建,可重复执行。
SET NOCOUNT ON;

-- ① 加工单头:重点管控(是否重点管控产品)
IF COL_LENGTH('bd_manu_order', N'重点管控') IS NULL ALTER TABLE bd_manu_order ADD [重点管控] nvarchar(1) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID('bd_manu_order')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('bd_manu_order'), N'重点管控', 'ColumnId')
                 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'重点管控(排单计划表「是否重点管控产品」;是/否,排产时勾选,银嘉口径)',
       N'SCHEMA', N'dbo', N'TABLE', N'bd_manu_order', N'COLUMN', N'重点管控';

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'重点管控' AND place=N'header')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible)
  VALUES ('MANU_ORDER',N'重点管控',N'重点管控',N'文本',N'SELECT N''是'' AS 值 UNION ALL SELECT N''否''',NULL,NULL,NULL,N'query,header',70,90,1,0,0,1);

IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'重点管控' AND locale='en')
  INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'重点管控','en',N'Key Control','manual');

-- ② 重建排单计划视图(生产排产 / 快速排产 共用真源)
IF OBJECT_ID('v_manu_schedule','V') IS NOT NULL DROP VIEW v_manu_schedule;
GO
CREATE VIEW v_manu_schedule AS
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
       -- 入库/完成/余量:头级优先(ManuWritebackService 回写真源在 bd_manu_order.入库数量),行级兜底
       COALESCE(h.[入库数量], ISNULL(l.[入库数量], 0)) AS 入库数量,
       COALESCE(h.[入库数量], ISNULL(l.[入库数量], 0)) AS 实际完成数量,
       ISNULL(l.[排产数量], 0) - COALESCE(h.[入库数量], ISNULL(l.[入库数量], 0)) AS 余量,
       CAST(h.[预开工日] AS date) AS 计划开工日,
       CAST(h.[预完工日] AS date) AS 交期,
       CAST(h.[预完工日] AS date) AS 工序交期,
       CASE WHEN h.[预完工日] IS NULL THEN NULL
            ELSE DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) END AS [交期紧迫度(天)],
       -- 已排产分桶(交期≤7天 / 8~15天 / >15天;逾期归入首桶)
       CASE WHEN h.[预完工日] IS NOT NULL AND DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) <= 7
            THEN ISNULL(l.[排产数量], 0) ELSE 0 END AS [7天已排产],
       CASE WHEN h.[预完工日] IS NOT NULL AND DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) BETWEEN 8 AND 15
            THEN ISNULL(l.[排产数量], 0) ELSE 0 END AS [15天已排产],
       CASE WHEN h.[预完工日] IS NOT NULL AND DATEDIFF(day, CAST(GETDATE() AS date), CAST(h.[预完工日] AS date)) > 15
            THEN ISNULL(l.[排产数量], 0) ELSE 0 END AS [大于15天],
       h.[结案] AS 结案,
       -- 五工序(手写表每个工序「计划/完成数/未完成数」三行):完成=wo_progress 报工求和,计划=排产数量,未完成=计划−完成
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
WHERE ISNULL(h.asp_cancel,'N') <> 'Y';
GO

-- ③ MANU_SCHEDULE 面板补登新列(生产排产 / 排单计划表口径)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'重点管控') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'重点管控',N'重点管控',N'文本',N'query,detail',42,80,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'生产订单数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'生产订单数量',N'生产订单数量',N'小数',N'query,detail',140,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'每箱数量') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'每箱数量',N'每箱数量',N'小数',N'detail',146,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'箱数') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'箱数',N'箱数',N'小数',N'detail',148,80,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'计划开工日') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'计划开工日',N'计划开工日',N'日期',N'query,detail',160,110,0,0,0,1);

-- 五工序「计划 / 未完成」成列(完成列已存在);手写表每个工序三行 = 计划/完成/未完成
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'混料计划') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'混料计划',N'混料计划',N'小数',N'detail',200,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'混料未完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'混料未完成',N'混料未完成',N'小数',N'detail',220,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'成型计划') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'成型计划',N'成型计划',N'小数',N'detail',230,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'成型未完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'成型未完成',N'成型未完成',N'小数',N'detail',250,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'切炭计划') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'切炭计划',N'切炭计划',N'小数',N'detail',260,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'切炭未完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'切炭未完成',N'切炭未完成',N'小数',N'detail',280,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'组装计划') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'组装计划',N'组装计划',N'小数',N'detail',290,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'组装未完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'组装未完成',N'组装未完成',N'小数',N'detail',310,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'装箱计划') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'装箱计划',N'装箱计划',N'小数',N'detail',320,100,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'装箱未完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'装箱未完成',N'装箱未完成',N'小数',N'detail',340,110,0,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'装箱完成') INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'装箱完成',N'装箱完成',N'小数',N'detail',330,100,0,0,0,1);

-- en 译名(新增标签)
INSERT INTO yj_translation (scope,ref_key,locale,text,source)
SELECT N'field', v.k, 'en', v.t, 'manual'
FROM (VALUES
  (N'生产订单数量', N'Production Order Qty'),
  (N'箱数', N'Box Count'),
  (N'计划开工日', N'Planned Start Date'),
  (N'混料计划', N'Mixing Plan'),
  (N'混料未完成', N'Mixing Outstanding'),
  (N'成型计划', N'Forming Plan'),
  (N'成型未完成', N'Forming Outstanding'),
  (N'切炭计划', N'Carbon Cutting Plan'),
  (N'切炭未完成', N'Carbon Cutting Outstanding'),
  (N'组装计划', N'Assembly Plan'),
  (N'组装未完成', N'Assembly Outstanding'),
  (N'装箱计划', N'Packing Plan'),
  (N'装箱未完成', N'Packing Outstanding'),
  (N'装箱完成', N'Packing Completed')
) AS v(k,t)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope=N'field' AND x.ref_key=v.k AND x.locale='en');

SELECT N'重点管控 列' AS 检查, COUNT(*) AS 数量 FROM sys.columns WHERE object_id=OBJECT_ID('bd_manu_order') AND name=N'重点管控'
UNION ALL SELECT N'v_manu_schedule 列', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('v_manu_schedule')
UNION ALL SELECT N'MANU_SCHEDULE 新字段', COUNT(*) FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name IN (N'重点管控',N'生产订单数量',N'每箱数量',N'箱数',N'计划开工日',N'混料计划',N'混料未完成',N'成型计划',N'成型未完成',N'切炭计划',N'切炭未完成',N'组装计划',N'组装未完成',N'装箱计划',N'装箱未完成',N'装箱完成');
PRINT N'migrate-schedule-plan-form 完成';
GO
