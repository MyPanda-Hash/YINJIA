SET NOCOUNT ON;
/* 1) 这几行的暂收单 → 物料/批次/供应商 */
SELECT TOP 12 h.单据编号 AS 暂收单, CONVERT(nvarchar(10),h.单据日期,120) AS 日期, d.物料编码, d.物料名称, d.批次号 AS 行批次, h.批次号 AS 头批次,
       ISNULL(h.供应商,N'(空)') AS 供应商, h.采购订单号
  FROM dbo.sl_recv_detail d JOIN dbo.sl_recv h ON h.单据编号=d.单据编号
 WHERE h.单据编号 IN (N'SL-2026-10-0114', N'SL-2026-10-0115', N'SL-2026-10-0116', N'SL-2026-10-0117', N'SL-2026-10-0118')
 ORDER BY h.单据编号, d.id;
