SET NOCOUNT ON;
SELECT N'purchase_in max date' AS k, CONVERT(nvarchar(30), MAX(单据日期), 23) AS v FROM bd_purchase_in
UNION ALL SELECT N'purchase_in count', CAST(COUNT(*) AS nvarchar(30)) FROM bd_purchase_in
UNION ALL SELECT N'pu_order count', CAST(COUNT(*) AS nvarchar(30)) FROM bd_pu_order
UNION ALL SELECT N'PI-2026-11-0018', CAST(COUNT(*) AS nvarchar(30)) FROM bd_purchase_in WHERE 单据编号 = N'PI-2026-11-0018'
UNION ALL SELECT N'YJ-20261027-05 in pu_order', CAST(COUNT(*) AS nvarchar(30)) FROM bd_pu_order WHERE 单据编号 = N'YJ-20261027-05';
GO
SELECT TOP 15 单据编号, 单据日期, 采购订单号, 是否已转ERP, ERP单号 FROM bd_purchase_in ORDER BY 单据日期 DESC;
GO
SELECT TOP 10 单据编号, 单据日期, 供应商, 是否已转ERP, ERP单号 FROM bd_pu_order ORDER BY 单据日期 DESC;
