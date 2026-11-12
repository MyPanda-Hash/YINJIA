-- q-06-batch-link.sql — 批次能否当链路键(只读)
SET NOCOUNT ON;
/* 1. 暂收单行样例 */
SELECT TOP 10 h.单据编号 AS 暂收单号, h.批次号 AS 头批次, d.物料编码, d.物料名称, d.批次号 AS 行批次, d.数量, d.采购单号, d.采购订单行号, d.入库单号
  FROM dbo.sl_recv_detail d JOIN dbo.sl_recv h ON h.单据编号 = d.单据编号
 WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
 ORDER BY h.单据日期 DESC, d.id DESC;

/* 2. 暂收行 × 入库行 按物料编码+批号 的命中率 */
SELECT COUNT(*) AS 暂收行,
       COUNT(pl.id) AS 按物料编码和批号命中入库行,
       COUNT(pl2.id) AS 按物料编码和批次号命中入库行
  FROM dbo.sl_recv_detail d
  JOIN dbo.sl_recv h ON h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel,'N')<>'Y'
  OUTER APPLY (SELECT TOP 1 b.id FROM dbo.bl_purchase_in b
                WHERE b.存货编码 = d.物料编码 AND b.批号 = d.批次号 AND ISNULL(b.asp_cancel,'N')<>'Y') pl
  OUTER APPLY (SELECT TOP 1 b.id FROM dbo.bl_purchase_in b
                WHERE b.存货编码 = d.物料编码 AND b.批次号 = d.批次号 AND ISNULL(b.asp_cancel,'N')<>'Y') pl2
 WHERE ISNULL(d.asp_cancel,'N')<>'Y';

/* 3. 入库行样例(带批号/订单号/源单) */
SELECT TOP 10 b.单据编号, b.单据日期, b.单据状态, b.来源单号, b.采购订单号, b.批次号,
       l.存货编码, l.存货名称, l.批号, l.批次号 AS 行批次, l.实收数量, l.行号, l.源单编号
  FROM dbo.bd_purchase_in b JOIN dbo.bl_purchase_in l ON l.单据编号 = b.单据编号
 WHERE ISNULL(b.asp_cancel,'N')<>'Y' AND ISNULL(l.asp_cancel,'N')<>'Y'
 ORDER BY b.id DESC;

/* 4. 检验单行样例(批号/批次号/入库单号) */
SELECT TOP 10 i.单据编号 AS 检验单号, i.暂收单号, d.物料编码, d.物料名称, d.批号, d.批次号, d.送检数量, d.合格数量, d.不合格数量, d.入库单号, d.特采
  FROM dbo.qc_insp_detail d JOIN dbo.qc_insp i ON i.单据编号 = d.单据编号
 WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND ISNULL(i.asp_cancel,'N')<>'Y'
 ORDER BY i.id DESC;
