SET NOCOUNT ON;
PRINT N'=== 送料暂收单 SL-2026-10-0126 的全部行(看哪些没走检验=免检) ===';
SELECT ROW_NUMBER() OVER (ORDER BY s.id) AS 行号, s.物料编码, s.物料名称, s.数量, s.批次号,
       (SELECT COUNT(*) FROM qc_insp i WHERE i.暂收单号 = s.单据编号 AND ISNULL(i.asp_cancel,'N')<>'Y'
          AND EXISTS (SELECT 1 FROM qc_insp_detail d WHERE d.单据编号 = i.单据编号 AND d.物料编码 = s.物料编码)) AS 有检验单
  FROM sl_recv_detail s
 WHERE s.单据编号 = N'SL-2026-10-0126' AND ISNULL(s.asp_cancel,'N')<>'Y'
 ORDER BY s.id;
PRINT N'=== 该暂收单对应的检验单 ===';
SELECT 单据编号, 暂收单号, 采购订单号, 单据日期 FROM qc_insp WHERE 暂收单号 = N'SL-2026-10-0126' AND ISNULL(asp_cancel,'N')<>'Y';
PRINT N'=== 那张检验单的行 ===';
SELECT ROW_NUMBER() OVER (ORDER BY d.id) AS 检验单行号, d.物料编码, d.物料名称, d.送检数量, d.批次号
  FROM qc_insp_detail d WHERE d.单据编号 = N'IJ-2026-10-0016' AND ISNULL(d.asp_cancel,'N')<>'Y' ORDER BY d.id;
