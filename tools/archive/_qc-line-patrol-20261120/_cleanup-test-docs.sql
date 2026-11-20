/* 清理 2026-11-20 巡线表自动化验收造的两张单(0007 空草稿 / 0008 审批链路用单) */
DELETE FROM yj_form_approval WHERE panel_code = N'QC_LINE_PATROL' AND form_no IN (N'XJ-2026-11-0007', N'XJ-2026-11-0008');
PRINT N'[approval] 删除行数=' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM yj_doc_status WHERE panel_code = N'QC_LINE_PATROL' AND doc_no IN (N'XJ-2026-11-0007', N'XJ-2026-11-0008');
PRINT N'[status] 删除行数=' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM qc_line_patrol_detail WHERE 单据编号 IN (N'XJ-2026-11-0007', N'XJ-2026-11-0008');
PRINT N'[detail] 删除行数=' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM qc_line_patrol_head WHERE 单据编号 IN (N'XJ-2026-11-0007', N'XJ-2026-11-0008');
PRINT N'[head] 删除行数=' + CAST(@@ROWCOUNT AS nvarchar(10));
