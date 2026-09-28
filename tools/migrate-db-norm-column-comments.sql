-- migrate-db-norm-column-comments.sql — 阶段 2:拼音/英文列名的列补中文注明(2026-09-28)
-- 依据:《数据库规范》§2.1/§7 阶段 2;清单由 tools/verify/DbNormAudit.java 导出
--   java -cp lib\mssql-jdbc.jar verify/DbNormAudit.java dump=%TEMP%\cols.txt
--
-- 三条据实规则(不臆造语义):
--   ① 字典命中:引擎列(yj_ 元数据/日志/状态机)与通用英文列 —— 语义取自
--      docs/backend/后端逻辑设计.md、docs/development/数据库表清单.md 与本表实际用法;
--   ② 面板标签:该列名在某面板注册的 label 若与列名不同(即有中文名),直接采用「<标签>(面板字段列)」;
--   ③ 遗留空列:非 yj_ 前缀的业务表里,该列**全表为空**且无面板字段引用 ——
--      如实写为"历史遗留英文列(无面板引用、本表该列全空),《数据库规范》阶段 3 清理候选",不编造业务含义。
--   ④ 其余(有数据又无标签又不在字典)→ 不写,末尾打印"未覆盖"清单交人工。
--
-- 范围:与体检 03 项同口径 —— 规范前缀表(yj_/bs_/bd_/bl_/rd_/qc_/wo_)、非备份/临时、非 asp_*/id、
--       列名不含中文、无 MS_Description。冻结登记表(遗留/拼音)不在范围内。
-- 幂等:已有 MS_Description 的列一律跳过,可重跑。
IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ===== 字典(按列名匹配;覆盖引擎列与通用英文列)=====
DECLARE @dict TABLE (col sysname PRIMARY KEY, descr nvarchar(300));
INSERT INTO @dict (col, descr) VALUES
 -- yj_panel
 (N'panel_code', N'面板编码(=业务主键;yj_field/yj_doc_status/yj_role_panel 等按此关联)'),
 (N'panel_name', N'面板中文名(同时也是译名键 yj_translation.ref_key,scope=''panel'')'),
 (N'panel_name_en', N'面板英文名(译名旁路冗余列)'),
 (N'category', N'面板类别(单据 / 基础档案 / 报表)'),
 (N'mode', N'面板模式:doc 单据 / archive 单单据档案 / flat 报表'),
 (N'line_table', N'行表(或视图)名;报表类面板可指向视图'),
 (N'head_table', N'头表名(头行式面板才有)'),
 (N'group_col', N'单号分组列(单据按此列聚成一单)'),
 (N'pk_col', N'主键列(列表行键)'),
 (N'code_col', N'业务单号列(唯一性校验与展示用)'),
 (N'prefix', N'单据编号前缀(取号池 s_allno 按此前缀续号)'),
 (N'date_col', N'单据日期列'),
 (N'page_size', N'列表每页行数'),
 (N'detail_key', N'明细页签键(必须与接口返回的 detail.<key> 一致)'),
 (N'module_group', N'模块分组(菜单与角色授权按此分组)'),
 (N'config', N'面板附加配置(JSON;前端表格/页签等个性化配置)'),
 (N'config_at', N'面板配置写入时间'),
 -- yj_field
 (N'col_name', N'物理列名(必须与目标表/视图的实列一致)'),
 (N'label', N'中文标签(=前端数据键,永不翻译;ADR-0001)'),
 (N'data_type', N'数据类型(文本 / 整数 / 小数 / 日期;决定默认控件)'),
 (N'dict_sql', N'下拉选项 SQL(执行取首列作选项)'),
 (N'ref_panel', N'参照来源面板编码(参照字段才有)'),
 (N'ref_field', N'参照回填字段(用引用面板的中文标签,非列名)'),
 (N'display_field', N'参照下拉/弹窗的显示字段'),
 (N'place', N'出现位置(逗号复合值:query / header / detail)'),
 (N'seq', N'排序号(列表列序与表单字段序)'),
 (N'width', N'列宽(px)'),
 (N'editable', N'是否可编辑(1 可编辑 / 0 只读)'),
 (N'required', N'是否必填(1 必填 / 0 选填)'),
 (N'hidden', N'是否隐藏(1 隐藏,表单不渲染)'),
 (N'alias', N'列头显示别名(只影响显示,不改数据键)'),
 (N'visible', N'是否在表格显示(0 = 后端直接排除该列)'),
 (N'label_en', N'英文标签(译名旁路冗余列)'),
 (N'col_group', N'列分组(表格列分组/单据明细分组)'),
 (N'ref_filter', N'参照过滤条件'),
 -- yj_doc_status(状态机留痕,9 态优先级链)
 (N'doc_no', N'单据编号(与 panel_code 组成单据唯一标识)'),
 (N'shr', N'审核人(已审核标志:非空即已审核)'),
 (N'shsj', N'审核时间'),
 (N'canceled', N'作废标志(Y=已作废,优先级最高)'),
 (N'cancel_by', N'作废操作人'),
 (N'cancel_at', N'作废时间'),
 (N'pending', N'审批中标志(Y=审批中)'),
 (N'pending_by', N'提交审批人'),
 (N'pending_at', N'提交审批时间'),
 (N'stopped', N'中止标志(Y=已中止)'),
 (N'stop_by', N'中止操作人'),
 (N'stop_at', N'中止时间'),
 (N'saved', N'是否存过一次(Y=提交保存过 / N=新增未保存或保存为草稿)'),
 (N'archived', N'归档标志(Y=保存即归档的文书单)'),
 (N'archived_at', N'首次归档时间(仅首次写入,查询时间区间口径)'),
 (N'deleting', N'删除申请中标志(Y=已提交删除申请)'),
 (N'delete_req_by', N'删除申请人'),
 (N'delete_req_at', N'删除申请时间'),
 (N'modify_state', N'修改态(R=修改申请中 / Y=修改中;收尾置 NULL)'),
 (N'modify_req_by', N'修改申请人'),
 (N'modify_req_at', N'修改申请时间'),
 (N'modify_appr_by', N'修改审批人'),
 (N'modify_appr_at', N'修改审批时间'),
 (N'l2_approver', N'二级审批人(两级审批面板)'),
 (N'effective', N'生效标志'),
 (N'erp_close_state', N'ERP 关单状态(金蝶关单 S / 手工关单 H)'),
 (N'update_at', N'本行最后更新时间'),
 -- yj_translation / yj_locale
 (N'scope', N'翻译作用域(panel 面板名 / field 字段标签 / ui 界面词条)'),
 (N'ref_key', N'中文键(面板名或字段标签原样)'),
 (N'locale', N'语言码(zh-CN/en/ja/ko/de/es/fr/ru/vi/th/zh-TW)'),
 (N'text', N'该语言的译文'),
 (N'source', N'译名来源(mt 机器翻译 / manual 人工校对,manual 优先)'),
 (N'updated_at', N'最后更新时间'),
 (N'created_at', N'创建时间'),
 (N'name_zh', N'语言中文名(语言切换器显示)'),
 (N'name_native', N'语言本地名'),
 (N'enabled', N'是否启用(0 = 停用)'),
 (N'sort', N'排序号'),
 -- yj_usage_log
 (N'event_type', N'事件类型(login 登录 / action 面板操作)'),
 (N'action_name', N'动作名(新增/保存/审核/删除等;纯浏览动作不记)'),
 (N'ip', N'来源 IP'),
 -- yj_schema_log
 (N'script_name', N'迁移脚本名(相对 tools;主键)'),
 (N'content_hash', N'脚本内容 SHA-256(与当前文件不一致即判为"内容已变,重跑")'),
 (N'applied_at', N'执行/登记时间'),
 -- yj_doc_modify_log(归档单修改留痕)
 (N'changes', N'修改内容明细'),
 (N'change_meta', N'修改元数据(字段级差异快照)'),
 (N'snapshot_head', N'修改前头字段快照'),
 (N'snapshot_rows', N'修改前行数据快照'),
 (N'apply_by', N'修改申请人'),
 (N'apply_at', N'修改申请时间'),
 (N'approve_by', N'修改审批人'),
 (N'approve_at', N'修改审批时间'),
 (N'rearchive_by', N'重新归档操作人'),
 (N'rearchive_at', N'重新归档时间'),
 -- yj_plan_term(阶段中止/恢复申请)
 (N'reason', N'申请原因'),
 (N'state', N'条款状态(申请中/已批准/已驳回)'),
 (N'req_by', N'申请人'),
 (N'req_at', N'申请时间'),
 (N'p1_by', N'一级审批人'),
 (N'p1_at', N'一级审批时间'),
 (N'p2_by', N'二级审批人'),
 (N'p2_at', N'二级审批时间'),
 -- yj_attachment(单据附件)
 (N'file_name', N'原文件名(保留用户上传时的名字)'),
 (N'stored_name', N'磁盘存储名(防重名)'),
 (N'file_size', N'文件字节数'),
 (N'content_type', N'文件 MIME 类型'),
 (N'field_key', N'附件所属字段键(面板字段标签)'),
 -- yj_form_approval(审批留痕)
 (N'form_no', N'单据号'),
 (N'action', N'审批动作(SUBMIT/APPROVE/REJECT/UNAUDIT/STOP/… 见后端逻辑设计 §5)'),
 (N'operator', N'操作人'),
 (N'result', N'动作结果'),
 (N'opinion', N'审批意见(驳回时必填)'),
 (N'node_no', N'审批节点序号'),
 (N'create_time', N'记录时间'),
 -- yj_role / yj_role_panel / yj_user / yj_dept
 (N'role_code', N'角色编码'),
 (N'role_name', N'角色名称'),
 (N'is_admin', N'是否管理员(Y=管理员,享有全部面板与审批权)'),
 (N'perms', N'操作权限词表(view/query/add/edit/delete/export/print/audit/price/review/adjust)'),
 (N'can_approve', N'是否授予该面板的审批权'),
 (N'username', N'登录名'),
 (N'password_hash', N'口令哈希(PBKDF2-HMAC-SHA256,yj1 前缀方案,见 ADR-0005)'),
 (N'dept_id', N'所属部门(关联 yj_dept.id)'),
 (N'role_id', N'所属角色(关联 yj_role.id)'),
 (N'dept_name', N'部门名称'),
 (N'parent_id', N'上级 ID(树形结构的父节点)'),
 -- yj_std_lib / yj_report_template / yj_doc_batch / yj_share_file_cat
 (N'lib_code', N'标准库编码(如 spec.test,面板按库取内容片段)'),
 (N'item_code', N'库内条目编码(项目名)'),
 (N'content', N'条目内容片段(JSON 或纯文本,供文书面板引用)'),
 (N'template_code', N'报表模板编码(唯一)'),
 (N'create_by', N'创建人'),
 (N'create_at', N'创建时间'),
 (N'update_by', N'最后修改人'),
 (N'release_time', N'批次释放时间'),
 (N'source_panel_code', N'来源面板编码(批次转单)'),
 (N'target_panel_code', N'目标面板编码(批次转单)'),
 (N'cat_name', N'分类名称'),
 -- 通用英文列(遗留表沿用;有数据者据此说明)
 (N'comm', N'备注/说明(遗留英文列名)'),
 (N'notes', N'备注(遗留英文列名)'),
 (N'remark', N'备注'),
 (N'unit', N'单位'),
 (N'tester', N'测试人/检验人'),
 (N'test_date', N'测试日期'),
 (N'product_code', N'产品编码'),
 (N'record_no', N'记录编号'),
 (N'sample_name', N'样品名称'),
 (N'sample_no', N'样品编号'),
 (N'doc_name', N'单据名称'),
 (N'version', N'版本号'),
 (N'user_name', N'账号/用户名'),
 (N'real_name', N'姓名'),
 (N'use_date', N'使用日期'),
 (N'end_time', N'结束时间'),
 (N'flow_rate', N'流速'),
 (N'pressure', N'压力'),
 (N'file_path', N'文件路径'),
 (N'status', N'状态');

