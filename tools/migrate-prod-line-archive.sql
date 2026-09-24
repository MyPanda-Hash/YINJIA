-- migrate-prod-line-archive.sql — 生产线归位基础资料(2026-09-23 用户拍板:生产线=基础档案,产能是其属性)
-- 变更:
-- ①新建 **bs_prod_line 生产线档案**(基础资料·生产组):生产线(唯一)/生产车间/日产能/小时产能/排序/停用/备注;
-- ②bs_line_capacity(产线产能,生产计划组临时方案)数据迁入后 **表+LINE_CAP 面板整体下线**;
-- ③v_line_load 改读 bs_prod_line(负荷看板口径不变);
-- ④PROD_LINE 档案面板 + 字段 + en 译名 + 角色权限(同 MANU_ORDER 可见角色)。
-- 幂等:IF OBJECT_ID / IF NOT EXISTS / DELETE+INSERT,可重复执行(链上先建后收,空库亦安全)。
SET NOCOUNT ON;

-- ① 生产线档案表
IF OBJECT_ID('bs_prod_line') IS NULL
CREATE TABLE bs_prod_line (
  id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
  [生产线] nvarchar(100) NOT NULL,
  [生产车间] nvarchar(100) NULL,
  [日产能] decimal(18,4) NULL,
  [小时产能] decimal(18,4) NULL,
  [排序] int NULL,
  [停用] nvarchar(1) NULL,
  [备注] nvarchar(200) NULL,
  [asp_user1] nvarchar(50) NULL, [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL, [asp_time2] datetime2 NULL,
  [asp_cancel] char(1) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ux_bs_prod_line' AND object_id=OBJECT_ID('bs_prod_line'))
  CREATE UNIQUE INDEX ux_bs_prod_line ON bs_prod_line([生产线]);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('bs_prod_line') AND ep.minor_id=0 AND ep.name=N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'生产线档案(基础资料·生产组;排产指派对象,产能为属性:日产能=负荷/超载基准,小时产能与工序工时口径互补)',
       N'SCHEMA', N'dbo', N'TABLE', N'bs_prod_line';
GO
DECLARE @mc nvarchar(60), @md nvarchar(400);
DECLARE c_cur CURSOR LOCAL FAST_FORWARD FOR SELECT v.c, v.d FROM (VALUES
  (N'生产线',   N'生产线(排产指派对象,唯一;排产工作台选线数据源)'),
  (N'生产车间', N'生产车间(选线时自动带出)'),
  (N'日产能',   N'日产能(该产线每日可完成数量;产线排产负荷看板按此判超载)'),
  (N'小时产能', N'小时产能(该产线每小时可完成数量;与 工序工时 OP_TIME 口径互补)'),
  (N'停用',     N'停用(是/否;停用产线不再出现在选线下拉与负荷看板)')
) AS v(c,d);
OPEN c_cur; FETCH NEXT FROM c_cur INTO @mc, @md;
WHILE @@FETCH_STATUS = 0 BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                 WHERE ep.major_id=OBJECT_ID('bs_prod_line') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID('bs_prod_line'), @mc,'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @md, N'SCHEMA', N'dbo', N'TABLE', N'bs_prod_line', N'COLUMN', @mc;
  FETCH NEXT FROM c_cur INTO @mc, @md;
END
CLOSE c_cur; DEALLOCATE c_cur;
GO

-- ② 旧 bs_line_capacity 数据迁入(有则迁)
IF OBJECT_ID('bs_line_capacity') IS NOT NULL
INSERT INTO bs_prod_line ([生产线],[生产车间],[日产能],[小时产能],[排序],[备注],[asp_user1],[asp_time1])
SELECT c.[生产线], c.[生产车间], c.[日产能], c.[小时产能], c.[排序],
       N'由产线产能迁移' + ISNULL(N':'+c.[备注], N''), ISNULL(c.asp_user1,N'seed'), c.asp_time1
FROM bs_line_capacity c
WHERE ISNULL(c.asp_cancel,'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM bs_prod_line p WHERE p.[生产线] = c.[生产线]);
GO

-- ③ v_line_load 改读 bs_prod_line
IF OBJECT_ID('v_line_load','V') IS NOT NULL DROP VIEW v_line_load;
GO
CREATE VIEW v_line_load AS
WITH base AS (
    SELECT ISNULL(生产线,N'') AS 生产线, ISNULL(生产车间,N'') AS 生产车间, ISNULL(排产数量,0) AS q,
           CASE WHEN 工序交期 IS NULL THEN 计划开工日 ELSE 工序交期 END AS e,
           CASE WHEN 计划开工日 IS NULL THEN 工序交期 ELSE 计划开工日 END AS s
    FROM v_manu_schedule
    WHERE ISNULL(生产线,N'') <> N'' AND ISNULL(排产数量,0) > 0
      AND ISNULL(结案,N'N') <> N'Y' AND ISNULL(单据状态,N'') <> N'已作废'
),
clamped AS (
    SELECT 生产线, 生产车间, q,
           CASE WHEN s IS NULL THEN NULL
                WHEN e < CAST(GETDATE() AS date) THEN CAST(GETDATE() AS date)
                WHEN e > DATEADD(day, 13, CAST(GETDATE() AS date)) THEN DATEADD(day, 13, CAST(GETDATE() AS date))
                ELSE e END AS e2,
           CASE WHEN s IS NULL THEN NULL
                WHEN s < CAST(GETDATE() AS date) THEN CAST(GETDATE() AS date) ELSE s END AS s2
    FROM base
),
perday AS (
    SELECT d.生产线, d.生产车间, dd.di AS idx, SUM(d.q * 1.0 / (DATEDIFF(day, d.s2, d.e2) + 1)) AS v
    FROM clamped d
    CROSS APPLY (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13)) dd(di)
    WHERE d.s2 IS NOT NULL AND dd.di <= DATEDIFF(day, d.s2, d.e2)
    GROUP BY d.生产线, d.生产车间, dd.di
),
k AS (
    SELECT 生产线, 生产车间, 日产能, CAST(NULL AS int) AS idx, CAST(NULL AS decimal(18,4)) AS v
    FROM (SELECT 生产线, 生产车间, ISNULL(日产能,0) AS 日产能 FROM bs_prod_line
          WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(停用,'N') <> 'Y') c
    UNION ALL
    SELECT 生产线, 生产车间, NULL, idx, v FROM perday
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

-- ④ PROD_LINE 档案面板 + 字段
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='PROD_LINE')
  INSERT INTO yj_panel (panel_code,panel_name,category,mode,line_table,head_table,group_col,pk_col,code_col,prefix,date_col,page_size,detail_key,module_group)
  VALUES ('PROD_LINE', N'生产线', N'基础资料', 'archive', 'bs_prod_line', NULL, NULL, N'id', N'生产线', NULL, NULL, 100, N'items', N'基础资料');

DECLARE @dict_yn nvarchar(100) = N'SELECT N''是'' AS 值 UNION ALL SELECT N''否''';
INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq,width,editable,required,hidden,visible)
SELECT v.p, v.c, v.c, v.t, v.d, NULL, NULL, NULL, N'query,header', v.s, v.w, 1, v.q, 0, 1
FROM (VALUES
  ('PROD_LINE',N'生产线',N'文本',NULL,10,140,1),
  ('PROD_LINE',N'生产车间',N'文本',NULL,20,140,1),
  ('PROD_LINE',N'日产能',N'小数',NULL,30,110,0),
  ('PROD_LINE',N'小时产能',N'小数',NULL,40,110,0),
  ('PROD_LINE',N'排序',N'整数',NULL,50,80,0),
  ('PROD_LINE',N'停用',N'文本',@dict_yn,60,70,0),
  ('PROD_LINE',N'备注',N'文本',NULL,70,200,0)
) AS v(p,c,t,d,s,w,q)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code=v.p AND f.col_name=v.c);

