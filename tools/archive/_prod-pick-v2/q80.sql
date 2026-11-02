SET NOCOUNT ON;
SELECT id, 工单号, 工单行号, 领料单号, ISNULL(退料单号,'') 退料单号, 状态, 已领项数, 物料项数 FROM wo_pick_doc ORDER BY id;
GO
SELECT 领料单号, 物料编码, 退料数量, 退料单号 FROM wo_pick_return ORDER BY id;
GO
SELECT 单据编号, ISNULL(退料标志,'') 标志, ISNULL(asp_cancel,'N') 作废, LEFT(ISNULL(备注,''),40) 备注 FROM bd_other_in WHERE 单据编号 LIKE 'OI-2026-10-0005%';
