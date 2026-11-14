SET NOCOUNT ON;
PRINT N'=== A. 检验数据记录 抽样(5 条,带检验单号) ===';
SELECT TOP 5 r.id, r.单据编号 AS rec_no, r.来料检验单号 AS insp_no, r.物料编码, r.物料批次, r.来料数量
FROM qc_insp_rec r WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.来料检验单号,N'')<>N'' ORDER BY r.id DESC;

PRINT N'=== B. 检验单头 抽样 ===';
SELECT TOP 5 单据编号, 暂收单号, 采购订单号, 批次号, 供应商
FROM qc_insp WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;

PRINT N'=== C. 检验单明细 抽样(入库单号/采购订单行号 填充率) ===';
SELECT COUNT(*) AS tot,
       SUM(CASE WHEN ISNULL(入库单号,N'')<>N'' THEN 1 ELSE 0 END) AS has_in_no,
       SUM(CASE WHEN ISNULL(采购订单行号,N'')<>N'' THEN 1 ELSE 0 END) AS has_po_line,
       SUM(CASE WHEN ISNULL(批次号,N'')<>N'' THEN 1 ELSE 0 END) AS has_batch
FROM qc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y';

PRINT N'=== D. 暂收单明细 抽样 ===';
SELECT TOP 5 单据编号, 物料编码, 物料名称, 采购单号, 订单号, 采购订单行号, 入库单号, 批次号
FROM sl_recv_detail WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;

PRINT N'=== E. 采购入库单 明细 抽样 ===';
SELECT TOP 5 p.单据编号 AS in_no, p.行号 AS in_line, p.存货编码, p.批号
FROM bl_purchase_in p WHERE ISNULL(p.asp_cancel,'N')<>'Y' ORDER BY p.id DESC;

PRINT N'=== F. 入库单头 一单多行时行号唯一性 ===';
SELECT TOP 3 单据编号, COUNT(*) AS n FROM bl_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号 ORDER BY COUNT(*) DESC;
