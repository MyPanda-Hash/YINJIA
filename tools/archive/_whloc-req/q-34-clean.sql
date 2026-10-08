SET NOCOUNT ON;
-- 清理刚才的验证行
DELETE FROM bs_dict WHERE 字典类别=N'WH_ZONE' AND 代码=N'ZONE99';
SELECT N'WH_ZONE 残留(应 0)' AS 项, CAST(COUNT(*) AS nvarchar(6)) AS 值 FROM bs_dict WHERE 字典类别=N'WH_ZONE';
GO