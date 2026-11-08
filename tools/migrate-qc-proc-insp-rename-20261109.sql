/* migrate-qc-proc-insp-rename-20261109.sql(2026-11-08/09) — 面板改名:制程检验单 → 出货检验单功能
 *
 * 用户口径(2026-11-08,配合截图 image1 红框):
 *   「制程检验单将名字更改为出货检验功能……菜单为出货检验单功能,表格中标题为出货检验记录表」
 *   ⇒ **菜单 / 页签 / 左栏单据选择 = 出货检验单功能**;
 *      页面纸面标题 / 记录表标题(含 Excel 导出、服务端 PDF/XLSX 报表)= **出货检验记录表**
 *      (报表模板正文见 migrate-qc-proc-insp-tpl-20261109.sql)。
 *   只改**显示名**:面板代号 QC_PROC_INSP、物理表 qc_proc_insp_head/detail、单据编号前缀 ZC、
 *   单据状态/审批留痕/历史单据**全部不动**;检验类别的数据值「制程检验」也不动(那是业务数据键,
 *   不是面板名)。组装成品检验单 QC_ASM_INSP 本次不动(用户 2026-11-08 口径「图二和第二点不管先」)。
 *
 * 本脚本(幂等;两账套各跑一遍):
 *   §1 yj_panel.panel_name / panel_name_en 改名 —— 页签/左栏「XXX选择」/document.title/审批留痕
 *      里的面板名都读这一列(PanelRegistry.PanelDef.name / PanelConfigService.metadata.panelName);
 *   §2 yj_menu_node 覆盖行(菜单设计器)—— 库里若有 qcProcInsp 的菜单名覆盖行,一并改
 *      (本地两账套实测 0 行;服务器上可能有,脚本兜住「库覆盖 > 代码基线」这一层);
 *   §3 yj_translation 译名:panel(面板名)与 report(报表模板名)两条旧键 → 新键;
 *   §4 自检(RAISERROR 16 ⇒ DbSync 判 FAIL、不写 yj_schema_log)。
 *
 * 配套(不在本脚本):
 *   · 报表模板库内行(名称+正文)= migrate-qc-proc-insp-tpl-20261109.sql;
 *   · 代码侧显示名 = frontend menus.js 菜单 title / QcProcInspSheet.vue 纸面标题与导出名 /
 *     qcProcInspExport.js 版式默认标题 / reports/qc_proc_insp.jrxml 标题(同批提交)。
 *
 * 已知**不改**的旧名(属其它面板的字段标签 / 业务数据,不在本改名范围):
 *   · yj_field:QC_BHG / QC_OQC_REPORT 的「制程检验单号」列(别的单据引用本单号,改标签会动数据键);
 *   · yj_translation:scope=field 的「制程检验」「制程检验单」「制程检验单号」行;
 *   · 检验类别数据值「制程检验」。
 */

SET NOCOUNT ON;
GO

/* ═════════════ 1. 面板显示名:yj_panel ═════════════ */
PRINT N'== 1. yj_panel 面板改名(制程检验单 → 出货检验单功能) ==';
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_PROC_INSP')
  RAISERROR(N'[FAIL] yj_panel 缺 QC_PROC_INSP 行,改名无法进行', 16, 1);
ELSE
BEGIN
  UPDATE yj_panel
     SET panel_name = N'出货检验单功能',
         panel_name_en = N'Outgoing Inspection Sheet (Functional)'
   WHERE panel_code = N'QC_PROC_INSP'
     AND (panel_name <> N'出货检验单功能'
          OR ISNULL(panel_name_en, N'') <> N'Outgoing Inspection Sheet (Functional)');
  PRINT N'[OK] yj_panel.QC_PROC_INSP → panel_name=出货检验单功能 / panel_name_en=Outgoing Inspection Sheet (Functional)';
END
GO

/* ═════════════ 2. 菜单设计器覆盖行:yj_menu_node ═════════════
 * 菜单树 = 代码基线(menus.js) + 库覆盖(yj_menu_node,按 menu_code)。若库里存过这个叶子的名字,
 * 它会盖住代码基线 ⇒ 必须一起改,否则菜单仍显示旧名。本地两账套实测 0 行(未定制),服务器可能有。 */
PRINT N'== 2. yj_menu_node 菜单名覆盖行 ==';
UPDATE yj_menu_node
   SET title = N'出货检验单功能', updated_at = SYSDATETIME()
 WHERE menu_code = N'qcProcInsp'
   AND title <> N'出货检验单功能';
PRINT N'[OK] yj_menu_node:qcProcInsp 覆盖名(如有)已同步为 出货检验单功能';
GO

/* ═════════════ 3. 译名:panel(面板名)/ report(报表模板名) ═════════════ */
PRINT N'== 3. yj_translation 译名换键 ==';
-- 3.1 面板名:旧键整组删掉(改名的旧键已无对应面板),新键补 en(其余语种由 TranslationService 机翻兜底)
DELETE FROM yj_translation WHERE scope = N'panel' AND ref_key = N'制程检验单';
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'出货检验单功能' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'panel', N'出货检验单功能', N'en', N'Outgoing Inspection Sheet (Functional)', N'manual');

-- 3.2 报表模板名:旧键('制程检验记录表')已随模板改名作废,新键补 en
DELETE FROM yj_translation WHERE scope = N'report' AND ref_key = N'制程检验记录表';
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'report' AND ref_key = N'出货检验记录表' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'report', N'出货检验记录表', N'en', N'Outgoing Inspection Record', N'manual');
PRINT N'[OK] 译名换键完成(panel/report 各 1 个 en 新键;旧键 0 残留)';
GO

/* ═════════════ 4. 自检(不符即 RAISERROR 16 ⇒ DbSync 判 FAIL) ═════════════ */
PRINT N'== 4. 自检 ==';
DECLARE @bad int = 0;
-- 4.1 面板名已是新名、且旧名 0 残留
IF (SELECT COUNT(*) FROM yj_panel WHERE panel_code = N'QC_PROC_INSP' AND panel_name = N'出货检验单功能') <> 1 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_PROC_INSP' AND panel_name = N'制程检验单') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_PROC_INSP' AND ISNULL(panel_name_en, N'') = N'') SET @bad = @bad + 1;
-- 4.2 菜单覆盖行(如有)不再含旧名
IF EXISTS (SELECT 1 FROM yj_menu_node WHERE menu_code = N'qcProcInsp' AND title = N'制程检验单') SET @bad = @bad + 1;
-- 4.3 译名:新键 en 在、旧键 0 残留
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'出货检验单功能' AND locale = N'en') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'制程检验单') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'report' AND ref_key = N'出货检验记录表' AND locale = N'en') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'report' AND ref_key = N'制程检验记录表') SET @bad = @bad + 1;
-- 4.4 物理对象未被动到(改名只碰显示名):表在、面板行还在、单据编号前缀仍是 ZC
IF OBJECT_ID(N'dbo.qc_proc_insp_head', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.qc_proc_insp_detail', N'U') IS NULL SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_PROC_INSP' AND prefix <> N'ZC') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验单改名自检失败(见 §4 各项)', 16, 1);
ELSE PRINT N'[OK] 改名自检通过:面板名=出货检验单功能(旧名 0 残留);菜单覆盖 0 旧名;panel/report 译名就绪;表/前缀 ZC 未动';
GO
