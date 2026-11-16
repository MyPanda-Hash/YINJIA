SELECT t.name AS tbl, COUNT(*) AS cols FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name IN (N'qc_sample_reg', N'qc_insp_commission_head', N'qc_insp_commission_detail') GROUP BY t.name;
