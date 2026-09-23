-- migrate-rd-sample-no.sql — 样品编号表(RD_SAMPLE_NO)新面板
--
-- 设计源:二三级四级项目控制表2026.xlsx → sheet《产品开发样品编号》
-- 会话:2026-09-18 grill 会话。口径已定(用户):走 (a) ⇒ 确定性规则
--      **样品编号 = 客户项目代号 + 项目编号**(直接拼接)
--      依据:设计自身 38 个样例 38/38 复现(FL + 201-1 = FL201-1)
--      ⇒ 无计数器、无查库、无新端点(见 docs/design/研发管理-新面板设计与改动方案.md §14)
--
-- 前置约定(生成函数会校验,录入时须拦住不规范值):
--   ① 客户项目代号必须纯字母  ② 项目编号必须以 -<数字> 结尾  ③ 同一项目编号只出一张样品
--
-- 幂等:IF NOT EXISTS / COL_LENGTH,可重复执行。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ═══ 1. 面板注册 ═══
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'RD_SAMPLE_NO')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table,
                      group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
VALUES ('RD_SAMPLE_NO', N'样品编号表', N'单据', 'doc',
        'rd_sample_no_detail', 'rd_sample_no_head',
        N'单据编号', N'id', N'单据编号', N'SPN', N'单据日期', 200, N'items', N'研发管理');
GO

