SET NOCOUNT ON;
PRINT '=== 1. yj_user 全行 ===';
SELECT id, username, real_name, is_admin, role_id, enabled FROM yj_user;
GO
PRINT '=== 2. yj_role_panel 全行 ===';
SELECT * FROM yj_role_panel;
GO
PRINT '=== 3. yj_role 全行 ===';
SELECT id, role_code, role_name, is_admin FROM yj_role;
GO
PRINT '=== 4. 是否存在测试库 HSDZ_MES_TEST ===';
SELECT name, state_desc, compatibility_level FROM sys.databases;
GO
PRINT '=== 5. QC_RECV 是否注册「批号」字段(前端 QrLabelDialog 依赖) ===';
SELECT panel_code, col_name, label, data_type, place FROM yj_field WHERE panel_code='QC_RECV' AND (label IN (N'批号',N'批次号',N'暂收数量',N'数量',N'单位',N'物料编码',N'物料名称') ) ORDER BY label;
GO
PRINT '=== 6. 检验单「暂收单号」实际填充率 ===';
SELECT COUNT(*) AS total, SUM(CASE WHEN 暂收单号 IS NULL OR 暂收单号='' THEN 1 ELSE 0 END) AS empty_cnt FROM qc_insp;
GO
PRINT '=== 7. form_flow_link 链路占用统计 ===';
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='form_flow_link' ORDER BY ORDINAL_POSITION;
GO
SELECT src_panel, dst_panel, COUNT(*) AS n FROM form_flow_link GROUP BY src_panel, dst_panel ORDER BY n DESC;
GO
PRINT '=== 8. 批次台账 yj_doc_batch ===';
SELECT COUNT(*) AS batch_rows FROM yj_doc_batch;
GO
PRINT '=== 9. 采购入库单 转ERP 情况 ===';
SELECT COUNT(*) AS total, SUM(CASE WHEN ERP单号 IS NULL OR ERP单号='' THEN 1 ELSE 0 END) AS not_pushed FROM bd_purchase_in;
