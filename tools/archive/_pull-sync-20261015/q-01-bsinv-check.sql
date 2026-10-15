-- q-01-bsinv-check.sql — 拉取云端后 DbSync 失败项取证:migrate-bs-inv-inspection-align-20261015.sql 自检逐条
-- 用法(两个账套):java -cp lib\mssql-jdbc.jar SqlRunner.java "<url>" yinjia env archive\_pull-sync-20261015\q-01-bsinv-check.sql
SET NOCOUNT ON;
SELECT DB_NAME() AS db, (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.bs_inv')) AS bs_inv_列数_应148;
GO
SELECT N'列存在性' AS k, c.name, t.name AS 类型, c.max_length / 2 AS 长度, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.bs_inv') AND c.name IN (N'来料检验', N'是否来料检验', N'检验方式', N'商品类型');
GO
SELECT N'INV字段' AS k, id, col_name, label, data_type, place, seq, editable, visible, hidden, dict_sql
FROM yj_field
WHERE panel_code = 'INV' AND col_name IN (N'来料检验', N'是否来料检验', N'检验方式', N'商品类型');
GO
SELECT N'译名计数' AS k, ref_key, COUNT(*) AS 语言数
FROM yj_translation WHERE scope = 'field' AND ref_key IN (N'来料检验', N'商品类型')
GROUP BY ref_key;
GO
SELECT N'列注明' AS k, ep.name, CAST(ep.value AS nvarchar(200)) AS v
FROM sys.extended_properties ep
WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bs_inv')
  AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_inv'), N'来料检验', 'ColumnId');
GO
SELECT N'登记' AS k, script, applied_at FROM yj_schema_log WHERE script LIKE '%bs-inv-inspection%';
GO
