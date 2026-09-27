/* ============================================================
   migrate-scjl-single-table.sql — 2026-09-27 工序报工单表化(scjl 单表)
   ------------------------------------------------------------
   用户拍板:报工录入载体与事实账合一——WO_REPORT/WO_REPORT_LIST 两面板
   数据源由 wo_report 切 **scjl**(参考库生产记录表),操作流不变
   (新增→保存草稿→审核=wgzt'Y'→弃审=wgzt'N',不再双表同步/软删)。
   ① scjl 加 报工单号 nvarchar(30)(BG 号池续号;sc_no 保留=工单号语义)
      + 直销数量 float(切炭双出口字段)+ 中文注明;
   ② yj_field 两面板字段重定义(col_name 指向 scjl 列;删旧 wo_report 字段行,插新行);
   ③ yj_panel 数据源切 scjl:WO_REPORT 保持 doc 模式(group_col=报工单号,prefix=BG),
      WO_REPORT_LIST flat;
   ④ wo_report 停用为遗留表(存量 2 张空壳草稿,无生产数据,不迁移)。
   幂等可重跑。 ============================================================ */
SET NOCOUNT ON;
GO
IF COL_LENGTH(N'dbo.scjl', N'报工单号') IS NULL
    ALTER TABLE dbo.scjl ADD [报工单号] nvarchar(30) NULL;
IF COL_LENGTH(N'dbo.scjl', N'直销数量') IS NULL
    ALTER TABLE dbo.scjl ADD [直销数量] float NULL;
GO
IF COL_LENGTH(N'dbo.scjl', N'报工单号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.scjl')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'报工单号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'报工单号(BG 号池,单表化后 WO_REPORT 面板单据编号)',
            N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'报工单号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'报工单号(BG 号池,单表化后 WO_REPORT 面板单据编号)',
            N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'报工单号';
END
IF COL_LENGTH(N'dbo.scjl', N'直销数量') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.scjl')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'直销数量', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'直销数量(切炭双出口:报工中直销入成品仓的数量)',
            N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'直销数量';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'直销数量(切炭双出口:报工中直销入成品仓的数量)',
            N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'直销数量';
END
GO
-- 面板字段重定义(幂等:先删旧指向 wo_report 中文列的行,再插 scjl 列映射)
DELETE FROM yj_field WHERE panel_code IN ('WO_REPORT','WO_REPORT_LIST');
GO
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
VALUES
-- 工序报工单(doc:头=报工单号/日期,行=工单/工序/数量…)
('WO_REPORT', N'报工单号', N'单据编号', N'文本', 'query,header', 10, 150, 0, 0, 0, 1),
('WO_REPORT', N'sc_date',  N'单据日期', N'日期', 'query,header', 20, 100, 1, 0, 0, 1),
('WO_REPORT', N'gldh',     N'工单号',   N'文本', 'query,detail', 30, 160, 1, 1, 0, 1),
('WO_REPORT', N'批次号',    N'批次号',   N'文本', 'query,detail', 35, 100, 0, 0, 0, 1),
('WO_REPORT', N'gxdm',     N'工序',     N'文本', 'query,detail', 40, 100, 1, 1, 0, 1),
('WO_REPORT', N'sl',       N'报工数量', N'数值', 'query,detail', 50, 110, 1, 1, 0, 1),
('WO_REPORT', N'直销数量',  N'直销数量', N'数值', 'query,detail', 55, 110, 1, 0, 0, 1),
('WO_REPORT', N'lot_no',   N'批号',     N'文本', 'query,detail', 56, 120, 1, 0, 0, 1),
('WO_REPORT', N'scx',      N'生产线',   N'文本', 'query,detail', 57, 110, 1, 0, 0, 1),
('WO_REPORT', N'post_no',  N'入库单号', N'文本', 'query,detail', 58, 140, 0, 0, 0, 1),
('WO_REPORT', N'jc_no',    N'产成品流水号', N'文本', 'query,detail', 59, 170, 0, 0, 0, 1),
('WO_REPORT', N'ywman',    N'报工人',   N'文本', 'query,detail', 60, 100, 1, 0, 0, 1),
('WO_REPORT', N'bz',       N'备注',     N'文本', 'query,detail', 70, 160, 1, 0, 0, 1),
-- 报工记录(flat 只读清单)
('WO_REPORT_LIST', N'报工单号', N'单据编号', N'文本', 'query,detail', 10, 150, 0, 0, 0, 1),
('WO_REPORT_LIST', N'sc_date',  N'单据日期', N'日期', 'query,detail', 20, 100, 0, 0, 0, 1),
('WO_REPORT_LIST', N'gldh',     N'工单号',   N'文本', 'query,detail', 30, 160, 0, 0, 0, 1),
('WO_REPORT_LIST', N'批次号',    N'批次号',   N'文本', 'query,detail', 35, 100, 0, 0, 0, 1),
('WO_REPORT_LIST', N'gxdm',     N'工序',     N'文本', 'query,detail', 40, 100, 0, 0, 0, 1),
('WO_REPORT_LIST', N'sl',       N'报工数量', N'数值', 'query,detail', 50, 110, 0, 0, 0, 1),
('WO_REPORT_LIST', N'直销数量',  N'直销数量', N'数值', 'query,detail', 55, 110, 0, 0, 0, 1),
('WO_REPORT_LIST', N'scx',      N'生产线',   N'文本', 'query,detail', 56, 110, 0, 0, 0, 1),
('WO_REPORT_LIST', N'wgzt',     N'完工状态', N'文本', 'query,detail', 57, 90,  0, 0, 0, 1),
('WO_REPORT_LIST', N'post_no',  N'入库单号', N'文本', 'query,detail', 58, 140, 0, 0, 0, 1),
('WO_REPORT_LIST', N'ywman',    N'报工人',   N'文本', 'query,detail', 60, 100, 0, 0, 0, 1);
GO
-- 面板数据源切换:WO_REPORT(doc,group_col=报工单号,prefix=BG)/WO_REPORT_LIST(flat)→ scjl
UPDATE yj_panel SET line_table=N'scjl', head_table=NULL, group_col=N'报工单号', prefix='BG'
WHERE panel_code='WO_REPORT';
UPDATE yj_panel SET line_table=N'scjl' WHERE panel_code='WO_REPORT_LIST';
GO
PRINT N'scjl 单表化就绪(加列+注明+字段重定义+面板切源,幂等)';
GO
