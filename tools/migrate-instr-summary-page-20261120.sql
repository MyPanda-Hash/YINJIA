/* ============================================================================
 * migrate-instr-summary-page-20261120.sql —— 仪器使用汇总表(页面级虚拟面板 INSTR_SUMMARY)
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-20):
 *   「为当前的试验仪器记录表创建一个汇总表,汇总表需要查看的内容如图1所示。
 *     汇总表实现可以参考样品检验汇总表。」
 *   追问落点后:「不要这个页签,同时(第2项)按照独立页面完成」
 *   —— 2026-11-19 加在仪器使用记录表面板里的第 2 页签「使用记录汇总」撤除,
 *      汇总改为**独立页面**(照样品检验汇总表:时间区间 + 统计 + 勾选 + 导出 Excel)。
 *
 * 本页**不是** yj_panel 单据面板(不承载单据、没有自己的表),而是页面级虚拟面板
 * (先例:INSP_SUMMARY 样品检验汇总表 / QC_FLOW 品质流程监控):
 *   · 页面 /rd/instrSummary,取数 POST /api/px/instrSummary/summary(只读,现算);
 *   · 导出 POST /api/px/instrSummary/export(POI 生成「实验室仪器使用记录表」,可只导勾选行);
 *   · 面板定义在代码里:PagePanelRegistry.INSTR_SUMMARY(动作 view/query/export);
 *   · 授权照旧落 yj_role_panel;权限矩阵条目由 SysAdminController 从 PagePanelRegistry.ALL 注入;
 *   · 导航菜单在前端 hardcode(menus.js),本脚本不碰 yj_menu_node。
 *
 * 因此本脚本只做两件事:
 *   A. 授权:凡是**已能查看仪器使用记录表(RD_INSTR_USE)**的角色 + 管理员,
 *      补授 INSTR_SUMMARY 的 view,query,export —— 能看这张记录表的人就该能看它的汇总;
 *      不补授会让老账号上线后菜单消失、接口 403,而管理员并不知道要重新勾。
 *      ⚠ 按**角色**整批补,不写死 role_id(2026-11-06 教训:role_id 两账套不同)。
 *   B. 面板名译名(yj_translation scope='panel'),至少 en;AGENTS.md 多语言强制规范。
 *
 * 幂等:已存在的授权行只**补齐缺词**(不覆盖人工调整);译名 NOT EXISTS;重复执行 0 行变更。
 * 两账套(HSDZ_MES / HSDZ_MES_TEST)都要执行。末尾自检不符即 RAISERROR。
 * ========================================================================== */
SET NOCOUNT ON;
GO

/* ---------- A. 授权:能看仪器使用记录表的角色 + 管理员 ---------- */
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, N'INSTR_SUMMARY', N'view,query,export', 'N'
  FROM yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x
                    WHERE x.role_id = r.id AND x.panel_code = N'INSTR_SUMMARY')
   AND (r.is_admin = 'Y'
        OR EXISTS (SELECT 1 FROM yj_role_panel s
                    WHERE s.role_id = r.id
                      AND s.panel_code = N'RD_INSTR_USE'
                      AND s.perms LIKE '%view%'));
PRINT N'[授权] INSTR_SUMMARY 新增 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 个角色(view,query,export)';
GO

/* 已存在的授权行补齐缺词:缺 view / query / export 的分别补(整词判;空 perms 不产生前导逗号) */
UPDATE rp
   SET perms = CASE WHEN ISNULL(rp.perms, N'') = N'' THEN N'view'
                    ELSE rp.perms + N',view' END
  FROM yj_role_panel rp
 WHERE rp.panel_code = N'INSTR_SUMMARY'
   AND N',' + REPLACE(ISNULL(rp.perms, N''), N' ', N'') + N',' NOT LIKE N'%,view,%';
PRINT N'[授权] INSTR_SUMMARY 补 view,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

UPDATE rp
   SET perms = CASE WHEN ISNULL(rp.perms, N'') = N'' THEN N'query'
                    ELSE rp.perms + N',query' END
  FROM yj_role_panel rp
 WHERE rp.panel_code = N'INSTR_SUMMARY'
   AND N',' + REPLACE(ISNULL(rp.perms, N''), N' ', N'') + N',' NOT LIKE N'%,query,%';
