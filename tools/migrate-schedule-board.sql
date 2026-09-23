-- migrate-schedule-board.sql — 排产工作台(实现总结 V1.0 §3+§5,2026-09-23)
-- §3 生产线档案归位:bs_prod_line(基础资料·生产组 PROD_LINE「生产线」)+铺底8条+收编 bs_line_capacity/LINE_CAP;
--    v_line_load 改读 bs_prod_line(停用过滤)。混料线不建(材料段涉密不进系统)。
-- §5 排产工作台:头.排产班组(对齐参考图"班别",下拉=班组档案 bs_team);MANU_ORDER 生产线/预开工日/预完工日 转只读
--    (排产台单一写入)。客户解名链口径:bs_partner → dm_kh → SO 原值(C-000=张莉 为金蝶档案合法客户名)。
-- 幂等:IF OBJECT_ID/COL_LENGTH/IF NOT EXISTS/视图先删后建。
SET NOCOUNT ON;

-- ① 生产线档案
IF OBJECT_ID('bs_prod_line') IS NULL
CREATE TABLE bs_prod_line (
  id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
  [生产线] nvarchar(100) NOT NULL,
  [生产车间] nvarchar(100) NULL,
  [日产能] decimal(18,4) NULL,
  [小时产能] decimal(18,4) NULL,
  [排序] int NULL,
  [停用] bit NULL DEFAULT 0,
  [备注] nvarchar(200) NULL,
  [asp_user1] nvarchar(50) NULL, [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL, [asp_time2] datetime2 NULL,
  [asp_cancel] char(1) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ux_bs_prod_line' AND object_id=OBJECT_ID('bs_prod_line'))
  CREATE UNIQUE INDEX ux_bs_prod_line ON bs_prod_line([生产线]);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('bs_prod_line') AND ep.minor_id=0 AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'生产线档案(基础资料:排产台下拉/负荷基准;日产能=0 不判超载;停用=不显示)',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_prod_line';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('bs_prod_line') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID('bs_prod_line'),N'日产能','ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'日产能(该线每日可完成数量,排产负荷>日产能 提示超载,只提示不拦截)',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_prod_line', N'COLUMN', N'日产能';

-- 铺底 8 条(成型1~5线/切炭/组装/装箱;日产能=0 待业务维护;混料线不建)
INSERT INTO bs_prod_line ([生产线],[生产车间],[日产能],[小时产能],[排序],[备注],[asp_user1],[asp_time1])
SELECT v.line, v.ws, 0, 0, v.s, N'铺底(实现总结 V1.0 §3)', N'seed', SYSDATETIME()
FROM (VALUES (N'成型1线',N'成型1号车间',1),(N'成型2线',N'成型2号车间',2),(N'成型3线',N'成型3号车间',3),
             (N'成型4线',N'成型4号车间',4),(N'成型5线',N'成型5号车间',5),
             (N'切炭线',N'切炭车间',6),(N'组装线',N'组装车间',7),(N'装箱线',N'装箱车间',8)) AS v(line,ws,s)
WHERE NOT EXISTS (SELECT 1 FROM bs_prod_line x WHERE x.[生产线] = v.line);

-- 旧方案数据收编:bs_line_capacity → bs_prod_line(按生产线 upsert),随后整体下线(表+LINE_CAP 面板)
IF OBJECT_ID('bs_line_capacity') IS NOT NULL
BEGIN
  UPDATE p SET p.[生产车间] = ISNULL(NULLIF(c.[生产车间],N''), p.[生产车间]),
               p.[日产能] = CASE WHEN ISNULL(c.[日产能],0) > 0 THEN c.[日产能] ELSE p.[日产能] END,
               p.[小时产能] = CASE WHEN ISNULL(c.[小时产能],0) > 0 THEN c.[小时产能] ELSE p.[小时产能] END,
               p.[备注] = N'收编自 bs_line_capacity(' + ISNULL(p.[备注],N'') + N')',
               p.asp_user2 = N'migrate', p.asp_time2 = SYSDATETIME()
  FROM bs_prod_line p JOIN bs_line_capacity c ON c.[生产线] = p.[生产线]
  WHERE ISNULL(c.asp_cancel,'N') <> 'Y';
  INSERT INTO bs_prod_line ([生产线],[生产车间],[日产能],[小时产能],[排序],[备注],[asp_user1],[asp_time1])
  SELECT c.[生产线], ISNULL(c.[生产车间],N''), ISNULL(c.[日产能],0), ISNULL(c.[小时产能],0), ISNULL(c.[排序],99),
         N'收编自 bs_line_capacity', N'migrate', SYSDATETIME()
  FROM bs_line_capacity c
  WHERE ISNULL(c.asp_cancel,'N') <> 'Y' AND NOT EXISTS (SELECT 1 FROM bs_prod_line x WHERE x.[生产线] = c.[生产线]);
END
GO
-- LINE_CAP 面板下线(字段/权限/面板;菜单在 menus.js)
DELETE FROM yj_field WHERE panel_code = 'LINE_CAP';
DELETE FROM yj_role_panel WHERE panel_code = 'LINE_CAP';
DELETE FROM yj_panel WHERE panel_code = 'LINE_CAP';
IF OBJECT_ID('bs_line_capacity') IS NOT NULL DROP TABLE bs_line_capacity;
GO

-- PROD_LINE 面板(基础资料·生产组,档案式)
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='PROD_LINE')
  INSERT INTO yj_panel (panel_code,panel_name,category,mode,line_table,head_table,group_col,pk_col,code_col,prefix,date_col,page_size,detail_key,module_group)
  VALUES ('PROD_LINE', N'生产线', N'基础资料', 'archive', 'bs_prod_line', NULL, NULL, N'id', N'生产线', NULL, NULL, 100, N'items', N'基础资料');
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
SELECT 'PROD_LINE', v.c, v.c, v.t, N'query,header', v.s, v.w, v.e, v.q, 0, 1 FROM (VALUES
  (N'生产线',N'文本',10,140,1,1),(N'生产车间',N'文本',20,140,1,0),(N'日产能',N'小数',30,110,1,0),
  (N'小时产能',N'小数',40,110,1,0),(N'排序',N'整数',50,80,1,0),(N'停用',N'是否',60,80,1,0),(N'备注',N'文本',70,200,1,0)
) AS v(c,t,s,w,e,q)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code='PROD_LINE' AND f.col_name=v.c);
-- 停用=布尔开关(data_type 是否,同 启用派工 等 bit 字段);历史误注册为文本的库纠回(2026-09-23 用户拍板)
UPDATE yj_field SET data_type = N'是否' WHERE panel_code = 'PROD_LINE' AND col_name = N'停用' AND data_type <> N'是否';
INSERT INTO yj_role_panel (role_id, panel_code, perms)
SELECT DISTINCT rp.role_id, 'PROD_LINE', 'view,query,add,modify,export'
FROM yj_role_panel rp WHERE rp.panel_code='MANU_ORDER' AND rp.perms LIKE '%view%'
  AND NOT EXISTS (SELECT 1 FROM yj_role_panel z WHERE z.role_id=rp.role_id AND z.panel_code='PROD_LINE');
