SET NOCOUNT ON;
PRINT '=== 该单明细(id 与内容) ===';
SELECT id, 物料编码, 数量, 仓库编码 FROM bl_purchase_in WHERE 单据编号=N'CGRK-20260915-03214' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id;
PRINT '=== inh 全部(含作废) ===';
SELECT id, rid, 物料编码, 数量, 仓库编码, ISNULL(asp_cancel,'N') cxl, 单据日期 FROM inh WHERE 单据编号=N'CGRK-20260915-03214' ORDER BY id;
