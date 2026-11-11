SET NOCOUNT ON;
PRINT N'=== A. qc_insp 头 填充率 ===';
SELECT COUNT(*) AS tot,
       SUM(CASE WHEN ISNULL(暂收单号,N'')<>N'' THEN 1 ELSE 0 END) AS has_recv,
       SUM(CASE WHEN ISNULL(采购订单号,N'')<>N'' THEN 1 ELSE 0 END) AS has_po
FROM qc_insp WHERE ISNULL(asp_cancel,'N')<>'Y';

PRINT N'=== B. bd_purchase_in 来源单号 分布 ===';
SELECT TOP 10 来源单据, COUNT(*) AS n FROM bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 来源单据 ORDER BY COUNT(*) DESC;
SELECT COUNT(*) AS src_is_insp FROM bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y' AND 来源单号 LIKE N'IJ-%';

PRINT N'=== C. 候选视图:能解析出多少条链 ===';
WITH d AS (
  SELECT d.*, ROW_NUMBER() OVER (PARTITION BY d.单据编号 ORDER BY d.id) AS insp_line
  FROM qc_insp_detail d WHERE ISNULL(d.asp_cancel,'N')<>'Y'
), sl AS (
  SELECT s.单据编号, s.物料编码, ROW_NUMBER() OVER (PARTITION BY s.单据编号, s.物料编码 ORDER BY s.id) AS rn,
         ROW_NUMBER() OVER (PARTITION BY s.单据编号 ORDER BY s.id) AS recv_line
  FROM sl_recv_detail s WHERE ISNULL(s.asp_cancel,'N')<>'Y'
)
SELECT COUNT(*) AS recs,
       SUM(CASE WHEN i.单据编号 IS NOT NULL THEN 1 ELSE 0 END) AS mat_insp,
       SUM(CASE WHEN ISNULL(i.暂收单号,N'')<>N'' THEN 1 ELSE 0 END) AS has_recv_no,
       SUM(CASE WHEN ISNULL(i.采购订单号,N'')<>N'' OR ISNULL(d.采购订单行号,N'')<>N'' THEN 1 ELSE 0 END) AS has_po,
       SUM(CASE WHEN d.id IS NOT NULL THEN 1 ELSE 0 END) AS mat_line,
       SUM(CASE WHEN ISNULL(d.入库单号,N'')<>N'' THEN 1 ELSE 0 END) AS has_in_no
FROM qc_insp_rec r
LEFT JOIN qc_insp i ON i.单据编号 = r.来料检验单号 AND ISNULL(i.asp_cancel,'N')<>'Y'
LEFT JOIN d ON d.单据编号 = r.来料检验单号 AND d.物料编码 = r.物料编码
WHERE ISNULL(r.asp_cancel,'N')<>'Y';

PRINT N'=== D. 采购入库单 行号 填充率 ===';
SELECT COUNT(*) AS tot, SUM(CASE WHEN ISNULL(行号,N'')<>N'' THEN 1 ELSE 0 END) AS has_line FROM bl_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y';

PRINT N'=== E. 一条完整链样例 ===';
SELECT TOP 3 r.单据编号 AS rec_no, r.来料检验单号, r.物料编码, r.物料批次,
       i.暂收单号, i.采购订单号, d.入库单号, d.采购订单行号
FROM qc_insp_rec r
LEFT JOIN qc_insp i ON i.单据编号 = r.来料检验单号
LEFT JOIN qc_insp_detail d ON d.单据编号 = r.来料检验单号 AND d.物料编码 = r.物料编码
WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(d.入库单号,N'')<>N'' ORDER BY r.id DESC;
