/* ============================================================================
 * migrate-insp-summary-20261117.sql —— 样品检验汇总表(页面级虚拟面板 INSP_SUMMARY)
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-17):
 *   「为当前的样品检验增加汇总表,能够查看到一天或者一周,送好多个样品,测试啥的总表。
 *     要按一个时间范围,去导出有多少人送了啥样品测试啥,安排检测工作。」
 *   三问确认:① 样品检验下**独立页面**;② 视角 = 按送样人 + 按委托单/样品;
 *   ③ 本期不做「安排人/计划日期」可写字段(导出 Excel 线下排班)。
 *
 * 本页**不是** yj_panel 单据面板(不承载单据、没有自己的表),而是页面级虚拟面板
 * (先例:QC_FLOW 品质流程监控 / WORK_ORDER_PROGRESS 生产工序进度看板):
 *   · 页面 /qc/inspSummary,取数 POST /api/px/inspSummary/summary(只读,现算);
 *   · 面板定义在代码里:PagePanelRegistry.INSP_SUMMARY(动作 view/query/export);
 *   · 授权照旧落 yj_role_panel;权限矩阵条目由 SysAdminController 从 PagePanelRegistry.ALL 注入;
 *   · 导航菜单在前端 hardcode(menus.js),本脚本不碰 yj_menu_node。
 *
 * 因此本脚本只做两件事:
 *   A. 授权:凡是**已能查看检验委托单(INSP_COMMISSION)或送样登记表(SAMPLE_REG)**的角色
 *      + 管理员,补授 INSP_SUMMARY 的 view,query,export —— 能看这两张单的人就该能看它们的汇总;
 *      不补授会让老账号上线后菜单消失、接口 403,而管理员并不知道要重新勾。
 *      ⚠ 按**角色**整批补,不写死 role_id(2026-11-06 教训:role_id 两账套不同)。
 *   B. 面板名译名(yj_translation scope='panel'),至少 en;AGENTS.md 多语言强制规范。
 *
 * 幂等:已存在的授权行只**补齐缺词**(不覆盖人工调整);译名 NOT EXISTS;重复执行 0 行变更。
 * 两账套(HSDZ_MES / HSDZ_MES_TEST)都要执行。末尾自检不符即 RAISERROR。
 * ========================================================================== */
SET NOCOUNT ON;
GO

/* ---------- A. 授权:能看委托单/送样登记表的角色 + 管理员 ---------- */
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, N'INSP_SUMMARY', N'view,query,export', 'N'
  FROM yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x
                    WHERE x.role_id = r.id AND x.panel_code = N'INSP_SUMMARY')
   AND (r.is_admin = 'Y'
        OR EXISTS (SELECT 1 FROM yj_role_panel s
                    WHERE s.role_id = r.id
                      AND s.panel_code IN (N'INSP_COMMISSION', N'SAMPLE_REG')
                      AND s.perms LIKE '%view%'));
PRINT N'[授权] INSP_SUMMARY 新增 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 个角色(view,query,export)';
GO

/* 已存在的授权行补齐缺词:缺 view / query / export 的分别补(整词判;空 perms 不产生前导逗号) */
UPDATE rp
   SET perms = CASE WHEN ISNULL(rp.perms, N'') = N'' THEN N'view'
                    ELSE rp.perms + N',view' END
  FROM yj_role_panel rp
 WHERE rp.panel_code = N'INSP_SUMMARY'
   AND N',' + REPLACE(ISNULL(rp.perms, N''), N' ', N'') + N',' NOT LIKE N'%,view,%';
PRINT N'[授权] INSP_SUMMARY 补 view,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

UPDATE rp
   SET perms = CASE WHEN ISNULL(rp.perms, N'') = N'' THEN N'query'
                    ELSE rp.perms + N',query' END
  FROM yj_role_panel rp
 WHERE rp.panel_code = N'INSP_SUMMARY'
   AND N',' + REPLACE(ISNULL(rp.perms, N''), N' ', N'') + N',' NOT LIKE N'%,query,%';
