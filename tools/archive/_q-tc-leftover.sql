SET NOCOUNT ON;
-- run2 中断残留盘点:今天 10:50 之后造的 链路单据
SELECT N'1-特采单' AS 段, RTRIM(单据编号) AS 单据编号, 检验单号, 总数量,
       ISNULL(s.canceled,'N') AS canceled
FROM qc_tc_in t LEFT JOIN yj_doc_status s ON s.panel_code='QC_TC_IN' AND s.doc_no=t.单据编号
WHERE t.asp_time1 >= '2026-09-22 10:50' ORDER BY t.id;

SELECT N'2-检验单' AS 段, RTRIM(单据编号) AS 单据编号, ISNULL(s.canceled,'N') AS canceled
FROM qc_insp t LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=t.单据编号
WHERE t.asp_time1 >= '2026-09-22 10:50' ORDER BY t.id;

SELECT N'3-入库单' AS 段, RTRIM(单据编号) AS 单据编号, ISNULL(s.canceled,'N') AS canceled
FROM bd_purchase_in t LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=t.单据编号
WHERE t.asp_time1 >= '2026-09-22 10:50' ORDER BY t.id;

SELECT N'4-暂收单' AS 段, RTRIM(单据编号) AS 单据编号, ISNULL(s.canceled,'N') AS canceled
FROM sl_recv t LEFT JOIN yj_doc_status s ON s.panel_code='QC_RECV' AND s.doc_no=t.单据编号
WHERE t.asp_time1 >= '2026-09-22 10:50' ORDER BY t.id;

SELECT N'5-退料单' AS 段, RTRIM(单据编号) AS 单据编号, ISNULL(s.canceled,'N') AS canceled
FROM qc_return t LEFT JOIN yj_doc_status s ON s.panel_code='QC_RETURN' AND s.doc_no=t.单据编号
WHERE t.asp_time1 >= '2026-09-22 10:50' ORDER BY t.id;
