SET NOCOUNT ON;
SELECT TOP 3 单据编号, asp_user1, asp_time1 FROM bl_so_order ORDER BY id DESC;
GO
SELECT COUNT(*) AS 近7天同步的SO行 FROM bl_so_order WHERE asp_user1 = N'jdy-sync' AND asp_time1 >= DATEADD(day,-7,SYSDATETIME());
GO
SELECT TOP 2 单据编号, asp_time1 FROM bl_pu_order ORDER BY id DESC;
