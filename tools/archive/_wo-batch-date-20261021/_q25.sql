SET NOCOUNT ON;
SELECT N'wo_transfer_log' t, COUNT(*) n FROM dbo.wo_transfer_log WHERE ISNULL([批次号],N'')=N'20261014'
UNION ALL SELECT N'qc_catalog_detail', COUNT(*) FROM dbo.qc_catalog_detail WHERE ISNULL([批次号],N'')=N'20261014'
UNION ALL SELECT N'feed_confirm', COUNT(*) FROM dbo.feed_confirm WHERE ISNULL([批号],N'')=N'20261014'
UNION ALL SELECT N'inv_cost_ledger', COUNT(*) FROM dbo.inv_cost_ledger WHERE ISNULL([批号],N'')=N'20261014'
UNION ALL SELECT N'order_bs', COUNT(*) FROM dbo.order_bs WHERE ISNULL(lot_no,N'')=N'20261014'
UNION ALL SELECT N'Porder', COUNT(*) FROM dbo.Porder WHERE ISNULL(lot_no,N'')=N'20261014'
UNION ALL SELECT N'plang.lot_no', COUNT(*) FROM dbo.plang WHERE ISNULL(lot_no,N'')=N'20261014'
UNION ALL SELECT N'scjl.lot_no', COUNT(*) FROM dbo.scjl WHERE ISNULL(lot_no,N'')=N'20261014'
UNION ALL SELECT N'plang_pc.lot_no', COUNT(*) FROM dbo.plang_pc WHERE ISNULL(lot_no,N'')=N'20261014'
UNION ALL SELECT N'bl_stock_close', COUNT(*) FROM dbo.bl_stock_close WHERE ISNULL([批号],N'')=N'20261014'
UNION ALL SELECT N'bl_stocktake', COUNT(*) FROM dbo.bl_stocktake WHERE ISNULL([批号],N'')=N'20261014'
UNION ALL SELECT N'bl_transfer', COUNT(*) FROM dbo.bl_transfer WHERE ISNULL([批号],N'')=N'20261014'
UNION ALL SELECT N'bd_manu_order', COUNT(*) FROM dbo.bd_manu_order WHERE ISNULL([批号],N'')=N'20261014'
UNION ALL SELECT N'bl_manu_order', COUNT(*) FROM dbo.bl_manu_order WHERE ISNULL([批号],N'')=N'20261014'
UNION ALL SELECT N'bd_pu_label', COUNT(*) FROM dbo.bd_pu_label WHERE ISNULL([批次号],N'')=N'20261014'
UNION ALL SELECT N'qc_jjf', COUNT(*) FROM dbo.qc_jjf WHERE ISNULL([批次号],N'')=N'20261014';
GO
