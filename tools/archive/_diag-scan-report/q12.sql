SELECT DB_NAME() AS db;
SELECT name FROM sys.tables WHERE name IN ('plang','plang_pc','scjl','wo_process_line','wo_progress','qc_asm_insp_head','yj_doc_status','yj_usage_log') ORDER BY name;
