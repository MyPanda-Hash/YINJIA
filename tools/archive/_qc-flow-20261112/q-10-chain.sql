-- q-10-chain.sql — 品质流程监控:按「暂收单行」串联 送料→检验→入库 的完整取数原型(只读)
SET NOCOUNT ON;

SELECT TOP 30
  h.单据编号                      AS 送料单号,
  CONVERT(nvarchar(10), h.单据日期, 120) AS 送料日期,
  d.物料编码, d.物料名称, d.批次号 AS 批号, d.数量 AS 来料数量,
  ins.检验单号, ins.送检数量, ins.合格数量, ins.不合格数量,
  put.入库单号, put.匹配方式, put.实收数量,
  st1.状态 AS 送料状态, st2.状态 AS 检验状态, st3.状态 AS 入库状态
  FROM dbo.sl_recv_detail d
  JOIN dbo.sl_recv h ON h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel,'N')<>'Y'
  OUTER APPLY (
    SELECT TOP 1 x.单据编号 AS 检验单号, x.检验日期, x.检验员, x.总结论,
                 y.送检数量, y.合格数量, y.不合格数量, y.批次号 AS 检验批次, y.入库单号 AS 检验入库单号
      FROM dbo.qc_insp x
      JOIN dbo.qc_insp_detail y ON y.单据编号 = x.单据编号 AND ISNULL(y.asp_cancel,'N')<>'Y'
     WHERE ISNULL(x.asp_cancel,'N')<>'Y' AND x.暂收单号 = h.单据编号 AND y.物料编码 = d.物料编码
     ORDER BY CASE WHEN ISNULL(y.批次号,N'') = ISNULL(d.批次号,N'') THEN 0 ELSE 1 END, x.id DESC
  ) ins
  OUTER APPLY (
    SELECT TOP 1 q.入库单号, q.入库日期, q.入库状态, q.实收数量, q.批号, q.匹配方式
      FROM (
        SELECT b.单据编号 AS 入库单号, b.单据日期 AS 入库日期, b.单据状态 AS 入库状态,
               l.实收数量, l.批号, N'检验单行' AS 匹配方式, 1 AS 优先级, l.id AS 排序
          FROM dbo.bl_purchase_in l
          JOIN dbo.bd_purchase_in b ON b.单据编号 = l.单据编号 AND ISNULL(b.asp_cancel,'N')<>'Y'
         WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND l.存货编码 = d.物料编码
           AND b.单据编号 = ins.检验入库单号
        UNION ALL
        SELECT b.单据编号, b.单据日期, b.单据状态, l.实收数量, l.批号, N'来源单号', 2, l.id
          FROM dbo.bl_purchase_in l
          JOIN dbo.bd_purchase_in b ON b.单据编号 = l.单据编号 AND ISNULL(b.asp_cancel,'N')<>'Y'
         WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND l.存货编码 = d.物料编码
           AND b.来源单号 IN (ins.检验单号, h.单据编号)
        UNION ALL
        SELECT b.单据编号, b.单据日期, b.单据状态, l.实收数量, l.批号, N'批号推定', 3, l.id
          FROM dbo.bl_purchase_in l
          JOIN dbo.bd_purchase_in b ON b.单据编号 = l.单据编号 AND ISNULL(b.asp_cancel,'N')<>'Y'
         WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND l.存货编码 = d.物料编码
           AND ISNULL(d.批次号,N'') <> N''
           AND (l.批次号 = d.批次号 OR l.批号 = d.批次号)
      ) q
     ORDER BY q.优先级, q.排序 DESC
  ) put
  OUTER APPLY (SELECT TOP 1 CASE WHEN s.canceled='Y' THEN N'已作废' WHEN s.stopped='Y' THEN N'已中止'
                                  WHEN s.pending='Y' THEN N'审批中'
                                  WHEN ISNULL(s.shr,N'')<>N'' THEN N'已审核' ELSE N'草稿' END AS 状态
                 FROM dbo.yj_doc_status s WHERE s.panel_code = N'QC_RECV' AND s.doc_no = h.单据编号) st1
  OUTER APPLY (SELECT TOP 1 CASE WHEN s.canceled='Y' THEN N'已作废' WHEN s.stopped='Y' THEN N'已中止'
                                  WHEN s.pending='Y' THEN N'审批中'
                                  WHEN ISNULL(s.shr,N'')<>N'' THEN N'已审核' ELSE N'草稿' END AS 状态
                 FROM dbo.yj_doc_status s WHERE s.panel_code = N'QC_INSP' AND s.doc_no = ins.检验单号) st2
  OUTER APPLY (SELECT TOP 1 CASE WHEN s.canceled='Y' THEN N'已作废' WHEN s.stopped='Y' THEN N'已中止'
                                  WHEN s.pending='Y' THEN N'审批中'
                                  WHEN ISNULL(s.shr,N'')<>N'' THEN N'已审核' ELSE N'草稿' END AS 状态
                 FROM dbo.yj_doc_status s WHERE s.panel_code = N'PURCHASE_IN' AND s.doc_no = put.入库单号) st3
 WHERE ISNULL(d.asp_cancel,'N')<>'Y'
 ORDER BY h.单据日期 DESC, h.单据编号, d.id;

