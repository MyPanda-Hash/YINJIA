SET NOCOUNT ON;
SELECT 'qc_asm_insp_detail' AS t, name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_asm_insp_detail') AND name IN (N'不合格数量',N'不良数量',N'结果判断')
UNION ALL
SELECT 'qc_proc_insp_detail', name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_proc_insp_detail') AND name IN (N'不合格数量',N'不良数量',N'结果判断');
-- 两张单现存的草稿/已审核数量 + 有总结论的行(证明没有不合格单)
SELECT (SELECT COUNT(*) FROM dbo.qc_proc_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y') AS proc_heads,
       (SELECT COUNT(*) FROM dbo.qc_proc_insp_head WHERE ISNULL([总结论],N'')<>N'') AS proc_with_verdict,
       (SELECT COUNT(*) FROM dbo.qc_asm_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y') AS asm_heads,
       (SELECT COUNT(*) FROM dbo.qc_asm_insp_head WHERE ISNULL([总结论],N'')<>N'') AS asm_with_verdict;
SELECT TOP 5 [单据编号],[总结论] FROM dbo.qc_asm_insp_head WHERE ISNULL([总结论],N'')<>N'' ORDER BY id DESC;
