SET NOCOUNT ON;
PRINT '=== QC 各表列名(每行一列) ===';
SELECT t.name AS 表, c.column_id AS 序, c.name AS 列
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE t.name IN ('qc_first_insp_head','qc_first_insp_detail','qc_proc_insp_head','qc_proc_insp_detail',
                 'qc_mold_insp_head','qc_mold_insp_detail','qc_cut_insp_head','qc_asm_insp_head','qc_fin_spec_head')
ORDER BY t.name, c.column_id;
GO
