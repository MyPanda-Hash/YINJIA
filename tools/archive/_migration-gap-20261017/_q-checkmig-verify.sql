SET NOCOUNT ON;
SELECT 'v_lot_trace' AS obj, CASE WHEN OBJECT_ID('dbo.v_lot_trace') IS NULL THEN '不存在' ELSE '存在' END AS state
UNION ALL SELECT 'v_wo_schedule', CASE WHEN OBJECT_ID('dbo.v_wo_schedule') IS NULL THEN '不存在' ELSE '存在' END
UNION ALL SELECT 'v_wo_kit', CASE WHEN OBJECT_ID('dbo.v_wo_kit') IS NULL THEN '不存在' ELSE '存在' END
UNION ALL SELECT 'bl_outsource_in.仓库', CASE WHEN COL_LENGTH('dbo.bl_outsource_in', N'仓库') IS NULL THEN '不存在' ELSE '存在' END
UNION ALL SELECT 'wo_order.产品批号', CASE WHEN COL_LENGTH('dbo.wo_order', N'产品批号') IS NULL THEN '不存在' ELSE '存在' END
UNION ALL SELECT 'wo_order.批次号', CASE WHEN COL_LENGTH('dbo.wo_order', N'批次号') IS NULL THEN '不存在' ELSE '存在' END
UNION ALL SELECT 'wo_report.直销数量', CASE WHEN COL_LENGTH('dbo.wo_report', N'直销数量') IS NULL THEN '不存在' ELSE '存在' END
UNION ALL SELECT 'gran_record_detail', CASE WHEN OBJECT_ID('dbo.gran_record_detail') IS NULL THEN '不存在' ELSE '存在' END
UNION ALL SELECT 'wh_record_detail', CASE WHEN OBJECT_ID('dbo.wh_record_detail') IS NULL THEN '不存在' ELSE '存在' END
UNION ALL SELECT 'pack_confirm_detail', CASE WHEN OBJECT_ID('dbo.pack_confirm_detail') IS NULL THEN '不存在' ELSE '存在' END
UNION ALL SELECT 'rod_return_detail', CASE WHEN OBJECT_ID('dbo.rod_return_detail') IS NULL THEN '不存在' ELSE '存在' END
UNION ALL SELECT 'qc_op', CASE WHEN OBJECT_ID('dbo.qc_op') IS NULL THEN '不存在' ELSE '存在' END
UNION ALL SELECT 'yj_doc_annotation', CASE WHEN OBJECT_ID('dbo.yj_doc_annotation') IS NULL THEN '不存在' ELSE '存在' END;

-- bl_outsource_in 现有列里带「仓库/仓」的
SELECT name AS bl_outsource_in_仓库类列 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bl_outsource_in') AND name LIKE N'%仓%';
-- wo_order / wo_report 里带「批」或「直销」的列
SELECT OBJECT_NAME(object_id) AS tbl, name AS col FROM sys.columns
 WHERE object_id IN (OBJECT_ID('dbo.wo_order'), OBJECT_ID('dbo.wo_report')) AND (name LIKE N'%批%' OR name LIKE N'%直销%');
