SET NOCOUNT ON;
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('bd_purchase_in','bd_finish_in','bd_other_in','bd_sale_out','bd_material_out','bd_other_out')
  AND COLUMN_NAME IN ('单据编号','单据日期','单据状态','单据状态2','asp_cancel','仓库','仓库编码')
ORDER BY TABLE_NAME, COLUMN_NAME;
SELECT panel_code, COUNT(*) AS 留痕行, SUM(CASE WHEN shr IS NOT NULL THEN 1 ELSE 0 END) AS 已审核
FROM yj_doc_status GROUP BY panel_code ORDER BY panel_code;
