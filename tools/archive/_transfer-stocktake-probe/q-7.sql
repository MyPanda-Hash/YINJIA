SET NOCOUNT ON;
SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.v_other_out_detail')) AS d;
PRINT '=== stats ===';
SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.v_other_out_stats')) AS d;
