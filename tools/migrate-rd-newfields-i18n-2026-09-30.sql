-- migrate-rd-newfields-i18n-2026-09-30.sql
-- 本轮新增字段标签的 en 译名(规范:新增字段必须同时交付译名) —— 幂等,两个账套都要执行
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════════
   为什么单独一条:2026-09-30 那批改动新增了三个字段标签,当时漏了译名,
   数据库规范体检第 09 项(缺 en 译名,棘轮只许降不许升)因此在两账套都 **FAIL**。
     · 是否受控 / 受控日期 —— 四个受控文件(RD_SPEC_DOC / RD_MOLD_PROC / RD_ASM_PROC / RD_INSP_PLAN)
       「审批后自动受控」的落点,见 migrate-rd-file-controlled-2026-09-30.sql
     · 变更类型           —— 严格变更 / 快捷变更是两档流程,见 migrate-rd-change-kind-2026-09-30.sql
   口径:yj_translation scope='field',ref_key=**字段标签**(同 label 全局共享),
   与前端 locales/en.js 的 biz 词条**成对**交付 —— 少了任何一边,切到 en 后总有一处露中文。
   ═══════════════════════════════════════════════════════════════════════════ */

IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'是否受控' AND locale = 'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否受控', 'en', N'Controlled', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'受控日期' AND locale = 'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'受控日期', 'en', N'Control Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'变更类型' AND locale = 'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'变更类型', 'en', N'Change Type', 'manual');
PRINT N'[OK] 三个新字段标签的 en 译名已补齐(是否受控/受控日期/变更类型)';
GO

-- 顺带把三个新字段用到的**取值**也补上(en 界面下下拉里不该是中文)
-- ⚠ 取值是字典项,按 ADR-0001 走同一张译名表(scope='field')
DECLARE @vals TABLE (k nvarchar(100), t nvarchar(200));
INSERT INTO @vals (k, t) VALUES (N'严格变更', N'Strict Change'), (N'快捷变更', N'Quick Change');
DECLARE @k nvarchar(100), @t nvarchar(200);
DECLARE cur CURSOR FOR SELECT k, t FROM @vals;
OPEN cur; FETCH NEXT FROM cur INTO @k, @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = @k AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', @k, 'en', @t, 'manual');
  FETCH NEXT FROM cur INTO @k, @t;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[OK] 变更类型两个取值(严格变更/快捷变更)的 en 译名已补';
GO

-- 自检
DECLARE @n int = (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND locale = 'en'
                   AND ref_key IN (N'是否受控', N'受控日期', N'变更类型', N'严格变更', N'快捷变更'));
IF @n = 5
  PRINT N'[OK] 自检通过:5 条 en 译名齐备';
ELSE
  PRINT N'[WARN] 自检异常:只查到 ' + CAST(@n AS nvarchar(3)) + N' 条(期望 5)';
GO
