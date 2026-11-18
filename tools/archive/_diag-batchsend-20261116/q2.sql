SET NOCOUNT ON;
SELECT id, 单据编号, 行号, 物料编码, 物料名称, 数量, ISNULL(asp_cancel,'') AS cancel FROM bl_pu_order WHERE 单据编号 = N'YJ-20261111-06' ORDER BY 行号;
GO
PRINT '---- id 11039 anywhere in bl_pu_order ----';
SELECT id, 单据编号, 行号, 物料编码, 数量 FROM bl_pu_order WHERE id = 11039;
GO
PRINT '---- form_flow_link columns ----';
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='form_flow_link' ORDER BY ORDINAL_POSITION;
GO
PRINT '---- doc status ----';
SELECT panel_code, doc_no, shr, shsj, canceled FROM yj_doc_status WHERE doc_no = N'YJ-20261111-06';
