-- q-01-columns.sql — 品质流程监控看板:六张表关键列侦查(只读)
SET NOCOUNT ON;
DECLARE @t TABLE (tbl sysname);
INSERT INTO @t VALUES (N'sl_recv'), (N'sl_recv_detail'), (N'qc_insp'), (N'qc_insp_detail'),
                      (N'bd_purchase_in'), (N'bl_purchase_in'), (N'qc_catalog'), (N'qc_catalog_detail'),
                      (N'qc_insp_rec');
SELECT t.tbl AS 表名, c.column_id AS 序, c.name AS 列名, ty.name AS 类型,
       c.max_length AS 长度, c.is_nullable AS 可空
  FROM @t t
  JOIN sys.columns c ON c.object_id = OBJECT_ID(N'dbo.' + t.tbl)
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
 ORDER BY t.tbl, c.column_id;
