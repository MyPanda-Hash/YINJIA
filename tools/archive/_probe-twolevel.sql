USE HSDZ_MES; SET NOCOUNT ON;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = N'rd_dev_task' ORDER BY ORDINAL_POSITION;
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = N'rd_spec_assign' ORDER BY ORDINAL_POSITION;
SELECT panel_code, col_name, label, data_type, dict_sql FROM yj_field WHERE panel_code=N'RD_PROD_INFO' AND col_name IN (N'审核人一级',N'审核人二级',N'责任人') ;
SELECT r.role_code, r.role_name, rp.panel_code, rp.perms, rp.can_approve FROM yj_role r LEFT JOIN yj_role_panel rp ON rp.role_id=r.id WHERE rp.panel_code IN (N'RD_PROD_INFO',N'RD_MOLD_PROC',N'RD_ASM_PROC',N'RD_SPEC_DOC',N'RD_INSP_PLAN') ORDER BY r.role_code, rp.panel_code;