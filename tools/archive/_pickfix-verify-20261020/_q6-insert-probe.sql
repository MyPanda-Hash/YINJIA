SET NOCOUNT ON;
SET XACT_ABORT OFF;
IF OBJECT_ID('tempdb..#r') IS NOT NULL DROP TABLE #r;
CREATE TABLE #r (步骤 int, 场景 nvarchar(300), 结论 nvarchar(400));
BEGIN TRAN;
GO
BEGIN TRY
  INSERT INTO dbo.outh (src, rid, 单据编号, 物料编码, 批号, 数量)
  VALUES (6, 990001, N'PROBE-PICK', N'PROBE-MAT-A', N'PROBE-B1', 1);
  INSERT INTO #r VALUES (1, N'第 1 件物料(物料A/批号B1)', N'[PASS] 插入成功');
END TRY BEGIN CATCH INSERT INTO #r VALUES (1, N'第 1 件物料(物料A/批号B1)', N'[FAIL] ' + ERROR_MESSAGE()); END CATCH;
GO
BEGIN TRY
  INSERT INTO dbo.outh (src, rid, 单据编号, 物料编码, 批号, 数量)
  VALUES (6, 990001, N'PROBE-PICK', N'PROBE-MAT-B', N'PROBE-B1', 1);
  INSERT INTO #r VALUES (2, N'同一工单第 2 件物料(物料B/批号B1) = 用户报障场景', N'[PASS] 插入成功,不再撞键');
END TRY BEGIN CATCH INSERT INTO #r VALUES (2, N'同一工单第 2 件物料(物料B/批号B1) = 用户报障场景', N'[BLOCKED] ' + ERROR_MESSAGE()); END CATCH;
GO
BEGIN TRY
  INSERT INTO dbo.outh (src, rid, 单据编号, 物料编码, 批号, 数量)
  VALUES (6, 990001, N'PROBE-PICK', N'PROBE-MAT-A', N'PROBE-B1', 1);
  INSERT INTO #r VALUES (3, N'同物料同批号重复写入', N'[WARN] 意外通过 —— 防重复扣账保险失效');
END TRY BEGIN CATCH INSERT INTO #r VALUES (3, N'同物料同批号重复写入', N'[PASS] 仍被拦下(保险还在): ' + ERROR_MESSAGE()); END CATCH;
GO
BEGIN TRY
  INSERT INTO dbo.outh (src, rid, 单据编号, 物料编码, 批号, 数量)
  VALUES (6, 990001, N'PROBE-PICK', N'PROBE-MAT-C', N'PROBE-B2', 1);
  INSERT INTO dbo.outh (src, rid, 单据编号, 物料编码, 批号, 数量)
  VALUES (6, 990001, N'PROBE-PICK', N'PROBE-MAT-C', N'PROBE-B3', 1);
  INSERT INTO #r VALUES (4, N'同物料两个批号(B2/B3)各一行', N'[PASS] 两行并存(允许一批一码)');
END TRY BEGIN CATCH INSERT INTO #r VALUES (4, N'同物料两个批号(B2/B3)各一行', N'[BLOCKED] ' + ERROR_MESSAGE()); END CATCH;
GO
BEGIN TRY
  INSERT INTO dbo.outh (src, rid, 单据编号, 物料编码, 批号, 数量)
  VALUES (6, 990001, N'PROBE-PICK', NULL, N'PROBE-B9', 1);
  INSERT INTO dbo.outh (src, rid, 单据编号, 物料编码, 批号, 数量)
  VALUES (6, 990001, N'PROBE-PICK', NULL, N'PROBE-B9', 1);
  INSERT INTO #r VALUES (5, N'物料编码留空(NULL)两行', N'[WARN] 通过 —— 空物料不参与身份,仍可能撞键');
END TRY BEGIN CATCH INSERT INTO #r VALUES (5, N'物料编码留空(NULL)两行', N'[BLOCKED] 空物料仍撞键: ' + ERROR_MESSAGE()); END CATCH;
GO
BEGIN TRY
  INSERT INTO dbo.outh (src, rid, 单据编号, 物料编码, 批号, 数量)
  VALUES (6, 990001, N'PROBE-PICK', N'', N'PROBE-C1', 1);
  INSERT INTO dbo.outh (src, rid, 单据编号, 物料编码, 批号, 数量)
  VALUES (6, 990001, N'PROBE-PICK', N'', N'PROBE-C1', 1);
  INSERT INTO #r VALUES (6, N'物料编码空串两行', N'[WARN] 通过 —— 存在撞键风险');
END TRY BEGIN CATCH INSERT INTO #r VALUES (6, N'物料编码空串两行', N'[BLOCKED] 空串仍撞键: ' + ERROR_MESSAGE()); END CATCH;
GO
SELECT 步骤, 场景, 结论 FROM #r ORDER BY 步骤;
GO
SELECT id, src, rid, 物料编码, 批号, 数量 FROM dbo.outh WHERE 单据编号 = N'PROBE-PICK' ORDER BY id;
GO
IF @@TRANCOUNT > 0 ROLLBACK;
SELECT COUNT(*) AS 回滚后残留探针行 FROM dbo.outh WHERE 单据编号 = N'PROBE-PICK';