PRINT N'[授权] INSTR_SUMMARY 补 query,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

UPDATE rp
   SET perms = CASE WHEN ISNULL(rp.perms, N'') = N'' THEN N'export'
                    ELSE rp.perms + N',export' END
  FROM yj_role_panel rp
 WHERE rp.panel_code = N'INSTR_SUMMARY'
   AND N',' + REPLACE(ISNULL(rp.perms, N''), N' ', N'') + N',' NOT LIKE N'%,export,%';
PRINT N'[授权] INSTR_SUMMARY 补 export,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- B. 面板名译名(scope=panel;与 INSP_SUMMARY 同款) ---------- */
IF OBJECT_ID('dbo.yj_translation') IS NULL
BEGIN
  RAISERROR(N'[SKIP] yj_translation 不存在,译名跳过(不影响授权)', 10, 1);
END
ELSE
BEGIN
  DECLARE @t TABLE (locale varchar(10), text nvarchar(200));
  INSERT INTO @t (locale, text) VALUES
   ('en',    N'Instrument Usage Summary'),
   ('zh-TW', N'儀器使用彙總表'),
   ('ja',    N'機器使用集計表'),
   ('ko',    N'기기 사용 집계표'),
   ('es',    N'Resumen de uso de instrumentos'),
   ('fr',    N'Synthèse d''utilisation des instruments'),
   ('de',    N'Übersicht der Gerätenutzung'),
   ('ru',    N'Сводка использования приборов'),
   ('vi',    N'Bảng tổng hợp sử dụng thiết bị'),
   ('th',    N'ตารางสรุปการใช้งานเครื่องมือ');

  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  SELECT 'panel', N'仪器使用汇总表', t.locale, t.text, 'manual'
    FROM @t t
   WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                      WHERE x.scope = 'panel' AND x.ref_key = N'仪器使用汇总表' AND x.locale = t.locale);
  PRINT N'[译名] 仪器使用汇总表 新增 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 条';
END
GO

/* ---------- C. 自检 ---------- */
/* C1:凡有 RD_INSTR_USE 查看权的角色,必须有 INSTR_SUMMARY 的 view
   (管理员 is_admin='Y' 恒放行,不在此列) */
DECLARE @miss int = (
  SELECT COUNT(*)
    FROM yj_role r
   WHERE r.is_admin <> 'Y'
     AND EXISTS (SELECT 1 FROM yj_role_panel s
                  WHERE s.role_id = r.id
                    AND s.panel_code = N'RD_INSTR_USE'
                    AND s.perms LIKE '%view%')
     AND NOT EXISTS (SELECT 1 FROM yj_role_panel x
                      WHERE x.role_id = r.id AND x.panel_code = N'INSTR_SUMMARY'
                        AND N',' + REPLACE(ISNULL(x.perms, N''), N' ', N'') + N',' LIKE N'%,view,%')
);
IF @miss > 0
    RAISERROR(N'[自检] 仍有 %d 个角色能看仪器使用记录表但没有 INSTR_SUMMARY 的 view', 16, 1, @miss);

/* C2:INSTR_SUMMARY 的授权行必须含 query 与 export(导出按钮靠 pagePerms 的 export 词) */
DECLARE @bad int = (
  SELECT COUNT(*) FROM yj_role_panel
   WHERE panel_code = N'INSTR_SUMMARY'
     AND (N',' + REPLACE(ISNULL(perms, N''), N' ', N'') + N',' NOT LIKE N'%,query,%'
       OR N',' + REPLACE(ISNULL(perms, N''), N' ', N'') + N',' NOT LIKE N'%,export,%')
);
IF @bad > 0
    RAISERROR(N'[自检] 有 %d 条 INSTR_SUMMARY 授权缺 query/export', 16, 1, @bad);

/* C3:面板名译名至少要有 en(AGENTS.md 多语言强制规范) */
IF OBJECT_ID('dbo.yj_translation') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_translation
                    WHERE scope = 'panel' AND ref_key = N'仪器使用汇总表' AND locale = 'en')
    RAISERROR(N'[自检] 仪器使用汇总表 缺 en 面板名译名', 16, 1);

PRINT N'[完成] INSTR_SUMMARY 授权 + 译名就绪(两账套均需执行)';
GO
