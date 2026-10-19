SET NOCOUNT ON;
IF NOT EXISTS (SELECT 1 FROM dbo.outh WHERE src = 6 AND rid = 1975 AND 物料编码 = N'PROBE-MAT-2')
  INSERT INTO dbo.outh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 仓库编码, 仓库名称, 批号, 数量, asp_user1, asp_time1, asp_cancel)
  VALUES (6, 1975, N'PROBE-MULTIMAT', N'材料出库单', CAST('2026-09-02' AS date), N'PROBE-MAT-2', N'探针物料2', N'CK00006', N'华北工控仓', N'PROBE-LOT', 2, N'probe', SYSDATETIME(), 'N');
SELECT rid, 物料编码, 批号, asp_cancel AS 作废 FROM dbo.outh WHERE src = 6 AND rid = 1975 ORDER BY id;
