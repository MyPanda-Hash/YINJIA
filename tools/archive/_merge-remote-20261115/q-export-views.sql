/* 从正式库导出测试库缺失的 8 个视图定义(供在 HSDZ_MES_TEST 重建) */
SELECT o.name, m.definition
FROM HSDZ_MES.sys.views o
JOIN HSDZ_MES.sys.sql_modules m ON m.object_id = o.object_id
WHERE o.is_ms_shipped = 0
  AND o.name IN (N'v_pu_order_detail', N'v_pu_order_stats', N'v_qc_insp_rec_detail',
                 N'v_stocktake_detail', N'v_stocktake_stats', N'v_transfer_detail',
                 N'v_transfer_stats', N'v_wo_completion_detail')
ORDER BY o.name;