INSERT INTO yj_translation (scope,ref_key,locale,text,source)
SELECT N'panel', N'生产线', 'en', N'Production Lines', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope=N'panel' AND x.ref_key=N'生产线' AND x.locale='en');

INSERT INTO yj_role_panel (role_id, panel_code, perms)
SELECT DISTINCT rp.role_id, 'PROD_LINE', 'view,query,add,modify,export'
FROM yj_role_panel rp
WHERE rp.panel_code = 'MANU_ORDER' AND rp.perms LIKE '%view%'
  AND NOT EXISTS (SELECT 1 FROM yj_role_panel z WHERE z.role_id=rp.role_id AND z.panel_code='PROD_LINE');

-- ⑤ 旧 LINE_CAP 收编下线(数据已迁)
DELETE FROM yj_field WHERE panel_code='LINE_CAP';
DELETE FROM yj_role_panel WHERE panel_code='LINE_CAP';
DELETE FROM yj_panel WHERE panel_code='LINE_CAP';
IF OBJECT_ID('bs_line_capacity') IS NOT NULL DROP TABLE bs_line_capacity;
GO

SELECT N'bs_prod_line 行' AS 检查, COUNT(*) FROM bs_prod_line
UNION ALL SELECT N'PROD_LINE 面板/字段', (SELECT COUNT(*) FROM yj_panel WHERE panel_code='PROD_LINE') + (SELECT COUNT(*) FROM yj_field WHERE panel_code='PROD_LINE')
UNION ALL SELECT N'LINE_CAP 残留(面板+字段+表)', (SELECT COUNT(*) FROM yj_panel WHERE panel_code='LINE_CAP') + (SELECT COUNT(*) FROM yj_field WHERE panel_code='LINE_CAP') + (SELECT COUNT(*) FROM sys.tables WHERE name='bs_line_capacity')
UNION ALL SELECT N'v_line_load 列', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('v_line_load');
PRINT N'migrate-prod-line-archive 完成';
GO
