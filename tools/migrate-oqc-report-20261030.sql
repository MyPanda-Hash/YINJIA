/* migrate-oqc-report-20261030.sql(2026-10-30):出厂检验报告 —— QC_OQC_REPORT
 *
 * 需求来源(用户 2026-10-30 定稿,12 轮讨论):
 *   「出厂检验报告的内容应该就是首件检验、制程检验、成品检验三张单据检验数据的共同数据
 *     之上的基础生成;在销售出库勾选货物时跳转到这个页面实现,然后走正常的审批形式。」
 *   设计定稿见 docs/design/出厂检验报告-从三张检验单并集生成.md。
 *
 * 关键口径(逐条来自拍板):
 *   ① 行清单来自《出货检验计划表》RD_INSP_PLAN —— **只建只读视图 v_oqc_std,不改该表任何一列**
 *      (用户口径「不想修改这个出货检验计划,因为当前这个已经是完整的功能了」);
 *   ② 实测值从 成品 / 制程 / 首件 三张单按「并集 + 有值优先」取,对齐走 qc_oqc_item_map;
 *   ③ 一份报告 = 一个产品(出库勾选多行 → 生成多张单);
 *   ④ 抽样标准/抽检量/AQL 手填(系统无 AQL 结构化数据,不自动查 GB/T 2828.1);
 *   ⑤ 卫生安全页本轮不录数,只留版面位;
 *   ⑥ 走普通单据审批(单级审核,审核人取 yj_doc_status.shr),不接两级审批族。
 *
 * 规范符合性:头行成对;主键 id + 审计四件套 asp_user1/2 + asp_time1/2;asp_cancel 默认 'N';
 *   表与关键列写 MS_Description 中文注明(全量部署规范);面板 + 新字段 en 译名(AGENTS.md 强制)。
 * 幂等:建表 IF OBJECT_ID IS NULL、字段 INSERT 走 NOT EXISTS、注明 IF NOT EXISTS、视图 CREATE OR ALTER。
 * 两账套执行(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
 */

/* ============ A. 标准层只读视图(不改 rd_insp_plan_* 任何一列) ============ */
CREATE OR ALTER VIEW dbo.v_oqc_std AS
WITH cur AS (
    /* 一个产品可能有多张计划单(实测 B-92-25 有 0007/0009/0011 三张,其中 0009 与 0007 逐字段相同),
       报告只认「当前生效」的一张:优先受控(备用1='是'),其次单据日期 / 版本号 / 单据编号 取最新。 */
    SELECT h.单据编号, h.产品编号, h.客户项目名称, h.版本号, h.单据日期,
           ROW_NUMBER() OVER (
               PARTITION BY h.产品编号
               ORDER BY CASE WHEN ISNULL(h.备用1, N'') = N'是' THEN 0 ELSE 1 END,
                        ISNULL(h.单据日期, CAST('1900-01-01' AS date)) DESC,
                        ISNULL(h.版本号, N'') DESC,
                        h.单据编号 DESC
           ) AS rn
    FROM dbo.rd_insp_plan_head h
    WHERE h.产品编号 IS NOT NULL
)
SELECT
    c.单据编号                AS 计划单号,
    c.产品编号,
    c.客户项目名称,
    c.版本号,
    CASE WHEN LTRIM(RTRIM(ISNULL(d.序号, N''))) <> N''
              AND LTRIM(RTRIM(d.序号)) NOT LIKE N'%[^0-9]%'
         THEN CAST(LTRIM(RTRIM(d.序号)) AS int) END AS 序号,
    d.控制项目                AS 检验项目,
    d.控制标准及要求          AS 检验要求,
    d.控制方法                AS 检验方法,
    d.检测频率                AS 检查频率,
    d.不合格应对措施,
    CASE WHEN d.检测频率 = N'型式检验' THEN N'型式检验' ELSE N'出厂检验' END AS 检验类别
FROM cur c
JOIN dbo.rd_insp_plan_detail d ON d.单据编号 = c.单据编号
WHERE c.rn = 1;
GO

