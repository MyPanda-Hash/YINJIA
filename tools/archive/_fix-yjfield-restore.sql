/* yj_field 整表还原:当前被 panda 系列重放重灌(隐藏位翻开/后链字段被冲),快照(13:23,本地全部
   供应链工作完成后)与回滚后的代码配套。还原后需重放三个后快照合法字段迁移:
   migrate-pin-wh-unify(删 PURCHASE_IN 旧仓库行)→ migrate-wh-field-rename(仓库名称→仓库)
   → migrate-po-push-erp(PU_ORDER 转ERP 4 行)——由外部按序执行。 */
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;
DELETE FROM yj_field;
SET IDENTITY_INSERT yj_field ON;
INSERT INTO yj_field (id, panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter)
SELECT r.id, r.panel_code, r.col_name, r.label, r.data_type, r.dict_sql, r.ref_panel, r.ref_field, r.display_field, r.place, r.seq, r.width, r.editable, r.required, r.hidden, r.alias, r.visible, r.label_en, r.col_group, r.ref_filter
  FROM HSDZ_MES_RESTORE.dbo.yj_field r;
SET IDENTITY_INSERT yj_field OFF;
COMMIT;
SELECT COUNT(*) AS 还原后行数 FROM yj_field;
GO
