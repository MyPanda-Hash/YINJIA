/* 删前取证:两条任务是否已落地(落地才可弃快照) */
SELECT 'PC0000 残留' AS 项,
       (SELECT COUNT(*) FROM kucun WHERE RTRIM(ISNULL(lot_no,'')) = 'PC0000') AS kucun_,
       (SELECT COUNT(*) FROM inh   WHERE RTRIM(ISNULL(批号,''))  = 'PC0000') AS inh_,
       (SELECT COUNT(*) FROM outh  WHERE RTRIM(ISNULL(批号,''))  = 'PC0000') AS outh_;
GO
SELECT '当前业务行数' AS 项,
       (SELECT COUNT(*) FROM kucun) AS kucun,
       (SELECT COUNT(*) FROM inh) AS inh,
       (SELECT COUNT(*) FROM outh) AS outh,
       (SELECT COUNT(*) FROM qc_proc_insp_head) AS proc_head,
       (SELECT COUNT(*) FROM qc_first_insp_head) AS fst_head,
       (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'QC_PROC_INSP') AS proc_status,
       (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'QC_FIRST_INSP') AS fst_status;
GO
/* 快照里的行是否仍"找不到对应业务行"(= 被删的确实是空壳/占位行) */
SELECT '快照 pc0000 行在现表中能否对上' AS 项,
       (SELECT COUNT(*) FROM _bak_pc0000_20261018_kucun b
         WHERE EXISTS (SELECT 1 FROM kucun k WHERE k.id = b.id)) AS kucun_id命中,
       (SELECT COUNT(*) FROM _bak_pc0000_20261018_kucun) AS kucun快照行;
GO
SELECT '快照草稿单是否确实已不在' AS 项,
       (SELECT COUNT(*) FROM _bak_qcdraft_proc_head_20261021 b
         WHERE EXISTS (SELECT 1 FROM qc_proc_insp_head h WHERE h.id = b.id)) AS proc_仍在,
       (SELECT COUNT(*) FROM _bak_qcdraft_fst_head_20261021 b
         WHERE EXISTS (SELECT 1 FROM qc_first_insp_head h WHERE h.id = b.id)) AS fst_仍在;
GO