/* ============ B. 建表 ============ */
IF OBJECT_ID(N'dbo.qc_oqc_head', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.qc_oqc_head (
    id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_oqc_head PRIMARY KEY,
    单据编号     nvarchar(50)  NOT NULL,
    单据日期     date          NULL,
    客户名称     nvarchar(200) NULL,
    产品编码     nvarchar(100) NULL,   /* = 出库行 存货编码 = bs_inv.存货编码 */
    产品名称     nvarchar(200) NULL,
    规格型号     nvarchar(200) NULL,
    批次号       nvarchar(60)  NULL,   /* 出库行批号;PC0000/空 时留空并提示 */
    生产日期     date          NULL,
    生产数量     decimal(18,4) NULL,
    检测日期     date          NULL,
    AQL          nvarchar(30)  NULL,   /* 手填 */
    出库单号     nvarchar(50)  NULL,
    出库行号     int           NULL,
    成品检验单号 nvarchar(50)  NULL,   /* 溯源引用:数据主要来源 */
    首件检验单号 nvarchar(50)  NULL,
    制程检验单号 nvarchar(50)  NULL,
    检验结论     nvarchar(20)  NULL,   /* 合格/不合格 */
    检验员       nvarchar(50)  NULL,
    备注         nvarchar(1000) NULL,
    审核人       nvarchar(50)  NULL,
    审核时间     datetime2     NULL,
    单据状态     nvarchar(20)  NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
    asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_oqc_head_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] qc_oqc_head 已建';
END
ELSE PRINT N'[SKIP] qc_oqc_head 已存在';
GO

IF OBJECT_ID(N'dbo.qc_oqc_detail', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.qc_oqc_detail (
    id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_oqc_detail PRIMARY KEY,
    单据编号     nvarchar(50)  NOT NULL,
    行号         int           NULL,
    序号         int           NULL,
    检验项目     nvarchar(200) NULL,
    检验要求     nvarchar(4000) NULL,
    检验方法     nvarchar(2000) NULL,
    抽样标准     nvarchar(100) NULL,   /* 手填(如 GBT2828II级) */
    抽检量       nvarchar(30)  NULL,   /* 手填(如 50) */
    测量值1      decimal(18,4) NULL,
    测量值2      decimal(18,4) NULL,
    测量值3      decimal(18,4) NULL,
    测量值4      decimal(18,4) NULL,
    测量值5      decimal(18,4) NULL,
    结果         nvarchar(4000) NULL,  /* 定性文本 / 勾选文本 / 五值拼接 */
    判定         nvarchar(20)  NULL,   /* 合格/不合格 */
    数据来源     nvarchar(200) NULL,   /* 形如 QC_ASM_INSP:ZJ-2026-10-0140 */
    来源项目名   nvarchar(200) NULL,   /* 对齐表命中的源项目名 */
    是否手填     bit           NULL CONSTRAINT df_qc_oqc_detail_manual DEFAULT (0),
    备注         nvarchar(500) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
    asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_oqc_detail_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] qc_oqc_detail 已建';
END
ELSE PRINT N'[SKIP] qc_oqc_detail 已存在';
GO

IF OBJECT_ID(N'dbo.qc_oqc_item_map', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.qc_oqc_item_map (
    id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_qc_oqc_item_map PRIMARY KEY,
    报告项目     nvarchar(200) NOT NULL,  /* 报告上印的检验项目名 */
    源面板       nvarchar(50)  NULL,      /* QC_ASM_INSP / QC_PROC_INSP / QC_FIRST_INSP */
    源表区       nvarchar(100) NULL,      /* 三单的分区:表区 或 检验类型 */
    源项目名     nvarchar(200) NULL,      /* 三单明细里的检验项目 */
    优先级       int           NULL CONSTRAINT df_qc_oqc_item_map_prio DEFAULT (100),
    取值方式     nvarchar(20)  NULL,      /* 数值 / 文本 / 勾选 */
    停用         bit           NULL CONSTRAINT df_qc_oqc_item_map_disabled DEFAULT (0),
    备注         nvarchar(500) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL,
    asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL,
    asp_cancel nvarchar(1) NULL CONSTRAINT df_qc_oqc_item_map_cancel DEFAULT (N'N')
  );
  PRINT N'[OK] qc_oqc_item_map 已建';
END
ELSE PRINT N'[SKIP] qc_oqc_item_map 已存在';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_oqc_head_no' AND object_id = OBJECT_ID(N'dbo.qc_oqc_head'))
  CREATE INDEX ix_qc_oqc_head_no ON dbo.qc_oqc_head (单据编号, 出库单号);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_oqc_head_prod' AND object_id = OBJECT_ID(N'dbo.qc_oqc_head'))
  CREATE INDEX ix_qc_oqc_head_prod ON dbo.qc_oqc_head (产品编码, 批次号);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_oqc_detail_no' AND object_id = OBJECT_ID(N'dbo.qc_oqc_detail'))
  CREATE INDEX ix_qc_oqc_detail_no ON dbo.qc_oqc_detail (单据编号, 行号);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_qc_oqc_item_map_proj' AND object_id = OBJECT_ID(N'dbo.qc_oqc_item_map'))
  CREATE INDEX ix_qc_oqc_item_map_proj ON dbo.qc_oqc_item_map (报告项目, 优先级);
GO

/* ============ C. 面板登记 ============ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_OQC_REPORT')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
  VALUES (N'QC_OQC_REPORT', N'出厂检验报告', N'品质管理', 'doc', N'qc_oqc_detail', N'qc_oqc_head',
          N'单据编号', N'id', N'单据编号', N'OQC', N'单据日期', 20, N'items', N'品质管理');
GO

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_OQC_ITEMMAP')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, head_table, line_table, group_col, pk_col, detail_key, page_size, module_group)
  VALUES (N'QC_OQC_ITEMMAP', N'出厂检验项目对齐', N'基础设置', 'archive', NULL, N'qc_oqc_item_map', NULL, N'id', N'items', 100, N'品质管理');
GO

/* ============ D. 字段登记(头) ============ */
DECLARE @fh TABLE (col nvarchar(50), place nvarchar(30), seq int, width int, editable int, required int, hidden int, dtype nvarchar(20));
INSERT INTO @fh VALUES
 (N'单据编号',     N'query,header',  10, 140, 0, 1, 0, N'文本'),
 (N'单据日期',     N'query,header',  20, 110, 1, 1, 0, N'日期'),
 (N'客户名称',     N'query,header',  30, 180, 1, 0, 0, N'文本'),
 (N'产品编码',     N'query,header',  40, 120, 1, 1, 0, N'文本'),
 (N'产品名称',     N'query,header',  45, 180, 1, 0, 0, N'文本'),
 (N'规格型号',     N'header',        50, 160, 1, 0, 0, N'文本'),
 (N'批次号',       N'query,header',  55, 120, 1, 0, 0, N'文本'),
 (N'生产日期',     N'header',        60, 110, 1, 0, 0, N'日期'),
 (N'生产数量',     N'header',        65, 100, 1, 0, 0, N'小数'),
 (N'检测日期',     N'header',        70, 110, 1, 0, 0, N'日期'),
 (N'AQL',          N'header',        75, 80,  1, 0, 0, N'文本'),
 (N'出库单号',     N'query,header',  80, 140, 0, 0, 0, N'文本'),
 (N'出库行号',     N'header',        85, 80,  0, 0, 1, N'整数'),
 (N'成品检验单号', N'query,header',  90, 140, 0, 0, 0, N'文本'),
 (N'首件检验单号', N'header',        95, 140, 0, 0, 0, N'文本'),
 (N'制程检验单号', N'header',       100, 140, 0, 0, 0, N'文本'),
 (N'检验员',       N'query,header', 110, 100, 1, 0, 0, N'文本'),
 (N'检验结论',     N'query,header', 120, 100, 1, 0, 0, N'文本'),
 (N'单据状态',     N'query,header', 130, 90,  0, 0, 0, N'文本'),
 (N'审核人',       N'header',       140, 90,  0, 0, 0, N'文本'),
 (N'审核时间',     N'header',       150, 140, 0, 0, 0, N'文本'),
 (N'备注',         N'header',       160, 260, 1, 0, 0, N'多行文本');
DECLARE @c nvarchar(50), @p nvarchar(30), @s int, @w int, @e int, @r int, @h int, @dt nvarchar(20);
DECLARE curf CURSOR LOCAL FAST_FORWARD FOR SELECT col, place, seq, width, editable, required, hidden, dtype FROM @fh;
OPEN curf FETCH NEXT FROM curf INTO @c, @p, @s, @w, @e, @r, @h, @dt;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' AND col_name = @c)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_OQC_REPORT', @c, @c, @dt, @p, @s, @w, @e, @r, @h, CASE WHEN @h = 1 THEN 0 ELSE 1 END);
  FETCH NEXT FROM curf INTO @c, @p, @s, @w, @e, @r, @h, @dt;
END
CLOSE curf DEALLOCATE curf;
GO

/* ============ E. 字段登记(明细) ============ */
DECLARE @fd TABLE (col nvarchar(50), seq int, width int, editable int, required int, hidden int, dtype nvarchar(20));
INSERT INTO @fd VALUES
 (N'序号',       10,  60,  1, 0, 0, N'整数'),
 (N'检验项目',   20,  160, 1, 0, 0, N'多行文本'),
 (N'检验要求',   30,  300, 1, 0, 0, N'多行文本'),
 (N'检验方法',   40,  200, 1, 0, 0, N'多行文本'),
 (N'抽样标准',   50,  120, 1, 0, 0, N'文本'),
 (N'抽检量',     60,  80,  1, 0, 0, N'文本'),
 (N'测量值1',    70,  80,  1, 0, 0, N'小数'),
 (N'测量值2',    80,  80,  1, 0, 0, N'小数'),
 (N'测量值3',    90,  80,  1, 0, 0, N'小数'),
 (N'测量值4',   100,  80,  1, 0, 0, N'小数'),
 (N'测量值5',   110,  80,  1, 0, 0, N'小数'),
 (N'结果',      120,  200, 1, 0, 0, N'多行文本'),
 (N'判定',      130,  80,  1, 0, 0, N'文本'),
 (N'数据来源',  140,  160, 1, 0, 0, N'文本'),
 (N'来源项目名',150,  140, 0, 0, 1, N'文本'),
 (N'是否手填',  160,  70,  0, 0, 1, N'是否'),
 (N'行号',      170,  70,  0, 0, 1, N'文本'),
 (N'备注',      180,  160, 1, 0, 0, N'文本');
DECLARE @c2 nvarchar(50), @s2 int, @w2 int, @e2 int, @r2 int, @h2 int, @d2 nvarchar(20);
DECLARE curd CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq, width, editable, required, hidden, dtype FROM @fd;
OPEN curd FETCH NEXT FROM curd INTO @c2, @s2, @w2, @e2, @r2, @h2, @d2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' AND col_name = @c2)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_OQC_REPORT', @c2, @c2, @d2, N'detail', @s2, @w2, @e2, @r2, @h2, CASE WHEN @h2 = 1 THEN 0 ELSE 1 END);
  FETCH NEXT FROM curd INTO @c2, @s2, @w2, @e2, @r2, @h2, @d2;
END
CLOSE curd DEALLOCATE curd;
GO

/* 判定 的候选值(合格/不合格,与三张检验单的结果判断同口径) */
UPDATE yj_field
   SET dict_sql = N'SELECT v FROM (VALUES (N''合格''),(N''不合格'')) AS t(v)'
 WHERE panel_code = N'QC_OQC_REPORT' AND col_name IN (N'判定', N'检验结论')
   AND (dict_sql IS NULL OR dict_sql = N'');
GO

/* ============ F. 字段登记(对齐表面板 QC_OQC_ITEMMAP) ============ */
DECLARE @fm TABLE (col nvarchar(50), seq int, width int, editable int, required int, dtype nvarchar(20));
INSERT INTO @fm VALUES
 (N'报告项目', 10, 200, 1, 1, N'文本'),
 (N'源面板',   20, 140, 1, 0, N'下拉框'),
 (N'源表区',   30, 120, 1, 0, N'文本'),
 (N'源项目名', 40, 200, 1, 0, N'文本'),
 (N'优先级',   50, 80,  1, 0, N'整数'),
 (N'取值方式', 60, 100, 1, 0, N'下拉框'),
 (N'停用',     70, 70,  1, 0, N'是否'),
 (N'备注',     80, 200, 1, 0, N'文本');
DECLARE @c3 nvarchar(50), @s3 int, @w3 int, @e3 int, @r3 int, @d3 nvarchar(20);
DECLARE curm CURSOR LOCAL FAST_FORWARD FOR SELECT col, seq, width, editable, required, dtype FROM @fm;
OPEN curm FETCH NEXT FROM curm INTO @c3, @s3, @w3, @e3, @r3, @d3;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_OQC_ITEMMAP' AND col_name = @c3)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_OQC_ITEMMAP', @c3, @c3, @d3, N'query,detail', @s3, @w3, @e3, @r3, 0, 1);
  FETCH NEXT FROM curm INTO @c3, @s3, @w3, @e3, @r3, @d3;
