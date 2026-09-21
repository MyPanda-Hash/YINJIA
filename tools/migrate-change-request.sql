/* ═══════════════════════════════════════════════════════════════════════════════
   migrate-change-request.sql — 产品变更申请单(RD_CHANGE)数据层(2026-09-21)

   用户口径:产品变更在系统里以「变更申请单」走完整线上流程(替代目前仅上传附件的做法):
     ① 发起人创建变更申请单,填写变更原因、验证数据及其他相关信息;
     ② 按产品编号(唯一)关联该产品的**四个受控文件**(成型工艺清单/组装工艺清单/规格书/出货检验计划表),
        勾选本次需要变更的文件,并选择**原料/半成品/成品**的处理方式;
     ③ 各部门按各自账号分工填写本部门对应栏目(每人只能改自己填写的内容),留「变更后内容」可编辑区;
     ④ 变更涉及范围较大时由相关人员**会签**;
     ⑤ 填写完提交冯总(admin)审核,**审核通过后生效**:对应受控文件据此**自动建下一版草稿**
        (带「变更来源单号」标记)+ 通知各文件责任人重走受控审核。
   版式基础:《产品开发\…\副本变更模板(1).xlsx》sheet「KPC变更申请通知单」(YJ-QR-130)
     —— 基础信息 / 变更·新增申请事由 / 部门评审意见(7 部门)/ 相关变更 / 库存产品处理方式 / 批准。

   本脚本只做**数据层**(面板 + 表 + 字段 + 译名 + 权限行):
     §1 rd_change_head / rd_change_detail 建表(带中文注释)
     §2 rd_change_detail 补 [表区](部门评审/会签 分块,与文书面板同款物理列口径)
     §3 yj_panel 注册面板(doc 模式,前缀 CHG,模块 研发管理)
     §4 yj_field 头字段 + 明细字段(label 即数据键)
     §5 译名(至少 en + 其余 9 语言)
     §6 yj_role_panel 权限行(普通用户:view/query/add/modify/modlog/del/export/print)
   流程/门禁/会签/生效钩子在 ButtonService(下一步),本脚本不写业务逻辑。

   幂等:建表 IF OBJECT_ID IS NULL;列 IF COL_LENGTH IS NULL;元数据行 NOT EXISTS;权限行 NOT EXISTS。
   用法:java -cp lib\mssql-jdbc.jar SqlRunner.java <jdbcUrl> yinjia env tools\migrate-change-request.sql
   ═══════════════════════════════════════════════════════════════════════════════ */
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 1. 建表:头表 rd_change_head + 行表 rd_change_detail
-- ═══════════════════════════════════════════════════════════════════
IF OBJECT_ID('rd_change_head') IS NULL
BEGIN
  CREATE TABLE rd_change_head (
    id              int IDENTITY(1,1) PRIMARY KEY,
    单据编号        nvarchar(120) NULL,
    单据日期        nvarchar(40)  NULL,
    申请部门        nvarchar(100) NULL,
    性质            nvarchar(20)  NULL,   -- 变更 / 新增(YJ-QR-130 的 □变更 □新增)
    产品编号        nvarchar(100) NULL,   -- 关联四受控文件的唯一键
    产品名称        nvarchar(200) NULL,
    申请人          nvarchar(100) NULL,
    申请日期        nvarchar(40)  NULL,
    变更事由        nvarchar(2000) NULL,  -- 二、变更/新增申请事由(用户口径的"变更原因")
    验证数据        nvarchar(2000) NULL,  -- 用户口径新增:验证数据
    相关变更        nvarchar(2000) NULL,  -- 三、相关变更
    变更文件        nvarchar(200) NULL,   -- 勾选的受控文件(顿号分隔:成型工艺清单、规格书…)
    需会签          nvarchar(10)  NULL,   -- 是 / 否(范围较大时由相关人员会签)
    会签人          nvarchar(400) NULL,   -- 账号,逗号分隔(发起人选)
    原料数量        nvarchar(50)  NULL,
    原料处理方式    nvarchar(50)  NULL,
    半成品数量      nvarchar(50)  NULL,
    半成品处理方式  nvarchar(50)  NULL,
    成品数量        nvarchar(50)  NULL,
    成品处理方式    nvarchar(50)  NULL,
    变更来源单号    nvarchar(120) NULL,   -- 由本单生效生成的下一版草稿,回填其来源(审计线索)
    备注            nvarchar(1000) NULL,
    密级            nvarchar(40)  NULL,
    文件管理人      nvarchar(100) NULL,
    文件使用范围    nvarchar(120) NULL,
    asp_user1       nvarchar(100) NULL,
    asp_time1       datetime2     NULL,
    asp_user2       nvarchar(100) NULL,
    asp_time2       datetime2     NULL,
    asp_cancel      char(1)       NULL
  );
  PRINT N'已建表 rd_change_head';
