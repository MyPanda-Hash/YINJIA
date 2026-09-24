SET NOCOUNT ON;
PRINT '== ① yj_field 污染面(快照 vs 当前) ==';
SELECT (SELECT COUNT(*) FROM HSDZ_MES_RESTORE.dbo.yj_field) AS 快照行数,
       (SELECT COUNT(*) FROM yj_field) AS 当前行数;
PRINT '== ② 按面板统计:快照有当前没有(被冲掉) ==';
SELECT TOP 15 r.panel_code, COUNT(*) AS n FROM HSDZ_MES_RESTORE.dbo.yj_field r
 WHERE NOT EXISTS (SELECT 1 FROM yj_field t WHERE t.panel_code=r.panel_code AND t.col_name=r.col_name AND t.place=r.place)
 GROUP BY r.panel_code ORDER BY n DESC;
PRINT '== ③ 快照有当前也有但内容变了(hidden/label被重置) ==';
SELECT TOP 10 r.panel_code, r.col_name, r.hidden AS 快照hidden, t.hidden AS 当前hidden
  FROM HSDZ_MES_RESTORE.dbo.yj_field r JOIN yj_field t ON t.panel_code=r.panel_code AND t.col_name=r.col_name AND t.place=r.place
 WHERE ISNULL(r.hidden,0) <> ISNULL(t.hidden,0) OR ISNULL(r.label,'') <> ISNULL(t.label,'')
 ORDER BY r.panel_code;
PRINT '== ④ 用户点名项核验 ==';
SELECT '供应商代码-PURCHASE_IN' AS k, COUNT(*) AS snap FROM HSDZ_MES_RESTORE.dbo.yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'供应商代码'
UNION ALL SELECT '供应商代码-当前', COUNT(*) FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'供应商代码'
UNION ALL SELECT '特采-QC_INSP快照', COUNT(*) FROM HSDZ_MES_RESTORE.dbo.yj_field WHERE panel_code='QC_INSP' AND col_name=N'特采'
UNION ALL SELECT '特采-QC_INSP当前', COUNT(*) FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'特采';
PRINT '== ⑤ 暂收单状态:快照 yj_doc_status vs 当前 vs 物理列 ==';
SELECT '快照st_QC_RECV' AS k, COUNT(*) AS n FROM HSDZ_MES_RESTORE.dbo.yj_doc_status WHERE panel_code='QC_RECV'
UNION ALL SELECT '当前st_QC_RECV', COUNT(*) FROM yj_doc_status WHERE panel_code='QC_RECV'
UNION ALL SELECT '快照sl单据状态已审核', COUNT(*) FROM HSDZ_MES_RESTORE.dbo.sl_recv WHERE 单据状态=N'已审核'
UNION ALL SELECT '当前sl单据状态已审核', COUNT(*) FROM sl_recv WHERE 单据状态=N'已审核'
UNION ALL SELECT '快照sl审核人非空', COUNT(*) FROM HSDZ_MES_RESTORE.dbo.sl_recv WHERE 审核人 IS NOT NULL AND 审核人<>''
UNION ALL SELECT '当前sl审核人非空', COUNT(*) FROM sl_recv WHERE 审核人 IS NOT NULL AND 审核人<>'';
GO