END
CLOSE curm DEALLOCATE curm;
GO

UPDATE yj_field
   SET dict_sql = N'SELECT v FROM (VALUES (N''QC_ASM_INSP''),(N''QC_PROC_INSP''),(N''QC_FIRST_INSP'')) AS t(v)'
 WHERE panel_code = N'QC_OQC_ITEMMAP' AND col_name = N'源面板' AND (dict_sql IS NULL OR dict_sql = N'');
UPDATE yj_field
   SET dict_sql = N'SELECT v FROM (VALUES (N''数值''),(N''文本''),(N''勾选'')) AS t(v)'
 WHERE panel_code = N'QC_OQC_ITEMMAP' AND col_name = N'取值方式' AND (dict_sql IS NULL OR dict_sql = N'');
GO

/* ============ G. 角色授权 ============ */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'QC_OQC_REPORT', N'N', N'view,query,add,modify,modlog,del,export'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = N'QC_OQC_REPORT');
GO
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'QC_OQC_ITEMMAP', N'N', N'view,query,add,modify,modlog,del,export'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = N'QC_OQC_ITEMMAP');
GO

/* ============ H. 多语言(AGENTS.md 强制:新面板 + 新字段至少 en) ============ */
DECLARE @tp TABLE (k nvarchar(100), en nvarchar(160));
INSERT INTO @tp VALUES
 (N'出厂检验报告',     N'Factory Inspection Report'),
 (N'出厂检验项目对齐', N'Factory Inspection Item Mapping');