GO

-- ② v_line_load 改读 bs_prod_line(停用过滤)
IF OBJECT_ID('v_line_load','V') IS NOT NULL DROP VIEW v_line_load;
GO
CREATE VIEW v_line_load AS
WITH base AS (
    SELECT ISNULL(生产线,N'') AS 生产线, ISNULL(排产数量,0) AS q,
           CASE WHEN 工序交期 IS NULL THEN 计划开工日 ELSE 工序交期 END AS e,
           CASE WHEN 计划开工日 IS NULL THEN 工序交期 ELSE 计划开工日 END AS s
    FROM v_manu_schedule
    WHERE ISNULL(生产线,N'') <> N'' AND ISNULL(排产数量,0) > 0
      AND ISNULL(结案,N'N') <> N'Y' AND ISNULL(单据状态,N'') <> N'已作废'
),
clamped AS (
    SELECT 生产线, q,
           CASE WHEN s IS NULL THEN NULL
                WHEN e < CAST(GETDATE() AS date) THEN CAST(GETDATE() AS date)
                WHEN e > DATEADD(day, 13, CAST(GETDATE() AS date)) THEN DATEADD(day, 13, CAST(GETDATE() AS date))
                ELSE e END AS e2,
           CASE WHEN s IS NULL THEN NULL
                WHEN s < CAST(GETDATE() AS date) THEN CAST(GETDATE() AS date) ELSE s END AS s2
    FROM base
),
perday AS (
    SELECT d.生产线, dd.di AS idx, SUM(d.q * 1.0 / (DATEDIFF(day, d.s2, d.e2) + 1)) AS v
    FROM clamped d
    CROSS APPLY (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13)) dd(di)
    WHERE d.s2 IS NOT NULL AND dd.di <= DATEDIFF(day, d.s2, d.e2)
    GROUP BY d.生产线, dd.di
),
k AS (
    SELECT 生产线, 生产车间, 日产能, CAST(NULL AS int) AS idx, CAST(NULL AS decimal(18,4)) AS v
    FROM (SELECT 生产线, 生产车间, ISNULL(日产能,0) AS 日产能 FROM bs_prod_line
          WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(停用,0) = 0) c
    UNION ALL
    -- 负荷行仅保留启用档案线(2026-09-23 修复):停用线不进下拉/负荷面板;档案外脏值线(如'1')一并排除
    SELECT p.生产线, p.生产车间, NULL, pd.idx, pd.v
    FROM perday pd JOIN bs_prod_line p ON p.生产线 = pd.生产线
    WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.停用,0) = 0
)
SELECT 生产线,
       MAX(生产车间) AS 生产车间,
       MAX(日产能) AS 日产能,
       CAST(ISNULL(MAX(CASE WHEN idx = 0 THEN v END), 0) AS decimal(18,2)) AS [今日负荷],
       CAST(ISNULL(MAX(CASE WHEN idx = 1  THEN v END), 0) AS decimal(18,2)) AS [D1],
       CAST(ISNULL(MAX(CASE WHEN idx = 2  THEN v END), 0) AS decimal(18,2)) AS [D2],
       CAST(ISNULL(MAX(CASE WHEN idx = 3  THEN v END), 0) AS decimal(18,2)) AS [D3],
       CAST(ISNULL(MAX(CASE WHEN idx = 4  THEN v END), 0) AS decimal(18,2)) AS [D4],
       CAST(ISNULL(MAX(CASE WHEN idx = 5  THEN v END), 0) AS decimal(18,2)) AS [D5],
       CAST(ISNULL(MAX(CASE WHEN idx = 6  THEN v END), 0) AS decimal(18,2)) AS [D6],
       CAST(ISNULL(MAX(CASE WHEN idx = 7  THEN v END), 0) AS decimal(18,2)) AS [D7],
       CAST(ISNULL(MAX(CASE WHEN idx = 8  THEN v END), 0) AS decimal(18,2)) AS [D8],
       CAST(ISNULL(MAX(CASE WHEN idx = 9  THEN v END), 0) AS decimal(18,2)) AS [D9],
       CAST(ISNULL(MAX(CASE WHEN idx = 10 THEN v END), 0) AS decimal(18,2)) AS [D10],
       CAST(ISNULL(MAX(CASE WHEN idx = 11 THEN v END), 0) AS decimal(18,2)) AS [D11],
       CAST(ISNULL(MAX(CASE WHEN idx = 12 THEN v END), 0) AS decimal(18,2)) AS [D12],
       CAST(ISNULL(MAX(CASE WHEN idx = 13 THEN v END), 0) AS decimal(18,2)) AS [D13],
       CAST(ISNULL(SUM(v), 0) AS decimal(18,2)) AS [合计负荷],
       CAST(ROW_NUMBER() OVER (ORDER BY 生产线) AS int) AS id,
       CAST(NULL AS char(1)) AS asp_cancel
