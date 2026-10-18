SET NOCOUNT ON;
PRINT '=== CGRK-20260915-03214 明细 ===';
SELECT 序号, 存货编码, ISNULL(批号,'<NULL>') lot, 数量, 仓库编码 FROM bl_purchase_in WHERE 单据编号=N'CGRK-20260915-03214' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY 序号;
PRINT '=== 该单 inh 流水 ===';
SELECT id, 物料编码, ISNULL(批号,'<NULL>') lot, 数量, 仓库编码, 单据日期, ISNULL(asp_cancel,'N') cxl FROM inh WHERE 单据编号=N'CGRK-20260915-03214' ORDER BY id;
