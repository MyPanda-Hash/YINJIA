SET NOCOUNT ON;
SELECT TOP 20 存货编码, 存货名称, 计量单位
FROM dbo.bs_inv WHERE 存货编码 IN (N'HP-08',N'HS-150',N'HS-2040',N'XC-2040',N'XC-4080',N'XH-SX80250SX',N'SIT-Q4',N'SSC-Q3',N'SD-000',N'YJ-044',N'YJ-049',N'YJ-KG-AJE-A01');
PRINT N'-- bs_inv 是否有辅助单位列 --';
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bs_inv') AND (c.name LIKE N'%单位%' OR c.name LIKE N'%换算%');
