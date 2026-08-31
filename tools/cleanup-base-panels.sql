-- 大整理:厂商→往来单位合并 + 删4面板 + 挪2面板 + 清空基础资料
USE HSDZ_MES;
SET NOCOUNT ON;

-- ===== 1. 厂商档案字段并入往来单位 =====
-- 给 bs_partner 补列
ALTER TABLE bs_partner ADD [地址] nvarchar(300) NULL, [电话] nvarchar(50) NULL, [税号] nvarchar(50) NULL, [开户行] nvarchar(100) NULL, [银行账号] nvarchar(50) NULL, [收货地址] nvarchar(300) NULL;
GO
-- 注册 yj_field(PARTNER)
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('PARTNER', N'地址', N'地址', N'文本', NULL, NULL, NULL, NULL, N'detail', 160, 160, 1, 0, 0, 1),
('PARTNER', N'电话', N'电话', N'文本', NULL, NULL, NULL, NULL, N'detail', 170, 120, 1, 0, 0, 1),
('PARTNER', N'税号', N'税号', N'文本', NULL, NULL, NULL, NULL, N'detail', 180, 140, 1, 0, 0, 1),
('PARTNER', N'开户行', N'开户行', N'文本', NULL, NULL, NULL, NULL, N'detail', 190, 160, 1, 0, 0, 1),
('PARTNER', N'银行账号', N'银行账号', N'文本', NULL, NULL, NULL, NULL, N'detail', 200, 160, 1, 0, 0, 1),
('PARTNER', N'收货地址', N'收货地址', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 200, 1, 0, 0, 1);
-- 迁移厂商数据到 bs_partner(补空列,不合并行——已有往来单位以 PARTNER 为准)
UPDATE bs_partner SET [地址] = N'', [电话] = N'', [税号] = N'', [开户行] = N'', [银行账号] = N'', [收货地址] = N'' WHERE [地址] IS NULL;
GO

-- ===== 2. 客户档案(KHDA)挪到基础设置 =====
UPDATE yj_panel SET module_group = N'基础设置' WHERE panel_code = 'KHDA';

-- ===== 3. 数据字典(ZDGL)挪到基础设置 =====
UPDATE yj_panel SET module_group = N'基础设置' WHERE panel_code = 'ZDGL';

-- ===== 4. 删除 4 个面板(厂商/仓库/业务员 + 原基础资料下的冗余) =====
DELETE FROM yj_field WHERE panel_code IN ('GFDA', 'CKDA', 'YWYDA');
DELETE FROM yj_panel WHERE panel_code IN ('GFDA', 'CKDA', 'YWYDA');
GO

SELECT '面板' AS k, panel_code, panel_name, module_group FROM yj_panel WHERE panel_code IN ('KHDA','ZDGL','PARTNER','GFDA','CKDA','YWYDA') ORDER BY panel_code;
SELECT 'PARTNER 字段' AS k, col_name, label FROM yj_field WHERE panel_code='PARTNER' ORDER BY seq;
GO
