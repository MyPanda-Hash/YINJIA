/* QC_RECV 域恢复:从 HSDZ_MES_RESTORE(13:23 快照)把被 migrate-qc-recv-drop 重跑误删的行搬回。
   守卫:目标侧同自然键不存在才插(幂等);IDENTITY_INSERT 保原 id。 */
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, config, config_at, panel_name_en)
SELECT r.panel_code, r.panel_name, r.category, r.mode, r.line_table, r.head_table, r.group_col, r.pk_col, r.code_col, r.prefix, r.date_col, r.page_size, r.detail_key, r.module_group, r.config, r.config_at, r.panel_name_en
  FROM HSDZ_MES_RESTORE.dbo.yj_panel r
 WHERE r.panel_code = 'QC_RECV' AND NOT EXISTS (SELECT 1 FROM yj_panel t WHERE t.panel_code = r.panel_code);

SET IDENTITY_INSERT yj_field ON;
INSERT INTO yj_field (id, panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter)
SELECT r.id, r.panel_code, r.col_name, r.label, r.data_type, r.dict_sql, r.ref_panel, r.ref_field, r.display_field, r.place, r.seq, r.width, r.editable, r.required, r.hidden, r.alias, r.visible, r.label_en, r.col_group, r.ref_filter
  FROM HSDZ_MES_RESTORE.dbo.yj_field r
 WHERE r.panel_code = 'QC_RECV' AND NOT EXISTS (SELECT 1 FROM yj_field t WHERE t.panel_code = r.panel_code AND t.col_name = r.col_name AND t.place = r.place);
SET IDENTITY_INSERT yj_field OFF;

SET IDENTITY_INSERT yj_doc_status ON;
INSERT INTO yj_doc_status (id, panel_code, doc_no, shr, shsj, canceled, cancel_by, cancel_at, pending, pending_by, pending_at, update_at, archived, deleting, delete_req_by, delete_req_at, stopped, stop_by, stop_at, saved, modify_state, modify_req_by, modify_req_at, modify_appr_by, modify_appr_at, archived_at, erp_close_state, approve_node, l2_approver, effective)
SELECT r.id, r.panel_code, r.doc_no, r.shr, r.shsj, r.canceled, r.cancel_by, r.cancel_at, r.pending, r.pending_by, r.pending_at, r.update_at, r.archived, r.deleting, r.delete_req_by, r.delete_req_at, r.stopped, r.stop_by, r.stop_at, r.saved, r.modify_state, r.modify_req_by, r.modify_req_at, r.modify_appr_by, r.modify_appr_at, r.archived_at, r.erp_close_state, r.approve_node, r.l2_approver, r.effective
  FROM HSDZ_MES_RESTORE.dbo.yj_doc_status r
 WHERE r.panel_code = 'QC_RECV' AND NOT EXISTS (SELECT 1 FROM yj_doc_status t WHERE t.panel_code = r.panel_code AND t.doc_no = r.doc_no);
SET IDENTITY_INSERT yj_doc_status OFF;

SET IDENTITY_INSERT form_flow_link ON;
INSERT INTO form_flow_link (id, source_panel_code, source_form_no, source_detail_key, source_line_key, target_panel_code, target_form_no, target_detail_key, target_line_key, inventory_code, source_quantity, linked_quantity, link_status, create_by, create_time, release_time, batch_no, batch_id)
SELECT r.id, r.source_panel_code, r.source_form_no, r.source_detail_key, r.source_line_key, r.target_panel_code, r.target_form_no, r.target_detail_key, r.target_line_key, r.inventory_code, r.source_quantity, r.linked_quantity, r.link_status, r.create_by, r.create_time, r.release_time, r.batch_no, r.batch_id
  FROM HSDZ_MES_RESTORE.dbo.form_flow_link r
 WHERE (r.source_panel_code = 'QC_RECV' OR r.target_panel_code = 'QC_RECV')
   AND NOT EXISTS (SELECT 1 FROM form_flow_link t WHERE ISNULL(t.source_panel_code,'')=ISNULL(r.source_panel_code,'') AND ISNULL(t.source_form_no,'')=ISNULL(r.source_form_no,'')
                     AND ISNULL(t.source_line_key,'')=ISNULL(r.source_line_key,'') AND ISNULL(t.target_panel_code,'')=ISNULL(r.target_panel_code,'')
                     AND ISNULL(t.target_form_no,'')=ISNULL(r.target_form_no,'') AND ISNULL(t.target_line_key,'')=ISNULL(r.target_line_key,''));
