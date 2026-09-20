-- migrate-rd-prod-doclist.sql — 产品文件列表(RD_PROD_DOCLIST)新面板
--
-- 设计源:产品开发系统需求汇总.xlsx → sheet《文件汇总表》
--  产品编号 | 文件1 | 状态 | 文件2 | 状态 | 文件3 | 状态 | 文件4 | 状态 | 产品负责人 | 是否受控 | 受控日期
--  配套:产品信息表 → 一级审核 → 二级审核 → 任务分发 → 5.1 规格书/5.2 成型/5.3 组装/5.4 出货
--
-- 【★ 关键:不新建业务逻辑】设计那 4 个文件列 + 4 个状态**已经存在**于
--   DevTaskService.DEV_PANELS(RD_MOLD_PROC 成型工艺清单 / RD_ASM_PROC 组装工艺清单 /
--   RD_SPEC_DOC 规格书 / RD_INSP_PLAN 出货检验计划表)与 devStatus() 状态推导
--   (已归档→开发完毕 | 审批中→开发审核中 | 有草稿→开发中 | 无单据→未开发)。
--   本面板只是把那个"按钮里的矩阵"暴露成一张可查询的表 —— 不双写、不另存状态。
--
--   ⇒ 所以本脚本只建**面板壳**(面板注册 + 头表 + 明细行),业务数据由 DevTaskService 实时推导。
--
-- 幂等:IF NOT EXISTS / COL_LENGTH,可重复执行。
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ═══ 1. 面板注册 ═══
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'RD_PROD_DOCLIST')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table,
                      group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
VALUES ('RD_PROD_DOCLIST', N'产品文件列表', N'单据', 'doc',
        'rd_prod_doclist_detail', 'rd_prod_doclist_head',
        N'单据编号', N'id', N'单据编号', N'PDL', N'单据日期', 500, N'items', N'研发管理');
GO

-- ═══ 2. 头表 ═══
IF OBJECT_ID('rd_prod_doclist_head') IS NULL
CREATE TABLE rd_prod_doclist_head (
  id           int IDENTITY(1,1) PRIMARY KEY,
  单据编号     nvarchar(40)  NOT NULL,
  单据日期     nvarchar(30)  NULL,
  密级         nvarchar(20)  NULL,
  文件使用范围 nvarchar(50)  NULL,
  文件管理人   nvarchar(50)  NULL,
  文档编号     nvarchar(60)  NULL,
  备注         nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime NULL,
  asp_user2 nvarchar(50) NULL, asp_time2 datetime NULL,
  asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ═══ 3. 明细表(一行 = 一个产品) ═══
IF OBJECT_ID('rd_prod_doclist_detail') IS NULL
CREATE TABLE rd_prod_doclist_detail (
  id           int IDENTITY(1,1) PRIMARY KEY,
  单据编号     nvarchar(40)  NOT NULL,
  序号         int           NULL,
  产品编号     nvarchar(60)  NULL,   -- 参照 RD_PROD_INFO.产品编号(⚠ 唯一不加"已归档"过滤的面板)
  产品负责人   nvarchar(50)  NULL,
  是否受控     nvarchar(10)  NULL,   -- 是/否;4 文件全归档且为空时由服务端自动回填"是"
  受控日期     nvarchar(30)  NULL,   -- 第 4 个文件归档日(同上,仅在为空时回填)
  备注         nvarchar(500) NULL,
  表区         nvarchar(40)  NULL
);
GO

-- ═══ 4. 字段登记 ═══
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.dict_sql, v.ref_panel, v.ref_field, v.display_field,
       v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  ('RD_PROD_DOCLIST', N'单据编号',     N'单据编号',     N'文本',   NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
  ('RD_PROD_DOCLIST', N'单据日期',     N'单据日期',     N'日期',   NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
  ('RD_PROD_DOCLIST', N'密级',         N'密级',         N'下拉框',
     N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 30,  80, 1, 0, 0, 1),
  ('RD_PROD_DOCLIST', N'文件使用范围', N'文件使用范围', N'下拉框',
     N'SELECT v FROM (VALUES (N''公司内''),(N''工程技术中心''),(N''客户项目组''),(N''双方项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 120, 1, 0, 0, 1),
  ('RD_PROD_DOCLIST', N'文件管理人',   N'文件管理人',   N'文本',   NULL, NULL, NULL, NULL, N'header', 50, 120, 1, 0, 0, 1),
  ('RD_PROD_DOCLIST', N'文档编号',     N'文档编号',     N'文本',   NULL, NULL, NULL, NULL, N'header', 60, 120, 1, 0, 1, 1),
  ('RD_PROD_DOCLIST', N'备注',         N'备注',         N'文本',   NULL, NULL, NULL, NULL, N'header', 70, 160, 1, 0, 0, 1),
  -- 序号:纯排序辅助列(不进列表)
  ('RD_PROD_DOCLIST', N'序号',         N'序号',         N'文本',   NULL, NULL, NULL, NULL, N'detail',  5,  60, 1, 0, 1, 0),
  -- ⚠ 产品编号不加"已归档"过滤(migrate-ref-filter.sql 第 4 步显式清空 ref_filter):
  --   本表跟踪的就是开发中的产品,过滤掉未归档等于没数据
  ('RD_PROD_DOCLIST', N'产品编号',     N'产品编号',     N'参照',   NULL, N'RD_PROD_INFO', N'产品编号', N'产品编号', N'detail', 10, 140, 1, 0, 0, 1),
  ('RD_PROD_DOCLIST', N'产品负责人',   N'产品负责人',   N'文本',   NULL, NULL, NULL, NULL, N'detail', 20, 110, 1, 0, 0, 1),
  ('RD_PROD_DOCLIST', N'是否受控',     N'是否受控',     N'下拉框',
     N'SELECT v FROM (VALUES (N''是''),(N''否'')) AS t(v)', NULL, NULL, NULL, N'detail', 30,  90, 1, 0, 0, 1),
  ('RD_PROD_DOCLIST', N'受控日期',     N'受控日期',     N'文本',   NULL, NULL, NULL, NULL, N'detail', 40, 110, 1, 0, 0, 1),
  ('RD_PROD_DOCLIST', N'备注',         N'备注',         N'文本',   NULL, NULL, NULL, NULL, N'detail', 99, 160, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
       place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

-- ═══ 5. 查询列 ═══
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  ('RD_PROD_DOCLIST', N'产品编号', N'产品编号', N'文本', N'query', 10, 140, 0, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

-- ═══ 6. 中文表注明 ═══
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_prod_doclist_head') AND minor_id = 0 AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'产品文件列表(产品开发文件汇总):产品×4文件开发状态矩阵,状态由 DevTaskService 实时推导不存表',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_prod_doclist_head';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_prod_doclist_detail') AND minor_id = 0 AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'产品文件列表明细(产品编号/产品负责人/是否受控/受控日期;文件与状态列为派生显示)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_prod_doclist_detail';
GO

PRINT N'migrate-rd-prod-doclist.sql 完成';
GO
