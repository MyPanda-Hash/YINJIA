SET NOCOUNT ON;
SELECT t.name AS tbl,
  ISNULL((SELECT STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal)
          FROM HSDZ_MES.sys.indexes i JOIN HSDZ_MES.sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
          JOIN HSDZ_MES.sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
          WHERE i.object_id=t.object_id AND i.is_primary_key=1), '(无主键)') AS pk_cols,
  (SELECT COUNT(*) FROM HSDZ_MES.sys.columns c WHERE c.object_id=t.object_id) AS colcnt
FROM HSDZ_MES.sys.tables t
WHERE t.name IN ('inv_cost_ledger','yj_form_approval','s_allno','scjl','wo_process_line','wo_transfer_log','qc_tc_in','yj_attachment','rd_approval','rd_dev_task','rd_plan','rd_prod_info_head','rd_progress','rd_progress_detail','rd_spec_doc_detail','rd_spec_doc_head','bs_qc_item','bs_qc_plan','yj_message','yj_usage_log')
ORDER BY t.name;
