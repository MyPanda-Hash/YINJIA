/* migrate-qc-flow-monitor-20261112.sql — 品质流程监控(QC_FLOW)页面级面板:授权 + 面板名译名(2026-11-12)
 *
 * 背景(用户口径 2026-11-12):「流程监控:从送料->检验单->入库。为品质做一个流程监控的面版,
 *   可以知道每个单据的状态,和跳转,如果没有对应面版的权限就无法跳转过去。这种看板类似,
 *   而且参考检验目录,主要要显示物料批号和物料编码。」
 *
 * 页面 = /qc/flowMonitor(专用 Vue:views/modules/qc/QcFlowMonitor.vue,看板 + 列表双视图),
 *   **不是** yj_panel 单据面板(没有自己的表:一行 = 送料暂收单的一条物料行,现算)
 *   ⇒ 沿用既有先例(生产工序进度看板 WORK_ORDER_PROGRESS / 项目流程管控 PROJECT_FLOW):
 *   按 PagePanelRegistry.QC_FLOW 页面级虚拟面板登记,授权落 yj_role_panel,
 *   组织架构「角色与面板权限」矩阵的「品质管理」组由 SysAdminController 直接注入(本页只读,动作 view/query)。
 *
 * 等价补授(本脚本唯一的兼容风险点):凡是**已授来料检验单 QC_INSP 或送料暂收单 QC_RECV 可见**的角色
 *   (或 is_admin='Y'),补授 QC_FLOW 的 view,query —— 看板就是这两张单的派生视图,
 *   能看单的人就该能看它;不补授会让老账号上线后菜单消失/接口 403,而管理员并不知道要重新勾。
 *
 * 跳转权限不在这里配:看板上的三个节点(送料暂收单 / 来料检验单 / 采购入库单)在**点击时**按
 *   目标面板自己的查看权判定(前端 canViewPanel,与导航/我的桌面同源;后端各面板 requirePanelView 兜底),
 *   没有该面板权限时只提示「无查看该面板的权限」,不发路由。
 *
 * 幂等:全部 IF NOT EXISTS;已存在的授权行**不动**(不覆盖人工调整)。重跑安全。
 * 两账套(HSDZ_MES → HSDZ_MES_TEST)均需执行。
 */
SET NOCOUNT ON;
GO

/* ── ① 等价补授:已授 来料检验单/送料暂收单 可见的角色 + 管理员 ── */
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, N'QC_FLOW', N'view,query', 'N'
  FROM yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x
                    WHERE x.role_id = r.id AND x.panel_code = N'QC_FLOW')
   AND (r.is_admin = 'Y'
        OR EXISTS (SELECT 1 FROM yj_role_panel s
                    WHERE s.role_id = r.id
                      AND s.panel_code IN (N'QC_INSP', N'QC_RECV')
                      AND s.perms LIKE '%view%'));
PRINT N'[授权] QC_FLOW 新增 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 个角色(view,query)';
GO

/* ── ② 面板名译名(AGENTS.md 多语言规范:新增面板必须同时交付译名) ──
   页面级虚拟面板无 yj_panel 行,名称同样走 yj_translation scope='panel';
   前端菜单标题另在 src/i18n/locales 下各语言包的 biz 块(本任务同批交付)。 */
DECLARE @t TABLE (locale varchar(10), text nvarchar(200));
INSERT INTO @t (locale, text) VALUES
 ('en',    N'Quality Process Monitor'),
 ('zh-TW', N'品質流程監控'),
 ('ja',    N'品質プロセス監視'),
 ('ko',    N'품질 프로세스 모니터'),
 ('es',    N'Monitor de proceso de calidad'),
 ('fr',    N'Suivi du processus qualité'),
 ('de',    N'Qualitätsprozess-Monitor'),
 ('ru',    N'Мониторинг процесса качества'),
 ('vi',    N'Giám sát quy trình chất lượng'),
 ('th',    N'ตรวจสอบกระบวนการคุณภาพ');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'panel', N'品质流程监控', t.locale, t.text, 'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = 'panel' AND x.ref_key = N'品质流程监控' AND x.locale = t.locale);
PRINT N'[译名] 品质流程监控 新增 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 条';
GO

/* ── ③ 自检 ── */
DECLARE @bad int = 0;
/* 授权:至少 1 个角色(管理员恒有),且权限词必须是只读的 view,query */
IF (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'QC_FLOW') = 0 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code = N'QC_FLOW'
            AND (perms NOT LIKE '%view%' OR perms LIKE '%audit%' OR perms LIKE '%add%' OR perms LIKE '%del%'))
  SET @bad = @bad + 1;
/* 译名:en 必须有(切英语后菜单/标题不能回中文) */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'品质流程监控' AND locale = 'en')
  SET @bad = @bad + 1;
/* 不该在 yj_panel 里出现(页面级虚拟面板不是单据面板;插了会污染选单/字段配置等 registry.all() 下游) */
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_FLOW') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'品质流程监控 QC_FLOW 迁移自检失败(坏项 %d)', 16, 1, @bad);
ELSE PRINT N'[OK] 品质流程监控 QC_FLOW 就绪(授权 + 10 语言面板名)';
GO

SELECT N'QC_FLOW 授权角色数' AS 检查项, COUNT(*) AS 值 FROM yj_role_panel WHERE panel_code = N'QC_FLOW'
UNION ALL
SELECT N'QC_FLOW 译名条数', COUNT(*) FROM yj_translation WHERE scope = 'panel' AND ref_key = N'品质流程监控';
GO
