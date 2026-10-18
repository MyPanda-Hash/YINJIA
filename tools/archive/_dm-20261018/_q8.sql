SET NOCOUNT ON;
SELECT TOP 5 asp_user1, asp_user2, [单据编号], [ERP单号], [单据日期], [供应商] FROM bd_purchase_in WHERE [ERP单号] IS NOT NULL AND [ERP单号] <> N'' ORDER BY id DESC;
SELECT COUNT(*) AS 有ERP单号 FROM bd_purchase_in WHERE ISNULL([ERP单号],N'')<>N'';
