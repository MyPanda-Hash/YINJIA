-- q-07-po-link.sql — 采购入库单能否按 采购订单号+物料编码(+批号) 回挂到暂收行(只读)
SET NOCOUNT ON;
/* 1. 暂收单头 采购订单号 是否非空 */
SELECT COUNT(*) AS 暂收单头,
       SUM(CASE WHEN ISNULL(采购订单号,N'')<>N'' THEN 1 ELSE 0 END) AS 有采购订单号
  FROM dbo.sl_recv WHERE ISNULL(asp_cancel,'N')<>'Y';

/* 2. 入库单头 采购订单号 是否非空 */
SELECT COUNT(*) AS 入库单头,
       SUM(CASE WHEN ISNULL(采购订单号,N'')<>N'' THEN 1 ELSE 0 END) AS 有采购订单号,
       SUM(CASE WHEN ISNULL(来源单号,N'')<>N'' THEN 1 ELSE 0 END) AS 有来源单号
  FROM dbo.bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y';

/* 3. 暂收行 → 入库行:按 采购订单号+存货编码(+批号) 命中 */
SELECT COUNT(*) AS 暂收行,
       COUNT(x.id) AS 按订单和物料命中,
       COUNT(y.id) AS 按订单物料批号命中
  FROM dbo.sl_recv_detail d
  JOIN dbo.sl_recv h ON h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel,'N')<>'Y'
  OUTER APPLY (SELECT TOP 1 l.id FROM dbo.bl_purchase_in l
                 JOIN dbo.bd_purchase_in b ON b.单据编号 = l.单据编号 AND ISNULL(b.asp_cancel,'N')<>'Y'
                WHERE ISNULL(l.asp_cancel,'N')<>'Y'
                  AND b.采购订单号 = h.采购订单号 AND l.存货编码 = d.物料编码) x
  OUTER APPLY (SELECT TOP 1 l.id FROM dbo.bl_purchase_in l
                 JOIN dbo.bd_purchase_in b ON b.单据编号 = l.单据编号 AND ISNULL(b.asp_cancel,'N')<>'Y'
                WHERE ISNULL(l.asp_cancel,'N')<>'Y'
                  AND b.采购订单号 = h.采购订单号 AND l.存货编码 = d.物料编码
                  AND (l.批号 = d.批次号 OR l.批次号 = d.批次号)) y
 WHERE ISNULL(d.asp_cancel,'N')<>'Y';

/* 4. 检验单行 批号/批次号 填充率(22 张真有暂收单的) */
SELECT COUNT(*) AS 检验行, SUM(CASE WHEN ISNULL(批号,N'')<>N'' THEN 1 ELSE 0 END) AS 有批号,
       SUM(CASE WHEN ISNULL(批次号,N'')<>N'' THEN 1 ELSE 0 END) AS 有批次号
  FROM dbo.qc_insp_detail d JOIN dbo.qc_insp i ON i.单据编号 = d.单据编号
 WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND ISNULL(i.asp_cancel,'N')<>'Y' AND ISNULL(i.暂收单号,N'')<>N'';

/* 5. 按暂收行看:检验单行 与 入库行 的覆盖(前 20 行样例) */
SELECT TOP 20 h.单据编号 AS 暂收单号, d.物料编码, d.物料名称, d.批次号,
       i.单据编号 AS 检验单号, l.单据编号 AS 入库单号, l.批号 AS 入库批号, l.实收数量
  FROM dbo.sl_recv_detail d
  JOIN dbo.sl_recv h ON h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel,'N')<>'Y'
  OUTER APPLY (SELECT TOP 1 x.单据编号 FROM dbo.qc_insp x
                 JOIN dbo.qc_insp_detail y ON y.单据编号 = x.单据编号
                WHERE x.暂收单号 = h.单据编号 AND y.物料编码 = d.物料编码
                  AND ISNULL(x.asp_cancel,'N')<>'Y' AND ISNULL(y.asp_cancel,'N')<>'Y') i
  OUTER APPLY (SELECT TOP 1 lin.单据编号 AS 入库单号, lin.批号 AS 入库批号, lin.实收数量
                 FROM dbo.bl_purchase_in lin
                 JOIN dbo.bd_purchase_in b ON b.单据编号 = lin.单据编号 AND ISNULL(b.asp_cancel,'N')<>'Y'
                WHERE ISNULL(lin.asp_cancel,'N')<>'Y'
                  AND (b.来源单号 = h.单据编号 OR b.来源单号 = d.单据编号)
                  AND lin.存货编码 = d.物料编码
                ORDER BY lin.id) l
 WHERE ISNULL(d.asp_cancel,'N')<>'Y'
 ORDER BY h.单据日期 DESC, d.id;