END
ELSE PRINT N'rd_change_head 已存在,跳过';
GO
IF OBJECT_ID('rd_change_detail') IS NULL
BEGIN
  CREATE TABLE rd_change_detail (
    id            int IDENTITY(1,1) PRIMARY KEY,
    单据编号      nvarchar(120) NULL,
    表区          nvarchar(20)  NULL,   -- 部门评审 / 会签
    部门          nvarchar(60)  NULL,
    变更后内容    nvarchar(2000) NULL,  -- 各部门填的"变更后内容"可编辑区
    签字          nvarchar(60)  NULL,
    日期          nvarchar(40)  NULL,
    备注          nvarchar(500) NULL,
    asp_user1     nvarchar(100) NULL,
    asp_time1     datetime2     NULL,
    asp_user2     nvarchar(100) NULL,
    asp_time2     datetime2     NULL,
    asp_cancel    char(1)       NULL
  );
  PRINT N'已建表 rd_change_detail';
END
ELSE PRINT N'rd_change_detail 已存在,跳过';
GO
-- 行表补 [表区](已存在库上补列;新建表已带,COL_LENGTH 幂等)
IF OBJECT_ID('rd_change_detail') IS NOT NULL AND COL_LENGTH('rd_change_detail', N'表区') IS NULL
  ALTER TABLE rd_change_detail ADD [表区] nvarchar(20) NULL;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 2. 表/列中文注释(MS_Description;已有不覆盖)
-- ═══════════════════════════════════════════════════════════════════
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('rd_change_head') AND minor_id=0 AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'产品变更申请单头表(照《副本变更模板(1).xlsx》sheet「KPC变更申请通知单」YJ-QR-130;产品编号关联四受控文件,部门评审在行表)',
       N'SCHEMA',N'dbo',N'TABLE',N'rd_change_head';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('rd_change_detail') AND minor_id=0 AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'产品变更申请单行表(表区=部门评审:7 部门各一行,部门/变更后内容/签字/日期)',
       N'SCHEMA',N'dbo',N'TABLE',N'rd_change_detail';
GO

-- ═══════════════════════════════════════════════════════════════════
-- 3. yj_panel 注册面板(doc 模式;前缀 CHG)
-- ═══════════════════════════════════════════════════════════════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'RD_CHANGE')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
  VALUES (N'RD_CHANGE', N'产品变更申请单', N'单据', N'doc', N'rd_change_detail', N'rd_change_head', N'单据编号', N'id', N'单据编号', N'CHG', N'单据日期', 20, N'items', N'研发管理', N'Product Change Request');
GO

