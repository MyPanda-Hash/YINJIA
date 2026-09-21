SET NOCOUNT ON;
PRINT N'=== 来料链四单:物理列 批号/批次号 ===';
SELECT t.name AS 表名, c.name AS 列名, ty.name AS 类型
FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('sl_recv','sl_recv_detail','qc_insp','qc_insp_detail','qc_return','qc_return_detail',
                 'bd_purchase_in','bl_purchase_in','bd_pu_order','bl_pu_order')
  AND (c.name LIKE N'%批号%' OR c.name LIKE N'%批次%')
ORDER BY t.name, c.column_id;
GO
PRINT N'=== 来料链四单:元数据注册 批号/批次号 ===';
SELECT panel_code, col_name, label, place, editable, visible
FROM yj_field
WHERE panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN','PU_ORDER')
  AND (col_name LIKE N'%批号%' OR col_name LIKE N'%批次%')
ORDER BY panel_code, place, seq;
GO
PRINT N'=== 全库所有注册了「批号」的面板(非来料链也要看) ===';
SELECT panel_code, COUNT(*) AS 批号字段数 FROM yj_field WHERE col_name = N'批号' GROUP BY panel_code ORDER BY panel_code;
GO
PRINT N'=== 批次台账 yj_doc_batch 结构 ===';
SELECT c.column_id, c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('yj_doc_batch') ORDER BY c.column_id;
GO
PRINT N'=== 批次台账样例 ===';
SELECT TOP 8 * FROM yj_doc_batch ORDER BY id DESC;
GO
