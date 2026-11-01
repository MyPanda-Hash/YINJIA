SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_first_insp_head') AND c.name IN (N'生产日期',N'批次号',N'工单行号');
