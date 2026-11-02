SET NOCOUNT ON;
SELECT N'scjl' t, s.[工单行号] xc, COUNT(*) n, SUM(CASE WHEN ISNULL(s.asp_cancel,'N')='Y' THEN 1 ELSE 0 END) 作废
FROM dbo.scjl s WHERE s.gldh=N'GD-2026-09-0011' GROUP BY s.[工单行号]
UNION ALL SELECT N'qc_first', ISNULL(h.[工单行号],0), COUNT(*), 0 FROM dbo.qc_first_insp_head h WHERE h.[工单号]=N'GD-2026-09-0011' GROUP BY h.[工单行号]
UNION ALL SELECT N'qc_proc', ISNULL(h.[工单行号],0), COUNT(*), 0 FROM dbo.qc_proc_insp_head h WHERE h.[工单号]=N'GD-2026-09-0011' GROUP BY h.[工单行号]
UNION ALL SELECT N'qc_asm', ISNULL(h.[工单行号],0), COUNT(*), 0 FROM dbo.qc_asm_insp_head h WHERE h.[工单号]=N'GD-2026-09-0011' GROUP BY h.[工单行号]
UNION ALL SELECT N'finish_in', ISNULL(f.[工单行号],0), COUNT(*), 0 FROM dbo.bd_finish_in f WHERE f.[加工单号]=N'GD-2026-09-0011' GROUP BY f.[工单行号]
UNION ALL SELECT N'wo_progress', ISNULL(w.[工单行id],0), COUNT(*), 0 FROM dbo.wo_progress w WHERE w.[单据编号]=N'GD-2026-09-0011' GROUP BY w.[工单行id]
UNION ALL SELECT N'material_out', 0, COUNT(*), 0 FROM dbo.bd_material_out d WHERE d.[加工单号]=N'GD-2026-09-0011';
GO
SELECT f.id, f.source_form_no, f.source_line_key, f.target_form_no, f.target_line_key, f.link_status
FROM dbo.form_flow_link f WHERE f.source_form_no=N'GD-2026-09-0011' OR f.source_line_key LIKE N'GD-2026-09-0011#%'
   OR f.target_form_no=N'GD-2026-09-0011' OR f.target_line_key LIKE N'GD-2026-09-0011#%';
GO
SELECT u.doc_no, u.[工单行号], u.event_type, u.panel_name, u.action_name, CONVERT(varchar(19),u.created_at,120) t
FROM dbo.yj_usage_log u WHERE u.doc_no=N'GD-2026-09-0011';
GO
