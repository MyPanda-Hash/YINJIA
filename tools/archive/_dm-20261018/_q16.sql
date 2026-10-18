SET NOCOUNT ON;
SELECT name FROM sys.tables WHERE name LIKE 'qc_proc_insp%';
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_proc_insp_head') AND name IN (N'检验类型',N'格数上限');