DECLARE @pk nvarchar(100), @pe nvarchar(160);
DECLARE curt CURSOR LOCAL FAST_FORWARD FOR SELECT k, en FROM @tp;
OPEN curt FETCH NEXT FROM curt INTO @pk, @pe;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = @pk AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', @pk, N'en', @pe, N'manual');
  FETCH NEXT FROM curt INTO @pk, @pe;
END
CLOSE curt DEALLOCATE curt;
GO

DECLARE @tf TABLE (k nvarchar(100), en nvarchar(160));
INSERT INTO @tf VALUES
 (N'AQL',          N'AQL'),
 (N'出库单号',     N'Sales Outbound No.'),
 (N'出库行号',     N'Sales Outbound Line'),
 (N'成品检验单号', N'Finished Goods Inspection No.'),
 (N'首件检验单号', N'First Article Inspection No.'),
 (N'制程检验单号', N'In-Process Inspection No.'),
 (N'检验结论',     N'Inspection Conclusion'),
 (N'抽样标准',     N'Sampling Standard'),
 (N'抽检量',       N'Sample Size'),
 (N'结果',         N'Result'),
 (N'判定',         N'Judgement'),
 (N'数据来源',     N'Data Source'),
 (N'来源项目名',   N'Source Item'),
 (N'是否手填',     N'Manually Filled'),
 (N'报告项目',     N'Report Item'),
 (N'源面板',       N'Source Panel'),
 (N'源表区',       N'Source Section'),
 (N'源项目名',     N'Source Item Name'),
 (N'优先级',       N'Priority'),
 (N'取值方式',     N'Value Type'),
 (N'序号',         N'No.'),
 (N'检验项目',     N'Inspection Item'),
 (N'检验要求',     N'Inspection Requirement'),
 (N'检验方法',     N'Inspection Method');
