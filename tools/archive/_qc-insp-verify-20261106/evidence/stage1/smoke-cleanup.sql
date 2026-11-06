-- 清理 2026-11-06 三项需求 E2E 测试数据(tag=smoke-cleanup)
-- 硬闸门:仅允许测试账套 HSDZ_MES_TEST;删除范围 = 迁移脚本记录的显式单号白名单
-- 白名单(0): 
DECLARE @db sysname = DB_NAME();
IF @db <> 'HSDZ_MES_TEST' RAISERROR('cleanup refused: %s', 16, 1, @db);
ELSE BEGIN
  DELETE FROM yj_doc_status WHERE doc_no IN (NULL);
  DELETE FROM yj_form_approval WHERE form_no IN (NULL);
  DELETE FROM yj_message WHERE 单据编号 IN (NULL);
END
