/* migrate-work-order-progress-panel-20261108.sql — 生产工序进度看板:页面级面板权限 + 面板名译名(2026-11-08)
 *
 * 背景(用户口径 2026-11-08):「生产工单进度需要做一个看板,方便直观查看工单各工序进度……
 *   新增当前的这个看板视图查看,增加这个看板可以点击其中订单行转跳到这个工单。」
 *
 * 页面 = /prod/plan/workOrderProgress(专用 Vue:WorkOrderProgressBoard.vue,大屏+列表双视图),
 *   **不是** yj_panel 单据面板 ⇒ 沿用既有先例(订单结转/快速排产/工单排产/生产工单):按
 *   PagePanelRegistry.WORK_ORDER_PROGRESS 页面级虚拟面板登记,授权落 yj_role_panel,
 *   组织架构「角色与面板权限」矩阵由 SysAdminController 直接注入(本页只读,动作 view/query)。
 *
 * 等价补授(本脚本唯一兼容风险点):凡是**已授生产工单 WORK_ORDER_LIST 可见**的角色
 *   (或 is_admin='Y'),补授 WORK_ORDER_PROGRESS 的 view,query —— 看板是生产工单的派生视图,
 *   能看生产工单的人就该能看它;不补授会让老账号上线后菜单消失/接口 403,而管理员并不知道要重新勾。
 *
 * 幂等:全部 IF NOT EXISTS;已存在的授权行**不动**(不覆盖人工调整)。重跑安全。
 * 两账套(HSDZ_MES → HSDZ_MES_TEST)均需执行。
 */
SET NOCOUNT ON;
GO

/* ── ① 等价补授:已授 WORK_ORDER_LIST 可见的角色 + 管理员 ── */
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, N'WORK_ORDER_PROGRESS', N'view,query', 'N'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x
                  WHERE x.role_id = r.id AND x.panel_code = N'WORK_ORDER_PROGRESS')
  AND (r.is_admin = 'Y'
       OR EXISTS (SELECT 1 FROM yj_role_panel s
                  WHERE s.role_id = r.id AND s.panel_code = N'WORK_ORDER_LIST'
                    AND s.perms LIKE '%view%'));
GO

/* ── ② 面板名译名(AGENTS.md 多语言规范:新增面板必须同时交付译名) ──
   页面级虚拟面板无 yj_panel 行,名称同样走 yj_translation scope='panel';
   前端菜单标题另在 src/i18n/locales 下各语言包的 biz 块(本任务同批交付)。 */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'生产工序进度看板' AND locale = 'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES ('panel', N'生产工序进度看板', 'en', N'Production Process Progress Board', 'manual');
GO

/* ── ③ 自检:授权角色数(应 ≥ 1,管理员角色恒有) ── */
SELECT N'生产工序进度看板授权自检' AS 检查项, COUNT(*) AS 授权角色数
FROM yj_role_panel WHERE panel_code = N'WORK_ORDER_PROGRESS';
GO

/* ── ④ 自检:仍应补授却未补授的角色(应为空) ── */
SELECT N'应补授但未补授的角色(应为空)' AS 检查项, r.id AS 角色ID, r.role_name AS 角色
FROM yj_role r
WHERE (r.is_admin = 'Y'
       OR EXISTS (SELECT 1 FROM yj_role_panel s
                  WHERE s.role_id = r.id AND s.panel_code = N'WORK_ORDER_LIST' AND s.perms LIKE '%view%'))
  AND NOT EXISTS (SELECT 1 FROM yj_role_panel x
                  WHERE x.role_id = r.id AND x.panel_code = N'WORK_ORDER_PROGRESS');
GO
