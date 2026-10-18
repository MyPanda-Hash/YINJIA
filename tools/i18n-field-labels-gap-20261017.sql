/* i18n-field-labels-gap-20261017.sql — 补 3 个缺 en 译名的字段标签

   【问题】数据库规范体检 09 项:缺 en 译名的字段标签 3 个 —— 备注1 / 交期紧迫度 / 已报工。
   三者在前端语言包 src/i18n/locales/en.js 里其实已有译名,缺的是**库内 yj_translation 行**
   (面板标签层走库,不读前端 biz 词条),所以切英语后这三格会回落中文。

   译名取值与 en.js 保持一致(避免同一中文键两套英文):
     备注1     → Remark 1     (ROUTE 面板「备注」列的栏名别名)
     交期紧迫度 → Due Urgency  (WO_SCHEDULE 字段)
     已报工    → Reported      (MANU_SCHEDULE 字段)

   【只补 en】其余语言由 tools/scripts/trigger-mt.ps1 机翻兜底写 yj_translation(source='mt'),
   与既有 i18n-*.sql 同一口径;en 必须人工且与前端语言包一致,故手写。
   【幂等】已有同键同语言行则跳过。两账套均执行。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

DECLARE @t TABLE (k nvarchar(200), v nvarchar(400));
INSERT INTO @t (k, v) VALUES
    (N'备注1',     N'Remark 1'),
    (N'交期紧迫度', N'Due Urgency'),
    (N'已报工',    N'Reported');

DECLARE @k nvarchar(200), @v nvarchar(400), @added int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT k, v FROM @t;
OPEN cur;
FETCH NEXT FROM cur INTO @k, @v;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = @k AND locale = 'en')
    BEGIN
        INSERT INTO yj_translation (scope, ref_key, locale, text, source)
        VALUES ('field', @k, 'en', @v, 'manual');
        SET @added = @added + 1;
    END
    FETCH NEXT FROM cur INTO @k, @v;
END
CLOSE cur; DEALLOCATE cur;
DECLARE @db sysname = DB_NAME();
RAISERROR(N'[OK] %s 补 en 译名 %d 行(已存在则跳过)', 10, 1, @db, @added);
GO

/* ===== 自检:这 3 个键必须有 en 行 ===== */
DECLARE @miss int = (SELECT COUNT(*) FROM (VALUES (N'备注1'), (N'交期紧迫度'), (N'已报工')) AS t(k)
                     WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                                        WHERE x.scope = 'field' AND x.ref_key = t.k AND x.locale = 'en'));
IF @miss > 0 RAISERROR(N'[FAIL] 仍有 %d 个标签缺 en 译名', 16, 1, @miss);
ELSE PRINT N'[OK] 3 个标签 en 译名齐备';
GO
