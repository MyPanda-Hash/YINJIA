﻿-- 选单流转占用表(对齐 PANDA form_flow_link;SQL Server 版):
-- 生单后写 ACTIVE 记录,来源明细行不再出现在选单列表;删除下游草稿改 RELEASED 释放。
USE HSDZ_MES;
SET NOCOUNT ON;
IF OBJECT_ID('form_flow_link') IS NULL CREATE TABLE form_flow_link (
    id               int IDENTITY(1,1) PRIMARY KEY,
    source_panel_code varchar(50)  NOT NULL,
    source_form_no    nvarchar(60) NOT NULL,
    source_detail_key nvarchar(50) NULL,
    source_line_key   nvarchar(100) NOT NULL,
    target_panel_code varchar(50)  NOT NULL,
    target_form_no    nvarchar(60) NOT NULL,
    target_detail_key nvarchar(50) NULL,
    target_line_key   nvarchar(100) NULL,
    inventory_code    nvarchar(50) NULL,
    source_quantity   decimal(18,6) NULL,
    linked_quantity   decimal(18,6) NULL,
    link_status       varchar(20)  NOT NULL DEFAULT 'ACTIVE',
    create_by         nvarchar(50) NULL,
    create_time       datetime2    NOT NULL DEFAULT SYSDATETIME(),
    release_time      datetime2    NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ffl_source')
    CREATE INDEX idx_ffl_source ON form_flow_link (source_panel_code, source_form_no, source_line_key);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ffl_target')
    CREATE INDEX idx_ffl_target ON form_flow_link (target_panel_code, target_form_no);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ffl_status')
    CREATE INDEX idx_ffl_status ON form_flow_link (link_status);
SELECT name AS created FROM sys.tables WHERE name = 'form_flow_link';
