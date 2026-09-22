SET NOCOUNT ON;
-- A. 索引级 EP 是否存在
SELECT 'A.索引EP' AS k, OBJECT_NAME(p.major_id) AS obj, p.name, p.minor_id FROM sys.extended_properties p
 WHERE p.name=N'MS_Description' AND p.class=1 AND p.minor_id>0 AND OBJECT_NAME(p.major_id) IN ('bs_wh','kucun','bl_sale_out');
GO
-- B. 单独试 STATISTICS 级 EP
EXEC sp_addextendedproperty N'MS_Description', N'测试统计注释', N'SCHEMA', N'dbo', N'TABLE', N'bd_purchase_in', N'STATISTICS', N'ST_bd_purchase_in_单据状态';
GO
-- C. 单独试 INDEX 级 EP
EXEC sp_addextendedproperty N'MS_Description', N'测试索引注释2', N'SCHEMA', N'dbo', N'TABLE', N'bs_wh', N'INDEX', N'IX_bs_wh_仓库名称';
GO
