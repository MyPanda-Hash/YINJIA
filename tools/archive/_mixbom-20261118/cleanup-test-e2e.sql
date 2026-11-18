-- 清理 2026-11-18 验证「工艺清单归档→基础数据清单」时在**测试账套**造的 E2E 数据。
-- 只动本任务造的单据/同步出来的清单行(单号写死),注释写明行数。
SET NOCOUNT ON;
BEGIN TRAN;

-- 1) 审批留痕 + 单据状态
DELETE FROM yj_form_approval WHERE panel_code='RD_ASM_PROC'  AND form_no IN ('AP-2026-11-0001','AP-2026-11-0002');
DELETE FROM yj_form_approval WHERE panel_code='RD_MOLD_PROC' AND form_no IN ('MP-2026-11-0001');
DELETE FROM yj_form_approval WHERE panel_code='RD_X_SINTER'  AND form_no IN ('XS-2026-11-0001');
PRINT N'审批留痕删除:' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM yj_doc_status WHERE panel_code='RD_ASM_PROC'  AND doc_no IN ('AP-2026-11-0001','AP-2026-11-0002');
DELETE FROM yj_doc_status WHERE panel_code='RD_MOLD_PROC' AND doc_no IN ('MP-2026-11-0001');
DELETE FROM yj_doc_status WHERE panel_code='RD_X_SINTER'  AND doc_no IN ('XS-2026-11-0001');
PRINT N'单据状态删除:' + CAST(@@ROWCOUNT AS nvarchar(10));

-- 2) 三张工艺清单(头/行)
DELETE FROM rd_asm_proc_detail WHERE 单据编号 IN ('AP-2026-11-0001','AP-2026-11-0002');
DELETE FROM rd_asm_proc_head   WHERE 单据编号 IN ('AP-2026-11-0001','AP-2026-11-0002');
DELETE FROM rd_mold_proc_detail WHERE 单据编号 = 'MP-2026-11-0001';
DELETE FROM rd_mold_proc_head   WHERE 单据编号 = 'MP-2026-11-0001';
DELETE FROM rd_x_sinter_detail  WHERE 单据编号 = 'XS-2026-11-0001';
DELETE FROM rd_x_sinter_head    WHERE 单据编号 = 'XS-2026-11-0001';
PRINT N'工艺清单头行删除(上一条为 x_sinter 头表):' + CAST(@@ROWCOUNT AS nvarchar(10));

-- 3) 同步出来的基础数据清单(只删本次 E2E 产出的单号)
DELETE FROM bs_asm_bom WHERE 单据编号 = 'BOM-2026-11-0002' AND 产品编码 LIKE 'E2EASM-%';
DELETE FROM bs_mix_bom WHERE 单据编号 IN ('MIX-2026-11-0001','MIX-2026-11-0002')
                        AND (产品编号 LIKE 'E2EMIX-%' OR 产品编号 LIKE 'E2EXS-%');
PRINT N'E2E 同步清单行删除(上一条为 mix):' + CAST(@@ROWCOUNT AS nvarchar(10));

COMMIT;
GO
