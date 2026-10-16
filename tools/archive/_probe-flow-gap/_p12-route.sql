SET NOCOUNT ON;
PRINT '=== 工艺路线 bs_route ===';
SELECT * FROM bs_route;
GO
PRINT '=== 工序 bs_op ===';
SELECT * FROM bs_op;
GO
PRINT '=== plang 工艺路线与行 ===';
SELECT id, pl_no, pl_xc, scx, dm, mc, pl_sl, xq_sl, [工艺路线], [批次号], [作业员], [模具类型] FROM plang;
GO
PRINT '=== 工序台账 wo_process_line ===';
SELECT * FROM wo_process_line ORDER BY id;
GO
PRINT '=== 生产线档案 bs_prod_line ===';
SELECT * FROM bs_prod_line;
GO
