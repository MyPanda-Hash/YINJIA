SET NOCOUNT ON;
DECLARE @no nvarchar(60) = N'ZJ-2026-11-0004';
PRINT N'== 删除自动生成单(为验证手工新建路径) ==';
DELETE FROM dbo.qc_asm_insp_detail WHERE 单据编号=@no;
DELETE FROM dbo.qc_asm_insp_head WHERE 单据编号=@no;
DELETE FROM dbo.form_flow_link WHERE target_form_no=@no;
DELETE FROM dbo.yj_doc_status WHERE panel_code=N'QC_ASM_INSP' AND doc_no=@no;
PRINT N'[OK] removed ' + @no;
SELECT COUNT(*) AS head_left FROM dbo.qc_asm_insp_head WHERE 单据编号=@no;