DECLARE @lk nvarchar(100), @le nvarchar(160);
DECLARE curtf CURSOR LOCAL FAST_FORWARD FOR SELECT k, en FROM @tf;
OPEN curtf FETCH NEXT FROM curtf INTO @lk, @le;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = @lk AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', @lk, N'en', @le, N'manual');
  FETCH NEXT FROM curtf INTO @lk, @le;
END
CLOSE curtf DEALLOCATE curtf;
GO

/* ============ I. 中文注明 ============ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_oqc_head') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
    N'出厂检验报告头表(2026-10-30:一份报告=一个产品;由销售出库勾选货物触发生成;数据取自成品/制程/首件三张检验单的并集)',
    N'SCHEMA', N'dbo', N'TABLE', N'qc_oqc_head';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_oqc_detail') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
    N'出厂检验报告行表(序号/检验项目/检验要求/检验方法/抽样标准/抽检量/测量值1..5/结果/判定/数据来源;行清单来自视图 v_oqc_std)',
    N'SCHEMA', N'dbo', N'TABLE', N'qc_oqc_detail';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_oqc_item_map') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
    N'出厂检验项目对齐表(报告项目 ← 源面板+源表区+源项目名;按优先级取第一个有值的;三张检验单的词表不同名,只能按名字对齐)',
    N'SCHEMA', N'dbo', N'TABLE', N'qc_oqc_item_map';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.v_oqc_std') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
    N'出厂检验标准层只读视图(取自《出货检验计划表》rd_insp_plan_head/_detail;不改该表任何一列;检测频率=型式检验 的行归入型式检验类)',
    N'SCHEMA', N'dbo', N'VIEW', N'v_oqc_std';
GO

DECLARE @cols TABLE (tbl sysname, col sysname, note nvarchar(400));
INSERT INTO @cols (tbl, col, note) VALUES
 (N'qc_oqc_head', N'产品编码',   N'产品身份:取自出库行 存货编码,与 bs_inv.存货编码、qc_*_insp_head.产品编码、rd_insp_plan_head.产品编号 同一体系'),
 (N'qc_oqc_head', N'批次号',     N'出库行批号;金蝶默认批号 PC0000 或空时留空,报告页会提示未填批次'),
 (N'qc_oqc_head', N'AQL',        N'接收质量限,手填(系统无 AQL 结构化数据,不自动查 GB/T 2828.1)'),
 (N'qc_oqc_head', N'出库单号',   N'生成来源:销售出库单 bd_sale_out.单据编号'),
 (N'qc_oqc_head', N'成品检验单号', N'数据主要来源:该产品的组装成品检验单(按批次号匹配,匹配不到回落最近一张已审核)'),
 (N'qc_oqc_head', N'检验结论',   N'整张报告结论:合格/不合格(由明细判定汇总,可手改)'),
 (N'qc_oqc_detail', N'抽样标准', N'手填,如 GBT2828II级 / S-2 / S-1'),
 (N'qc_oqc_detail', N'测量值1',  N'实测数值分格(用到几格填几格),来自三张检验单的测量值1..5'),
 (N'qc_oqc_detail', N'结果',     N'定性文本/勾选文本/五值拼接;首件部分只带勾选不带数值'),
 (N'qc_oqc_detail', N'数据来源', N'命中来源:形如 QC_ASM_INSP:ZJ-2026-10-0140'),
 (N'qc_oqc_detail', N'来源项目名', N'对齐表命中的三单原始项目名,便于追溯'),
 (N'qc_oqc_detail', N'是否手填', N'1=三单取不到、由品质手填'),
 (N'qc_oqc_item_map', N'报告项目', N'报告上印的检验项目名(客户验收用语)'),
 (N'qc_oqc_item_map', N'源面板',   N'QC_ASM_INSP / QC_PROC_INSP / QC_FIRST_INSP'),
 (N'qc_oqc_item_map', N'源表区',   N'三单的分区列:首件/制程用 表区,组装成品用 检验类型'),
 (N'qc_oqc_item_map', N'优先级',   N'数值越小越先取;按优先级顺序找第一个"有值"的'),
 (N'qc_oqc_item_map', N'取值方式', N'数值(测量值1..5) / 文本(实测数值/检验结果) / 勾选(首件勾选项)');
DECLARE @t2 sysname, @c4 sysname, @n2 nvarchar(400);
DECLARE curc CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, note FROM @cols;
OPEN curc FETCH NEXT FROM curc INTO @t2, @c4, @n2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.' + @t2)
                   AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @t2), @c4, 'ColumnId')
                   AND name = N'MS_Description' AND class = 1)
    EXEC sp_addextendedproperty N'MS_Description', @n2, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', @c4;
  FETCH NEXT FROM curc INTO @t2, @c4, @n2;
END
CLOSE curc DEALLOCATE curc;
GO

/* ============ J. 自检 ============ */
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.qc_oqc_head', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.qc_oqc_detail', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.qc_oqc_item_map', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.v_oqc_std', N'V') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_OQC_REPORT') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'QC_OQC_ITEMMAP') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' AND place LIKE N'%header%') < 20 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' AND place LIKE N'%detail%') < 15 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_OQC_ITEMMAP' AND place LIKE N'%detail%') < 8 SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_head', N'asp_cancel') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_oqc_detail', N'asp_cancel') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_oqc_head') AND minor_id = 0 AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_oqc_detail') AND minor_id = 0 AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.qc_oqc_item_map') AND minor_id = 0 AND name = N'MS_Description') = 0 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'出厂检验报告' AND locale = N'en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'抽样标准' AND locale = N'en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'数据来源' AND locale = N'en') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = N'QC_OQC_REPORT') = 0 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'出厂检验报告迁移自检失败(缺表/缺视图/缺面板/缺字段/缺注明/缺译名/缺授权)', 16, 1);
ELSE PRINT N'出厂检验报告就绪(QC_OQC_REPORT / qc_oqc_head / qc_oqc_detail / qc_oqc_item_map / v_oqc_std)';
GO
