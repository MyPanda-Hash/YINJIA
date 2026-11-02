-- 验收用临时数据(测试账套 HSDZ_MES_TEST 专用,勿在正式库执行):
--   ① 一张组装BOM表(产品 B-70-04,2 项物料)
--   ② 一张生产工单行(GD-E2E-0001 / 行 1,产品 B-70-04,已排产 100)
--
-- 为什么造在测试账套:用户口径「测试库 = 演示/试用/批量造数」,而且本机测试账套 plang 一行都没有,
-- 不在测试账套造数就无法验收"扫工单 → 生单 → 领料 → 提交"这条链。
-- 清理见 e2e-cleanup.sql。
SET NOCOUNT ON;

-- ① 组装BOM表
DELETE FROM dbo.rd_asm_bom_detail WHERE 单据编号 = N'AB2-E2E-0001';
DELETE FROM dbo.rd_asm_bom_head   WHERE 单据编号 = N'AB2-E2E-0001';
INSERT INTO dbo.rd_asm_bom_head (单据编号, 单据日期, 产品编号, 产品名称, 备注, asp_user1, asp_time1, asp_cancel)
VALUES (N'AB2-E2E-0001', N'2026-10-30', N'B-70-04', N'X烧结PP复合阻垢碳棒/滤芯', N'手机扫码验收临时数据', N'e2e', SYSDATETIME(), 'N');
INSERT INTO dbo.rd_asm_bom_detail (单据编号, 序号, 物料编号, 物料名, 物料规格, 用量, asp_user1, asp_time1, asp_cancel) VALUES
 (N'AB2-E2E-0001', N'1', N'YJ-ZZ-001',  N'热缩膜', N'规格A', N'2',   N'e2e', SYSDATETIME(), 'N'),
 (N'AB2-E2E-0001', N'2', N'YJ-KBL-012', N'PE袋',   N'规格B', N'1.5', N'e2e', SYSDATETIME(), 'N');

-- ② 工单行
-- ⚠ plang.comm = 公司代码,NOT NULL(全库唯一值 '0',见 print-formats.js 的 COMPANY.companyCode)。
--    漏掉它会报「不能将值 NULL 插入列 'comm'」—— 2026-10-30 实测踩到。
DELETE FROM dbo.plang WHERE pl_no = N'GD-E2E-0001';
INSERT INTO dbo.plang (comm, pl_no, pl_xc, pl_man, pl_date, dm, mc, gg, jldw, pl_sl, scx,
                       asp_user1, asp_time1, asp_cancel, 工艺路线)
VALUES (N'0', N'GD-E2E-0001', 1, N'admin', SYSDATETIME(), N'B-70-04', N'X烧结PP复合阻垢碳棒/滤芯',
        N'32.5*16*204', N'支', 100, N'一线', N'e2e', SYSDATETIME(), 'N', N'GY-CB-STD');

SELECT N'BOM' k, 单据编号, 产品编号, CAST(NULL AS int) xc FROM dbo.rd_asm_bom_head WHERE 单据编号 = N'AB2-E2E-0001'
UNION ALL
SELECT N'工单', pl_no, dm, pl_xc FROM dbo.plang WHERE pl_no = N'GD-E2E-0001';