PRINT N'[授权] INSP_SUMMARY 补 query,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

UPDATE rp
   SET perms = CASE WHEN ISNULL(rp.perms, N'') = N'' THEN N'export'
                    ELSE rp.perms + N',export' END
  FROM yj_role_panel rp
 WHERE rp.panel_code = N'INSP_SUMMARY'
   AND N',' + REPLACE(ISNULL(rp.perms, N''), N' ', N'') + N',' NOT LIKE N'%,export,%';
PRINT N'[授权] INSP_SUMMARY 补 export,行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ---------- B. 面板名译名(scope=panel;与 QC_FLOW 同款) ---------- */
DECLARE @t TABLE (locale varchar(10), text nvarchar(200));
INSERT INTO @t (locale, text) VALUES
 ('en',    N'Sample Inspection Summary'),
 ('zh-TW', N'樣品檢驗彙總表'),
 ('ja',    N'サンプル検査集計表'),
 ('ko',    N'샘플 검사 집계표'),
 ('es',    N'Resumen de inspección de muestras'),
 ('fr',    N'Synthèse des inspections d''échantillons'),
 ('de',    N'Probenprüfungs-Übersicht'),
 ('ru',    N'Сводка по испытаниям образцов'),
 ('vi',    N'Bảng tổng hợp kiểm nghiệm mẫu'),
 ('th',    N'ตารางสรุปการตรวจสอบตัวอย่าง');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'panel', N'样品检验汇总表', t.locale, t.text, 'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = 'panel' AND x.ref_key = N'样品检验汇总表' AND x.locale = t.locale);
PRINT N'[译名] 样品检验汇总表 新增 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 条';
GO

/* ---------- C. 自检 ---------- */
/* C1:凡有 INSP_COMMISSION 或 SAMPLE_REG 查看权的角色,必须有 INSP_SUMMARY 的 view
   (管理员 is_admin='Y' 恒放行,不在此列) */
DECLARE @miss int = (
  SELECT COUNT(*)
    FROM yj_role r
   WHERE r.is_admin <> 'Y'
     AND EXISTS (SELECT 1 FROM yj_role_panel s
                  WHERE s.role_id = r.id
                    AND s.panel_code IN (N'INSP_COMMISSION', N'SAMPLE_REG')
                    AND s.perms LIKE '%view%')
     AND NOT EXISTS (SELECT 1 FROM yj_role_panel x
                      WHERE x.role_id = r.id AND x.panel_code = N'INSP_SUMMARY'
                        AND N',' + REPLACE(ISNULL(x.perms, N''), N' ', N'') + N',' LIKE N'%,view,%')
);
IF @miss > 0
    RAISERROR(N'[自检] 仍有 %d 个角色能看委托单/送样登记表但没有 INSP_SUMMARY 的 view', 16, 1, @miss);

/* C2:INSP_SUMMARY 的授权行必须含 query 与 export(导出按钮靠 pagePerms 的 export 词) */
DECLARE @bad int = (
  SELECT COUNT(*) FROM yj_role_panel
   WHERE panel_code = N'INSP_SUMMARY'
     AND (N',' + REPLACE(ISNULL(perms, N''), N' ', N'') + N',' NOT LIKE N'%,query,%'
       OR N',' + REPLACE(ISNULL(perms, N''), N' ', N'') + N',' NOT LIKE N'%,export,%')
);
IF @bad > 0
    RAISERROR(N'[自检] 有 %d 条 INSP_SUMMARY 授权缺 query/export', 16, 1, @bad);

/* C3:面板名译名至少 en 一条,且 10 个静态语言齐全 */
IF (SELECT COUNT(*) FROM yj_translation
     WHERE scope = 'panel' AND ref_key = N'样品检验汇总表') < 10
    RAISERROR(N'[自检] 样品检验汇总表 的 panel 译名不足 10 条', 16, 1);

PRINT N'✅ 样品检验汇总表(INSP_SUMMARY)授权与译名已就绪';
GO
