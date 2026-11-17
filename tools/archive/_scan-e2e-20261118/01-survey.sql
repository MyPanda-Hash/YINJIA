SET NOCOUNT ON;
PRINT '--- A. 领料台账状态分布 ---';
SELECT 状态, 领料类型, COUNT(*) AS 行数 FROM wo_pick_doc GROUP BY 状态, 领料类型 ORDER BY 状态, 领料类型;
GO
PRINT '--- B. 已完成领料单 与 其材料出库单审核状态(前 10) ---';
SELECT TOP 10 d.id, d.工单号, d.工单行号, d.领料类型, d.领料单号, d.状态,
       ISNULL(s.doc_no, N'-') AS 状态表单号, ISNULL(s.canceled, N'-') AS 作废,
       (SELECT COUNT(*) FROM bd_material_out h WHERE h.单据编号 = d.领料单号) AS 出库单在
FROM wo_pick_doc d LEFT JOIN yj_doc_status s ON s.panel_code = N'MATERIAL_OUT' AND s.doc_no = d.领料单号
WHERE d.状态 = N'已完成' ORDER BY d.id DESC;
GO
PRINT '--- C. 混料记录 wo_mixing_list 行数 ---';
SELECT COUNT(*) AS 混料记录行数 FROM wo_mixing_list;
GO
PRINT '--- D. 报工表 scjl 行数 ---';
SELECT COUNT(*) AS 报工行数 FROM scjl;
