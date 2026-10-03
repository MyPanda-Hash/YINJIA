SET NOCOUNT ON;
SELECT id, 存货编码, 备注 FROM dbo.bs_inv WHERE 备注 LIKE N'护栏验证-%';
GO
UPDATE dbo.bs_inv SET 备注 = N'' WHERE 备注 LIKE N'护栏验证-%';
GO
SELECT COUNT(*) AS 残留 FROM dbo.bs_inv WHERE 备注 LIKE N'护栏验证-%';
GO
