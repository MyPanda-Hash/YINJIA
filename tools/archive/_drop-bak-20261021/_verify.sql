SELECT COUNT(*) AS 表总数 FROM sys.tables;
GO
SELECT '业务行数(应与删前一致:1480/2529/3318/434/425)' AS 项,
       (SELECT COUNT(*) FROM kucun) AS kucun,
       (SELECT COUNT(*) FROM inh) AS inh,
       (SELECT COUNT(*) FROM outh) AS outh,
       (SELECT COUNT(*) FROM qc_proc_insp_head) AS proc_head,
       (SELECT COUNT(*) FROM qc_first_insp_head) AS fst_head;
GO
SELECT name FROM sys.tables WHERE name LIKE '\_bak%' ESCAPE '\' ORDER BY name;
GO
