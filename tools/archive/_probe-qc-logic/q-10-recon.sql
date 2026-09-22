-- q-10-recon.sql — 检验目录↔检验单↔检验数据记录 逻辑重构前的现状侦察
SET NOCOUNT ON;
SELECT 'A.bs_inv 列' AS k, name, TYPE_NAME(system_type_id) AS t, max_length FROM sys.columns WHERE object_id = OBJECT_ID('bs_inv') ORDER BY column_id;
SELECT 'B.qc_insp 头列' AS k, name, TYPE_NAME(system_type_id) AS t FROM sys.columns WHERE object_id = OBJECT_ID('qc_insp') ORDER BY column_id;
SELECT 'C.qc_insp_detail 列' AS k, name, TYPE_NAME(system_type_id) AS t FROM sys.columns WHERE object_id = OBJECT_ID('qc_insp_detail') ORDER BY column_id;
SELECT 'D.qc_catalog 列' AS k, name, TYPE_NAME(system_type_id) AS t FROM sys.columns WHERE object_id = OBJECT_ID('qc_catalog') ORDER BY column_id;
SELECT 'E.qc_catalog_detail 列' AS k, name, TYPE_NAME(system_type_id) AS t FROM sys.columns WHERE object_id = OBJECT_ID('qc_catalog_detail') ORDER BY column_id;
GO
