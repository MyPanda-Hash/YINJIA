SET NOCOUNT ON;
SELECT 'v_finish_in_detail 是否含 asp_cancel' AS k, COL_LENGTH('dbo.v_finish_in_detail','asp_cancel') AS col, COL_LENGTH('dbo.v_finish_in_stats','asp_cancel') AS col2;
GO
SELECT LEFT(m.definition, 600) AS def FROM sys.sql_modules m WHERE m.object_id = OBJECT_ID('dbo.v_finish_in_detail');
