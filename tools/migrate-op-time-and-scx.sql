-- migrate-op-time-and-scx.sql — ①工序工时(gxgs)面板化 ②dm_gx 产线层级补进 bs_dict(2026-09-21)
-- 依据(用户 2026-09-21 拍板):
--   ①参考库「工序工时」gxgs(71 列,现库已有该表与全部中文注明,仅缺面板/字段/译名)——按 客户×物料×工序
--     维护 换线时间/标准·最快·最慢·平均时间/加工单价/模具代码/并序 7 组/加工条件/预设机台/作业流程;
--     是"排产产能"与"计件工资/加工单价"的主数据来源。
--   ②参考库 dm_gx(lb='SCX') 是「部门→车间→产线」层级字典,当前 bs_dict.SCX 只落了叶子产线,
--     缺 106 生产部 / 10601 挂镀车间 / 10602 连续镀车间 三个父节点(去重后参考库 15 条 vs 当前 12 条)。
-- 幂等:IF NOT EXISTS / 动态 SQL 守卫,可重复执行。
SET NOCOUNT ON;

/* ============ A. 工序工时面板 OP_TIME(表 gxgs 已存在,只补面板与字段) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='OP_TIME')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
  VALUES ('OP_TIME', N'工序工时', N'基础档案', 'archive', 'gxgs', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'opTime', N'基础设置');

-- 核心字段(标签取库内 MS_Description 原名;代码/工序/客户/生产线尽量走参照与字典)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'dm') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'dm',N'代码',N'参照',NULL,N'INV',N'存货编码',N'存货名称',N'query,detail',10,130,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'mc') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'mc',N'款号名称',N'文本',NULL,NULL,NULL,NULL,N'query,detail',20,160,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'khdm') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'khdm',N'客户代码',N'参照',NULL,N'PARTNER',N'往来单位编码',N'往来单位名称',N'query,detail',30,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'xc') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'xc',N'项次',N'整数',NULL,NULL,NULL,NULL,N'detail',40,70,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'gxdm') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'gxdm',N'工序代码',N'参照',NULL,N'OP',N'工序编码',N'工序名称',N'query,detail',50,120,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'gxmc') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'gxmc',N'工序名称',N'文本',NULL,NULL,NULL,NULL,N'query,detail',60,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'gxsm') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'gxsm',N'工序说明',N'文本',NULL,NULL,NULL,NULL,N'detail',70,160,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'hxsj') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'hxsj',N'换线时间',N'小数',NULL,NULL,NULL,NULL,N'detail',80,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'bzsj') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'bzsj',N'标准时间',N'小数',NULL,NULL,NULL,NULL,N'detail',90,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'zksj') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'zksj',N'最快时间',N'小数',NULL,NULL,NULL,NULL,N'detail',100,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'zmsj') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'zmsj',N'最慢时间',N'小数',NULL,NULL,NULL,NULL,N'detail',110,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'pjsj') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'pjsj',N'平均时间',N'小数',NULL,NULL,NULL,NULL,N'query,detail',120,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'jgdj') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'jgdj',N'加工单价',N'小数',NULL,NULL,NULL,NULL,N'query,detail',130,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'jgdj2') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'jgdj2',N'加工单价2',N'小数',NULL,NULL,NULL,NULL,N'detail',140,100,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'sfbx') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'sfbx',N'是否并序',N'是否',NULL,NULL,NULL,NULL,N'detail',150,80,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'mjdm') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'mjdm',N'模具代码',N'文本',NULL,NULL,NULL,NULL,N'detail',160,110,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'gxtj') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'gxtj',N'加工条件',N'文本',NULL,NULL,NULL,NULL,N'detail',170,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'scx') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'scx',N'生产线',N'下拉框',N'SELECT 名称 FROM bs_dict WHERE 字典类别=N''SCX'' AND ISNULL(停用,0)=0 ORDER BY 排序, 代码',NULL,NULL,NULL,N'query,detail',180,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'sfdf') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'sfdf',N'是否打非',N'是否',NULL,NULL,NULL,NULL,N'detail',190,80,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'jjdm') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'jjdm',N'使用检具',N'文本',NULL,NULL,NULL,NULL,N'detail',200,110,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'ysjt') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'ysjt',N'预设机台',N'文本',NULL,NULL,NULL,NULL,N'detail',210,110,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'zylc') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'zylc',N'作业流程',N'文本',NULL,NULL,NULL,NULL,N'detail',220,180,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'zysx') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'zysx',N'注意事项',N'文本',NULL,NULL,NULL,NULL,N'detail',230,160,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'jcfs') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'jcfs',N'检查方式',N'文本',NULL,NULL,NULL,NULL,N'detail',240,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'tsgn') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'tsgn',N'特殊功能',N'文本',NULL,NULL,NULL,NULL,N'detail',250,120,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'sfsm') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'sfsm',N'是否扫码',N'是否',NULL,NULL,NULL,NULL,N'detail',260,80,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP_TIME' AND col_name=N'bz') INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible) VALUES ('OP_TIME',N'bz',N'备注',N'文本',NULL,NULL,NULL,NULL,N'detail',270,180,1,0,0,1);

-- 并序 2~7 组(部位/工序/说明/单价/完工后转到):标签与实际列名一致,便于勾选维护
DECLARE @n int = 2;
WHILE @n <= 7
BEGIN
  DECLARE @bw nvarchar(20) = N'bw' + CAST(@n AS nvarchar(2));
  DECLARE @gx nvarchar(20) = N'gxmc' + CAST(@n AS nvarchar(2));
  DECLARE @sm nvarchar(20) = N'gxsm' + CAST(@n AS nvarchar(2));
  DECLARE @dj nvarchar(20) = N'bxdj' + CAST(@n AS nvarchar(2));
  DECLARE @zd nvarchar(20) = N'zd' + CAST(@n AS nvarchar(2));
  DECLARE @p2 nvarchar(2) = CAST(@n AS nvarchar(2));
  DECLARE @lbl nvarchar(40);
  DECLARE @seq int = 300 + @n * 10;
  DECLARE @sql nvarchar(max) = N'
    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code=''OP_TIME'' AND col_name=@c) INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES (''OP_TIME'',@c,@l,N''文本'',N''detail'',@s,120,1,0,0,1);';
  DECLARE @s1 int = @seq, @s2 int = @seq + 1, @s3 int = @seq + 2, @s4 int = @seq + 3, @s5 int = @seq + 4;
  SET @lbl = N'并序' + @p2 + N'部位';
  EXEC sp_executesql @sql, N'@c nvarchar(20), @l nvarchar(40), @s int', @c=@bw, @l=@lbl, @s=@s1;
  SET @lbl = N'并序' + @p2 + N'工序名称';
  EXEC sp_executesql @sql, N'@c nvarchar(20), @l nvarchar(40), @s int', @c=@gx, @l=@lbl, @s=@s2;
  SET @lbl = N'并序' + @p2 + N'工序说明';
  EXEC sp_executesql @sql, N'@c nvarchar(20), @l nvarchar(40), @s int', @c=@sm, @l=@lbl, @s=@s3;
  SET @lbl = N'并序' + @p2 + N'加工单价';
  EXEC sp_executesql @sql, N'@c nvarchar(20), @l nvarchar(40), @s int', @c=@dj, @l=@lbl, @s=@s4;
  SET @lbl = N'并序' + @p2 + N'完工后转到';
  EXEC sp_executesql @sql, N'@c nvarchar(20), @l nvarchar(40), @s int', @c=@zd, @l=@lbl, @s=@s5;
  SET @n = @n + 1;
END

-- 权限行:普通用户可查/新增/编辑/删除/导出/打印(档案类面板)
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=2 AND panel_code='OP_TIME')
  INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, N'OP_TIME', N'N', N'view,query,add,edit,delete,export,print');

/* ============ B. 产线层级补录:dm_gx(lb=SCX) 的父节点 → bs_dict ============ */
-- 参考库 SCX 去重 15 条、当前 12 条;缺 3 个父节点(部门/车间层),补后成"部门→车间→产线"层级
IF NOT EXISTS (SELECT 1 FROM bs_dict WHERE 字典类别=N'SCX' AND 代码=N'106')
  INSERT INTO bs_dict (字典类别, 代码, 名称, 备注, 状态, 排序, 停用, asp_user1, asp_time1)
  VALUES (N'SCX', N'106', N'生产部', N'产线层级补录(dm_gx.lb=SCX)', N'启用', NULL, 0, N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_dict WHERE 字典类别=N'SCX' AND 代码=N'10601')
  INSERT INTO bs_dict (字典类别, 代码, 名称, 备注, 状态, 排序, 停用, asp_user1, asp_time1)
  VALUES (N'SCX', N'10601', N'挂镀车间', N'产线层级补录(dm_gx.lb=SCX)', N'启用', NULL, 0, N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM bs_dict WHERE 字典类别=N'SCX' AND 代码=N'10602')
  INSERT INTO bs_dict (字典类别, 代码, 名称, 备注, 状态, 排序, 停用, asp_user1, asp_time1)
  VALUES (N'SCX', N'10602', N'连续镀车间', N'产线层级补录(dm_gx.lb=SCX)', N'启用', NULL, 0, N'migration', SYSDATETIME());
