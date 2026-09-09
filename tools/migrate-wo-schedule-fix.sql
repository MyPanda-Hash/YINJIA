-- migrate-wo-schedule-fix.sql — 修正排产视图:状态从 yj_doc_status 推导(对齐已审批判据),排除已作废单
SET NOCOUNT ON;
IF OBJECT_ID('v_wo_schedule') IS NOT NULL DROP VIEW v_wo_schedule;
IF OBJECT_ID('v_wo_kit') IS NOT NULL DROP VIEW v_wo_kit;
GO
EXEC('CREATE VIEW v_wo_schedule AS
SELECT w.[单据编号] AS 工单号, w.[单据日期] AS 单据日期, w.[销售订单号] AS 销售订单号, w.[客户] AS 客户,
       w.[产品编码] AS 产品编码, w.[产品名称] AS 产品名称, w.[规格型号] AS 规格型号,
       w.[订单数量] AS 订单数量, w.[成型计划数量] AS 成型计划数量,
       w.[交期] AS 交期,
       CASE WHEN TRY_CAST(w.[交期] AS date) IS NULL THEN NULL
            ELSE DATEDIFF(day, CAST(GETDATE() AS date), TRY_CAST(w.[交期] AS date)) END AS 交期紧迫度,
       w.[生产车间] AS 生产车间,
       CASE WHEN ISNULL(st.canceled, ''Y'') = ''Y'' THEN N''已作废''
            WHEN ISNULL(st.stopped, ''N'') = ''Y'' THEN N''已中止''
            WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END AS 工单状态,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''混料''), 0) AS 混料完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''成型''), 0) AS 成型完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''切炭''), 0) AS 切炭完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''组装''), 0) AS 组装完成,
       ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''装箱''), 0) AS 装箱完成,
       w.[订单数量] - ISNULL((SELECT SUM(p.[完成数量]) FROM wo_progress p WHERE p.[单据编号] = w.[单据编号] AND p.[工序] = N''装箱''), 0) AS 未完成数量
FROM wo_order w
LEFT JOIN yj_doc_status st ON st.panel_code = ''WO_ORDER'' AND st.doc_no = w.[单据编号]
WHERE ISNULL(st.canceled, ''N'') <> ''Y'';');
GO
EXEC('CREATE VIEW v_wo_kit AS
SELECT w.[单据编号] AS 工单号,
       CASE WHEN ISNULL(st.canceled, ''Y'') = ''Y'' THEN N''已作废''
            WHEN ISNULL(st.stopped, ''N'') = ''Y'' THEN N''已中止''
            WHEN st.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END AS 工单状态,
       w.[交期] AS 交期,
       w.[产品编码] AS 产品编码, w.[产品名称] AS 产品名称, w.[订单数量] AS 订单数量,
       b.[子件编码] AS 子件编码, b.[子件名称] AS 子件名称, b.[规格型号] AS 子件规格,
       b.[定额数量] AS 单件用量, b.[定额数量] * w.[订单数量] AS 需求数量,
       ISNULL((SELECT SUM(k.yl) FROM kucun k WHERE k.wzdm = b.[子件编码] AND ISNULL(k.asp_cancel, ''N'') <> ''Y''), 0) AS 库存结余,
       ISNULL((SELECT SUM(k.yl) FROM kucun k WHERE k.wzdm = b.[子件编码] AND ISNULL(k.asp_cancel, ''N'') <> ''Y''), 0) - b.[定额数量] * w.[订单数量] AS 齐套缺口
FROM wo_order w
JOIN bs_bom b ON b.[父件编码] = w.[产品编码] AND ISNULL(b.[默认BOM], 0) = 1 AND ISNULL(b.[状态], N''启用'') = N''启用''
LEFT JOIN yj_doc_status st ON st.panel_code = ''WO_ORDER'' AND st.doc_no = w.[单据编号]
WHERE ISNULL(st.canceled, ''N'') <> ''Y'';');
GO
PRINT N'migrate-wo-schedule-fix 完成';
GO
