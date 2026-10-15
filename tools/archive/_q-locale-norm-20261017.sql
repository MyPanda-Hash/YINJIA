SET NOCOUNT ON;
SELECT DB_NAME() AS db_name;
SELECT N'en-only 译名 key 数 / 全部 key 数' AS q,
       (SELECT COUNT(*) FROM (SELECT ref_key FROM yj_translation WHERE scope=N'field' GROUP BY ref_key
          HAVING COUNT(*)=1 AND MAX(locale)='en') z) AS en_only_keys,
       (SELECT COUNT(*) FROM (SELECT ref_key FROM yj_translation WHERE scope=N'field' GROUP BY ref_key) z) AS all_keys,
       (SELECT COUNT(*) FROM (SELECT ref_key FROM yj_translation WHERE scope=N'field' GROUP BY ref_key
          HAVING COUNT(*)>=10) z) AS keys_10plus;
