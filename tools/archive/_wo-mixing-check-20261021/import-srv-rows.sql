SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF (SELECT COUNT(*) FROM HSDZ_MES_SRV1021.dbo.wo_mixing_list) <> 8
    THROW 51000, N'服务器快照行数不是 8,停止导入', 1;
DELETE FROM dbo.wo_mixing_list;
SET IDENTITY_INSERT dbo.wo_mixing_list ON;
INSERT INTO dbo.wo_mixing_list
 (id, 单据编号, 工单号, 工单行id, 工单行号, 配方单号, 配方版本, 序号, 物料种类, 物料编号, 物料名称,
  配料比, 单支物料含量, 设计添加量, 计划用量, 实际用量, 标记,
  asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel, asp_user4, asp_time4)
SELECT id, 单据编号, 工单号, 工单行id, 工单行号, 配方单号, 配方版本, 序号, 物料种类, 物料编号, 物料名称,
  配料比, 单支物料含量, 设计添加量, 计划用量, 实际用量, 标记,
  asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel, asp_user4, asp_time4
  FROM HSDZ_MES_SRV1021.dbo.wo_mixing_list;
SET IDENTITY_INSERT dbo.wo_mixing_list OFF;
COMMIT;
SELECT COUNT(*) AS rows_now, MIN(id) AS min_id, MAX(id) AS max_id FROM dbo.wo_mixing_list;
