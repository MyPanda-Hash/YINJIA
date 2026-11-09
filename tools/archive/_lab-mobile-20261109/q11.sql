SET NOCOUNT ON;
SELECT t.name tbl, COUNT(*) cols FROM sys.columns t WHERE t.object_id IN (OBJECT_ID('rd_spike_water_head'),OBJECT_ID('rd_equip_use_head'),OBJECT_ID('rd_instr_use_head')) GROUP BY t.name ORDER BY t.name;
GO
