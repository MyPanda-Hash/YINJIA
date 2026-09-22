SET NOCOUNT ON;
SELECT TOP 20 'A.所属类别取值(按物料数)' AS k, 所属类别, COUNT(*) AS n FROM bs_inv WHERE ISNULL(所属类别,N'')<>N'' GROUP BY 所属类别 ORDER BY COUNT(*) DESC;
SELECT TOP 8 'B.样例物料' AS k, 存货编码, 存货名称, 所属类别, 计量单位 FROM bs_inv WHERE ISNULL(所属类别,N'')<>N'' ORDER BY id;
GO
