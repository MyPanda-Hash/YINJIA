SET NOCOUNT ON;
-- 【测试库造数·不合格】把组装成品检验单改成 总结论=不合格(看板红色路径取证)
UPDATE dbo.qc_asm_insp_head SET 总结论=N'不合格' WHERE 单据编号='ZJ-2026-10-0085';
SELECT N'不合格造数完成' AS 步骤;
GO
