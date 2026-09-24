SET NOCOUNT ON;
/* 合并期脚本重放把 PURCHASE_IN 的「仓库」字段行写成 query,header,detail——头表 bd_purchase_in 已无 [仓库] 列,
   头级/查询级引用直接 500。该字段正名后的合法落点只有明细(bl_purchase_in.仓库)。修回 place=detail。 */
UPDATE yj_field SET place = 'detail'
 WHERE panel_code = 'PURCHASE_IN' AND col_name = N'仓库' AND place LIKE '%header%';
SELECT id, col_name, place, hidden, visible FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓库';
GO
