SET NOCOUNT ON;
-- 验证:正式库 ZC-2026-10-0126 状态应已恢复为「已审核/柴善银」
SELECT panel_code, doc_no, shr, shsj, canceled, stopped, pending, pending_by, pending_at,
       saved, archived, update_at, approve_node
FROM dbo.yj_doc_status
WHERE panel_code='QC_PROC_INSP' AND doc_no='ZC-2026-10-0126';
GO
SELECT 单据编号, ISNULL(检验员,N'') AS 检验员, asp_user1, CONVERT(varchar(19),asp_time1,120) AS t1,
       asp_user2, CONVERT(varchar(19),asp_time2,120) AS t2, ISNULL(总结论,N'') AS 总结论, ISNULL(检验数量,0) AS 检验数量
FROM dbo.qc_proc_insp_head WHERE 单据编号='ZC-2026-10-0126';
GO
-- 该单审批留痕:不应有 UNAUDIT
SELECT id, panel_code, form_no, action, result, node_no, operator, create_time
FROM dbo.yj_form_approval
WHERE panel_code='QC_PROC_INSP' AND form_no='ZC-2026-10-0126'
ORDER BY id;
GO
-- 今晚 23:00 以后正式库是否还有其它审批类写入(应为 0)
SELECT COUNT(*) AS 近期审批留痕数 FROM dbo.yj_form_approval WHERE create_time >= '2026-11-08 23:00:00';
GO
SELECT panel_code, form_no, action, operator, create_time
FROM dbo.yj_form_approval WHERE create_time >= '2026-11-08 23:00:00' ORDER BY id DESC;
GO
