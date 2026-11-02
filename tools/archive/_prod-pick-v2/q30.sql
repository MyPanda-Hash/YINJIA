SET NOCOUNT ON;
SELECT 单据编号, ISNULL(单据状态,'<null>') 单据状态, ISNULL(审核人,'') 审核人, ISNULL(CONVERT(varchar(19),审核时间,120),'') 审核时间 FROM bd_material_out WHERE 单据编号='LL-2026-10-0004';
GO
SELECT 单据编号, ISNULL(单据状态,'<null>') 单据状态, ISNULL(asp_cancel,'?') asp_cancel FROM bd_other_in WHERE 单据编号='OI-2026-10-0002';
GO
SELECT TOP 5 单据编号, 业务类型, ISNULL(单据状态,'<null>') 单据状态, ISNULL(审核人,'') 审核人 FROM bd_material_out WHERE 加工单号 LIKE 'GD-2026%' ORDER BY id DESC;
