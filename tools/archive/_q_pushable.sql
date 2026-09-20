SET NOCOUNT ON;
SELECT TOP 3 单据编号, 是否已转ERP, ERP单号 FROM bd_purchase_in
WHERE 单据状态 IS NOT NULL AND ISNULL(是否已转ERP,N'否')<>N'是'
ORDER BY id DESC;
GO
