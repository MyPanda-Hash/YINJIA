-- 清理 2026-11-06 三项需求 E2E 测试数据(tag=cleanup-sweep-20261106-121503)
-- 硬闸门:仅允许测试账套 HSDZ_MES_TEST;删除范围 = 迁移脚本记录的显式单号白名单
-- 白名单(1): QC_OQC_REPORT:OQC-2026-11-0016
DECLARE @db sysname = DB_NAME();
IF @db <> 'HSDZ_MES_TEST' RAISERROR('cleanup refused: %s', 16, 1, @db);
ELSE BEGIN
  DELETE FROM qc_oqc_detail WHERE 单据编号 IN ('OQC-2026-11-0016');
  DELETE FROM qc_oqc_head WHERE 单据编号 IN ('OQC-2026-11-0016');
  DELETE FROM yj_doc_status WHERE doc_no IN ('OQC-2026-11-0016');
  DELETE FROM yj_form_approval WHERE form_no IN ('OQC-2026-11-0016');
  DELETE FROM yj_message WHERE 单据编号 IN ('OQC-2026-11-0016');
END
