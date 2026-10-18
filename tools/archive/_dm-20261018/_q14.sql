SET NOCOUNT ON;
SELECT 'HEAD' t, COL_LENGTH('dbo.qc_proc_insp_head','检验类型') AS 检验类型, COL_LENGTH('dbo.qc_proc_insp_head','格数上限') AS 头格数上限;
SELECT 'bs_plan' t, COL_LENGTH('dbo.bs_qc_plan','检验类型') AS 检验类型;
SELECT 'bs_item' t, COL_LENGTH('dbo.bs_qc_item','检验数量') AS 检验数量;
