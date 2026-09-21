SET NOCOUNT ON;
SELECT id, 单据编号, 供应商, 采购单号, 产品名称, 总数量, 不合格品数量, 单据状态 FROM qc_tc_in ORDER BY id DESC;
GO