/* 覆盖率:三种入库匹配方式各多少行 */
SELECT ISNULL(put.匹配方式, N'(未匹配)') AS 入库匹配方式, COUNT(*) AS 行数
  FROM dbo.sl_recv_detail d
  JOIN dbo.sl_recv h ON h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel,'N')<>'Y'
  OUTER APPLY (
    SELECT TOP 1 x.单据编号 AS 检验单号, y.入库单号 AS 检验入库单号
      FROM dbo.qc_insp x
      JOIN dbo.qc_insp_detail y ON y.单据编号 = x.单据编号 AND ISNULL(y.asp_cancel,'N')<>'Y'
     WHERE ISNULL(x.asp_cancel,'N')<>'Y' AND x.暂收单号 = h.单据编号 AND y.物料编码 = d.物料编码
     ORDER BY CASE WHEN ISNULL(y.批次号,N'') = ISNULL(d.批次号,N'') THEN 0 ELSE 1 END, x.id DESC
  ) ins
  OUTER APPLY (
    SELECT TOP 1 q.匹配方式 FROM (
        SELECT N'检验单行' AS 匹配方式, 1 AS 优先级, l.id
          FROM dbo.bl_purchase_in l JOIN dbo.bd_purchase_in b ON b.单据编号 = l.单据编号 AND ISNULL(b.asp_cancel,'N')<>'Y'
         WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND l.存货编码 = d.物料编码 AND b.单据编号 = ins.检验入库单号
        UNION ALL
        SELECT N'来源单号', 2, l.id
          FROM dbo.bl_purchase_in l JOIN dbo.bd_purchase_in b ON b.单据编号 = l.单据编号 AND ISNULL(b.asp_cancel,'N')<>'Y'
         WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND l.存货编码 = d.物料编码 AND b.来源单号 IN (ins.检验单号, h.单据编号)
        UNION ALL
        SELECT N'批号推定', 3, l.id
          FROM dbo.bl_purchase_in l JOIN dbo.bd_purchase_in b ON b.单据编号 = l.单据编号 AND ISNULL(b.asp_cancel,'N')<>'Y'
         WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND l.存货编码 = d.物料编码
           AND ISNULL(d.批次号,N'') <> N'' AND (l.批次号 = d.批次号 OR l.批号 = d.批次号)
      ) q ORDER BY q.优先级, q.id DESC
  ) put
 WHERE ISNULL(d.asp_cancel,'N')<>'Y'
 GROUP BY put.匹配方式;

/* 覆盖率:有无检验单 */
SELECT CASE WHEN ins.检验单号 IS NULL THEN N'(无检验单)' ELSE N'(有检验单)' END AS 检验覆盖, COUNT(*) AS 行数
  FROM dbo.sl_recv_detail d
  JOIN dbo.sl_recv h ON h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel,'N')<>'Y'
  OUTER APPLY (
    SELECT TOP 1 x.单据编号 AS 检验单号
      FROM dbo.qc_insp x JOIN dbo.qc_insp_detail y ON y.单据编号 = x.单据编号 AND ISNULL(y.asp_cancel,'N')<>'Y'
     WHERE ISNULL(x.asp_cancel,'N')<>'Y' AND x.暂收单号 = h.单据编号 AND y.物料编码 = d.物料编码
     ORDER BY x.id DESC
  ) ins
 WHERE ISNULL(d.asp_cancel,'N')<>'Y'
 GROUP BY CASE WHEN ins.检验单号 IS NULL THEN N'(无检验单)' ELSE N'(有检验单)' END;
