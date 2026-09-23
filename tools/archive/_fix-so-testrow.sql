SET NOCOUNT ON;
UPDATE bl_sale_out SET [仓库] = N'正品仓' WHERE [单据编号] = N'TEST-SALE-001' AND ISNULL([仓库],N'')=N'' AND [仓库编码]=N'CK00001';
SELECT COUNT(*) AS 还原后有仓库 FROM bl_sale_out WHERE ISNULL([仓库],N'')<>N'';
GO
