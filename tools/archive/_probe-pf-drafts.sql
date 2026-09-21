SET NOCOUNT ON;
SELECT N'RD_MOLD_PROC' AS panel, 单据编号, ISNULL(变更来源单号,N'-') FROM rd_mold_proc_head WHERE 变更来源单号 = N'CHG-2026-09-0029'
UNION ALL SELECT N'RD_SPEC_DOC', 单据编号, ISNULL(变更来源单号,N'-') FROM rd_spec_doc_head WHERE 变更来源单号 = N'CHG-2026-09-0029'
UNION ALL SELECT N'RD_ASM_PROC', 单据编号, ISNULL(变更来源单号,N'-') FROM rd_asm_proc_head WHERE 变更来源单号 = N'CHG-2026-09-0029';