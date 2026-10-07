SET NOCOUNT ON;
SELECT N'1-PANEL-TABLES' AS seg, panel_code, panel_name, head_table, line_table, prefix
FROM yj_panel WHERE panel_code IN ('QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY','QC_TC_IN')
ORDER BY panel_code;
SELECT N'2-SIGN-COLUMNS' AS seg, t.name AS tbl,
       MAX(CASE WHEN c.name = N'编制人' THEN 1 ELSE 0 END) AS has_编制人,
       MAX(CASE WHEN c.name = N'填写人' THEN 1 ELSE 0 END) AS has_填写人,
       MAX(CASE WHEN c.name = N'责任人' THEN 1 ELSE 0 END) AS has_责任人,
       MAX(CASE WHEN c.name = N'检测人' THEN 1 ELSE 0 END) AS has_检测人,
       MAX(CASE WHEN c.name = N'审核人' THEN 1 ELSE 0 END) AS has_审核人,
       MAX(CASE WHEN c.name = N'审核时间' THEN 1 ELSE 0 END) AS has_审核时间,
       MAX(CASE WHEN c.name = N'审批人' THEN 1 ELSE 0 END) AS has_审批人,
       MAX(CASE WHEN c.name = N'审批时间' THEN 1 ELSE 0 END) AS has_审批时间,
       MAX(CASE WHEN c.name = N'填写部门' THEN 1 ELSE 0 END) AS has_填写部门
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name IN ('qc_bhg','qc_bhc','qc_bhz','qc_jjf','qc_scp','qc_lyb','qc_scy','qc_tc_in')
GROUP BY t.name ORDER BY t.name;
SELECT N'3-FIELDS' AS seg, panel_code, col_name, label, CAST(editable AS varchar(5)) AS editable, place
FROM yj_field
WHERE panel_code IN ('QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY')
  AND col_name IN (N'填写人',N'责任人',N'检测人',N'编制人',N'审核人',N'审核时间',N'审批人',N'审批时间',N'填写部门')
ORDER BY panel_code, seq;
SELECT N'4-PERM' AS seg, r.role_name, rp.panel_code, rp.perms, rp.can_approve
FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id
WHERE rp.panel_code IN ('QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY')
ORDER BY rp.panel_code, r.id;
SELECT N'5-ROWS' AS seg, N'QC_BHG' AS p, COUNT(*) AS n FROM qc_bhg
UNION ALL SELECT N'5-ROWS', N'QC_BHC', COUNT(*) FROM qc_bhc
UNION ALL SELECT N'5-ROWS', N'QC_BHZ', COUNT(*) FROM qc_bhz
UNION ALL SELECT N'5-ROWS', N'QC_JJF', COUNT(*) FROM qc_jjf
UNION ALL SELECT N'5-ROWS', N'QC_SCP', COUNT(*) FROM qc_scp
UNION ALL SELECT N'5-ROWS', N'QC_LYB', COUNT(*) FROM qc_lyb
UNION ALL SELECT N'5-ROWS', N'QC_SCY', COUNT(*) FROM qc_scy;
