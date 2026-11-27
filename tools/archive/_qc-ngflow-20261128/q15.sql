SELECT DB_NAME() AS db, COL_LENGTH('dbo.qc_insp_detail', N'仓位编码') AS binCode, COL_LENGTH('dbo.qc_insp_detail', N'仓位') AS binRaw;
