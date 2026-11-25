SELECT COUNT(*) AS head_rows FROM qc_asm_insp_head;
SELECT COUNT(*) AS has_col FROM sys.columns WHERE object_id=OBJECT_ID('qc_asm_insp_head') AND name='内部批次清单';
SELECT COUNT(*) AS det_rows FROM qc_asm_insp_detail;
SELECT COUNT(*) AS det_has_col FROM sys.columns WHERE object_id=OBJECT_ID('qc_asm_insp_detail') AND name='内部批次';