-- ===== 逐列补注明(三条规则;与字典必须同批次 —— 表变量不跨 GO)=====
DECLARE @tb sysname, @col sysname, @descr nvarchar(300), @n bigint, @sql nvarchar(400), @done int = 0;
DECLARE @on sysname, @ot sysname, @od nvarchar(300);
DECLARE @left TABLE (tbl sysname, col sysname, why nvarchar(50));

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT t.name, c.name FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
  WHERE (t.name LIKE 'yj[_]%' OR t.name LIKE 'bs[_]%' OR t.name LIKE 'bd[_]%' OR t.name LIKE 'bl[_]%'
      OR t.name LIKE 'rd[_]%' OR t.name LIKE 'qc[_]%' OR t.name LIKE 'wo[_]%')
    AND t.name NOT LIKE '%bak%' AND t.name NOT LIKE 'RENAME%' AND t.name NOT LIKE 'tmp%' AND t.name NOT LIKE 't[0-9]'
    AND c.name NOT LIKE 'asp[_]%' AND c.name <> 'id'
    AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                    WHERE ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description')
  ORDER BY t.name, c.column_id;

OPEN cur;
FETCH NEXT FROM cur INTO @tb, @col;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @descr = NULL;
  -- 规则①:字典
  SELECT @descr = descr FROM @dict WHERE col = @col;
  -- 规则②:面板中文标签(标签与列名不同者即为中文名;不依赖排序规则做中文判定)
  IF @descr IS NULL
    SELECT TOP 1 @descr = label + N'(面板字段列)' FROM yj_field
    WHERE col_name = @col AND label <> col_name ORDER BY id;
  -- 规则③:业务表里的"全空遗留列"(仅非 yj_ 前缀)
  IF @descr IS NULL AND @tb NOT LIKE 'yj[_]%'
  BEGIN
    SET @sql = N'SELECT @n = COUNT(*) FROM ' + QUOTENAME(@tb) + N' WHERE ' + QUOTENAME(@col) + N' IS NOT NULL';
    EXEC sp_executesql @sql, N'@n bigint OUTPUT', @n OUTPUT;
    IF @n = 0
      SET @descr = N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选';
  END
  IF @descr IS NOT NULL
  BEGIN
    SET @on = @col; SET @ot = @tb; SET @od = @descr;
    EXEC sp_addextendedproperty N'MS_Description', @od, N'SCHEMA', N'dbo', N'TABLE', @ot, N'COLUMN', @on;
    SET @done = @done + 1;
  END
  ELSE
    INSERT INTO @left VALUES (@tb, @col, N'需人工');
  FETCH NEXT FROM cur INTO @tb, @col;
END
CLOSE cur; DEALLOCATE cur;

PRINT N'阶段 2 列注明:已补 ' + CAST(@done AS nvarchar(10)) + N' 列';
SELECT COUNT(*) AS 未覆盖列数 FROM @left;
SELECT TOP 30 tbl AS 表, col AS 列 FROM @left ORDER BY tbl, col;
GO
