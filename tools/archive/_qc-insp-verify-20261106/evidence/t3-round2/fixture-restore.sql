-- 测试夹具还原(把 E2E 临时授予的审批权改回原值)
DECLARE @db sysname = DB_NAME();
IF @db <> 'HSDZ_MES_TEST' RAISERROR('fixture restore refused: %s', 16, 1, @db);
ELSE BEGIN
  UPDATE yj_role_panel SET can_approve='N', perms=N'view,query,add,modify,modlog,del,export' WHERE role_id=4 AND panel_code='QC_FIRST_INSP';
  UPDATE yj_role_panel SET can_approve='N', perms=N'view,query,add,modify,modlog,del,export' WHERE role_id=4 AND panel_code='QC_PROC_INSP';
END
