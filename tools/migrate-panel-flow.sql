-- migrate-panel-flow.sql — 流转改面板化(2026-09-22 用户拍板:工作流=面板↔面板,非快速排产页内部流转)
-- ①产线产能档案面板 LINE_CAP(bs_line_capacity,档案式增删改查)
-- ②产线排产负荷面板 LINE_LOAD(v_line_load:生产线×今日+未来13天 均摊负荷,含 asp_cancel 供 flat 面板过滤)
-- ③MANU_SCHEDULE 补 需求数量 字段(待产/完工总览并回 生产排产 面板)
-- 幂等:IF NOT EXISTS / 视图先删后建。
SET NOCOUNT ON;
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
    FROM (SELECT 生产线, 生产车间, ISNULL(日产能,0) AS 日产能 FROM bs_line_capacity WHERE ISNULL(asp_cancel,'N') <> 'Y') c
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
       CAST(ISNULL(MAX(CASE WHEN idx = 6 THEN v END), 0) AS decimal(18,2)) AS [D6],
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

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='LINE_CAP')
  INSERT INTO yj_panel (panel_code,panel_name,category,mode,line_table,head_table,group_col,pk_col,code_col,prefix,date_col,page_size,detail_key,module_group)
  VALUES ('LINE_CAP', N'产线产能', N'生产制造', 'archive', 'bs_line_capacity', NULL, NULL, N'id', N'生产线', NULL, NULL, 100, N'items', N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='LINE_LOAD')
  INSERT INTO yj_panel (panel_code,panel_name,category,mode,line_table,head_table,group_col,pk_col,code_col,prefix,date_col,page_size,detail_key,module_group)
  VALUES ('LINE_LOAD', N'产线排产负荷', N'生产制造', 'flat', 'v_line_load', NULL, NULL, N'id', NULL, NULL, NULL, 100, N'items', N'生产制造');

INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
SELECT v.p, v.c, v.c, v.t, N'query,header', v.s, v.w, v.e, 0, 0, 1 FROM (VALUES
  ('LINE_CAP',N'生产线',N'文本',10,140,1),('LINE_CAP',N'生产车间',N'文本',20,140,1),
  ('LINE_CAP',N'日产能',N'小数',30,110,1),('LINE_CAP',N'小时产能',N'小数',40,110,1),
  ('LINE_CAP',N'排序',N'整数',50,80,1),('LINE_CAP',N'备注',N'文本',60,200,1)
) AS v(p,c,t,s,w,e)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code=v.p AND f.col_name=v.c);

INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
SELECT 'LINE_LOAD', v.c, v.c, N'小数', N'query,detail', v.s, 90, 0, 0, 0, 1 FROM (VALUES
  (N'日产能',20),(N'今日负荷',30),(N'D1',40),(N'D2',41),(N'D3',42),(N'D4',43),(N'D5',44),(N'D6',45),(N'D7',46),
  (N'D8',47),(N'D9',48),(N'D10',49),(N'D11',50),(N'D12',51),(N'D13',52),(N'合计负荷',60)
) AS v(c,s)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code='LINE_LOAD' AND f.col_name=v.c);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
SELECT 'LINE_LOAD', N'生产线', N'生产线', N'文本', N'query,detail', 10, 130, 0, 0, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code='LINE_LOAD' AND f.col_name=N'生产线');
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
SELECT 'LINE_LOAD', N'生产车间', N'生产车间', N'文本', N'query,detail', 15, 130, 0, 0, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code='LINE_LOAD' AND f.col_name=N'生产车间');

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name=N'需求数量')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_SCHEDULE',N'需求数量',N'需求数量',N'小数',N'query,detail',135,100,0,0,0,1);

INSERT INTO yj_role_panel (role_id, panel_code, perms)
SELECT DISTINCT rp.role_id, p, 'view,query,add,modify,export'
FROM yj_role_panel rp CROSS JOIN (VALUES ('LINE_CAP'),('LINE_LOAD')) AS x(p)
WHERE rp.panel_code='MANU_ORDER' AND rp.perms LIKE '%view%'
  AND NOT EXISTS (SELECT 1 FROM yj_role_panel z WHERE z.role_id=rp.role_id AND z.panel_code=x.p);
GO
SELECT N'v_line_load 列' AS 检查, COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('v_line_load')
UNION ALL SELECT N'新面板', (SELECT COUNT(*) FROM yj_panel WHERE panel_code IN ('LINE_CAP','LINE_LOAD'))
UNION ALL SELECT N'新字段', (SELECT COUNT(*) FROM yj_field WHERE panel_code IN ('LINE_CAP','LINE_LOAD'));
PRINT N'migrate-panel-flow 完成';
GO
