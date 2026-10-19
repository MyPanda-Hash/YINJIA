SET NOCOUNT ON;
SELECT id, rid, 物料编码, 批号, 数量, asp_cancel AS 作废 FROM dbo.outh WHERE src = 6 AND 单据编号 = N'SCLL-20261014-00009' ORDER BY id;
