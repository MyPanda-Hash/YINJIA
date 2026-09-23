-- migrate-single-track-report.sql — 单轨改造(2026-09-22,用户拍板"单轨·参考库式")
-- 依据:补充设计-V2.0 §4.1「MANU_ORDER(工单) ├─ Stage 1..5」、§4.2 报工表主键=工单号;
--      参考库 scjl.gd_id → plang_pc.id(报工直接挂工单,一张单从排产走到结案)。
-- 范围:①报工单 WO_REPORT.工单号 参照改指 生产加工单(MANU_ORDER.合同号);
--      ②工单齐套表 v_wo_kit 数据源 wo_order → bd_manu_order(按行产品×默认BOM×kucun);
--      ③WO_ORDER(生产工单)与 WO_SCHEDULE(排单计划)菜单下线(前端 menus.js,面板/权限行保留可回滚),
--        看板职责由 生产排产 MANU_SCHEDULE 承接(五工序完成/未完成数量已并入该视图)。
-- Java 侧(WoReportService/双出口/产品批号)同步改锚,本脚本只管元数据与视图。幂等可重跑。
SET NOCOUNT ON;

/* ============ A. 报工单工单号参照:WO_ORDER → MANU_ORDER ============ */
UPDATE yj_field SET ref_panel = N'MANU_ORDER', ref_field = N'合同号', display_field = N'合同号'
 WHERE panel_code = 'WO_REPORT' AND col_name = N'工单号' AND ISNULL(ref_panel,'') = N'WO_ORDER';

/* ============ B. 工单齐套表 v_wo_kit 改指生产加工单 ============ */
-- 口径:加工单行(产品编码×排产数量)×默认BOM 子件 → 需求数量=定额×排产数量;
--       库存结余=kucun.yl 按子件汇总;齐套缺口=结余−需求;状态由 yj_doc_status(MANU_ORDER)推导
IF OBJECT_ID('v_wo_kit','V') IS NOT NULL DROP VIEW v_wo_kit;
GO
CREATE VIEW v_wo_kit AS
SELECT ROW_NUMBER() OVER (ORDER BY h.[合同号], b.[子件编码]) AS id,
       h.[合同号] AS 工单号,
       CASE WHEN ISNULL(st.canceled, 'Y') = 'Y' THEN N'已作废'
            WHEN ISNULL(st.stopped, 'N') = 'Y' THEN N'已中止'
            WHEN st.shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END AS 工单状态,
       CAST(h.[预完工日] AS date) AS 交期,
       l.[产品编码] AS 产品编码, l.[产品名称] AS 产品名称,
       ISNULL(l.[排产数量], 0) AS 订单数量,
       b.[子件编码] AS 子件编码, b.[子件名称] AS 子件名称, b.[规格型号] AS 子件规格,
       b.[定额数量] AS 单件用量, b.[定额数量] * ISNULL(l.[排产数量], 0) AS 需求数量,
       ISNULL((SELECT SUM(k.yl) FROM kucun k WHERE k.wzdm = b.[子件编码] AND ISNULL(k.asp_cancel, 'N') <> 'Y'), 0) AS 库存结余,
       ISNULL((SELECT SUM(k.yl) FROM kucun k WHERE k.wzdm = b.[子件编码] AND ISNULL(k.asp_cancel, 'N') <> 'Y'), 0)
           - b.[定额数量] * ISNULL(l.[排产数量], 0) AS 齐套缺口,
       CAST(NULL AS char(1)) AS asp_cancel
FROM bd_manu_order h
JOIN bl_manu_order l ON l.[合同号] = h.[合同号] AND ISNULL(l.asp_cancel, 'N') <> 'Y'
JOIN bs_bom b ON b.[父件编码] = l.[产品编码] AND ISNULL(b.[默认BOM], 0) = 1 AND ISNULL(b.[状态], N'启用') = N'启用'
LEFT JOIN yj_doc_status st ON st.panel_code = 'MANU_ORDER' AND st.doc_no = h.[合同号]
WHERE ISNULL(st.canceled, 'N') <> 'Y' AND ISNULL(h.asp_cancel, 'N') <> 'Y';
GO

/* ============ C. 校验 ============ */
SELECT N'WO_REPORT.工单号 参照' AS 检查, ISNULL(MIN(ref_panel), N'-') + N'.' + ISNULL(MIN(ref_field), N'-') AS 值
  FROM yj_field WHERE panel_code = 'WO_REPORT' AND col_name = N'工单号'
UNION ALL SELECT N'v_wo_kit 可查', CAST(COUNT(*) AS nvarchar(20)) FROM v_wo_kit
UNION ALL SELECT N'v_manu_schedule 列数', CAST(COUNT(*) AS nvarchar(20)) FROM sys.columns WHERE object_id = OBJECT_ID('v_manu_schedule')
UNION ALL SELECT N'MANU_SCHEDULE 字段数', CAST(COUNT(*) AS nvarchar(20)) FROM yj_field WHERE panel_code = 'MANU_SCHEDULE';
PRINT N'migrate-single-track-report 完成';
GO
