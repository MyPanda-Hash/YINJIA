/* ═══════════════════════════════════════════════════════════════════════════════
   migrate-approval-level.sql — 立项申请表「项目等级」(审核人定级)+ 全链路四级统一
   (2026-09-21)

   用户口径:
     ① 立项申请表审核通过后,由**审核人**在系统里对项目定级,等级作为后续立项(实施计划)、
        进度(分发)流程的属性;
     ② 等级选项在原有基础上补成 **一级/二级/三级/四级**(四级统一),下游字典同步补「一级」;
     ③ 形态:归档后侧栏「项目定级」按钮(管理员 ∪ 该面板审批人 can_approve),弹窗选级,
        写单据 + 留一条审批留痕;已定级可再改,每次留痕。

   本脚本负责数据层:
     §1 rd_approval 补 [项目等级] 列(可空 —— 定级是审核人的事后动作,不是建单必填);
     §2 yj_field 登记 RD_APPROVAL.项目等级(header/下拉框/一~四级);
     §3 下游字典统一补「一级」:RD_PLAN.项目定级、RD_PROGRESS.项目定级(place=detail 的 项目层级);
        ⚠ RD_PROGRESS 表头那个 label 是「项目(一/二级)」,语义是"一二级并档",**不动**;
     §4 列注释 + 译名(项目等级 = Project Level,10 语言;选项值属数据键不翻译,见 ADR-0001)。

   幂等:列走 IF COL_LENGTH IS NULL;字段行按 (panel_code, col_name, place) NOT EXISTS;字典直接覆盖写。
   用法:java -cp lib\mssql-jdbc.jar SqlRunner.java <jdbcUrl> yinjia env tools\migrate-approval-level.sql
   ═══════════════════════════════════════════════════════════════════════════════ */
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 1. 立项申请头表补 [项目等级](⚠ 头表叫 rd_approval,不是 rd_approval_head)
-- ═══════════════════════════════════════════════════════════════════
BEGIN TRY
IF COL_LENGTH('rd_approval', N'项目等级') IS NULL ALTER TABLE rd_approval ADD [项目等级] nvarchar(20) NULL;
END TRY BEGIN CATCH PRINT N'rd_approval 加列跳过'; END CATCH;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 2. 字段登记(seq 160:排在 文件使用范围150 与 文档编号155 之后,不挤动既有列序)
-- ═══════════════════════════════════════════════════════════════════
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_APPROVAL' AND col_name = N'项目等级' AND place = N'header')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                          place, seq, width, editable, required, hidden, visible)
    VALUES (N'RD_APPROVAL', N'项目等级', N'项目等级', N'下拉框',
            N'SELECT v FROM (VALUES (N''一级''),(N''二级''),(N''三级''),(N''四级'')) AS t(v)',
            NULL, NULL, NULL, N'header', 160, 100, 1, 0, 0, 1);
GO

-- ═══════════════════════════════════════════════════════════════════
-- 3. 下游字典统一补「一级」(四级统一:一/二/三/四)
-- ═══════════════════════════════════════════════════════════════════
UPDATE yj_field SET dict_sql = N'SELECT v FROM (VALUES (N''一级''),(N''二级''),(N''三级''),(N''四级'')) AS t(v)'
 WHERE panel_code = N'RD_PLAN' AND col_name = N'项目定级';
GO
UPDATE yj_field SET dict_sql = N'SELECT v FROM (VALUES (N''一级''),(N''二级''),(N''三级''),(N''四级'')) AS t(v)'
 WHERE panel_code = N'RD_PROGRESS' AND place = N'detail' AND col_name = N'项目层级';
GO

-- ═══════════════════════════════════════════════════════════════════
-- 4. 列注释 + 译名
-- ═══════════════════════════════════════════════════════════════════
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_approval') AND name = 'MS_Description'
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_approval'), N'项目等级', 'ColumnId'))
    EXEC sp_addextendedproperty N'MS_Description', N'项目等级(立项申请审核通过后由审核人在「项目定级」按钮里定;一/二/三/四级,后续实施计划与进度查询据此分档)',
        N'SCHEMA', N'dbo', N'TABLE', N'rd_approval', N'COLUMN', N'项目等级';
GO
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', N'项目等级', v.locale, v.text, 'manual'
FROM (VALUES ('en', N'Project Level'), ('zh-TW', N'專案等級'), ('ja', N'プロジェクト等級'), ('ko', N'프로젝트 등급'),
             ('es', N'Nivel de proyecto'), ('fr', N'Niveau de projet'), ('de', N'Projektstufe'),
             ('ru', N'Уровень проекта'), ('vi', N'Cấp dự án'), ('th', N'ระดับโครงการ')) AS v(locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope='field' AND x.ref_key=N'项目等级' AND x.locale=v.locale);
GO

-- ═══════════════════════════════════════════════════════════════════
-- 5. 校验输出
-- ═══════════════════════════════════════════════════════════════════
SELECT N'rd_approval.项目等级' AS 检查项,
       CASE WHEN COL_LENGTH('rd_approval', N'项目等级') IS NULL THEN N'MISSING' ELSE N'OK' END AS 结果
UNION ALL SELECT N'yj_field RD_APPROVAL.项目等级', CAST(COUNT(*) AS nvarchar) + N' 行(应为 1)'
  FROM yj_field WHERE panel_code=N'RD_APPROVAL' AND col_name=N'项目等级'
UNION ALL SELECT N'译名 项目等级', CAST(COUNT(*) AS nvarchar) + N' 语言' FROM yj_translation WHERE scope='field' AND ref_key=N'项目等级';
GO
SELECT panel_code, place, col_name, label, dict_sql FROM yj_field
 WHERE (panel_code=N'RD_APPROVAL' AND col_name=N'项目等级')
    OR (panel_code=N'RD_PLAN' AND col_name=N'项目定级')
    OR (panel_code=N'RD_PROGRESS' AND place=N'detail' AND col_name=N'项目层级');
GO
PRINT N'migrate-approval-level.sql 完成:立项申请表项目等级 + 全链路一/二/三/四级';
GO