SET IDENTITY_INSERT form_flow_link OFF;

SET IDENTITY_INSERT yj_form_approval ON;
INSERT INTO yj_form_approval (id, panel_code, form_no, action, result, node_no, operator, opinion, create_time)
SELECT r.id, r.panel_code, r.form_no, r.action, r.result, r.node_no, r.operator, r.opinion, r.create_time
  FROM HSDZ_MES_RESTORE.dbo.yj_form_approval r
 WHERE r.panel_code = 'QC_RECV' AND NOT EXISTS (SELECT 1 FROM yj_form_approval t WHERE t.panel_code = r.panel_code AND t.form_no = r.form_no AND t.create_time = r.create_time AND t.action = r.action);
SET IDENTITY_INSERT yj_form_approval OFF;

SET IDENTITY_INSERT yj_role_panel ON;
INSERT INTO yj_role_panel (id, role_id, panel_code, can_approve, perms)
SELECT r.id, r.role_id, r.panel_code, r.can_approve, r.perms
  FROM HSDZ_MES_RESTORE.dbo.yj_role_panel r
 WHERE r.panel_code = 'QC_RECV' AND NOT EXISTS (SELECT 1 FROM yj_role_panel t WHERE t.role_id = r.role_id AND t.panel_code = r.panel_code);
SET IDENTITY_INSERT yj_role_panel OFF;

SET IDENTITY_INSERT yj_attachment ON;
INSERT INTO yj_attachment (id, panel_code, doc_no, field_key, file_name, stored_name, file_size, content_type, asp_user1, asp_time1, asp_user2, asp_time2)
SELECT r.id, r.panel_code, r.doc_no, r.field_key, r.file_name, r.stored_name, r.file_size, r.content_type, r.asp_user1, r.asp_time1, r.asp_user2, r.asp_time2
  FROM HSDZ_MES_RESTORE.dbo.yj_attachment r
 WHERE r.panel_code = 'QC_RECV' AND NOT EXISTS (SELECT 1 FROM yj_attachment t WHERE t.panel_code = r.panel_code AND t.doc_no = r.doc_no AND t.field_key = r.field_key AND t.file_name = r.file_name);
SET IDENTITY_INSERT yj_attachment OFF;

SET IDENTITY_INSERT yj_doc_batch ON;
INSERT INTO yj_doc_batch (id, source_panel_code, source_form_no, batch_seq, batch_no, batch_qty, status, target_panel_code, target_form_no, create_by, create_time, release_time, remark)
SELECT r.id, r.source_panel_code, r.source_form_no, r.batch_seq, r.batch_no, r.batch_qty, r.status, r.target_panel_code, r.target_form_no, r.create_by, r.create_time, r.release_time, r.remark
  FROM HSDZ_MES_RESTORE.dbo.yj_doc_batch r
 WHERE (r.source_panel_code = 'QC_RECV' OR r.target_panel_code = 'QC_RECV')
   AND NOT EXISTS (SELECT 1 FROM yj_doc_batch t WHERE t.source_panel_code = r.source_panel_code AND t.source_form_no = r.source_form_no AND t.batch_seq = r.batch_seq);
SET IDENTITY_INSERT yj_doc_batch OFF;
COMMIT;
GO
PRINT '== 恢复后核验 ==';
SELECT (SELECT COUNT(*) FROM yj_panel WHERE panel_code='QC_RECV') AS panel_rows,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_RECV') AS field_rows,
       (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code='QC_RECV') AS status_rows,
       (SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_RECV' OR target_panel_code='QC_RECV') AS link_rows,
       (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code='QC_RECV') AS role_rows,
       (SELECT COUNT(*) FROM yj_doc_batch WHERE source_panel_code='QC_RECV' OR target_panel_code='QC_RECV') AS batch_rows;
GO
