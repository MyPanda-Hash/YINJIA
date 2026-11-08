SET NOCOUNT ON;
-- 【测试库造数·合格】GD-2026-10-0001#1 的两张检验单改为「已审核+检验合格」,用于看板绿色路径取证
-- 原始值(已记录):SJ-2026-10-0043 检验数量=0/总结论=NULL/状态草稿;ZJ-2026-10-0085 检验数量=0/总结论=NULL/合格数量=3071/状态草稿
UPDATE dbo.qc_first_insp_head SET 检验数量=3071, 总结论=N'合格' WHERE 单据编号='SJ-2026-10-0043';
UPDATE dbo.yj_doc_status SET shr=N'admin', shsj=GETDATE(), pending='N', canceled='N'
 WHERE panel_code='QC_FIRST_INSP' AND doc_no='SJ-2026-10-0043';
UPDATE dbo.qc_asm_insp_head SET 检验数量=3071 WHERE 单据编号='ZJ-2026-10-0085';
UPDATE dbo.yj_doc_status SET shr=N'admin', shsj=GETDATE(), pending='N', canceled='N'
 WHERE panel_code='QC_ASM_INSP' AND doc_no='ZJ-2026-10-0085';
SELECT N'合格造数完成' AS 步骤;
GO
