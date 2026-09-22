SET NOCOUNT ON;
SELECT 'A.INV面板所属类别字段' AS k, col_name, label, data_type, place, editable, hidden, visible FROM yj_field WHERE panel_code IN ('INV','GFDA') AND col_name = N'所属类别';
SELECT 'B.bs_inv 所属类别填充率' AS k, COUNT(*) AS total, SUM(CASE WHEN ISNULL(所属类别,N'')<>N'' THEN 1 ELSE 0 END) AS filled FROM bs_inv;
SELECT 'C.检验单生单按钮配置' AS k, panel_code, col_name, label FROM yj_field WHERE panel_code='QC_RECV' AND (label LIKE N'%生单%' OR label LIKE N'%检验%') ORDER BY seq;
GO
