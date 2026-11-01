/* _prod-pick-mig-20261025/verify.sql — 补链后终态验证(只读) */
SET NOCOUNT ON;
SELECT N'schema-log' AS tag, script_name, applied_at
  FROM dbo.yj_schema_log WHERE script_name LIKE N'%prod_pick%';
SELECT N'counts' AS tag,
       (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = N'PROD_PICK_LIST') AS 字段数,
       (SELECT COUNT(*) FROM dbo.yj_role_panel WHERE panel_code = N'PROD_PICK_LIST') AS 授权角色数,
       (SELECT COUNT(*) FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'生产领料') AS 面板译名数,
       (SELECT COUNT(*) FROM dbo.yj_translation t
         WHERE t.scope = 'field' AND t.locale = 'en'
           AND t.ref_key IN (SELECT label FROM dbo.yj_field WHERE panel_code = N'PROD_PICK_LIST')) AS 字段en译名覆盖,
       (SELECT COUNT(*) FROM dbo.v_prod_pick_list) AS 视图行数;