-- 排序对齐:按"部门→车间→产线"树序给显式排序键(106 生产部=1;10601 挂镀车间=10 及其产线 11-13;
-- 10602 连续镀车间=20 及其产线 21-29),使下拉按层级可读。幂等:每次按代码重算。
UPDATE bs_dict SET 排序 = CASE 代码
    WHEN N'106'     THEN 1
    WHEN N'10601'   THEN 10
    WHEN N'1060101' THEN 11
    WHEN N'1060102' THEN 12
    WHEN N'1060103' THEN 13
    WHEN N'10602'   THEN 20
    WHEN N'1060201' THEN 21
    WHEN N'1060202' THEN 22
    WHEN N'1060203' THEN 23
    WHEN N'1060204' THEN 24
    WHEN N'1060205' THEN 25
    WHEN N'1060206' THEN 26
    WHEN N'1060207' THEN 27
    WHEN N'1060208' THEN 28
    WHEN N'1060209' THEN 29
    ELSE 排序 END
WHERE 字典类别 = N'SCX';
GO

/* ============ C. 多语言:面板名 + 新字段 en 译名 ============ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'工序工时' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('panel',N'工序工时','en',N'Operation Time','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'款号名称' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'款号名称','en',N'Style Name','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换线时间' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'换线时间','en',N'Changeover Time','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'标准时间' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'标准时间','en',N'Standard Time','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最快时间' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'最快时间','en',N'Fastest Time','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'最慢时间' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'最慢时间','en',N'Slowest Time','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'平均时间' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'平均时间','en',N'Average Time','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'加工单价' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'加工单价','en',N'Processing Unit Price','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'加工单价2' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'加工单价2','en',N'Processing Unit Price 2','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否并序' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'是否并序','en',N'Parallel Op','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'模具代码' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'模具代码','en',N'Mold Code','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'加工条件' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'加工条件','en',N'Processing Condition','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否打非' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'是否打非','en',N'Mark Defect','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'使用检具' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'使用检具','en',N'Gauge Used','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'预设机台' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'预设机台','en',N'Preset Machine','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'作业流程' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'作业流程','en',N'Workflow','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'注意事项' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'注意事项','en',N'Precautions','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检查方式' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'检查方式','en',N'Inspection Method','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'特殊功能' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'特殊功能','en',N'Special Function','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否扫码' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'是否扫码','en',N'Scan Required','manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'工序说明' AND locale='en') INSERT INTO yj_translation (scope,ref_key,locale,text,source) VALUES ('field',N'工序说明','en',N'Operation Note','manual');
GO

/* ============ D. 校验 ============ */
SELECT N'OP_TIME 面板' AS 检查, COUNT(*) AS 数量 FROM yj_panel WHERE panel_code='OP_TIME'
UNION ALL SELECT N'OP_TIME 字段数', COUNT(*) FROM yj_field WHERE panel_code='OP_TIME'
UNION ALL SELECT N'OP_TIME 权限行', COUNT(*) FROM yj_role_panel WHERE panel_code='OP_TIME'
UNION ALL SELECT N'bs_dict.SCX 行数', COUNT(*) FROM bs_dict WHERE 字典类别=N'SCX'
UNION ALL SELECT N'工序工时面板译名', COUNT(*) FROM yj_translation WHERE scope='panel' AND ref_key=N'工序工时' AND locale='en';
PRINT N'migrate-op-time-and-scx 完成';
GO
