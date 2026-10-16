/* migrate-page-panel-perms-20261016.sql — 四个看板页面的**页面级面板权限** + 等价补授(2026-10-16)
 *
 * 背景(用户口径 2026-10-16):「查看当前组织架构中是否存在当前的订单结转、快速排产、工单排产、
 *   生产订单的界面的权限控制,不存在的话进行创建和增加,针对当前页面的特性进行编写实现。」
 *
 * 排查结论(实库 HSDZ_MES 实测):
 *   · 订单结转(/prod/plan/orderConvert)、快速排产(/prod/plan/scheduleBoard)、
 *     工单排产(/prod/plan/workOrderBoard)**在 yj_panel 里根本没有行**(ORDER_CONVERT /
 *     SCHEDULE_BOARD / WORK_ORDER_BOARD 三个码均不存在)⇒ 组织架构「角色与面板权限」矩阵只列
 *     registry.all() = yj_panel 的面板,**这三个页面在界面上无从勾选**;
 *   · 生产工单列表(/prod/plan/workOrderList)也没有面板码,且 /px/workOrderList 列表接口
 *     **零校验**(登录即可读全部工单/客户/数量);
 *   · 四条菜单项在 menus.js 里没有 panelCode,而 filterMenuTree 对「无 panelCode 的叶子」
 *     一律放行 ⇒ 任何登录账号都能看到并进入这四个页面;后端只是"借" SO_ORDER / MANU_ORDER 的
 *     权限当闸门。
 *
 * 处置(沿用既有先例「虚拟面板 DASHBOARD(我的桌面)」):
 *   ① **不建表、不插 yj_panel 行** —— 空面板(无表无字段)会污染报表/选单/字段配置等
 *      registry.all() 的下游;矩阵条目改由后端 SysAdminController 直接注入
 *      (定义与动作集见 backend .../service/PagePanelRegistry.java);
 *   ② 授权照旧落 yj_role_panel(该表无外键,panel_code 就是字符串);本脚本负责**等价补授** ——
 *      把现有角色的旧授权(SO_ORDER view / MANU_ORDER view)平移成新页面面板的授权,
 *      保证改造上线后**老账号一个都不掉权限**(这是本次改造唯一的兼容风险点);
 *   ③ 四个页面各自的动作集按页面特性裁剪(不是通用 12 项),如下表。
 *
 *   ┌────────────────┬──────────┬──────────────────────────────────────────────┐
 *   │ 页面面板码     │ 面板名   │ 动作词(perms csv 顺序)                       │
 *   ├────────────────┼──────────┼──────────────────────────────────────────────┤
 *   │ ORDER_CONVERT  │ 订单结转 │ view,query,date(修改交期),convert(转工单)     │
 *   │ SCHEDULE_BOARD │ 快速排产 │ view,query,assign(排产),unassign(撤销排产)    │
 *   │ WORK_ORDER_BOARD│ 工单排产│ view,query,transfer(调拨),revoke(撤回调拨),  │
 *   │                │          │ unclose(取消结案),print(打印)                │
 *   │ WORK_ORDER_LIST│ 生产工单 │ view,query,print,close(结案),split(切单),     │
 *   │                │          │ picking(转领料单),export(导出),assign(排产)  │
 *   └────────────────┴──────────┴──────────────────────────────────────────────┘
 *
 * 幂等:全部 IF NOT EXISTS;已存在的行(role_id,panel_code 唯一键 uq_yjrp)**不动**(不覆盖人工调整)。
 * 只补「没有该行」的角色 —— 重跑安全。两账套(HSDZ_MES → HSDZ_MES_TEST)均需执行。
 */
SET NOCOUNT ON;
GO

/* ── ① 订单结转:凡已授 SO_ORDER 可见的角色(它原先就是借 SO_ORDER 当闸门) ── */
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, N'ORDER_CONVERT', N'view,query,date,convert', 'N'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'ORDER_CONVERT')
  AND (r.is_admin = 'Y'
       OR EXISTS (SELECT 1 FROM yj_role_panel s
                  WHERE s.role_id = r.id AND s.panel_code = N'SO_ORDER' AND s.perms LIKE '%view%'));
GO

/* ── ② 快速排产 / ③ 工单排产 / ④ 生产工单:凡已授 MANU_ORDER 可见的角色 ──
   三者原先都借 MANU_ORDER 当闸门(排产页/看板页 = view+保存;生产工单列表 = 写操作)。
   生产工单列表另需 assign —— 它在页面上有个「排产」按钮(弹出内嵌快速排产),与快速排产页同一个动作词。 */
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, N'SCHEDULE_BOARD', N'view,query,assign,unassign', 'N'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'SCHEDULE_BOARD')
  AND (r.is_admin = 'Y'
       OR EXISTS (SELECT 1 FROM yj_role_panel s
                  WHERE s.role_id = r.id AND s.panel_code = N'MANU_ORDER' AND s.perms LIKE '%view%'));
GO

INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, N'WORK_ORDER_BOARD', N'view,query,transfer,revoke,unclose,print', 'N'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'WORK_ORDER_BOARD')
  AND (r.is_admin = 'Y'
       OR EXISTS (SELECT 1 FROM yj_role_panel s
                  WHERE s.role_id = r.id AND s.panel_code = N'MANU_ORDER' AND s.perms LIKE '%view%'));
GO

INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, N'WORK_ORDER_LIST', N'view,query,print,close,split,picking,export,assign', 'N'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'WORK_ORDER_LIST')
  AND (r.is_admin = 'Y'
       OR EXISTS (SELECT 1 FROM yj_role_panel s
                  WHERE s.role_id = r.id AND s.panel_code = N'MANU_ORDER' AND s.perms LIKE '%view%'));
GO

/* ── ⑤ 面板名译名(AGENTS.md 多语言规范:新增面板必须同时交付译名) ──
   这四个是**页面级虚拟面板**(无 yj_panel 行),名称同样走 yj_translation scope='panel'
   (消费点:PanelConfigService / QueryService 按面板中文名取译名),故一并登记。
   英语手写;其余语言由机翻兜底(source='mt')或后续人工校对。 */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'订单结转' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'订单结转', 'en', N'Order Convert', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'快速排产' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'快速排产', 'en', N'Quick Scheduling', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'工单排产' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'工单排产', 'en', N'Work Order Scheduling', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'生产工单' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'生产工单', 'en', N'Production Work Order', 'manual');
GO

/* ── ⑥ 自检:四个页面面板的授权行数 + 新动作词样例(应各 ≥ 1,管理员角色恒有) ── */
SELECT N'页面面板授权自检' AS 检查项, p.panel_code AS 面板码, COUNT(*) AS 授权角色数
FROM yj_role_panel p
WHERE p.panel_code IN (N'ORDER_CONVERT', N'SCHEDULE_BOARD', N'WORK_ORDER_BOARD', N'WORK_ORDER_LIST')
GROUP BY p.panel_code
ORDER BY p.panel_code;
GO
SELECT N'仍借旧闸门但未补新码的角色(应为空)' AS 检查项, r.id AS 角色ID, r.role_name AS 角色
FROM yj_role r
WHERE EXISTS (SELECT 1 FROM yj_role_panel s WHERE s.role_id = r.id AND s.panel_code = N'MANU_ORDER' AND s.perms LIKE '%view%')
  AND NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'WORK_ORDER_LIST');
GO
