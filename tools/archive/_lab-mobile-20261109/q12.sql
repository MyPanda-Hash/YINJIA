SET NOCOUNT ON;
SELECT OBJECT_NAME(object_id) tbl, COUNT(*) cols FROM sys.columns WHERE object_id IN (OBJECT_ID('rd_spike_water_head'),OBJECT_ID('rd_equip_use_head'),OBJECT_ID('rd_instr_use_head')) GROUP BY object_id ORDER BY 1;
GO
