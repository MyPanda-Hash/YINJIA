-- q-30-mydata.sql — 本轮探针生成的测试数据清单(含所带采购订单号)
SET NOCOUNT ON;
SELECT 'A.检验目录行' AS k, id, 检测物料类别 AS 类别, 物料名称, 物料编码, 批次号, 数量, 检验状态, 是否合格, 检验单号, 检验数据记录单号
  FROM qc_catalog_detail WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id;
SELECT TOP 20 'B.相关来料检验单' AS k, 单据编号, 单据日期, 暂收单号, 采购订单号, 批次号, 数量
  FROM qc_insp WHERE 单据编号 IN (SELECT DISTINCT 检验单号 FROM qc_catalog_detail WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(检验单号,N'')<>'') ORDER BY 单据编号 DESC;
SELECT TOP 20 'C.检验数据记录(报告)' AS k, r.单据编号, r.单据日期, r.物料名称, r.物料编码, r.物料批次, r.来料数量, r.检验人, r.表单审核人
  FROM qc_insp_rec r WHERE ISNULL(r.asp_cancel,'N') <> 'Y' ORDER BY r.id DESC;
SELECT TOP 12 'D.本轮自建暂收单' AS k, 单据编号, 单据日期, 供应商, 采购订单号, 批次号, 数量
  FROM sl_recv WHERE 单据编号 >= N'SL-2026-09-0159' ORDER BY 单据编号 DESC;
SELECT TOP 12 'E.暂收单状态' AS k, doc_no, CASE WHEN canceled='Y' THEN N'作废' WHEN shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END AS 状态
  FROM yj_doc_status WHERE panel_code = N'QC_RECV' AND doc_no >= N'SL-2026-09-0159' ORDER BY doc_no DESC;
GO
