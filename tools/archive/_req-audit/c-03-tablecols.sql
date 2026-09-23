SET NOCOUNT ON;
-- 每张表一行,列名拼接(compat 100,用 FOR XML)
SELECT t.name AS 表名,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS 列数,
       STUFF((SELECT N' | ' + CAST(c2.column_id AS varchar(4)) + N':' + c2.name
              FROM sys.columns c2 WHERE c2.object_id = t.object_id
              ORDER BY c2.column_id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 3, N'') AS 列清单
FROM sys.tables t
WHERE t.name IN ('qc_recv','sl_recv','sl_recv_detail','qc_recv_detail','qc_insp','qc_insp_detail',
                 'qc_return','qc_return_detail','qc_tc','qc_tc_detail','qc_jjf','qc_jjf_detail',
                 'bd_purchase_in','bl_purchase_in','bd_pu_order','bl_pu_order')
ORDER BY t.name;
GO
SELECT name AS 对象名, type_desc AS 类型
FROM sys.objects
WHERE type IN ('V','P','FN','TF','IF')
ORDER BY type, name;
GO
