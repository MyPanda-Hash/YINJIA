-- 测试夹具(阶段2 E2E):临时给测试库角色 4(研发审核) 两面板审批权
-- 原值已记录,测试结束由 fixture-restore 还原;只允许 HSDZ_MES_TEST。
-- 原值: [{"panel_code":"QC_FIRST_INSP","can_approve":"N","perms":"view,query,add,modify,modlog,del,export"},{"panel_code":"QC_PROC_INSP","can_approve":"N","perms":"view,query,add,modify,modlog,del,export"}]
DECLARE @db sysname = DB_NAME();
IF @db <> 'HSDZ_MES_TEST' RAISERROR('fixture refused: %s', 16, 1, @db);
ELSE BEGIN
  UPDATE yj_role_panel SET can_approve='Y',
         perms = CASE WHEN ','+ISNULL(perms,'')+',' LIKE '%,audit,%' THEN perms ELSE ISNULL(perms,'')+',audit' END
   WHERE role_id=4 AND panel_code IN ('QC_PROC_INSP','QC_FIRST_INSP');
END
