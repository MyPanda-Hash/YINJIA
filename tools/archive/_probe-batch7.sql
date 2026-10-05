SET NOCOUNT ON;
GO
PRINT '=== 批次号字段可编辑口径(迁移后应:QC_RECV 头=1,其余全 0) ===';
SELECT f.panel_code, f.place, f.label, f.editable,
       CASE WHEN EXISTS (SELECT 1 FROM sys.extended_properties ep
              WHERE ep.major_id = OBJECT_ID(N'dbo.' + CASE f.panel_code
                        WHEN N'QC_RECV' THEN N'sl_recv' WHEN N'QC_INSP' THEN N'qc_insp'
                        WHEN N'QC_RETURN' THEN N'qc_return' WHEN N'PURCHASE_IN' THEN N'bd_purchase_in'
                        ELSE N'qc_tc_in' END)
                AND ep.name = 'MS_Description') THEN N'有注明' ELSE N'缺注明' END AS 注明
FROM yj_field f
WHERE f.label = N'批次号'
  AND f.panel_code IN (N'QC_RECV', N'QC_INSP', N'QC_RETURN', N'PURCHASE_IN', N'QC_TC_IN')
ORDER BY f.panel_code, f.place;
GO
PRINT '=== 各表 批次号 列中文注明(前 40 字) ===';
SELECT t.name AS tbl, LEFT(CAST(ep.value AS nvarchar(400)), 40) AS 注明
FROM sys.extended_properties ep
JOIN sys.tables t ON t.object_id = ep.major_id
JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
WHERE ep.name = 'MS_Description' AND c.name = N'批次号' AND t.name IN
  (N'sl_recv', N'sl_recv_detail', N'qc_insp', N'qc_insp_detail', N'bd_purchase_in', N'bl_purchase_in',
   N'qc_return', N'qc_return_detail', N'qc_tc_in', N'yj_doc_batch')
ORDER BY t.name;
GO
