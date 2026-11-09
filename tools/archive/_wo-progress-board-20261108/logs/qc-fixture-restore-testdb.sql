SET NOCOUNT ON;
-- 【测试库造数·恢复原状】清掉合格/不合格造数,两张检验单回到草稿(原始值)
UPDATE dbo.qc_first_insp_head SET 检验数量=0, 总结论=NULL WHERE 单据编号='SJ-2026-10-0043';
UPDATE dbo.qc_asm_insp_head SET 检验数量=0, 总结论=NULL WHERE 单据编号='ZJ-2026-10-0085';
UPDATE dbo.yj_doc_status SET shr=NULL, shsj=NULL, pending='N', canceled='N'
 WHERE panel_code='QC_FIRST_INSP' AND doc_no='SJ-2026-10-0043';
UPDATE dbo.yj_doc_status SET shr=NULL, shsj=NULL, pending='N', canceled='N'
 WHERE panel_code='QC_ASM_INSP' AND doc_no='ZJ-2026-10-0085';
SELECT N'恢复完成' AS 步骤;
GO
