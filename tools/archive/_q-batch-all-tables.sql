SET NOCOUNT ON;
SELECT 'bl_finish_in' AS t, CASE WHEN COL_LENGTH('dbo.bl_finish_in',N'批次号') IS NULL THEN 0 ELSE 1 END AS has_batch_no, CASE WHEN COL_LENGTH('dbo.bl_finish_in',N'批号') IS NULL THEN 0 ELSE 1 END AS has_lot
UNION ALL SELECT 'bl_other_in', CASE WHEN COL_LENGTH('dbo.bl_other_in',N'批次号') IS NULL THEN 0 ELSE 1 END, CASE WHEN COL_LENGTH('dbo.bl_other_in',N'批号') IS NULL THEN 0 ELSE 1 END
UNION ALL SELECT 'bl_outsource_in', CASE WHEN COL_LENGTH('dbo.bl_outsource_in',N'批次号') IS NULL THEN 0 ELSE 1 END, CASE WHEN COL_LENGTH('dbo.bl_outsource_in',N'批号') IS NULL THEN 0 ELSE 1 END
UNION ALL SELECT 'bl_sale_out', CASE WHEN COL_LENGTH('dbo.bl_sale_out',N'批次号') IS NULL THEN 0 ELSE 1 END, CASE WHEN COL_LENGTH('dbo.bl_sale_out',N'批号') IS NULL THEN 0 ELSE 1 END
UNION ALL SELECT 'bl_material_out', CASE WHEN COL_LENGTH('dbo.bl_material_out',N'批次号') IS NULL THEN 0 ELSE 1 END, CASE WHEN COL_LENGTH('dbo.bl_material_out',N'批号') IS NULL THEN 0 ELSE 1 END
UNION ALL SELECT 'bl_other_out', CASE WHEN COL_LENGTH('dbo.bl_other_out',N'批次号') IS NULL THEN 0 ELSE 1 END, CASE WHEN COL_LENGTH('dbo.bl_other_out',N'批号') IS NULL THEN 0 ELSE 1 END
UNION ALL SELECT 'bl_outsource_issue', CASE WHEN COL_LENGTH('dbo.bl_outsource_issue',N'批次号') IS NULL THEN 0 ELSE 1 END, CASE WHEN COL_LENGTH('dbo.bl_outsource_issue',N'批号') IS NULL THEN 0 ELSE 1 END;
GO
