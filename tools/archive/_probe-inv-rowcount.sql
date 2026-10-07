-- 一次性探针:商品(INV/bs_inv)行数与其面板配置(排查「只剩一行」)
SET NOCOUNT ON;
SELECT DB_NAME() AS 库, COUNT(*) AS bs_inv总行数,
       SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) AS 未作废行数
FROM dbo.bs_inv;
GO
SELECT TOP 15 id, [存货编码], [存货名称], asp_time1, asp_user1, asp_cancel
FROM dbo.bs_inv ORDER BY id DESC;
GO
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_panel' ORDER BY ORDINAL_POSITION;
GO
SELECT * FROM dbo.yj_panel WHERE panel_code = 'INV';
GO
