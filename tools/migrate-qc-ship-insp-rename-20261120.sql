/* migrate-qc-ship-insp-rename-20261120.sql(2026-11-20)
 *
 * 用户口径:「名字修改为出货检验（表观）/（功能）」。
 *
 * 只改**显示名**(yj_panel.panel_name + panel 级译名):
 *   · QC_PROC_INSP:出货检验单功能 → 出货检验（功能）
 *   · QC_ASM_INSP :出货检验表观   → 出货检验（表观）
 *
 * ⚠ 不动的(ADR-0001 数据键红线 + 既有改名先例 2026-11-11「组装成品检验→出货检验表观」):
 *   面板代号(QC_PROC_INSP / QC_ASM_INSP)、物理表(qc_proc_insp_* / qc_asm_insp_*)、
 *   单号前缀(ZC / ZJ)、菜单 code/route、历史单据、审批状态、检验类型内部值。
 *   动代号 = 全链路迁移 + 历史数据对不上,收益为零。
 *
 * 落点(前端另改):menus.js 菜单标题、若干话术(选生产工单提示/回执、发货检验子页签等)见同批提交;
 *   纸面受控表单标题(YJ-QR-154「出货检验功能记录表」)属受控文件,不随菜单改名。
 *
 * 幂等:UPDATE 带 <> 判定(同值命中 0 行);译名逐 locale 的 INSERT 带 NOT EXISTS;两账套均执行。
 */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ============ A. 面板显示名 ============ */
UPDATE yj_panel SET panel_name = N'出货检验（功能）'
 WHERE panel_code = N'QC_PROC_INSP' AND ISNULL(panel_name, N'') <> N'出货检验（功能）';
IF @@ROWCOUNT > 0 PRINT N'[OK] yj_panel QC_PROC_INSP 已改名为「出货检验（功能）」';
ELSE PRINT N'[SKIP] yj_panel QC_PROC_INSP 已是「出货检验（功能）」';
GO
UPDATE yj_panel SET panel_name = N'出货检验（表观）'
 WHERE panel_code = N'QC_ASM_INSP' AND ISNULL(panel_name, N'') <> N'出货检验（表观）';
IF @@ROWCOUNT > 0 PRINT N'[OK] yj_panel QC_ASM_INSP 已改名为「出货检验（表观）」';
ELSE PRINT N'[SKIP] yj_panel QC_ASM_INSP 已是「出货检验（表观）」';
GO

/* ============ B. panel 级译名:把旧 key 整体改名(保住已有各语种译文),缺的 en/zh-TW 补齐 ============ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'出货检验（功能）')
    UPDATE yj_translation SET ref_key = N'出货检验（功能）', updated_at = SYSDATETIME()
     WHERE scope = 'panel' AND ref_key = N'出货检验单功能';
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'出货检验（表观）')
    UPDATE yj_translation SET ref_key = N'出货检验（表观）', updated_at = SYSDATETIME()
     WHERE scope = 'panel' AND ref_key = N'出货检验表观';
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'出货检验（功能）' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('panel', N'出货检验（功能）', 'en', N'Outgoing Inspection (Functional)', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'出货检验（功能）' AND locale = 'zh-TW')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('panel', N'出货检验（功能）', 'zh-TW', N'出貨檢驗（功能）', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'出货检验（表观）' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('panel', N'出货检验（表观）', 'en', N'Outgoing Inspection (Appearance)', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'出货检验（表观）' AND locale = 'zh-TW')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('panel', N'出货检验（表观）', 'zh-TW', N'出貨檢驗（表觀）', 'manual');
GO

/* ============ C. 菜单覆盖层(yj_menu_node):菜单名有**两个真源** ============
 * 左栏菜单 = 代码基线(menus.js) + yj_menu_node 覆盖行(菜单设计器保存过就整表覆盖)。
 * 正式库覆盖行 0 条 ⇒ 只认代码基线;测试库有 222 条(设计器保存过)⇒ 不改这里,
 * 测试库菜单**仍然显示旧名**(2026-11-20 实测踩到:面板标题已改、菜单还是「出货检验单功能」)。
 * 只动这两行,按 menu_code 精确命中,不动别人的定制(顺序/隐藏/图标)。
 */
UPDATE yj_menu_node SET title = N'出货检验（功能）', updated_at = SYSDATETIME()
 WHERE menu_code = N'qcProcInsp' AND ISNULL(title, N'') <> N'出货检验（功能）';
IF @@ROWCOUNT > 0 PRINT N'[OK] yj_menu_node qcProcInsp 标题已改';
ELSE PRINT N'[SKIP] yj_menu_node qcProcInsp 无覆盖行或已是新名';
GO
UPDATE yj_menu_node SET title = N'出货检验（表观）', updated_at = SYSDATETIME()
 WHERE menu_code = N'qcAsmInsp' AND ISNULL(title, N'') <> N'出货检验（表观）';
IF @@ROWCOUNT > 0 PRINT N'[OK] yj_menu_node qcAsmInsp 标题已改';
ELSE PRINT N'[SKIP] yj_menu_node qcAsmInsp 无覆盖行或已是新名';
GO

/* ============ D. 自检(任一项不成立即 RAISERROR 16 停手) ============ */
DECLARE @db sysname = DB_NAME();
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_PROC_INSP' AND panel_name = N'出货检验（功能）')
   AND EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_ASM_INSP' AND panel_name = N'出货检验（表观）')
   AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel'
                        AND ref_key IN (N'出货检验单功能', N'出货检验表观'))
   AND EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'出货检验（功能）' AND locale = 'en')
   AND EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'panel' AND ref_key = N'出货检验（表观）' AND locale = 'en')
   AND NOT EXISTS (SELECT 1 FROM yj_menu_node WHERE menu_code IN (N'qcProcInsp', N'qcAsmInsp')
                        AND title IN (N'出货检验单功能', N'出货检验表观'))
    RAISERROR(N'[PASS] %s 出货检验两张面板已改名为（功能）/（表观）,译名就位', 10, 1, @db);
ELSE
    RAISERROR(N'[FAIL] %s 出货检验面板改名自检未通过', 16, 1, @db);
GO
