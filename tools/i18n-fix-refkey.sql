-- 修正:翻译键统一为"中文原文"(字段标签/面板名),跨面板共享译名,与前端 biz 词典同构
-- ⚠ 幂等修正(2026-09-22 服务器实测踩到):同一 label 在 yj_field 多面板可带**不同 label_en**
--   (如 供应商编码 在不同面板有不同英文),SELECT DISTINCT 挡不住「同 (scope,ref_key,locale)
--   不同 text」的重复——撞 uq_translation 唯一键后 INSERT 整批失败,而 DELETE 已执行完,
--   翻译表被清空。改用 ROW_NUMBER 只取每个键的第一个译名。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
DELETE FROM yj_translation;
GO
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', label, 'en', label_en, 'manual'
FROM (
  SELECT f.label, f.label_en,
         ROW_NUMBER() OVER (PARTITION BY f.label ORDER BY f.label_en) AS rn
    FROM yj_field f
   WHERE f.label_en IS NOT NULL
     AND f.label_en <> N''
) t WHERE rn = 1;
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'panel', panel_name, 'en', panel_name_en, 'manual'
FROM (
  SELECT p.panel_name, p.panel_name_en,
         ROW_NUMBER() OVER (PARTITION BY p.panel_name ORDER BY p.panel_name_en) AS rn
    FROM yj_panel p
   WHERE p.panel_name_en IS NOT NULL
     AND p.panel_name_en <> N''
) t WHERE rn = 1;
GO
SELECT scope, locale, COUNT(*) AS cnt FROM yj_translation GROUP BY scope, locale;
GO
