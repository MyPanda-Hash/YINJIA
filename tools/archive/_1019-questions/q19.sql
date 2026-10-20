SELECT t.name AS 表名, COUNT(c.column_id) AS 列数 FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name IN ('qc_insp_rec','qc_tc_in','qc_return','sl_recv','bd_purchase_in','bd_pu_label','yj_doc_batch') GROUP BY t.name ORDER BY t.name
GO
SELECT name FROM sys.tables WHERE name IN ('qc_insp_rec')