-- ═══ 2. 头表 ═══
IF OBJECT_ID('rd_sample_no_head') IS NULL
CREATE TABLE rd_sample_no_head (
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

-- ═══ 3. 明细表(7 列,设计 6 列 + 派生出样品编号所需的客户项目代号) ═══
IF OBJECT_ID('rd_sample_no_detail') IS NULL
CREATE TABLE rd_sample_no_detail (
  id           int IDENTITY(1,1) PRIMARY KEY,
  单据编号     nvarchar(40)  NOT NULL,
  客户项目代号 nvarchar(20)  NULL,   -- 标准库 rd.customer_code;设计纸面无此列(列表隐藏/表单可见)
  样品编号     nvarchar(40)  NULL,   -- = 客户项目代号 + 项目编号(派生,可手改);面板内唯一
  项目名称     nvarchar(200) NULL,   -- 参照 RD_PROGRESS.项目名称
  子项目       nvarchar(200) NULL,
  项目负责人   nvarchar(50)  NULL,
  项目编号     nvarchar(50)  NULL,   -- 必须以 -<数字> 结尾(如 201-1)
  炭棒尺寸     nvarchar(200) NULL,
  备注         nvarchar(500) NULL,
  表区         nvarchar(40)  NULL,
  -- ⚠ asp_cancel + asp_user1/2 + asp_time1/2 是**行表的硬约定**(见 migrate-rd-prod-doclist.sql 同款说明):
  --   QueryService.loadDetail 的 SQL 一律带 `ISNULL(t.asp_cancel,'N') <> 'Y'`,缺列直接 500。
  asp_user1 nvarchar(50) NULL, asp_time1 datetime NULL,
  asp_user2 nvarchar(50) NULL, asp_time2 datetime NULL,
  asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- 幂等补齐(已建过缺列版本的环境)
IF COL_LENGTH('rd_sample_no_detail','asp_cancel') IS NULL ALTER TABLE rd_sample_no_detail ADD asp_cancel char(1) NULL DEFAULT 'N';
IF COL_LENGTH('rd_sample_no_detail','asp_user1')  IS NULL ALTER TABLE rd_sample_no_detail ADD asp_user1 nvarchar(50) NULL;
IF COL_LENGTH('rd_sample_no_detail','asp_time1')  IS NULL ALTER TABLE rd_sample_no_detail ADD asp_time1 datetime NULL;
IF COL_LENGTH('rd_sample_no_detail','asp_user2')  IS NULL ALTER TABLE rd_sample_no_detail ADD asp_user2 nvarchar(50) NULL;
IF COL_LENGTH('rd_sample_no_detail','asp_time2')  IS NULL ALTER TABLE rd_sample_no_detail ADD asp_time2 datetime NULL;
GO

-- ═══ 4. 字段登记 ═══
-- 单据编号:系统流水号 ⇒ editable=0 / required=1(实测 RD_FILTER_EFF.单据编号 同款)
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.dict_sql, v.ref_panel, v.ref_field, v.display_field,
       v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  ('RD_SAMPLE_NO', N'单据编号',     N'单据编号',     N'文本',   NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1),
  ('RD_SAMPLE_NO', N'单据日期',     N'单据日期',     N'日期',   NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1),
  ('RD_SAMPLE_NO', N'密级',         N'密级',         N'下拉框',
     N'SELECT v FROM (VALUES (N''绝密''),(N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 30,  80, 1, 0, 0, 1),
  ('RD_SAMPLE_NO', N'文件使用范围', N'文件使用范围', N'下拉框',
     N'SELECT v FROM (VALUES (N''工程技术中心''),(N''公司内''),(N''客户项目组''),(N''双方项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 120, 1, 0, 0, 1),
  ('RD_SAMPLE_NO', N'文件管理人',   N'文件管理人',   N'文本',   NULL, NULL, NULL, NULL, N'header', 50, 120, 1, 0, 0, 1),
  ('RD_SAMPLE_NO', N'文档编号',     N'文档编号',     N'文本',   NULL, NULL, NULL, NULL, N'header', 60, 120, 1, 0, 1, 1),
  ('RD_SAMPLE_NO', N'备注',         N'备注',         N'文本',   NULL, NULL, NULL, NULL, N'header', 70, 160, 1, 0, 0, 1),
  -- 明细:客户项目代号 = 标准库(⚠ dict_sql 存【库编码】不是 SQL,误写 SQL 会下拉空白且无报错)
  ('RD_SAMPLE_NO', N'客户项目代号', N'客户项目代号', N'标准库', N'rd.customer_code', NULL, NULL, NULL, N'detail',  5, 100, 1, 1, 1, 1),
  ('RD_SAMPLE_NO', N'样品编号',     N'样品编号',     N'文本',   NULL, NULL, NULL, NULL, N'detail', 10, 130, 1, 1, 0, 1),
  ('RD_SAMPLE_NO', N'项目名称',     N'项目名称',     N'参照',   NULL, N'RD_PROGRESS', N'项目名称', N'项目名称', N'detail', 20, 180, 1, 0, 0, 1),
  ('RD_SAMPLE_NO', N'子项目',       N'子项目',       N'文本',   NULL, NULL, NULL, NULL, N'detail', 30, 160, 1, 0, 0, 1),
  ('RD_SAMPLE_NO', N'项目负责人',   N'项目负责人',   N'文本',   NULL, NULL, NULL, NULL, N'detail', 40, 100, 1, 0, 0, 1),
  ('RD_SAMPLE_NO', N'项目编号',     N'项目编号',     N'文本',   NULL, NULL, NULL, NULL, N'detail', 50, 100, 1, 1, 0, 1),
  ('RD_SAMPLE_NO', N'炭棒尺寸',     N'炭棒尺寸',     N'文本',   NULL, NULL, NULL, NULL, N'detail', 60, 150, 1, 0, 0, 1),
  ('RD_SAMPLE_NO', N'备注',         N'备注',         N'文本',   NULL, NULL, NULL, NULL, N'detail', 99, 160, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
       place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

-- ═══ 5. 查询列(列表显示) ═══
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  ('RD_SAMPLE_NO', N'样品编号', N'样品编号', N'文本', N'query', 10, 130, 0, 0, 0, 1),
  ('RD_SAMPLE_NO', N'项目名称', N'项目名称', N'文本', N'query', 20, 180, 0, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

-- ═══ 6. 客户项目代号标准库(rd.customer_code):item_code=项目名称,content=代号
--     实测:设计 38 样例覆盖 34 个唯一项目名称,无一对多代号 ⇒ 可直接播种
--     ⚠ 幂等去重键 lib_code + item_code(项目名称)—— 用 NOT EXISTS,避免 N'undefined'
--     种子明细由 tools/gen-customer-code.cjs 生成(见 migrate-customer-code-seed.sql)
IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = 'rd.customer_code')
PRINT N'  提示:rd.customer_code 库为空,请执行 tools/migrate-customer-code-seed.sql 播种 34 条';
GO

-- ═══ 7. 中文表注明(AGENTS.md:新增表必须带 MS_Description) ═══
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_sample_no_head') AND minor_id = 0 AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'样品编号表(产品开发样品编号):样品编号=客户项目代号+项目编号(确定性拼接,38样例验证)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_sample_no_head';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_sample_no_detail') AND minor_id = 0 AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'样品编号表明细(客户项目代号/样品编号/项目名称/子项目/项目负责人/项目编号/炭棒尺寸)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_sample_no_detail';
GO

PRINT N'migrate-rd-sample-no.sql 完成';
GO
