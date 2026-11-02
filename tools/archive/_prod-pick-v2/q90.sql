SET NOCOUNT ON;
SELECT '工单' k, COUNT(*) n FROM plang WHERE pl_no LIKE 'GD-DEMO-%' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT '组装工艺清单(含BOM)', COUNT(*) FROM rd_asm_proc_head WHERE 单据编号 LIKE 'AP-DEMO-%'
UNION ALL SELECT 'BOM用料行', COUNT(*) FROM rd_asm_proc_detail WHERE 单据编号 LIKE 'AP-DEMO-%' AND 表区=N'物料清单'
UNION ALL SELECT '台账(未开单应为0)', COUNT(*) FROM wo_pick_doc WHERE 工单号 LIKE 'GD-DEMO-%';
