SET NOCOUNT ON;
SELECT N'bd_dispatch' AS t, COUNT(*) AS n, MIN(单据编号) AS s FROM bd_dispatch WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'qc_proc_insp_head', COUNT(*), MIN(单据编号) FROM qc_proc_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'qc_first_insp_head', COUNT(*), MIN(单据编号) FROM qc_first_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'qc_insp_rec', COUNT(*), MIN(单据编号) FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'qc_catalog', COUNT(*), MIN(单据编号) FROM qc_catalog WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'qc_tc_in', COUNT(*), MIN(单据编号) FROM qc_tc_in WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'rd_spec_doc_head', COUNT(*), MIN(单据编号) FROM rd_spec_doc_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'bd_stock_close(月结)', COUNT(*), MIN(结转单据编号) FROM bd_stock_close;
PRINT '== inh 单据类型分布 ==';
SELECT ISNULL(单据类型,N'(空)') AS 单据类型, COUNT(*) AS rows, MIN(单据编号) AS sample FROM inh GROUP BY 单据类型 ORDER BY COUNT(*) DESC;
PRINT '== outh ==';
SELECT ISNULL(单据类型,N'(空)') AS 单据类型, COUNT(*) AS rows, MIN(单据编号) AS sample FROM outh GROUP BY 单据类型 ORDER BY COUNT(*) DESC;
