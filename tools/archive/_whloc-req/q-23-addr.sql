SET NOCOUNT ON;
SELECT TOP 14 仓位编码, 大区, 存储分区, 区码, ISNULL(排号,N'(空)') AS 排号, 位号, 仓位地址
FROM dbo.bs_wh_loc WHERE 仓库编码=N'CK-D' AND ISNULL(asp_cancel,'N')<>'Y'
  AND 仓位编码 IN (N'D1-01-1',N'炭1区-01',N'炭1区-36',N'炭粉区1-01',N'炭粉区3-36',N'胶粉5区-36',
                   N'纸箱区-01',N'纸箱区-14',N'端盖区-12',N'PP棉区-12',N'折叠棉-24',N'网套布区-12',N'H1-1',N'H11-4')
ORDER BY 仓位编码;
GO