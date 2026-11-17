-- 测试账套:还原门禁验证留下的痕迹(验完即清)
UPDATE d SET d.内部批次 = NULL
  FROM qc_asm_insp_detail d WHERE d.单据编号 = N'ZJ-2026-10-0135';
UPDATE h SET h.内部批次清单 = NULL FROM qc_asm_insp_head h WHERE h.单据编号 = N'ZJ-2026-10-0135';
UPDATE p SET p.内部批次 = NULL
  FROM qc_proc_insp_detail p WHERE p.单据编号 = N'ZC-2026-10-0126';
DELETE FROM yj_doc_status WHERE panel_code = N'FINISH_IN' AND doc_no = N'FI-LINKTEST-01';
DELETE FROM bl_finish_in WHERE 单据编号 = N'FI-LINKTEST-01';
DELETE FROM bd_finish_in WHERE 单据编号 = N'FI-LINKTEST-01';
SELECT (SELECT COUNT(*) FROM bd_finish_in WHERE 单据编号=N'FI-LINKTEST-01') AS fi_left,
       (SELECT COUNT(*) FROM qc_asm_insp_detail WHERE 单据编号=N'ZJ-2026-10-0135' AND ISNULL(内部批次,N'')<>N'') AS asm_batch_left,
       (SELECT COUNT(*) FROM qc_proc_insp_detail WHERE 单据编号=N'ZC-2026-10-0126' AND ISNULL(内部批次,N'')<>N'') AS proc_batch_left;
