SET NOCOUNT ON;
SELECT p.panel_code, p.panel_name, p.panel_name_en, p.mode, p.category, p.line_table, p.module_group,
       p.date_col, p.page_size,
       (SELECT COUNT(*) FROM dbo.yj_field f WHERE f.panel_code = p.panel_code) AS 字段数,
       (SELECT COUNT(*) FROM dbo.yj_role_panel r WHERE r.panel_code = p.panel_code) AS 授权角色数
  FROM dbo.yj_panel p WHERE p.panel_code = N'PROD_PICK_LIST';
SELECT COUNT(*) AS 视图总行, COUNT(DISTINCT 单据编号) AS 单数, MIN(单据日期) AS 最早, MAX(单据日期) AS 最晚
  FROM dbo.v_prod_pick_list;
SELECT TOP 3 t.id AS __id, t.[单据编号] AS [单据编号], t.[单据日期] AS [单据日期], t.[物料名称] AS [物料名称],
       t.[仓库名称] AS [仓库名称], t.[批号] AS [批号], t.[数量] AS [数量], t.[成本金额] AS [成本金额],
       t.[创建人] AS x FROM (SELECT *, asp_user1 AS [创建人] FROM dbo.v_prod_pick_list) t
 ORDER BY t.[单据日期] DESC, t.id DESC;
SELECT r.role_name, rp.perms, rp.can_approve FROM dbo.yj_role_panel rp
  LEFT JOIN dbo.yj_role r ON r.id = rp.role_id WHERE rp.panel_code = N'PROD_PICK_LIST' ORDER BY r.id;
SELECT scope, ref_key, locale, text FROM dbo.yj_translation WHERE (scope = 'panel' AND ref_key = N'生产领料')
    OR (scope = 'field' AND ref_key IN (N'单据编号', N'批号', N'成本金额')) ORDER BY scope, ref_key, locale;
