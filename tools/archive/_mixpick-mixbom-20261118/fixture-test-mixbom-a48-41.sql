/* 测试账套专用:给 A-48-41 补一张《混料物料清单》,用于验证
   「生成工单领料 → 混料领料单」与「扫码混料」都已改读 bs_mix_bom(2026-11-18)。
   ⚠ 只允许 HSDZ_MES_TEST;正式库直接 THROW。验证完按 README 的清理语句删除。 */
SET NOCOUNT ON;
IF DB_NAME() <> N'HSDZ_MES_TEST'
    THROW 51000, N'测试数据脚本,只允许在 HSDZ_MES_TEST 执行。', 1;

DELETE FROM dbo.bs_mix_bom WHERE 来源单号 = N'TEST-DEMO-A48-41';

INSERT INTO dbo.bs_mix_bom (单据编号,产品编号,产品名称,烧结类型,来源单号,版本号,状态,行序,
       物料种类,物料编号,物料名称,添加比例,单支含量g,设计添加量,行备注,asp_user1,asp_time1,asp_cancel)
VALUES
 (N'MIX-2026-11-0001', N'A-48-41', N'PP复合阻垢炭棒', N'烧结工艺清单', N'TEST-DEMO-A48-41', N'V2026-11-18-01', N'启用', 1,
  N'粉料', N'YJ-KG-C12', N'阻垢料', N'62.00', N'324', N'62.00%', N'', N'agent', GETDATE(), 'N'),
 (N'MIX-2026-11-0001', N'A-48-41', N'PP复合阻垢炭棒', N'烧结工艺清单', N'TEST-DEMO-A48-41', N'V2026-11-18-01', N'启用', 2,
  N'颗粒料', N'YJ-HKK-007', N'竹炭活性炭80-200', N'38.00', N'231', N'231g/支', N'', N'agent', GETDATE(), 'N');

PRINT N'[fixture] A-48-41 混料物料清单已写入:';
SELECT 单据编号, 产品编号, 烧结类型, 行序, 物料编号, 单支含量g FROM dbo.bs_mix_bom WHERE 来源单号 = N'TEST-DEMO-A48-41' ORDER BY 行序;
