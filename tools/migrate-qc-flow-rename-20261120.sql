/* migrate-qc-flow-rename-20261120.sql(2026-11-20)
 *
 * 用户口径:「品质流程监控名字更改为来料品质流程监控」。
 *
 * 只改**显示名**(页面级虚拟面板 QC_FLOW 的展示名 + panel 级译名 + 菜单覆盖层):
 *   · PagePanelRegistry 的 PagePanelDef 显示名(代码,见同批提交):品质流程监控 → 来料品质流程监控
 *   · 前端 menus.js / router meta.title / QcFlowMonitor 标题(代码,同批提交)
 *   · 本脚本:yj_translation 的 panel 级译名(按旧 key 整体改名,保住原有各语种译文并校正)
 *     + yj_menu_node 覆盖行
 *
 * ⚠ 不动的(与 2026-11-20 出货检验改名先例同口径):
 *   面板码 QC_FLOW、路由 /qc/flowMonitor、菜单 code qcFlowMonitor、接口 /px/qcFlow/list、
 *   授权行 yj_role_panel.panel_code、全部取数口径。
 *   动代号 = 授权/收藏/深链全要重签,收益为零。
 *
 * 为什么改:本页只管**来料**这条采购支线(送料→检验→入库),原来叫「品质流程监控」容易被理解成
 *   覆盖全部品质流程(首件/出货/不合格处理都不在这一页)。
 *
 * 幂等:UPDATE 带 <> / NOT EXISTS 判定;两账套(HSDZ_MES + HSDZ_MES_TEST)都要执行。
 */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ============ A. panel 级译名:旧 key 整体改名(保住原文各语种译文,随后按「来料」语义校正) ============ */
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'品质流程监控')
   AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'来料品质流程监控')
BEGIN
    UPDATE yj_translation SET ref_key = N'来料品质流程监控', updated_at = SYSDATETIME()
     WHERE scope = 'panel' AND ref_key = N'品质流程监控';
    PRINT N'[OK] yj_translation panel 译名已改名:品质流程监控 → 来料品质流程监控';
END
ELSE
    PRINT N'[SKIP] yj_translation panel 译名无需改名(旧 key 不存在或新 key 已存在)';
GO
/* A2. 十个语种的定稿译文(旧译名是「品质流程」泛称,新名限定「来料」):
 *     先 INSERT 缺行(从零安装的库 / 旧 key 从未机翻过的语种),再 UPDATE 已存在的旧译文。
 *     VALUES 表 = 唯一真源,与前端 i18n 语言包同文。 */
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'panel', N'来料品质流程监控', v.locale, v.text, 'manual'
  FROM (VALUES
        ('en',    N'Incoming Quality Process Monitor'),
        ('zh-TW', N'來料品質流程監控'),
        ('ja',    N'受入品質プロセス監視'),
        ('ko',    N'수입 품질 프로세스 모니터'),
        ('de',    N'Wareneingangs-Qualitätsprozess-Monitor'),
        ('es',    N'Monitor del proceso de calidad de recepción'),
        ('fr',    N'Suivi du processus qualité réception'),
        ('ru',    N'Мониторинг процесса качества входящих'),
        ('vi',    N'Giám sát quy trình chất lượng nhập hàng'),
        ('th',    N'ตรวจสอบกระบวนการคุณภาพวัตถุดิบ')
       ) AS v(locale, text)
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                    WHERE t.scope = 'panel' AND t.ref_key = N'来料品质流程监控' AND t.locale = v.locale);
PRINT N'[OK] panel 译名缺行已补齐(已存在的行不动)';
GO
UPDATE t SET text = v.text, source = 'manual', updated_at = SYSDATETIME()
  FROM yj_translation t
  JOIN (VALUES
        ('en',    N'Incoming Quality Process Monitor'),
        ('zh-TW', N'來料品質流程監控'),
        ('ja',    N'受入品質プロセス監視'),
        ('ko',    N'수입 품질 프로세스 모니터'),
        ('de',    N'Wareneingangs-Qualitätsprozess-Monitor'),
        ('es',    N'Monitor del proceso de calidad de recepción'),
        ('fr',    N'Suivi du processus qualité réception'),
        ('ru',    N'Мониторинг процесса качества входящих'),
        ('vi',    N'Giám sát quy trình chất lượng nhập hàng'),
        ('th',    N'ตรวจสอบกระบวนการคุณภาพวัตถุดิบ')
       ) AS v(locale, text) ON v.locale = t.locale
 WHERE t.scope = 'panel' AND t.ref_key = N'来料品质流程监控' AND ISNULL(t.text, N'') <> v.text;
PRINT N'[OK] panel 译名已按新名校正';
GO

/* ============ B. 菜单覆盖层(yj_menu_node):菜单名有**两个真源** ============
 * 左栏菜单 = 代码基线(menus.js) + yj_menu_node 覆盖行(菜单设计器保存过就整表覆盖)。
 * 正式库覆盖行 0 条 ⇒ 只认代码基线;测试库有 222 条 ⇒ 不改这里,测试库菜单**仍然显示旧名**
 *   (2026-11-20 出货检验改名时实测踩到同一个坑)。
 * 只动 qcFlowMonitor 这一行,按 menu_code 精确命中,不动别人的定制(顺序/隐藏/图标)。
 */
IF OBJECT_ID('dbo.yj_menu_node') IS NOT NULL
BEGIN
    UPDATE yj_menu_node SET title = N'来料品质流程监控', updated_at = SYSDATETIME()
     WHERE menu_code = N'qcFlowMonitor' AND ISNULL(title, N'') <> N'来料品质流程监控';
    IF @@ROWCOUNT > 0 PRINT N'[OK] yj_menu_node qcFlowMonitor 标题已改';
    ELSE PRINT N'[SKIP] yj_menu_node qcFlowMonitor 无覆盖行或已是新名';
END
ELSE
    PRINT N'[SKIP] 本库没有 yj_menu_node(菜单只认代码基线)';
GO

/* ============ C. 自检(任一项不成立即 RAISERROR 16 停手) ============ */
DECLARE @db sysname = DB_NAME();
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'panel' AND ref_key = N'来料品质流程监控') >= 10
   AND EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'来料品质流程监控'
                    AND locale = 'en' AND text = N'Incoming Quality Process Monitor')
   AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'品质流程监控')
   AND (OBJECT_ID('dbo.yj_menu_node') IS NULL
        OR NOT EXISTS (SELECT 1 FROM yj_menu_node WHERE menu_code = N'qcFlowMonitor' AND title = N'品质流程监控'))
    RAISERROR(N'[PASS] %s 品质流程监控已改名为来料品质流程监控(译名 10 语种 + 菜单覆盖层就位)', 10, 1, @db);
ELSE
    RAISERROR(N'[FAIL] %s 改名自检未通过', 16, 1, @db);
GO
