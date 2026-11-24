/* migrate-i18n-upstream-newfields-20261124.sql(2026-11-24)
 *
 * 背景:合并 origin/main(94 提交)时带入两个**上游新增字段**,但上游迁移只登记了 yj_field、
 *   没补 en 译名 ⇒ DbNormAudit 第 9 项「缺 en 译名」从 215 涨到 217(棘轮只许降不许升),
 *   英文界面这两格也仍显示中文。本脚本只补 yj_translation(不碰字段/表结构):
 *     · RD_APPROVAL.客户编号   → Customer code(与 en.js 既有词条同译)
 *     · RD_PROGRESS.项目定级原则 → Project Grading Principle
 *
 * 幂等:NOT EXISTS 守卫;两账套:HSDZ_MES → HSDZ_MES_TEST。
 * ========================================================================== */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO
PRINT N'== migrate-i18n-upstream-newfields-20261124 ==';
GO

DECLARE @t TABLE (scope varchar(20), ref_key nvarchar(120), locale varchar(10), text nvarchar(400));
INSERT INTO @t (scope, ref_key, locale, text) VALUES
 ('field', N'客户编号',     'en', N'Customer code'),
 ('field', N'项目定级原则', 'en', N'Project Grading Principle');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT t.scope, t.ref_key, t.locale, t.text, 'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = t.scope AND x.ref_key = t.ref_key AND x.locale = t.locale);
GO

/* 自检:两条 en 译名必须都在(已存在也算通过) */
DECLARE @db sysname = DB_NAME();
DECLARE @n int = (SELECT COUNT(*) FROM yj_translation
                   WHERE scope = 'field' AND locale = 'en'
                     AND ref_key IN (N'客户编号', N'项目定级原则'));
IF @n = 2
    RAISERROR(N'[PASS] %s 上游新增字段 en 译名已就绪(2 条)', 10, 1, @db);
ELSE
    RAISERROR(N'[FAIL] %s en 译名缺失:应为 2 条,实际 %d', 16, 1, @db, @n);
GO
