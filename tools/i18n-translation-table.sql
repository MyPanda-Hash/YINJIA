-- 多语言扩展地基:通用翻译表 + 语言注册表(任意语言=加行不加列)
-- 契约(CONTEXT.md 翻译表决策):label/panel_name 保持中文为键;译名存行。
USE HSDZ_MES;
GO
IF OBJECT_ID('yj_translation') IS NULL
CREATE TABLE yj_translation (
    id int IDENTITY(1,1) PRIMARY KEY,
    scope varchar(20) NOT NULL,          -- 'field' | 'panel' | 'ui'
    ref_key nvarchar(200) NOT NULL,      -- field: panel_code + ':' + col_name; panel: panel_code; ui: 前端词条原文
    locale varchar(10) NOT NULL,         -- 'en' | 'ja' | 'ko' | ...
    text nvarchar(500) NOT NULL,         -- 译名
    source varchar(10) NOT NULL DEFAULT 'manual',  -- manual=人工 | mt=机翻缓存
    created_at datetime2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at datetime2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT uq_translation UNIQUE (scope, ref_key, locale)
);
GO
IF OBJECT_ID('yj_locale') IS NULL
CREATE TABLE yj_locale (
    locale varchar(10) PRIMARY KEY,      -- 'en' | 'ja' | ...
    name_zh nvarchar(50) NOT NULL,       -- 中文名(简体中文/英语/日语...)
    name_native nvarchar(50) NOT NULL,   -- 本地名(English/日本語/한국어...)
    enabled bit NOT NULL DEFAULT 1,
    sort int NOT NULL DEFAULT 100
);
GO
-- 语言注册表初始数据(常用集;按需 INSERT 即扩展)
MERGE yj_locale AS t
USING (VALUES
    ('en',     N'英语',     N'English',    1, 10),
    ('ja',     N'日语',     N'日本語',      1, 20),
    ('ko',     N'韩语',     N'한국어',      1, 30),
    ('es',     N'西班牙语', N'Español',    1, 40),
    ('fr',     N'法语',     N'Français',   1, 50),
    ('de',     N'德语',     N'Deutsch',    1, 60),
    ('ru',     N'俄语',     N'Русский',    1, 70),
    ('vi',     N'越南语',   N'Tiếng Việt', 1, 80),
    ('th',     N'泰语',     N'ไทย',        1, 90),
    ('zh-TW',  N'繁体中文', N'繁體中文',    0, 95)
) AS s(locale, name_zh, name_native, enabled, sort)
ON t.locale = s.locale
WHEN NOT MATCHED THEN INSERT (locale, name_zh, name_native, enabled, sort)
VALUES (s.locale, s.name_zh, s.name_native, s.enabled, s.sort);
GO
-- 存量 label_en / panel_name_en 迁入翻译表(source=manual)
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', f.panel_code + ':' + f.col_name, 'en', f.label_en, 'manual'
FROM yj_field f WHERE f.label_en IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key = f.panel_code + ':' + f.col_name AND t.locale='en');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'panel', p.panel_code, 'en', p.panel_name_en, 'manual'
FROM yj_panel p WHERE p.panel_name_en IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key = p.panel_code AND t.locale='en');
GO
-- 校验
SELECT scope, locale, COUNT(*) AS cnt, SUM(CASE WHEN source='manual' THEN 1 ELSE 0 END) AS manual_cnt FROM yj_translation GROUP BY scope, locale;
SELECT COUNT(*) AS enabled_locales FROM yj_locale WHERE enabled = 1;
GO
