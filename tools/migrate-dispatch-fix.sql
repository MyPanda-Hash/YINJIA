/* 工序派工单:用中文列名重建 bl_dispatch(与 bd_dispatch/v_dispatch_detail 对齐) */
USE HSDZ_MES;
SET NOCOUNT ON;
GO
CREATE TABLE bl_dispatch (
    id int IDENTITY(1,1) PRIMARY KEY,
    单据编号 nvarchar(60) NULL,
    工序编码 nvarchar(60) NULL,
    工序名称 nvarchar(200) NULL,
    工作中心 nvarchar(60) NULL,
    设备 nvarchar(100) NULL,
    班组 nvarchar(60) NULL,
    工人 nvarchar(60) NULL,
    加工类型 nvarchar(20) NULL,
    计划数量 float NULL,
    已派工数量 float NULL,
    派工数量 float NULL,
    计量单位 nvarchar(20) NULL,
    派工加工状态 nvarchar(20) NULL,
    累计汇报数量 float NULL,
    委外供应商 nvarchar(100) NULL,
    规格型号 nvarchar(200) NULL,
    预开工日 date NULL,
    预完工日 date NULL,
    备注 nvarchar(500) NULL,
    comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL,
    asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0
);
GO
GRANT SELECT, INSERT, UPDATE, DELETE ON bl_dispatch TO yinjia;
GO
-- DISPATCH 面板字段(detail 用中文列名,与 bd_dispatch 表头分离)
INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq) VALUES
('DISPATCH','单据编号',N'单据编号','文本',NULL,NULL,NULL,'query,header',1),
('DISPATCH','工序编码',N'工序编码','文本',NULL,NULL,NULL,'detail',10),
('DISPATCH','工序名称',N'工序名称','文本',NULL,NULL,NULL,'query,detail',11),
('DISPATCH','工作中心',N'工作中心','文本',NULL,NULL,NULL,'detail',12),
('DISPATCH','设备',N'设备','文本',NULL,NULL,NULL,'detail',13),
('DISPATCH','班组',N'班组','文本',NULL,NULL,NULL,'detail',14),
('DISPATCH','工人',N'工人','文本',NULL,NULL,NULL,'detail',15),
('DISPATCH','加工类型',N'加工类型','文本',NULL,NULL,NULL,'detail',16),
('DISPATCH','计划数量',N'计划数量','小数',NULL,NULL,NULL,'detail',17),
('DISPATCH','已派工数量',N'已派工数量','小数',NULL,NULL,NULL,'detail',18),
('DISPATCH','派工数量',N'派工数量','小数',NULL,NULL,NULL,'detail',19),
('DISPATCH','计量单位',N'计量单位','文本',NULL,NULL,NULL,'detail',20),
('DISPATCH','派工加工状态',N'派工加工状态','文本',NULL,NULL,NULL,'detail',21),
('DISPATCH','累计汇报数量',N'累计汇报数量','小数',NULL,NULL,NULL,'detail',22),
('DISPATCH','委外供应商',N'委外供应商','文本',NULL,NULL,NULL,'detail',23),
('DISPATCH','规格型号',N'规格型号','文本',NULL,NULL,NULL,'detail',24),
('DISPATCH','预开工日',N'预开工日','日期',NULL,NULL,NULL,'detail',25),
('DISPATCH','预完工日',N'预完工日','日期',NULL,NULL,NULL,'detail',26),
('DISPATCH','备注',N'备注','文本',NULL,NULL,NULL,'detail',99);
GO
-- DISPATCH 面板改为头行分表(bd_dispatch 头 / bl_dispatch 行)
UPDATE yj_panel SET head_table = 'bd_dispatch' WHERE panel_code = 'DISPATCH';
GO
DECLARE @c int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='DISPATCH');
PRINT N'工序派工单(中文列名)注册完成: ' + CAST(@c AS nvarchar(10)) + N' 个字段';
GO
