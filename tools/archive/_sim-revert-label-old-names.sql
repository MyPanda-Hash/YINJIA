-- 一次性:把 TEST 库的 10 个字段**改回旧名**,模拟「已发布旧版状态」,
-- 用来实测 migrate-material-out-label-cleanup.sql 的「新旧两列并存」兜底分支
-- (= 有人把生成器按清洁名重跑、生成器先插了清洁名列/字段行,清理脚本后跑)。
-- 仅用于 HSDZ_MES_TEST 演练,不是迁移链的一部分。
SET NOCOUNT ON;
GO
DECLARE @rev TABLE (old_col nvarchar(200), new_col nvarchar(200));
INSERT INTO @rev VALUES
  (N'单据状态_bill_status', N'金蝶单据状态'), (N'审核时间_audit_time', N'金蝶审核时间'),
  (N'审核人_auditor_name', N'金蝶审核人'), (N'dept_id', N'部门id'), (N'creator_id', N'创建人id'),
  (N'modifier_id', N'修改人id'), (N'bill_type_id', N'单据类型id'), (N'auditor_id', N'审核人id'),
  (N'emp_id', N'经手人id'), (N'pick_use_id', N'领料用途id');
DECLARE @n nvarchar(200), @o nvarchar(200), @sql nvarchar(500);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT new_col, old_col FROM @rev;
OPEN cur; FETCH NEXT FROM cur INTO @n, @o;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH('dbo.bd_material_out', @n) IS NOT NULL AND COL_LENGTH('dbo.bd_material_out', @o) IS NULL
  BEGIN
    SET @sql = N'EXEC sp_rename N''dbo.bd_material_out.' + @n + N''', N''' + @o + N''', N''COLUMN'';';
    EXEC sp_executesql @sql;
  END
  FETCH NEXT FROM cur INTO @n, @o;
END
CLOSE cur; DEALLOCATE cur;
UPDATE f SET f.col_name = r.old_col, f.label = r.old_col
FROM yj_field f JOIN @rev r ON f.col_name = r.new_col
WHERE f.panel_code = 'MATERIAL_OUT';
SELECT '回退后 旧名行数' AS k, COUNT(*) AS n FROM yj_field WHERE panel_code='MATERIAL_OUT'
  AND col_name IN (N'单据状态_bill_status',N'审核时间_audit_time',N'审核人_auditor_name',N'dept_id',N'creator_id',N'modifier_id',N'bill_type_id',N'auditor_id',N'emp_id',N'pick_use_id');
GO
