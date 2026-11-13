-- q-05-link.sql — 状态真源 yj_doc_status + 链路命中率(只读)
SET NOCOUNT ON;
/* 1. 三张面板在 yj_doc_status 里的状态分布 */
SELECT panel_code AS 面板,
       SUM(CASE WHEN ISNULL(canceled,'N')='Y' THEN 1 ELSE 0 END) AS 已作废,
       SUM(CASE WHEN ISNULL(stopped,'N')='Y' AND ISNULL(canceled,'N')<>'Y' THEN 1 ELSE 0 END) AS 已中止,
       SUM(CASE WHEN ISNULL(pending,'N')='Y' THEN 1 ELSE 0 END) AS 审批中,
       SUM(CASE WHEN ISNULL(shr,N'')<>N'' AND ISNULL(pending,'N')<>'Y' THEN 1 ELSE 0 END) AS 已审核,
       SUM(CASE WHEN ISNULL(shr,N'')=N'' AND ISNULL(pending,'N')<>'Y' THEN 1 ELSE 0 END) AS 草稿类,
       COUNT(*) AS 状态行
  FROM dbo.yj_doc_status
 WHERE panel_code IN (N'QC_RECV', N'QC_INSP', N'PURCHASE_IN')
 GROUP BY panel_code;

/* 2. 检验单 → 暂收单 命中率 */
SELECT COUNT(*) AS 检验单,
       SUM(CASE WHEN ISNULL(i.暂收单号,N'')<>N'' THEN 1 ELSE 0 END) AS 暂收单号非空,
       COUNT(r.单据编号) AS 暂收单存在
  FROM dbo.qc_insp i
  LEFT JOIN dbo.sl_recv r ON r.单据编号 = i.暂收单号 AND ISNULL(r.asp_cancel,'N')<>'Y'
 WHERE ISNULL(i.asp_cancel,'N')<>'Y';

/* 3. 采购入库单 来源单号 是否指到检验单 / 暂收单 */
SELECT ISNULL(b.来源单据, N'(空)') AS 来源单据, COUNT(*) AS 单数,
       COUNT(i.单据编号) AS 指到检验单,
       COUNT(r.单据编号) AS 指到暂收单,
       SUM(CASE WHEN ISNULL(b.来源单号,N'')=N'' THEN 1 ELSE 0 END) AS 来源空
  FROM dbo.bd_purchase_in b
  LEFT JOIN dbo.qc_insp i ON i.单据编号 = b.来源单号 AND ISNULL(i.asp_cancel,'N')<>'Y'
  LEFT JOIN dbo.sl_recv r ON r.单据编号 = b.来源单号 AND ISNULL(r.asp_cancel,'N')<>'Y'
 WHERE ISNULL(b.asp_cancel,'N')<>'Y'
 GROUP BY b.来源单据;

/* 4. 检验单行 → 入库单号 命中率 */
SELECT COUNT(*) AS 检验行,
       SUM(CASE WHEN ISNULL(d.入库单号,N'')<>N'' THEN 1 ELSE 0 END) AS 入库单号非空,
       COUNT(b.单据编号) AS 入库单存在
  FROM dbo.qc_insp_detail d
  LEFT JOIN dbo.bd_purchase_in b ON b.单据编号 = d.入库单号 AND ISNULL(b.asp_cancel,'N')<>'Y'
 WHERE ISNULL(d.asp_cancel,'N')<>'Y';

/* 5. 暂收单行 → 是否已被检验单行认领(按 检验单.暂收单号 + 检验行.物料编码) */
SELECT COUNT(*) AS 暂收行,
       COUNT(i.单据编号) AS 有检验单行
  FROM dbo.sl_recv_detail t
  JOIN dbo.sl_recv h ON h.单据编号=t.单据编号 AND ISNULL(h.asp_cancel,'N')<>'Y'
  OUTER APPLY (SELECT TOP 1 x.单据编号 FROM dbo.qc_insp x
                 JOIN dbo.qc_insp_detail y ON y.单据编号 = x.单据编号
                WHERE x.暂收单号 = h.单据编号 AND y.物料编码 = t.物料编码
                  AND ISNULL(x.asp_cancel,'N')<>'Y' AND ISNULL(y.asp_cancel,'N')<>'Y') i
 WHERE ISNULL(t.asp_cancel,'N')<>'Y';
