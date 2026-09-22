SET NOCOUNT ON;
SELECT 'IX' AS k, OBJECT_NAME(i.object_id) AS tbl, i.name AS idx, i.is_unique
  FROM sys.indexes i WHERE i.name LIKE 'IX_bl_%单据编号' OR i.name LIKE 'IX_bd_%单据编号' OR i.name IN ('IX_bs_wh_仓库名称','UX_kucun_id') ORDER BY 2,3;
GO
SELECT 'ST' AS k, OBJECT_NAME(s.object_id) AS tbl, s.name AS stat, s.auto_created FROM sys.stats s WHERE s.name LIKE 'ST[_]%' ORDER BY 2,3;
GO
SELECT 'EP' AS k, OBJECT_NAME(p.major_id) AS obj, p.name, p.minor_id, CONVERT(nvarchar(80), p.value) AS val
  FROM sys.extended_properties p WHERE p.name=N'MS_Description' AND p.class=1 ORDER BY 2,3;
GO
