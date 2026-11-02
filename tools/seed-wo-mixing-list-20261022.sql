/* seed-wo-mixing-list-20261022.sql
   把服务器 2026-10-21 的真实 8 行混料记录补进本地库，让「混料记录」面板在正式账套里
   也看得到与服务器一致的数据（本地正式库原来是空的：这张表只存在于服务器）。

   数据来源：服务器 36.140.66.163 / HSDZ_MES 的 dbo.wo_mixing_list（8 行，id 1~8），
             与 HSDZ_MES-manual-20261021-184953.bak 双向核对一致。

   ⚠ 只有在表**为空**时才插入（幂等）：服务器上本来就有这 8 行 ⇒ 跑本脚本是空操作，
     绝不会造成重复。本脚本不进增量包，只在本地对账用。
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.wo_mixing_list', N'U') IS NULL
BEGIN
    RAISERROR(N'wo_mixing_list 不存在，请先执行 migrate-wo-mixing-list-20261022.sql。', 16, 1);
    RETURN;
END

IF EXISTS (SELECT 1 FROM dbo.wo_mixing_list) RETURN;   -- 非空：不插，避免重复

SET IDENTITY_INSERT dbo.wo_mixing_list ON;
INSERT INTO dbo.wo_mixing_list
  (id, 单据编号, 工单号, 工单行id, 工单行号, 配方单号, 配方版本, 序号, 物料种类, 物料编号, 物料名称,
   配料比, 单支物料含量, 设计添加量, 计划用量, 实际用量, 标记, asp_user1, asp_time1, asp_user3, asp_cancel)
VALUES
 (1, N'PL2610210002', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
   0, NULL, 0, 1, 0, N'Y', N'Admin', '2026-10-21 08:04:19', N'Admin', 'N'),
 (2, N'PL2610210002', N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'1', NULL, N'YJ-TJHZ-001', N'雅可比CS(80-200)',
   0, 0.086, 0, 1, 0.39, N'Y', N'Admin', '2026-10-21 08:04:19', N'Admin', 'N'),
 (3, N'PL2610210002', N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'1', NULL, N'YJ-TJHZ-001', N'雅可比CS(80-200)',
   0, 0.086, 0, 1, 0.39, N'Y', N'Admin', '2026-10-21 08:04:19', N'Admin', 'N'),
 (4, N'PL2610210002', N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'1', NULL, N'YJ-TJHZ-001', N'雅可比CS(80-200)',
   0, 0.086, 0, 1, 0.39, N'Y', N'Admin', '2026-10-21 08:04:19', N'Admin', 'N'),
 (5, N'PL2610210002', N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'1', NULL, N'YJ-TJHZ-001', N'雅可比CS(80-200)',
   0, 0.086, 0, 1, 0.39, N'Y', N'Admin', '2026-10-21 08:04:19', N'Admin', 'N'),
 (6, N'PL2610210002', N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'1', NULL, N'YJ-TJHZ-001', N'雅可比CS(80-200)',
   0, 0.086, 0, 1, 0.39, N'Y', N'Admin', '2026-10-21 08:04:19', N'Admin', 'N'),
 (7, NULL, N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'1', NULL, N'YJ-TJHZ-001', N'雅可比CS(80-200)',
   0, 0.086, 0, 226.18, 0.39, N'N', N'Admin', '2026-10-21 08:09:57', NULL, 'N'),
 (8, NULL, N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'2', NULL, N'YJ-YKRS-005', N'英克瑞斯椰完活性炭',
   0, 0.021, 0, 55.23, 0.39, N'N', N'Admin', '2026-10-21 08:13:09', NULL, 'N');
SET IDENTITY_INSERT dbo.wo_mixing_list OFF;

SELECT COUNT(*) AS 已补行数, MIN(id) AS 最小id, MAX(id) AS 最大id FROM dbo.wo_mixing_list;
SELECT N'RESULT: SEED-OK' AS 结果;
