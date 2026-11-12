-- 测试账套:为门禁 happy-path 造一对「同工单行 + 同批次 + 已判合格」的检验明细(验完还原)
UPDATE d SET d.内部批次 = N'20261017', d.结果判断 = N'合格'
  FROM qc_asm_insp_detail d
 WHERE d.id IN (SELECT TOP 2 id FROM qc_asm_insp_detail WHERE 单据编号 = N'ZJ-2026-10-0135' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id);
UPDATE h SET h.内部批次清单 = N'20261017' FROM qc_asm_insp_head h WHERE h.单据编号 = N'ZJ-2026-10-0135';

UPDATE p SET p.内部批次 = N'20261017', p.结果判断 = N'合格'
  FROM qc_proc_insp_detail p
 WHERE p.id IN (SELECT TOP 2 id FROM qc_proc_insp_detail WHERE 单据编号 = N'ZC-2026-10-0126' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id);

SELECT COUNT(*) AS asm_batch_rows FROM qc_asm_insp_detail WHERE 单据编号=N'ZJ-2026-10-0135' AND 内部批次=N'20261017';
SELECT COUNT(*) AS proc_batch_rows FROM qc_proc_insp_detail WHERE 单据编号=N'ZC-2026-10-0126' AND 内部批次=N'20261017';
