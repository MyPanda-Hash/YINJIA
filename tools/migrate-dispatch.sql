/* 工序派工单:建表 + 注册 + 字段(从 light-mes 拉取配置) */
USE HSDZ_MES;
SET NOCOUNT ON;
GO
IF OBJECT_ID('bl_dispatch') IS NOT NULL DROP TABLE bl_dispatch;
GO
CREATE TABLE bl_dispatch (
    id int IDENTITY(1,1) PRIMARY KEY,
    dispatch_no nvarchar(60) NULL,
    dispatch_date date NULL,
    biz_type nvarchar(20) NULL,
    workshop nvarchar(60) NULL,
    work_order_no nvarchar(60) NULL,
    product_name nvarchar(200) NULL,
    process_name nvarchar(200) NULL,
    work_center nvarchar(60) NULL,
    equipment nvarchar(100) NULL,
    team nvarchar(60) NULL,
    worker nvarchar(60) NULL,
    work_type nvarchar(20) NULL,
    plan_qty float NULL,
    dispatched_qty float NULL,
    dispatch_qty float NULL,
    unit nvarchar(20) NULL,
    plan_start date NULL,
    plan_end date NULL,
    dispatch_status nvarchar(20) NULL,
    reported_qty float NULL,
    spec nvarchar(200) NULL,
    handler nvarchar(40) NULL,
    project nvarchar(60) NULL,
    dept nvarchar(60) NULL,
    remark nvarchar(500) NULL,
    comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL,
    asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0
);
GO
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES
('DISPATCH', N'工序派工单', N'单据', 'doc', 'bl_dispatch', NULL, 'dispatch_no', 'id', NULL, 'DP', 'dispatch_date', 20, 'items', N'生产制造');
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq) VALUES
('DISPATCH','dispatch_no',N'单据编号','文本',NULL,NULL,NULL,'query,header',1),
('DISPATCH','dispatch_date',N'单据日期','日期',NULL,NULL,NULL,'query,header',2),
('DISPATCH','biz_type',N'业务类型','下拉框',NULL,NULL,NULL,'query,header',3),
('DISPATCH','workshop',N'生产车间','参照','DEPT','部门名称','部门名称','query,header',4),
('DISPATCH','work_order_no',N'加工单号','文本',NULL,NULL,NULL,'header',5),
('DISPATCH','product_name',N'产品名称','文本',NULL,NULL,NULL,'query,header,detail',6),
('DISPATCH','process_name',N'工序名称','文本',NULL,NULL,NULL,'query,header,detail',7),
('DISPATCH','work_center',N'工作中心','文本',NULL,NULL,NULL,'detail',8),
('DISPATCH','equipment',N'设备','文本',NULL,NULL,NULL,'detail',9),
('DISPATCH','team',N'班组','文本',NULL,NULL,NULL,'detail',10),
('DISPATCH','worker',N'工人','文本',NULL,NULL,NULL,'detail',11),
('DISPATCH','work_type',N'加工类型','文本',NULL,NULL,NULL,'detail',12),
('DISPATCH','plan_qty',N'计划数量','小数',NULL,NULL,NULL,'detail',13),
('DISPATCH','dispatched_qty',N'已派工数量','小数',NULL,NULL,NULL,'detail',14),
('DISPATCH','dispatch_qty',N'派工数量','小数',NULL,NULL,NULL,'detail',15),
('DISPATCH','unit',N'计量单位','文本',NULL,NULL,NULL,'detail',16),
('DISPATCH','plan_start',N'预开工日','日期',NULL,NULL,NULL,'header,detail',17),
('DISPATCH','plan_end',N'预完工日','日期',NULL,NULL,NULL,'header,detail',18),
('DISPATCH','dispatch_status',N'派工加工状态','文本',NULL,NULL,NULL,'detail',19),
('DISPATCH','reported_qty',N'累计汇报数量','小数',NULL,NULL,NULL,'detail',20),
('DISPATCH','spec',N'规格型号','文本',NULL,NULL,NULL,'detail',21),
('DISPATCH','handler',N'经手人','文本',NULL,NULL,NULL,'header',22),
('DISPATCH','project',N'项目','文本',NULL,NULL,NULL,'header',23),
('DISPATCH','dept',N'部门','文本',NULL,NULL,NULL,'header',24),
('DISPATCH','remark',N'备注','文本',NULL,NULL,NULL,'header,detail',99);
GO
UPDATE yj_field SET dict_sql = N'SELECT mc FROM dm_gx WHERE lb=''GXLX'' AND ISNULL(asp_cancel,''N'')<>''Y''' WHERE panel_code='DISPATCH' AND col_name='biz_type';
IF NOT EXISTS (SELECT 1 FROM dm_gx WHERE lb='GXLX' AND dm='GXLX01')
INSERT INTO dm_gx (comm, dm, mc, lb, asp_cancel) VALUES
('0','GXLX01',N'工序派工','GXLX','N'),
('0','GXLX02',N'委外派工','GXLX','N');
GO
GRANT SELECT, INSERT, UPDATE, DELETE ON bl_dispatch TO yinjia;
GO
DECLARE @c int = (SELECT COUNT(*) FROM yj_field WHERE panel_code='DISPATCH');
PRINT N'工序派工单注册完成: ' + CAST(@c AS nvarchar(10)) + N' 个字段';
GO
