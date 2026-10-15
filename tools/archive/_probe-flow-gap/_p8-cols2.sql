SET NOCOUNT ON;
SELECT 'qc_first_insp_head' AS 表, STUFF((SELECT ' | ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_first_insp_head') ORDER BY c.column_id FOR XML PATH('')),1,3,'') AS 列;
GO
SELECT 'qc_first_insp_detail' AS 表, STUFF((SELECT ' | ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_first_insp_detail') ORDER BY c.column_id FOR XML PATH('')),1,3,'') AS 列;
GO
SELECT 'qc_proc_insp_head' AS 表, STUFF((SELECT ' | ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_proc_insp_head') ORDER BY c.column_id FOR XML PATH('')),1,3,'') AS 列;
GO
SELECT 'qc_proc_insp_detail' AS 表, STUFF((SELECT ' | ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_proc_insp_detail') ORDER BY c.column_id FOR XML PATH('')),1,3,'') AS 列;
GO
SELECT 'qc_mold_insp_head' AS 表, STUFF((SELECT ' | ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_mold_insp_head') ORDER BY c.column_id FOR XML PATH('')),1,3,'') AS 列;
GO
SELECT 'qc_mold_insp_detail' AS 表, STUFF((SELECT ' | ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_mold_insp_detail') ORDER BY c.column_id FOR XML PATH('')),1,3,'') AS 列;
GO
SELECT 'qc_cut_insp_detail' AS 表, STUFF((SELECT ' | ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_cut_insp_detail') ORDER BY c.column_id FOR XML PATH('')),1,3,'') AS 列;
GO
SELECT 'qc_asm_insp_detail' AS 表, STUFF((SELECT ' | ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_asm_insp_detail') ORDER BY c.column_id FOR XML PATH('')),1,3,'') AS 列;
GO
SELECT 'qc_fin_spec_head' AS 表, STUFF((SELECT ' | ' + c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_fin_spec_head') ORDER BY c.column_id FOR XML PATH('')),1,3,'') AS 列;
GO
