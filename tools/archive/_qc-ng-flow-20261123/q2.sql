SET NOCOUNT ON;
SELECT COUNT(*) AS bhc_total,
       SUM(CASE WHEN ISNULL([出货检验单号],N'') <> N'' THEN 1 ELSE 0 END) AS with_insp_no,
       SUM(CASE WHEN ISNULL([出货检验单号],N'') LIKE N'ZC-%' THEN 1 ELSE 0 END) AS zc_rows,
       SUM(CASE WHEN ISNULL([出货检验单号],N'') LIKE N'ZJ-%' THEN 1 ELSE 0 END) AS zj_rows
  FROM dbo.qc_bhc;
SELECT TOP 8 [单据编号],[单据日期],[出货检验单号],[工单号],[生产量],[不合格品数量],[不合格品比例] FROM dbo.qc_bhc ORDER BY id DESC;
-- 两张出货检验单里「总结论=不合格」的单(有多少张会出这个按钮)
SELECT 'QC_PROC_INSP' AS panel, COUNT(*) AS ng_heads FROM dbo.qc_proc_insp_head WHERE ISNULL([总结论],N'')=N'不合格' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL
SELECT 'QC_ASM_INSP', COUNT(*) FROM dbo.qc_asm_insp_head WHERE ISNULL([总结论],N'')=N'不合格' AND ISNULL(asp_cancel,'N')<>'Y';
