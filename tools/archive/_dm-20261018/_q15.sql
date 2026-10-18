SET NOCOUNT ON;
SELECT COL_LENGTH('dbo.qc_proc_insp_head','检验类型') AS 头检验类型,
       COL_LENGTH('dbo.qc_proc_insp_detail','格数上限') AS 行格数上限;