-- ═══════════════════════════════════════════════════════════════════
-- 4. yj_field(label 即数据键;头字段 place='header',部门评审 place='detail')
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                      place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.dict_sql, v.ref_panel, v.ref_field, v.display_field,
       v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  -- 一、基础信息
  ('RD_CHANGE', N'单据编号',     N'单据编号',     N'文本',   NULL, NULL, NULL, NULL, N'header',  10, 140, 0, 1, 0, 1),
  ('RD_CHANGE', N'单据日期',     N'单据日期',     N'日期',   NULL, NULL, NULL, NULL, N'header',  20, 120, 1, 1, 0, 1),
  ('RD_CHANGE', N'申请部门',     N'申请部门',     N'文本',   NULL, NULL, NULL, NULL, N'header',  30, 140, 1, 0, 0, 1),
  ('RD_CHANGE', N'性质',         N'性质',         N'下拉框', N'SELECT v FROM (VALUES (N''变更''),(N''新增'')) AS t(v)', NULL, NULL, NULL, N'header', 35, 100, 1, 0, 0, 1),
  ('RD_CHANGE', N'产品编号',     N'产品编号',     N'参照',   NULL, N'RD_PROD_INFO', N'产品编号', N'产品名称', N'header', 40, 160, 1, 1, 0, 1),
  ('RD_CHANGE', N'产品名称',     N'产品名称',     N'文本',   NULL, NULL, NULL, NULL, N'header',  45, 180, 1, 0, 0, 1),
  ('RD_CHANGE', N'申请人',       N'申请人',       N'文本',   NULL, NULL, NULL, NULL, N'header',  50, 120, 0, 0, 0, 1),
  ('RD_CHANGE', N'申请日期',     N'申请日期',     N'日期',   NULL, NULL, NULL, NULL, N'header',  55, 120, 1, 0, 0, 1),
  -- 二、变更/新增申请事由
  ('RD_CHANGE', N'变更事由',     N'变更事由',     N'文本',   NULL, NULL, NULL, NULL, N'header',  60, 200, 1, 0, 0, 1),
  ('RD_CHANGE', N'验证数据',     N'验证数据',     N'文本',   NULL, NULL, NULL, NULL, N'header',  65, 200, 1, 0, 0, 1),
  -- 本次需要变更的受控文件(勾选,顿号分隔写入)
  ('RD_CHANGE', N'变更文件',     N'变更文件',     N'文本',   NULL, NULL, NULL, NULL, N'header',  70, 200, 1, 0, 0, 1),
  -- 三、相关变更
  ('RD_CHANGE', N'相关变更',     N'相关变更',     N'文本',   NULL, NULL, NULL, NULL, N'header',  80, 200, 1, 0, 0, 1),
  -- 会签(范围较大时):是否 + 会签人账号
  ('RD_CHANGE', N'需会签',       N'需会签',       N'下拉框', N'SELECT v FROM (VALUES (N''否''),(N''是'')) AS t(v)', NULL, NULL, NULL, N'header', 90, 80, 1, 0, 0, 1),
  ('RD_CHANGE', N'会签人',       N'会签人',       N'文本',   NULL, NULL, NULL, NULL, N'header',  95, 200, 1, 0, 0, 1),
  -- 四、库存产品处理方式(原料/半成品/成品)
  ('RD_CHANGE', N'原料数量',     N'原料数量',     N'文本',   NULL, NULL, NULL, NULL, N'header', 100, 90, 1, 0, 0, 1),
  ('RD_CHANGE', N'原料处理方式', N'原料处理方式', N'下拉框', N'SELECT v FROM (VALUES (N''继续使用''),(N''返工''),(N''报废''),(N''降级''),(N''待定'')) AS t(v)', NULL, NULL, NULL, N'header', 105, 120, 1, 0, 0, 1),
  ('RD_CHANGE', N'半成品数量',   N'半成品数量',   N'文本',   NULL, NULL, NULL, NULL, N'header', 110, 90, 1, 0, 0, 1),
  ('RD_CHANGE', N'半成品处理方式', N'半成品处理方式', N'下拉框', N'SELECT v FROM (VALUES (N''继续使用''),(N''返工''),(N''报废''),(N''降级''),(N''待定'')) AS t(v)', NULL, NULL, NULL, N'header', 115, 120, 1, 0, 0, 1),
  ('RD_CHANGE', N'成品数量',     N'成品数量',     N'文本',   NULL, NULL, NULL, NULL, N'header', 120, 90, 1, 0, 0, 1),
  ('RD_CHANGE', N'成品处理方式', N'成品处理方式', N'下拉框', N'SELECT v FROM (VALUES (N''继续使用''),(N''返工''),(N''报废''),(N''降级''),(N''待定'')) AS t(v)', NULL, NULL, NULL, N'header', 125, 120, 1, 0, 0, 1),
  -- 归档/文书面板通用
  ('RD_CHANGE', N'密级',         N'密级',         N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 130, 100, 1, 0, 0, 1),
  ('RD_CHANGE', N'文件管理人',   N'文件管理人',   N'文本',   NULL, NULL, NULL, NULL, N'header', 140, 120, 1, 0, 0, 1),
  ('RD_CHANGE', N'文件使用范围', N'文件使用范围', N'下拉框', N'SELECT v FROM (VALUES (N''公司内''),(N''客户项目组''),(N''双方项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 150, 140, 1, 0, 0, 1),
  -- 生效回填:由本单生成的下一版草稿单号(只读)
  ('RD_CHANGE', N'变更来源单号', N'变更来源单号', N'文本',   NULL, NULL, NULL, NULL, N'header', 160, 140, 0, 0, 0, 1),
  ('RD_CHANGE', N'备注',         N'备注',         N'文本',   NULL, NULL, NULL, NULL, N'header', 170, 200, 1, 0, 0, 1),
  -- 明细:部门评审(表区物理分块列 + 四列)
  ('RD_CHANGE', N'表区',         N'表区',         N'文本',   NULL, NULL, NULL, NULL, N'detail',   4,  90, 1, 0, 0, 1),
  ('RD_CHANGE', N'部门',         N'部门',         N'文本',   NULL, NULL, NULL, NULL, N'detail',  10, 140, 1, 0, 0, 1),
  ('RD_CHANGE', N'变更后内容',   N'变更后内容',   N'文本',   NULL, NULL, NULL, NULL, N'detail',  20, 380, 1, 0, 0, 1),
  ('RD_CHANGE', N'签字',         N'签字',         N'文本',   NULL, NULL, NULL, NULL, N'detail',  30, 120, 1, 0, 0, 1),
  ('RD_CHANGE', N'日期',         N'日期',         N'文本',   NULL, NULL, NULL, NULL, N'detail',  40, 120, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                   WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

-- ═══════════════════════════════════════════════════════════════════
-- 5. 译名(scope='field',按中文标签全局共享;已有译名的标签不重复插入)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', v.label, v.locale, v.text, 'manual'
FROM (VALUES
 (N'产品变更申请单','en',N'Product Change Request'), (N'产品变更申请单','zh-TW',N'產品變更申請單'), (N'产品变更申请单','ja',N'製品変更申請書'),
 (N'申请部门','en',N'Requesting Dept.'), (N'申请部门','ja',N'申請部門'),
 (N'性质','en',N'Nature'), (N'性质','ja',N'性質'),
 (N'变更事由','en',N'Change Reason'), (N'变更事由','ja',N'変更理由'),
 (N'验证数据','en',N'Verification Data'), (N'验证数据','ja',N'検証データ'),
 (N'变更文件','en',N'Documents to Change'), (N'变更文件','ja',N'変更対象文書'),
 (N'相关变更','en',N'Related Changes'), (N'相关变更','ja',N'関連変更'),
 (N'需会签','en',N'Countersign Required'), (N'需会签','ja',N'会簽が必要'),
 (N'会签人','en',N'Countersigners'), (N'会签人','ja',N'会簽者'),
 (N'原料数量','en',N'Raw Material Qty'), (N'原料处理方式','en',N'Raw Material Disposition'),
 (N'半成品数量','en',N'Semi-finished Qty'), (N'半成品处理方式','en',N'Semi-finished Disposition'),
 (N'成品数量','en',N'Finished Goods Qty'), (N'成品处理方式','en',N'Finished Goods Disposition'),
 (N'变更后内容','en',N'Content After Change'), (N'变更后内容','ja',N'変更後内容'),
 (N'变更来源单号','en',N'Source Change No.')
) AS v(label, locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope='field' AND x.ref_key=v.label AND x.locale=v.locale);
GO

-- ═══════════════════════════════════════════════════════════════════
-- 6. 权限行(普通用户:读/查/增/改/修改记录/删/导出打印;审批权归管理员/审批人)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, N'RD_CHANGE', N'view,query,add,modify,modlog,del,export,print', 'N'
FROM yj_role r
WHERE r.role_code = N'user'
  AND NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = N'RD_CHANGE');
GO

-- ═══════════════════════════════════════════════════════════════════
-- 7. 校验输出
-- ═══════════════════════════════════════════════════════════════════
SELECT N'rd_change_head' AS 检查项, CAST(COUNT(*) AS nvarchar) AS 值 FROM sys.columns WHERE object_id=OBJECT_ID('rd_change_head')
UNION ALL SELECT N'rd_change_detail', CAST(COUNT(*) AS nvarchar) FROM sys.columns WHERE object_id=OBJECT_ID('rd_change_detail')
UNION ALL SELECT N'yj_panel RD_CHANGE', CAST(COUNT(*) AS nvarchar) FROM yj_panel WHERE panel_code=N'RD_CHANGE'
UNION ALL SELECT N'yj_field RD_CHANGE(header)', CAST(COUNT(*) AS nvarchar) FROM yj_field WHERE panel_code=N'RD_CHANGE' AND place=N'header'
UNION ALL SELECT N'yj_field RD_CHANGE(detail)', CAST(COUNT(*) AS nvarchar) FROM yj_field WHERE panel_code=N'RD_CHANGE' AND place=N'detail'
UNION ALL SELECT N'yj_role_panel RD_CHANGE', CAST(COUNT(*) AS nvarchar) FROM yj_role_panel WHERE panel_code=N'RD_CHANGE';
GO
PRINT N'migrate-change-request.sql 完成:产品变更申请单数据层(RD_CHANGE + 头/行表 + 字段 + 译名 + 权限)';
GO
