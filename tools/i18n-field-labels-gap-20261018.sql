/* i18n-field-labels-gap-20261018.sql — 补「字典SQL」的 en 译名(体检 09)
   【背景】2026-10-18 合入远端「数据建模·字段管理(FIELDMGR)」后,新字段标签「字典SQL」没有 en 译名,
     体检 09 报 1 个缺失(棘轮基线 0 ⇒ FAIL)。按 AGENTS 多语言规范:新增字段标签至少补 en。
   【幂等】已有同键行则跳过。两账套均执行。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'字典SQL' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'字典SQL', 'en', N'Dictionary SQL', 'manual');
GO
DECLARE @db sysname = DB_NAME();
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'字典SQL' AND locale = 'en')
    RAISERROR(N'[OK] %s 字典SQL en 译名就绪', 10, 1, @db);
ELSE RAISERROR(N'[FAIL] %s 字典SQL en 译名未写入', 16, 1, @db);
GO
