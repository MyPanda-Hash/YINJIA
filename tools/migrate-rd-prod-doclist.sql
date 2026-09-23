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
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
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

-- ═══ 1b. 面板配置:singleDoc(与 RD_PROGRESS 同款)═══
--  本面板的"内容"是**一张矩阵**:全部产品都在同一张单里 ⇒ 不应让用户新增第二张。
--  PanelConfigService.panelSingleDoc 读 yj_panel.config 里的 "singleDoc":true:
--  前端据此隐藏「新增/新增流程」(PanelxList singleDocMode 分支),但保留 doc 状态机。
--  ⚠ 单单据面板只是**隐藏新增入口**,单据本身仍须存在(否则 queryDocs 返回空列表 ⇒ 矩阵不渲染)。
--    故下面同时补一张固定单据(幂等)。
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'RD_PROD_DOCLIST' AND CONVERT(nvarchar(max), config) LIKE '%"singleDoc":true%')
  UPDATE yj_panel SET config = N'{"singleDoc":true}'
  WHERE panel_code = 'RD_PROD_DOCLIST';
GO

-- ═══ 1c. 承载单据(幂等:缺则补一张)═══
--  与 RD_PROGRESS 的"唯一一张进度单"同一模式。矩阵数据不落这张单,它只是**视图宿主**:
--  Sheet 组件由这张单挂载,内容来自 /px/prodDocList 现算。
IF NOT EXISTS (SELECT 1 FROM rd_prod_doclist_head WHERE ISNULL(asp_cancel,'N') <> 'Y')
INSERT INTO rd_prod_doclist_head (单据编号, 单据日期, 密级, 文件使用范围, 文件管理人, 备注)
VALUES (N'PDL-0001', CONVERT(nvarchar(30), CONVERT(date, GETDATE()), 23), N'保密', N'工程技术中心', N'陈秀丽', N'产品文件列表视图宿主单据');

IF NOT EXISTS (SELECT 1 FROM yj_doc_status WHERE panel_code = 'RD_PROD_DOCLIST' AND doc_no = N'PDL-0001')
INSERT INTO yj_doc_status (panel_code, doc_no, saved, archived) VALUES ('RD_PROD_DOCLIST', N'PDL-0001', 'Y', 'N');
GO

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

-- ═══ 3. 明细表(占位:本面板是只读派生视图,明细行不落库)═══
--  ⚠ 设计原表有 产品编号/产品负责人/是否受控/受控日期 四列,但这四列**全部是派生值**:
--    产品编号 来自 rd_dev_task(已下发产品),其余三列由 DevTaskService.board() + yj_doc_status 实时算。
--    第一版把 是否受控/受控日期 也建成物理列,但它们**永远不会被写入**(本面板没有「新增」入口,
--    数据源是别的面板)⇒ 死列、且会让人误以为要填。故只保留占位主键与单据号,矩阵数据一律现算。
IF OBJECT_ID('rd_prod_doclist_detail') IS NULL
CREATE TABLE rd_prod_doclist_detail (
  id        int IDENTITY(1,1) PRIMARY KEY,
  单据编号  nvarchar(40)  NOT NULL,
  序号      int           NULL,
  产品编号  nvarchar(60)  NULL,
  表区      nvarchar(40)  NULL,
  -- ⚠ asp_cancel + asp_user1/2 + asp_time1/2 是**行表的硬约定**:
  --   QueryService.loadDetail 的 SQL 一律带 `ISNULL(t.asp_cancel,'N') <> 'Y'`,
  --   缺列直接 500(本次实测:漏了它 ⇒ 面板列表打不开)。同族 rd_asm_proc_detail /
  --   rd_mold_proc_detail / rd_insp_plan_detail / rd_progress_detail 都带这四个。
  asp_user1 nvarchar(50) NULL, asp_time1 datetime NULL,
  asp_user2 nvarchar(50) NULL, asp_time2 datetime NULL,
  asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- 幂等补齐(已建过缺列版本的环境)
IF COL_LENGTH('rd_prod_doclist_detail','asp_cancel') IS NULL ALTER TABLE rd_prod_doclist_detail ADD asp_cancel char(1) NULL DEFAULT 'N';
IF COL_LENGTH('rd_prod_doclist_detail','asp_user1')  IS NULL ALTER TABLE rd_prod_doclist_detail ADD asp_user1 nvarchar(50) NULL;
IF COL_LENGTH('rd_prod_doclist_detail','asp_time1')  IS NULL ALTER TABLE rd_prod_doclist_detail ADD asp_time1 datetime NULL;
IF COL_LENGTH('rd_prod_doclist_detail','asp_user2')  IS NULL ALTER TABLE rd_prod_doclist_detail ADD asp_user2 nvarchar(50) NULL;
IF COL_LENGTH('rd_prod_doclist_detail','asp_time2')  IS NULL ALTER TABLE rd_prod_doclist_detail ADD asp_time2 datetime NULL;
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
  ('RD_PROD_DOCLIST', N'产品编号',     N'产品编号',     N'参照',   NULL, N'RD_PROD_INFO', N'产品编号', N'产品编号', N'detail', 10, 140, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
       place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

-- 清理第一版误建的死列/死字段(派生值,永不写入)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rd_prod_doclist_detail') AND name = '产品负责人')
  ALTER TABLE rd_prod_doclist_detail DROP COLUMN [产品负责人];
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rd_prod_doclist_detail') AND name = '是否受控')
  ALTER TABLE rd_prod_doclist_detail DROP COLUMN [是否受控];
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rd_prod_doclist_detail') AND name = '受控日期')
  ALTER TABLE rd_prod_doclist_detail DROP COLUMN [受控日期];
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rd_prod_doclist_detail') AND name = '备注')
  ALTER TABLE rd_prod_doclist_detail DROP COLUMN [备注];
DELETE FROM yj_field WHERE panel_code = 'RD_PROD_DOCLIST'
  AND place = N'detail' AND col_name IN (N'产品负责人', N'是否受控', N'受控日期', N'备注');
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
       N'产品文件列表头表(占位):本面板是只读派生视图,矩阵由 DevTaskService 实时推导,不落库',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_prod_doclist_head';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('rd_prod_doclist_detail') AND minor_id = 0 AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'产品文件列表明细表(占位,doc 模式要求):产品×4文件状态矩阵不落库,由 DevTaskService.board() 现算;是否受控/受控日期为派生值(4 份文件全归档 ⇒ 是)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_prod_doclist_detail';
GO
-- 幂等修正旧注明(第一版误把 产品负责人/是否受控/受控日期 建成物理列,已删;注明需同步)
IF EXISTS (SELECT 1 FROM sys.extended_properties
           WHERE major_id = OBJECT_ID('rd_prod_doclist_detail') AND minor_id = 0 AND name = 'MS_Description'
             AND CONVERT(nvarchar(400), value) LIKE N'%是否受控/受控日期;文件与状态列为派生显示%')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'产品文件列表明细表(占位,doc 模式要求):产品×4文件状态矩阵不落库,由 DevTaskService.board() 现算;是否受控/受控日期为派生值(4 份文件全归档 ⇒ 是)',
       N'SCHEMA', N'dbo', N'TABLE', N'rd_prod_doclist_detail';
GO

PRINT N'migrate-rd-prod-doclist.sql 完成';
GO
