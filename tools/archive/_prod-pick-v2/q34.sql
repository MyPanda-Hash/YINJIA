SET NOCOUNT ON;
SELECT TOP 3 单据编号, 业务类型, 备注 FROM bd_other_in WHERE 业务类型 LIKE '%退%' OR 单据编号 LIKE 'OI-%' ORDER BY id DESC;
GO
SELECT TOP 3 单据编号, 存货编码, 数量, ISNULL(明细备注,'') FROM bl_other_in WHERE 单据编号 LIKE 'OI-%' ORDER BY id DESC;
GO
SELECT COUNT(*) n FROM bd_other_in;