FROM k GROUP BY 生产线;
GO

-- ③ 排产班组(对齐参考图"班别";下拉=班组档案 bs_team)
IF COL_LENGTH('bd_manu_order', N'排产班组') IS NULL ALTER TABLE bd_manu_order ADD [排产班组] nvarchar(50) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('bd_manu_order')
               AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID('bd_manu_order'),N'排产班组','ColumnId') AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'排产班组(参考图班别;排产工作台指派,下拉=班组档案)',
       N'SCHEMA', N'dbo', N'TABLE', N'bd_manu_order', N'COLUMN', N'排产班组';
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'排产班组' AND place=N'header')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible)
  VALUES ('MANU_ORDER',N'排产班组',N'排产班组',N'文本',N'SELECT 班组名称 AS 值 FROM bs_team WHERE ISNULL(asp_cancel,''N'')<>''Y''',NULL,NULL,NULL,N'header',73,100,0,0,0,1);

-- 停用存量回填(铺底行 NULL→0=否)
UPDATE bs_prod_line SET 停用 = 0 WHERE 停用 IS NULL;

-- ④ 排产台单一写入:MANU_ORDER 生产线/预开工日/预完工日 转只读
UPDATE yj_field SET editable = 0 WHERE panel_code = 'MANU_ORDER' AND col_name IN (N'生产线', N'预开工日', N'预完工日');

INSERT INTO yj_translation (scope,ref_key,locale,text,source)
SELECT N'field', v.k, 'en', v.t, 'manual'
FROM (VALUES (N'排产班组', N'Schedule Team'), (N'停用', N'Disabled'), (N'生产线档案', N'Production Line')) AS v(k,t)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope=N'field' AND x.ref_key=v.k AND x.locale='en');
INSERT INTO yj_translation (scope,ref_key,locale,text,source)
SELECT N'panel', N'生产线', 'en', N'Production Line', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope=N'panel' AND x.ref_key=N'生产线' AND x.locale='en');

SELECT N'bs_prod_line 行' AS 检查, COUNT(*) FROM bs_prod_line
UNION ALL SELECT N'bs_line_capacity 已下线', 1 - COUNT(*) FROM sys.tables WHERE name='bs_line_capacity'
UNION ALL SELECT N'PROD_LINE 字段', COUNT(*) FROM yj_field WHERE panel_code='PROD_LINE'
UNION ALL SELECT N'排产班组列', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('bd_manu_order') AND name=N'排产班组'
UNION ALL SELECT N'三字段只读', COUNT(*) FROM yj_field WHERE panel_code='MANU_ORDER' AND col_name IN (N'生产线',N'预开工日',N'预完工日') AND editable=0;
PRINT N'migrate-schedule-board 完成';
GO
