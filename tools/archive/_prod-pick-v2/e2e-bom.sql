-- 验收用临时数据:给产品 B-70-04 造一张组装BOM表(2 项物料)
-- ⚠ 仅测试账套;末尾 DELETE 可一键清理(见 cleanup)
SET NOCOUNT ON;

DELETE FROM dbo.rd_asm_bom_detail WHERE 单据编号 = N'AB2-TEST-0001';
DELETE FROM dbo.rd_asm_bom_head   WHERE 单据编号 = N'AB2-TEST-0001';

INSERT INTO dbo.rd_asm_bom_head (单据编号, 单据日期, 产品编号, 产品名称, 备注, asp_user1, asp_time1, asp_cancel)
VALUES (N'AB2-TEST-0001', N'2026-10-30', N'B-70-04', N'X烧结PP复合阻垢碳棒/滤芯', N'手机扫码验收用临时数据', N'e2e', SYSDATETIME(), 'N');

INSERT INTO dbo.rd_asm_bom_detail (单据编号, 序号, 物料编号, 物料名, 物料规格, 用量, asp_user1, asp_time1, asp_cancel) VALUES
 (N'AB2-TEST-0001', N'1', N'YJ-ZZ-001',   N'热缩膜',     N'规格A', N'2',   N'e2e', SYSDATETIME(), 'N'),
 (N'AB2-TEST-0001', N'2', N'YJ-KBL-012',  N'PE袋',       N'规格B', N'1.5', N'e2e', SYSDATETIME(), 'N');

SELECT 单据编号, 产品编号, 产品名称 FROM dbo.rd_asm_bom_head WHERE 单据编号 = N'AB2-TEST-0001';
SELECT 序号, 物料编号, 物料名, 用量 FROM dbo.rd_asm_bom_detail WHERE 单据编号 = N'AB2-TEST-0001' ORDER BY 序号;
