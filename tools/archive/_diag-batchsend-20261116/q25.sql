SET NOCOUNT ON;
PRINT '== 预演:采购链可回填样例(目标行带行号) ==';
SELECT TOP 8 l.id AS link_id, l.source_form_no, l.source_line_key AS 旧键, l.inventory_code,
       o.id AS 新行id, o.行号 AS 新行号, o.物料编码, d.采购订单行号 AS 目标行上的订单行号, l.linked_quantity
FROM form_flow_link l
JOIN sl_recv_detail d ON d.单据编号 = l.target_form_no
     AND l.target_line_key = l.target_form_no + N'#' + CAST(d.id AS nvarchar(20))
JOIN bl_pu_order o ON o.单据编号 = l.source_form_no
     AND LTRIM(RTRIM(CAST(o.行号 AS nvarchar(50)))) = LTRIM(RTRIM(CAST(d.采购订单行号 AS nvarchar(50))))
WHERE l.source_panel_code = N'PU_ORDER'
  AND NOT EXISTS (SELECT 1 FROM bl_pu_order x WHERE x.单据编号 = l.source_form_no
                  AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key)
ORDER BY l.id DESC;
GO
PRINT '== 预演:物料唯一兜底样例 ==';
SELECT TOP 8 l.id AS link_id, l.source_form_no, l.source_line_key AS 旧键, l.inventory_code,
       o.id AS 新行id, o.行号 AS 新行号, o.物料编码, o.数量, l.linked_quantity
FROM form_flow_link l
JOIN bl_pu_order o ON o.单据编号 = l.source_form_no AND o.物料编码 = l.inventory_code
WHERE l.source_panel_code = N'PU_ORDER'
  AND NOT EXISTS (SELECT 1 FROM bl_pu_order x WHERE x.单据编号 = l.source_form_no
                  AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key)
  AND (SELECT COUNT(*) FROM bl_pu_order y WHERE y.单据编号 = l.source_form_no AND y.物料编码 = l.inventory_code) = 1
ORDER BY l.id DESC;
GO
PRINT '== 预演:目标那一条(5146) ==';
SELECT l.id, l.source_line_key AS 旧键, o.id AS 新行id, o.行号, o.物料编码, o.数量 AS 订单数量, l.linked_quantity AS 已送
FROM form_flow_link l
JOIN bl_pu_order o ON o.单据编号 = l.source_form_no AND o.物料编码 = l.inventory_code
WHERE l.id = 5146;
GO
PRINT '== 预演:销售链可回填样例 ==';
SELECT TOP 8 l.id AS link_id, l.source_form_no, l.source_line_key AS 旧键, l.inventory_code,
       o.id AS 新行id, o.行号 AS 新行号, o.存货编码, o.数量, l.linked_quantity
FROM form_flow_link l
JOIN bl_so_order o ON o.单据编号 = l.source_form_no AND o.存货编码 = l.inventory_code
WHERE l.source_panel_code = N'SO_ORDER'
  AND NOT EXISTS (SELECT 1 FROM bl_so_order x WHERE x.单据编号 = l.source_form_no
                  AND x.单据编号 + N'#' + CAST(x.id AS nvarchar(20)) = l.source_line_key)
  AND (SELECT COUNT(*) FROM bl_so_order y WHERE y.单据编号 = l.source_form_no AND y.存货编码 = l.inventory_code) = 1
ORDER BY l.id DESC;
GO
PRINT '== 材料码可回填样例 ==';
SELECT TOP 6 lb.id, lb.单据编号 AS 打印单, h.采购订单号, lb.采购订单行号, o.id AS 新行id, o.行号 AS 新行号, o.物料编码, lb.打印数量
FROM bl_pu_label lb
JOIN bd_pu_label h ON h.单据编号 = lb.单据编号
JOIN bl_pu_order o ON o.单据编号 = h.采购订单号
     AND LTRIM(RTRIM(CAST(o.行号 AS nvarchar(50)))) = LTRIM(RTRIM(CAST(lb.采购订单行号 AS nvarchar(50))))
WHERE NOT EXISTS (SELECT 1 FROM bl_pu_order x WHERE x.id = lb.采购订单行id)
ORDER BY lb.id DESC;
