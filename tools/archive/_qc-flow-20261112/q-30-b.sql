SET NOCOUNT ON;
PRINT N'== 该批次/物料有没有采购入库行 ==';
SELECT TOP 10 b.单据编号, CONVERT(nvarchar(10),b.单据日期,120) AS 日期, b.单据状态, ISNULL(b.来源单号,N'(空)') AS 来源单号,
       ISNULL(b.是否已转ERP,N'(空)') AS 转ERP, l.存货编码, l.批号, l.批次号, l.实收数量
  FROM dbo.bl_purchase_in l JOIN dbo.bd_purchase_in b ON b.单据编号=l.单据编号
 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(b.asp_cancel,'N')<>'Y'
   AND (l.批次号 = N'XCL-20261012' OR l.批号 = N'XCL-20261012' OR l.存货编码 = N'Y-M-D')
 ORDER BY b.id DESC;

PRINT N'== 采购入库单 批次号的取值样式(最近 15 条) ==';
SELECT TOP 15 b.单据编号, l.存货编码, l.批号, l.批次号, ISNULL(b.来源单号,N'(空)') AS 来源单号
  FROM dbo.bl_purchase_in l JOIN dbo.bd_purchase_in b ON b.单据编号=l.单据编号
 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(b.asp_cancel,'N')<>'Y'
 ORDER BY b.id DESC;
