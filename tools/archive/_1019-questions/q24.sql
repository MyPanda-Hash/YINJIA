SELECT TOP 10 仓库编码, 仓库名称 FROM bs_wh WHERE 仓库编码 IN (N'CP-02', N'CK00001', N'CP-03') OR 仓库名称 LIKE N'%成品%' OR 仓库名称 LIKE N'%正品%'
GO
SELECT COUNT(*) AS 仓库数 FROM bs_wh
GO
SELECT TOP 5 存货编码, 存货名称 FROM bs_inv WHERE 存货编码 LIKE N'A-32%' ORDER BY 存货编码
