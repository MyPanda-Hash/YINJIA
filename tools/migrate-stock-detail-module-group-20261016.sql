/* migrate-stock-detail-module-group-20261016.sql — 库存明细(STOCK_DETAIL)的 module_group 从「系统管理」写回「库存核算」(本地两账套)

【用户原话】「要按照模块来收纳面板,现在多了一个基础设置和系统管理」(2026-10-16)

【病症】权限矩阵(组织架构 →「角色与面板权限」)里冒出了**导航里根本没有的两个分组**:
  - `基础设置`(25 张:部门/员工/存货/工序/计量单位/仓库/仓位/工艺路线…)—— 代码侧已由
    `ReportService.NAV_GROUP` 补 `基础设置 → 基础档案` 归并(不改库:那 25 行的 module_group
    还兼作读权限放行分组,改库会顺带把「基础设置」与「基础档案」两个读放行组合并 ⇒ 无谓放权);
  - `系统管理`(**本列唯一成员就是 STOCK_DETAIL 库存明细**)—— 它不该靠归并,而是**值本身写错了**:
    `migrate-stock-detail-panel.sql` 建这张面板时把 `migrate-panel-modules.sql` 那句
    `module_group IS NULL ⇒ N'系统管理'` 的兜底值直接抄进了 VALUES;而库存明细在导航里是
    **智能供应链 → 库存报表** 的第 5 张,与 STOCK_BALANCE/STOCK_LEDGER/STOCK_STATUS/STOCK_SUMMARY
    同一栏(那 4 张在库里就是 `库存核算`,2026-10-10 由 fix-stock-report-module-group.sql 从乱码写回)。
  ⇒ 本脚本把它写回 `库存核算`,与四张同族报表同组:既让矩阵归并到「智能供应链」,
    也让读权限放行分组与同族报表一致(能看库存状况表的人本就该读得到库存明细)。

【做什么】把 panel_code='STOCK_DETAIL' 且 module_group='系统管理' 的 1 行改成 '库存核算'。
【幂等】只更新「当前值 = 系统管理」的行;第二次执行 0 行。
【自检】末尾断言「库里不存在任何落不进导航模块的 module_group 值」(越界 0 处)。
  合法值 = ReportService.NAV_GROUP 的键 ∪ 归并结果(我的桌面/研发管理/智能供应链/生产制造/品质管理/
  设备管理/财务管理/基础档案/其他);本脚本执行后应恰好等于下面列出的 15 个。
【两账套】先 HSDZ_MES 后 HSDZ_MES_TEST(DbSync 自动排队)。
*/
SET NOCOUNT ON;

DECLARE @dbn sysname = DB_NAME();

/* 待改行(窄条件 + 行数证据) */
DECLARE @n0 int = (SELECT COUNT(*) FROM yj_panel WHERE panel_code = N'STOCK_DETAIL' AND module_group = N'系统管理');
RAISERROR(N'[待改] %s:STOCK_DETAIL 的 module_group = 系统管理 的行 %d 行(期望 ≤1)', 10, 1, @dbn, @n0);

BEGIN TRANSACTION;
UPDATE yj_panel SET module_group = N'库存核算'
 WHERE panel_code = N'STOCK_DETAIL' AND module_group = N'系统管理';
DECLARE @n1 int = @@ROWCOUNT;

/* 自检 ①:该面板落在了预期的库存报表组 */
DECLARE @bad1 int = (SELECT COUNT(*) FROM yj_panel WHERE panel_code = N'STOCK_DETAIL' AND module_group <> N'库存核算');
/* 自检 ②:全库 module_group 都能归并到导航模块(越界 0 处)—— 合法值清单与 ReportService.NAV_GROUP 同源 */
DECLARE @legal TABLE (g nvarchar(50) PRIMARY KEY);
INSERT INTO @legal (g) VALUES
 (N'我的桌面'),(N'研发管理'),(N'智能供应链'),(N'库存核算'),(N'库存报表'),(N'采购管理'),(N'订单管理'),(N'销售管理'),
 (N'生产制造'),(N'生产管理'),(N'委外加工'),(N'品质管理'),(N'基础档案'),(N'基础资料'),(N'基础数据'),
 (N'基础设置'),(N'物料及价格'),(N'设备管理'),(N'财务管理'),(N'其他');
DECLARE @bad2 nvarchar(200) = (SELECT TOP 1 p.module_group FROM yj_panel p
                                WHERE p.module_group IS NULL OR p.module_group = N''
                                   OR NOT EXISTS (SELECT 1 FROM @legal l WHERE l.g = p.module_group));
IF @bad1 <> 0 OR @bad2 IS NOT NULL
BEGIN
  ROLLBACK TRANSACTION;
  RAISERROR(N'[FAIL] %s:自检未过(STOCK_DETAIL 未归位 %d / 越界 module_group「%s」),已整段回滚', 16, 1, @dbn, @bad1, @bad2);
  RETURN;
END
COMMIT TRANSACTION;
RAISERROR(N'[OK] %s:STOCK_DETAIL 的 module_group 系统管理→库存核算 %d 行;全库 module_group 越界 0 处', 10, 1, @dbn, @n1);
GO

SELECT LEFT(ISNULL(module_group, N'(NULL)'), 20) AS 模块, COUNT(*) AS 面板数
  FROM yj_panel GROUP BY module_group ORDER BY COUNT(*) DESC;
GO
