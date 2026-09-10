-- migrate-phase1-foundation.sql — Phase 1 基础层:二维码批号注册表 + 存货检验标志
SET NOCOUNT ON;
GO
-- 批号注册表(全系统统一批号生成,幂等,yyyymmdd+3位流水)
IF OBJECT_ID('qr_batch_registry') IS NULL
CREATE TABLE qr_batch_registry (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    batch_no NVARCHAR(50) NOT NULL UNIQUE,
    biz_date DATE NOT NULL,
    seq INT NOT NULL,
    item_code NVARCHAR(50),
    source_type NVARCHAR(20),
    source_no NVARCHAR(100),
    created_by NVARCHAR(50),
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_qr_batch_date')
    CREATE INDEX ix_qr_batch_date ON qr_batch_registry (biz_date, seq);
GO
-- 存货检验标志(Phase 2 品检分流用,一并加上)
IF COL_LENGTH('bs_inv', '是否检验') IS NULL
    ALTER TABLE bs_inv ADD [是否检验] BIT DEFAULT 0;
GO
IF COL_LENGTH('bs_inv', '检验方式') IS NULL
    ALTER TABLE bs_inv ADD [检验方式] NVARCHAR(10) DEFAULT N'全检';
GO
-- 隔离仓/不良品仓(Phase 4 品质层用,一并注册)
IF NOT EXISTS (SELECT 1 FROM bs_wh WHERE [仓库编码] = N'CK06')
    INSERT INTO bs_wh ([仓库编码],[仓库名称],[仓库地址],[负责人],[停用],[允许零库存出库],[备注],[状态],[asp_user1],[asp_time1],[asp_cancel])
    VALUES (N'CK06', N'隔离仓', N'', NULL, 0, 0, N'问题品先入隔离仓再判断', N'启用', N'migration', GETDATE(), 'N');
GO
IF NOT EXISTS (SELECT 1 FROM bs_wh WHERE [仓库编码] = N'CK07')
    INSERT INTO bs_wh ([仓库编码],[仓库名称],[仓库地址],[负责人],[停用],[允许零库存出库],[备注],[状态],[asp_user1],[asp_time1],[asp_cancel])
    VALUES (N'CK07', N'不良品仓', N'', NULL, 0, 0, N'报废/不良品最终仓', N'启用', N'migration', GETDATE(), 'N');
GO
PRINT N'Phase 1 基础层迁移完成(批号注册表+检验标志+隔离仓/不良品仓)';
GO
