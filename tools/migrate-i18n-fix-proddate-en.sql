-- migrate-i18n-fix-proddate-en.sql — 修正「生产日期」英文错译 Kf Date → Production Date(2026-09-21)
-- ═══════════════════════════════════════════════════════════════════════════════════
-- 起因:来料检验单新增「生产日期」字段后,英文界面实测显示为 **Kf Date**。
--   追查:yj_translation 里 scope='field' / ref_key='生产日期' / locale='en' 的既有行文本是 'Kf Date'
--   (source=manual, 历史遗留);库里**不存在**「开封日期」之类字段(实测 0),
--   故 'Kf' 并非另一字段的译名误置,而是纯粹错译。
--   该中文标签被 3 个面板的字段共用,修正后一并受益。
--
-- 影响面:仅 scope='field' 的这一行 en 文本;不动其它语言、不动 zh/其它 scope。
-- 幂等:第二次执行文本已等于目标值,UPDATE 命中 0 行。
-- 注:英文界面用 label_en 列时另说——本脚本只修 yj_translation(译名表的真源)。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 修正前留档
PRINT N'[i18n-proddate] 修正前:';
SELECT ref_key, locale, text, source FROM yj_translation
WHERE scope='field' AND ref_key=N'生产日期' AND locale='en';

UPDATE yj_translation SET text = N'Production Date', updated_at = GETDATE()
WHERE scope='field' AND ref_key=N'生产日期' AND locale='en' AND text <> N'Production Date';
PRINT N'[i18n-proddate] 更新行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N'(首次 1,复跑 0)';

-- 自检
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'生产日期' AND locale='en' AND text <> N'Production Date')
    RAISERROR(N'[i18n-proddate] 自检失败:生产日期/en 仍不是 Production Date', 16, 1);
ELSE
    PRINT N'[i18n-proddate] 自检通过:生产日期 / en = Production Date';
GO
