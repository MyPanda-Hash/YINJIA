SET NOCOUNT ON;
/* 这几个批次到底有没有采购入库行(任意单据,含已转ERP/已作废,只看批次号或批号相等) */
DECLARE @b TABLE (b nvarchar(100));
INSERT INTO @b (b) VALUES (N'XCL-20261012'), (N'HKB-20261012'), (N'YCYX-20261012'), (N'SDXYH-20261012'), (N'AJ-20261012');
SELECT x.b AS 批次号,
       (SELECT COUNT(*) FROM dbo.bl_purchase_in l
          JOIN dbo.bd_purchase_in h ON h.单据编号 = l.单据编号
         WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
           AND (l.批次号 = x.b OR l.批号 = x.b)) AS 入库行数
  FROM @b x;

/* 这些物料最近三张入库单(看批次号是不是"同一供应+别的日期") */
SELECT TOP 12 l.存货编码, l.批次号, l.批号, h.单据编号, CONVERT(nvarchar(10),h.单据日期,120) AS 日期, h.单据状态, h.是否已转ERP
  FROM dbo.bl_purchase_in l JOIN dbo.bd_purchase_in h ON h.单据编号 = l.单据编号
 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
   AND l.存货编码 IN (N'Y-M-D', N'YJ-HKB-001', N'YJ-YCYX-054', N'YJ-SDXYH-015', N'YJ-AJ-009')
 ORDER BY h.单据日期 DESC, l.id;
