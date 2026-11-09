SET NOCOUNT ON;
SELECT OBJECT_NAME(object_id) tbl, COUNT(*) cols FROM sys.columns WHERE object_id IN (OBJECT_ID('rd_spike_water_detail'),OBJECT_ID('rd_equip_use_detail'),OBJECT_ID('rd_instr_use_detail')) GROUP BY object_id ORDER BY 1;
GO
