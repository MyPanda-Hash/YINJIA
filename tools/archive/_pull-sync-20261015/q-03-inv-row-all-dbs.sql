-- q-03-inv-row-all-dbs.sql — 各库 INV·来料检验 字段行与 bs_inv 列现状(判定 hidden=1 是否为服务器基线)
SET NOCOUNT ON;
SELECT DB_NAME() AS db,
       (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.bs_inv')) AS bs_inv列数,
       COL_LENGTH('dbo.bs_inv', N'来料检验') AS 来料检验字节,
       COL_LENGTH('dbo.bs_inv', N'是否来料检验') AS 旧计算列字节;
GO
SELECT DB_NAME() AS db, id, col_name, label, data_type, place, seq, editable, visible, hidden, dict_sql
FROM yj_field WHERE panel_code = 'INV' AND col_name IN (N'来料检验', N'是否来料检验', N'检验方式', N'商品类型');
GO
