SET NOCOUNT ON;
SELECT 方向='出', 单据编号, 单据类型, 单据日期, 行数 = COUNT(*), 数量 = SUM(数量)
FROM outh WHERE 单据日期 > '2026-11-01' GROUP BY 单据编号, 单据类型, 单据日期;

SELECT 表='bl_purchase_in.批次号', 总行=COUNT(*),
       空白=SUM(CASE WHEN ISNULL(批次号,'')='' THEN 1 ELSE 0 END),
       PC0000=SUM(CASE WHEN 批次号='PC0000' THEN 1 ELSE 0 END),
       未填占位=SUM(CASE WHEN 批次号=N'(未填批号)' THEN 1 ELSE 0 END)
FROM bl_purchase_in
UNION ALL
SELECT 'bl_purchase_in.批号', COUNT(*), SUM(CASE WHEN ISNULL(批号,'')='' THEN 1 ELSE 0 END),
       SUM(CASE WHEN 批号='PC0000' THEN 1 ELSE 0 END), SUM(CASE WHEN 批号=N'(未填批号)' THEN 1 ELSE 0 END) FROM bl_purchase_in
UNION ALL
SELECT 'bl_material_out.批号', COUNT(*), SUM(CASE WHEN ISNULL(批号,'')='' THEN 1 ELSE 0 END),
       SUM(CASE WHEN 批号='PC0000' THEN 1 ELSE 0 END), SUM(CASE WHEN 批号=N'(未填批号)' THEN 1 ELSE 0 END) FROM bl_material_out
UNION ALL
SELECT 'bl_sale_out.批号', COUNT(*), SUM(CASE WHEN ISNULL(批号,'')='' THEN 1 ELSE 0 END),
       SUM(CASE WHEN 批号='PC0000' THEN 1 ELSE 0 END), SUM(CASE WHEN 批号=N'(未填批号)' THEN 1 ELSE 0 END) FROM bl_sale_out
UNION ALL
SELECT 'bl_finish_in.批号', COUNT(*), SUM(CASE WHEN ISNULL(批号,'')='' THEN 1 ELSE 0 END),
       SUM(CASE WHEN 批号='PC0000' THEN 1 ELSE 0 END), SUM(CASE WHEN 批号=N'(未填批号)' THEN 1 ELSE 0 END) FROM bl_finish_in;
