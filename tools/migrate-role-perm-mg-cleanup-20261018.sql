/* ============================================================
   migrate-role-perm-mg-cleanup-20261018.sql
   让「角色词表归位」与「库存报表族 module_group 归位」两支迁移在**任何账套**都能跑通的数据清障

   背景(2026-10-18 本机首次真正执行这两支迁移时暴露):
     ① migrate-role-perm-words-20261016.sql 末尾自检「全库 perms 词都在引擎词表内」——
        实测本机两账套都有**探针遗留角色**(role_code LIKE 'AUTO_ROLE%'),其 perms 是
        `[view, query, add, edit]` 这种带方括号/非法词的写法 ⇒ 自检永远不过、脚本回滚、
        迁移链卡死在同一行(DbSync 遇首个失败即中止)。
     ② migrate-stock-detail-module-group-20261016.sql 末尾自检「module_group 都能归并到导航模块」——
        实测 STOCK_STATUS 是 NULL/「仓库管理」、DISPATCH_DETAIL/DISPATCH_STATS 是「新生产」
        ⇒ 同样永远不过、整段回滚。

   做什么(**只动这两类脏值,别的行一行不碰**):
     ① 探针遗留角色(AUTO_ROLE*)的授权行:perms 归一为 `view,query,add,modify`、can_approve='N';
     ② module_group 落不进导航的值按语义归位:
        STOCK_STATUS → 库存核算(与 STOCK_DETAIL/BALANCE/LEDGER/SUMMARY 同族)
        DISPATCH_DETAIL / DISPATCH_STATS → 生产制造(工序派工的导航归属)
        NULL 的其余面板 → 其他(仅当它确实不属于上述特例时;本脚本只处理这三种已知形态)

   幂等:重复执行 0 行;两账套均执行(先正式、后测试)。
   注意:本脚本**不改**任何迁移脚本的判据 —— 只把"卡住判据"的脏数据清掉。
   ============================================================ */
SET NOCOUNT ON;

DECLARE @dbn sysname = DB_NAME();

/* ① 探针遗留角色:非法词/方括号写法归一 */
DECLARE @n1 int = 0;
UPDATE rp SET rp.perms = N'view,query,add,modify', rp.can_approve = N'N'
  FROM dbo.yj_role_panel rp
 WHERE rp.role_id IN (SELECT id FROM dbo.yj_role WHERE role_code LIKE N'AUTO\_ROLE%' ESCAPE '\')
   AND (ISNULL(rp.perms,N'') LIKE N'%edit%' OR ISNULL(rp.perms,N'') LIKE N'%delete%'
        OR ISNULL(rp.perms,N'') LIKE N'%price%' OR ISNULL(rp.perms,N'') LIKE N'%review%'
        OR ISNULL(rp.perms,N'') LIKE N'%adjust%' OR ISNULL(rp.perms,N'') LIKE N'%[[]%'
        OR ISNULL(rp.perms,N'') = N'');
SET @n1 = @@ROWCOUNT;
RAISERROR(N'[待改] %s:探针遗留角色(AUTO_ROLE*)授权行归一 %d 行', 10, 1, @dbn, @n1);

/* ② module_group 落不进导航的已知形态归位 */
DECLARE @n2 int = 0;
UPDATE dbo.yj_panel SET module_group = N'库存核算'
 WHERE panel_code = N'STOCK_STATUS' AND ISNULL(module_group,N'') IN (N'', N'仓库管理', N'系统管理');
SET @n2 = @@ROWCOUNT;

DECLARE @n3 int = 0;
UPDATE dbo.yj_panel SET module_group = N'生产制造'
 WHERE panel_code IN (N'DISPATCH_DETAIL', N'DISPATCH_STATS') AND ISNULL(module_group,N'') = N'新生产';
SET @n3 = @@ROWCOUNT;
DECLARE @n23 int = @n2 + @n3;
RAISERROR(N'[待改] %s:module_group 归位 %d 行(STOCK_STATUS %d / 派工两表 %d)', 10, 1, @dbn, @n23, @n2, @n3);

/* 自检:①不再有探针角色的方括号/非法词;②module_group 不再出现「新生产/仓库管理」且无 NULL */
DECLARE @bad1 int = (SELECT COUNT(*) FROM dbo.yj_role_panel rp
                      WHERE rp.role_id IN (SELECT id FROM dbo.yj_role WHERE role_code LIKE N'AUTO\_ROLE%' ESCAPE '\')
                        AND (ISNULL(rp.perms,N'') LIKE N'%[[]%' OR ISNULL(rp.perms,N'') LIKE N'%edit%'
                             OR ISNULL(rp.perms,N'') LIKE N'%delete%'));
DECLARE @bad2 int = (SELECT COUNT(*) FROM dbo.yj_panel
                      WHERE ISNULL(module_group,N'') IN (N'', N'新生产', N'仓库管理'));
IF @bad1 > 0 RAISERROR(N'[FAIL] %s:仍有 %d 行非法授权词', 16, 1, @dbn, @bad1);
IF @bad2 > 0 RAISERROR(N'[FAIL] %s:仍有 %d 行 module_group 落不进导航', 16, 1, @dbn, @bad2);
RAISERROR(N'[OK] %s:授权词与 module_group 清障完成(越界 0)', 10, 1, @dbn);
GO
