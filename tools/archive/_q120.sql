SET NOCOUNT ON;
SELECT 单据编号, 单据状态, 是否已转ERP, ERP单号, 转ERP操作人, 转ERP时间 FROM bd_purchase_in WHERE 是否已转ERP = N'是';
