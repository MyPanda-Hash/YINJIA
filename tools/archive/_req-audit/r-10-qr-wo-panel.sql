-- r-10:二维码批号/工单面板编码核对
SET NOCOUNT ON;
GO
PRINT '=== [1] 工单面板编码到底是 WO_ORDER 还是 MANU_ORDER(PANDA_BUTTONS 键为 WO_ORDER) ===';
SELECT panel_code, panel_name, category, mode, head_table, line_table, module_group
FROM yj_panel WHERE panel_code IN ('WO_ORDER','MANU_ORDER','WO_SCHEDULE','WO_KIT') OR panel_code LIKE 'WO[_]%'
ORDER BY panel_code;
GO
PRINT '=== [2] qr_batch_registry 是否存在 + 行数 ===';
SELECT CASE WHEN OBJECT_ID('qr_batch_registry') IS NULL THEN '不存在' ELSE '存在' END AS t;
GO
IF OBJECT_ID('qr_batch_registry') IS NOT NULL
  SELECT COUNT(*) AS rows FROM qr_batch_registry;
GO
IF OBJECT_ID('qr_batch_registry') IS NOT NULL
  SELECT TOP 20 batch_no, item_code, source_type, source_no, created_by, CONVERT(varchar(19), created_at, 120) AS created_at
  FROM qr_batch_registry ORDER BY id DESC;
GO
PRINT '=== [3] wo_material_pick / wo_stage_report 里的 qr_code 列(扫码领料/报工数据面) ===';
SELECT TOP 10 [单据编号], [qr_code] FROM wo_material_pick ORDER BY 1 DESC;
GO
PRINT '=== [4] 采购订单已有数据量(报表实测可用性) ===';
SELECT COUNT(*) AS pu_order_rows FROM bd_pu_order;
GO
SELECT COUNT(*) AS qc_recv_rows FROM sl_recv;
GO
SELECT COUNT(*) AS qc_insp_rows FROM qc_insp;
GO
SELECT COUNT(*) AS qc_return_rows FROM qc_return;
GO
