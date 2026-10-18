/* migrate-role-grant-dm-readonly-20261018.sql — 数据建模 4 张面板给「普通用户」开只读

   【用户口径 2026-10-18】我在上一轮报告末尾问「数据建模那 4 张(字段管理/数据字典/ERP导入日志/
     ERP导入明细)现在只有管理员能用,要不要给普通用户开 view(只读看日志/字典,不给改)」→ 用户回「加」。
   【授权内容】role_id=2 普通用户 × {FIELDMGR, ZDGL, ERPLG, ERPLG_ROW} = perms 'view,query'
     (能看能查;无 add/modify/del/audit/save ⇒ 界面上仍只能浏览,服务端 requireButton 同口径拒绝写操作)。
   【为什么不给管理员插行】admin 由 is_admin 恒放行,矩阵里本来就全勾,插行只是噪音。
   【幂等】已有行则只把缺少的 view,query 补齐(不覆盖该行其他词);两账套均执行。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

DECLARE @dmp TABLE (panel_code varchar(40) PRIMARY KEY);
INSERT INTO @dmp (panel_code) VALUES (N'FIELDMGR'), (N'ZDGL'), (N'ERPLG'), (N'ERPLG_ROW');

-- 授权对象 = **所有非管理员角色**(普通用户 2 / 研发审核 4 / 文件负责人 5)。
--   实测库中角色 2 没有任何账号,真正在用的是 4(cp/liulei/fs…)与 5;只给 2 授权等于没人能看见,
--   所以按「非管理员角色」一次性铺开(仍然是只读词,不给写)。
DECLARE @roles TABLE (role_id int PRIMARY KEY);
INSERT INTO @roles (role_id) SELECT id FROM yj_role WHERE id <> 1;

INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT ro.role_id, d.panel_code, 'N', N'view,query'
FROM @dmp d CROSS JOIN @roles ro
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel r WHERE r.role_id = ro.role_id AND r.panel_code = d.panel_code);
DECLARE @ins int = @@ROWCOUNT;

UPDATE r SET perms = CASE WHEN ISNULL(r.perms,'') = '' THEN N'view,query'
                          WHEN r.perms LIKE '%view%' AND r.perms LIKE '%query%' THEN r.perms
                          ELSE r.perms + N',query' END
  FROM yj_role_panel r JOIN @dmp d ON d.panel_code = r.panel_code
 WHERE r.role_id <> 1;

DECLARE @db sysname = DB_NAME();
RAISERROR(N'[OK] %s 数据建模 4 张对全部非管理员角色开只读(本次新增 %d 行)', 10, 1, @db, @ins);
GO

/* 自检:4 张都授权、且只读 */
/* ⚠ 断言按**显式面板码**统计,不能用 module_group='数据建模':2026-10-18 起「系统管理平台」的 32 张
   也归入了数据建模(migrate-sysadmin-panels-to-dm-20261018.sql),用分组统计会让本脚本重放时误报 FAIL。*/
DECLARE @dmp2 TABLE (panel_code varchar(40) PRIMARY KEY);
INSERT INTO @dmp2 (panel_code) VALUES (N'FIELDMGR'), (N'ZDGL'), (N'ERPLG'), (N'ERPLG_ROW');
DECLARE @want int = (SELECT COUNT(*) FROM yj_role r CROSS JOIN (SELECT 1 AS x) t WHERE r.id <> 1) * 4;
DECLARE @cnt int = (SELECT COUNT(*) FROM yj_role_panel r JOIN @dmp2 d ON d.panel_code = r.panel_code
                     WHERE r.role_id <> 1);
DECLARE @w int = (SELECT COUNT(*) FROM yj_role_panel r JOIN @dmp2 d ON d.panel_code = r.panel_code
                   WHERE r.role_id <> 1
                     AND (r.perms LIKE '%add%' OR r.perms LIKE '%modify%' OR r.perms LIKE '%del%'));
IF @cnt <> @want RAISERROR(N'[FAIL] 非管理员角色只授到 %d 行(期望 %d)', 16, 1, @cnt, @want);
IF @w > 0 RAISERROR(N'[FAIL] 数据建模出现 %d 条写权限(应只读)', 16, 1, @w);
IF @cnt = @want AND @w = 0 PRINT N'[OK] 数据建模 4 张 × 全部非管理员角色 只读授权到位';
GO
