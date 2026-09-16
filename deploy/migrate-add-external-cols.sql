-- =====================================================================
-- 金蝶云·星辰销售订单同步:bd_so_order 增加外部数据锚点列(幂等,可重复执行)
-- 用途:外部数据ID 存星辰单据 id(幂等去重键),外部单据号 存星辰 bill_no 备查
-- 执行:SSMS 连接 HSDZ_MES 后直接运行;重复执行无副作用
-- 注意:仅加物理列,不注册 yj_field(面板不展示);若日后要在销售订单面板
--       显示这两列,必须按 AGENTS.md 同步补 yj_field + yj_translation 多语言
-- =====================================================================

IF COL_LENGTH('dbo.bd_so_order', '外部数据ID') IS NULL
    ALTER TABLE dbo.bd_so_order ADD [外部数据ID] nvarchar(64) NULL;

IF COL_LENGTH('dbo.bd_so_order', '外部单据号') IS NULL
    ALTER TABLE dbo.bd_so_order ADD [外部单据号] nvarchar(200) NULL;

IF COL_LENGTH('dbo.bd_so_order', '外部指纹') IS NULL
    ALTER TABLE dbo.bd_so_order ADD [外部指纹] nvarchar(500) NULL; -- 列表级字段指纹,跳过无变化单据省详情调用

IF COL_LENGTH('dbo.bd_pu_order', '外部数据ID') IS NULL
    ALTER TABLE dbo.bd_pu_order ADD [外部数据ID] nvarchar(64) NULL;

IF COL_LENGTH('dbo.bd_pu_order', '外部单据号') IS NULL
    ALTER TABLE dbo.bd_pu_order ADD [外部单据号] nvarchar(200) NULL;

IF COL_LENGTH('dbo.bd_pu_order', '外部指纹') IS NULL
    ALTER TABLE dbo.bd_pu_order ADD [外部指纹] nvarchar(500) NULL;
GO

-- 幂等唯一索引(过滤 NULL,不影响存量手录单据)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bd_so_order_ext_id')
    CREATE UNIQUE INDEX ux_bd_so_order_ext_id
        ON dbo.bd_so_order ([外部数据ID])
        WHERE [外部数据ID] IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_bd_pu_order_ext_id')
    CREATE UNIQUE INDEX ux_bd_pu_order_ext_id
        ON dbo.bd_pu_order ([外部数据ID])
        WHERE [外部数据ID] IS NOT NULL;
GO

-- 自检(需在独立批次执行:同批次内新加列不可被引用)
SELECT N'bd_so_order 外部数据ID' AS 项, CASE WHEN COL_LENGTH('dbo.bd_so_order', N'外部数据ID') IS NOT NULL THEN 1 ELSE 0 END AS 已就绪
UNION ALL
SELECT N'bd_so_order 外部单据号', CASE WHEN COL_LENGTH('dbo.bd_so_order', N'外部单据号') IS NOT NULL THEN 1 ELSE 0 END
UNION ALL
SELECT N'bd_so_order 外部指纹', CASE WHEN COL_LENGTH('dbo.bd_so_order', N'外部指纹') IS NOT NULL THEN 1 ELSE 0 END
UNION ALL
SELECT N'bd_pu_order 外部数据ID', CASE WHEN COL_LENGTH('dbo.bd_pu_order', N'外部数据ID') IS NOT NULL THEN 1 ELSE 0 END
UNION ALL
SELECT N'bd_pu_order 外部单据号', CASE WHEN COL_LENGTH('dbo.bd_pu_order', N'外部单据号') IS NOT NULL THEN 1 ELSE 0 END
UNION ALL
SELECT N'bd_pu_order 外部指纹', CASE WHEN COL_LENGTH('dbo.bd_pu_order', N'外部指纹') IS NOT NULL THEN 1 ELSE 0 END
UNION ALL
SELECT N'唯一索引 ux_bd_so_order_ext_id', CASE WHEN INDEXPROPERTY(OBJECT_ID('dbo.bd_so_order'), 'ux_bd_so_order_ext_id', 'IndexID') IS NOT NULL THEN 1 ELSE 0 END
UNION ALL
SELECT N'唯一索引 ux_bd_pu_order_ext_id', CASE WHEN INDEXPROPERTY(OBJECT_ID('dbo.bd_pu_order'), 'ux_bd_pu_order_ext_id', 'IndexID') IS NOT NULL THEN 1 ELSE 0 END;
