SET NOCOUNT ON;
PRINT '== 测试账套:制程检验单 ==';
SELECT TOP 5 id, 单据编号, 单据状态, 检验类别 FROM dbo.qc_proc_insp_head ORDER BY id DESC;
SELECT COUNT(*) AS head_rows FROM dbo.qc_proc_insp_head;
SELECT COUNT(*) AS detail_rows FROM dbo.qc_proc_insp_detail;
PRINT '== 列数 列是否已在(测试账套) ==';
SELECT COL_LENGTH(N'dbo.qc_proc_insp_head', N'列数') AS 列数_字节数;
SELECT panel_code, label, col_name, place, visible, hidden FROM dbo.yj_field WHERE panel_code = 'QC_PROC_INSP' AND col_name = N'列数';
