SET NOCOUNT ON;
SELECT 存货编码, 仓库, 仓库编码, 现存量, ISNULL(批号,N'') AS 批号 FROM v_stock_pick
WHERE 存货编码 IN (N'YJ-KBL-012', N'YJ-XWR-058') AND 现存量 > 0 ORDER BY 存货编码, 现存量 DESC;
GO
SELECT d.领料单号, l.物料编码, l.需求数量, l.数量, l.仓库 FROM wo_pick_doc d JOIN wo_pick_line l ON l.单头id = d.id
WHERE d.工单号 = N'GD-2026-11-0010' AND d.工单行号 = 3 ORDER BY d.领料类型, l.行号;
