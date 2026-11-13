SET NOCOUNT ON;
SELECT SUM(CASE WHEN ISNULL(匹配来源单号,N'')<>N'' THEN 1 ELSE 0 END) AS 有匹配来源单号,
       SUM(CASE WHEN 匹配来源单号 LIKE N'SL%' THEN 1 ELSE 0 END) AS 匹配到SL,
       SUM(CASE WHEN 匹配来源单号 LIKE N'IJ%' THEN 1 ELSE 0 END) AS 匹配到IJ,
       COUNT(*) AS 总数
  FROM dbo.bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT TOP 15 单据编号, 单据日期, 供应商, 匹配来源单号, 来源单据, 来源单号, 采购订单号, 批次号, 是否已转ERP, 单据状态
  FROM dbo.bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
SELECT TOP 15 l.单据编号, l.存货编码, l.存货名称, l.批号, l.批次号, l.实收数量, l.送检数量, l.是否来料检验, l.特采, l.源单编号, l.源单行号
  FROM dbo.bl_purchase_in l WHERE ISNULL(l.asp_cancel,'N')<>'Y' ORDER BY l.id DESC;
