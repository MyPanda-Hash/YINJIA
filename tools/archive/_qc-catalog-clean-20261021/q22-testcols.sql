SET NOCOUNT ON;
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE (TABLE_NAME='bs_inv' AND COLUMN_NAME='所属类别')
   OR (TABLE_NAME='qc_catalog_detail' AND COLUMN_NAME IN ('计量单位','检验数据记录单号','检测物料类别'))
   OR (TABLE_NAME='qc_insp_rec' AND COLUMN_NAME='来料检验单号')
   OR (TABLE_NAME='qc_tc_in' AND COLUMN_NAME='检验数据记录单号')
   OR (TABLE_NAME='s_allno' AND COLUMN_NAME='ny');
