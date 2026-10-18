SET NOCOUNT ON;
PRINT '=== CGRK-20260915-03214 明细行 ===';
SELECT id, 存货编码, 实收数量, 仓库编码 FROM bl_purchase_in WHERE 单据编号=N'CGRK-20260915-03214' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id;
PRINT '=== 该单 inh(全部) ===';
SELECT id, rid, 物料编码, 数量, 仓库编码, ISNULL(asp_cancel,'N') cxl FROM inh WHERE 单据编号=N'CGRK-20260915-03214' ORDER BY id;
