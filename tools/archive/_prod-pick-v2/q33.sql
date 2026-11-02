SET NOCOUNT ON;
SELECT 工单号, 工单行号, 状态, ISNULL(领料单号,'') 领料单, ISNULL(退料单号,'(已作废)') 退料单, 已领项数, 物料项数 FROM wo_pick_doc ORDER BY id;
GO
SELECT '工单' k, pl_no a, CAST(pl_xc AS nvarchar) b, dm c FROM plang WHERE pl_no LIKE 'GD-E2E-%'
UNION ALL SELECT 'BOM', 单据编号, 产品编号, 产品名称 FROM rd_asm_bom_head WHERE 单据编号 LIKE 'AB2-E2E-%';
