/* ============================================================
   migrate-prodline-import.sql — 2026-09-27 产线数据导入 + 工序种类
   ------------------------------------------------------------
   用户拍板(截图《新系统产线命名》):按 工序/工艺 → 生产线 两级导入当前产线,
   并为每条产线维护「工序种类」(成型/切炭/组装/装箱——对齐报工工序下拉,
   产线档案可继续人工增改)。
     成型·烧结: 1号车间/2号车间/3号车间/4号车间/自动线1/自动线2/自动线3
     成型·X烧结: 1号机/2号机/…/7号机
     切炭: 切炭1(老厂)/切炭2(自动)/切炭3(新厂)/切炭4(X)
     组装: 组装1(老厂)/组装2(新厂)/装箱1(老厂)/装箱2(新厂)
   ① bs_prod_line 加 工序种类 nvarchar(20)(产线档案可维护)
   ② 导入 22 条新产线(按 生产线 名幂等:存在则只补 工序种类)
   ③ 存量 8 行按名称回填 工序种类
   ④ PROD_LINE 面板注册 工序种类 字段 + en 译名
   幂等可重跑。 ============================================================ */
SET NOCOUNT ON;
GO
IF COL_LENGTH(N'dbo.bs_prod_line', N'工序种类') IS NULL
    ALTER TABLE dbo.bs_prod_line ADD [工序种类] nvarchar(20) NULL;
GO
IF COL_LENGTH(N'dbo.bs_prod_line', N'工序种类') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.bs_prod_line')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_prod_line'), N'工序种类', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'工序种类(产线执行的工序大类:成型/切炭/组装/装箱,对齐报工工序下拉;产线档案可维护)',
            N'SCHEMA', N'dbo', N'TABLE', N'bs_prod_line', N'COLUMN', N'工序种类';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'工序种类(产线执行的工序大类:成型/切炭/组装/装箱,对齐报工工序下拉;产线档案可维护)',
            N'SCHEMA', N'dbo', N'TABLE', N'bs_prod_line', N'COLUMN', N'工序种类';
END
GO
-- ② 导入 22 条新产线(幂等:按 生产线 名存在即跳过)
;WITH 新线(生产线, 生产车间, 工序种类, 排序) AS (
    SELECT N'1号车间', N'烧结', N'成型', 10 UNION ALL
    SELECT N'2号车间', N'烧结', N'成型', 20 UNION ALL
    SELECT N'3号车间', N'烧结', N'成型', 30 UNION ALL
    SELECT N'4号车间', N'烧结', N'成型', 40 UNION ALL
    SELECT N'自动线1', N'烧结', N'成型', 50 UNION ALL
    SELECT N'自动线2', N'烧结', N'成型', 60 UNION ALL
    SELECT N'自动线3', N'烧结', N'成型', 70 UNION ALL
    SELECT N'1号机', N'X烧结', N'成型', 80 UNION ALL
    SELECT N'2号机', N'X烧结', N'成型', 90 UNION ALL
    SELECT N'3号机', N'X烧结', N'成型', 100 UNION ALL
    SELECT N'4号机', N'X烧结', N'成型', 110 UNION ALL
    SELECT N'5号机', N'X烧结', N'成型', 120 UNION ALL
    SELECT N'6号机', N'X烧结', N'成型', 130 UNION ALL
    SELECT N'7号机', N'X烧结', N'成型', 140 UNION ALL
    SELECT N'切炭1(老厂)', N'切炭', N'切炭', 150 UNION ALL
    SELECT N'切炭2(自动)', N'切炭', N'切炭', 160 UNION ALL
    SELECT N'切炭3(新厂)', N'切炭', N'切炭', 170 UNION ALL
    SELECT N'切炭4(X)', N'切炭', N'切炭', 180 UNION ALL
    SELECT N'组装1(老厂)', N'组装', N'组装', 190 UNION ALL
    SELECT N'组装2(新厂)', N'组装', N'组装', 200 UNION ALL
    SELECT N'装箱1(老厂)', N'装箱', N'装箱', 210 UNION ALL
    SELECT N'装箱2(新厂)', N'装箱', N'装箱', 220
)
INSERT INTO bs_prod_line (生产线, 生产车间, 工序种类, 排序, asp_user1, asp_time1, asp_cancel)
SELECT x.生产线, x.生产车间, x.工序种类, x.排序, N'数据导入', GETDATE(), N'N'
FROM 新线 x
WHERE NOT EXISTS (SELECT 1 FROM bs_prod_line b WHERE b.生产线 = x.生产线);
GO
-- ③ 存量 8 行按名称回填 工序种类(幂等:只填 NULL)
UPDATE bs_prod_line SET [工序种类] = N'成型'
WHERE [工序种类] IS NULL AND (生产线 LIKE N'成型%' OR 生产线 IN (N'1号车间',N'2号车间',N'3号车间',N'4号车间',N'自动线1',N'自动线2',N'自动线3'
    ,N'1号机',N'2号机',N'3号机',N'4号机',N'5号机',N'6号机',N'7号机'));
UPDATE bs_prod_line SET [工序种类] = N'切炭'
WHERE [工序种类] IS NULL AND (生产线 LIKE N'切炭%');
UPDATE bs_prod_line SET [工序种类] = N'组装'
WHERE [工序种类] IS NULL AND (生产线 LIKE N'组装%');
UPDATE bs_prod_line SET [工序种类] = N'装箱'
WHERE [工序种类] IS NULL AND (生产线 LIKE N'装箱%');
GO
-- ④ PROD_LINE 面板字段注册(工序种类,seq=65 置于 停用/备注 之间;只读=0 可维护)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PROD_LINE' AND col_name = N'工序种类')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('PROD_LINE', N'工序种类', N'工序种类', N'文本',
            N'SELECT DISTINCT 工序种类 AS dm, 工序种类 AS mc FROM bs_prod_line WHERE ISNULL(工序种类,N'''')<>N'''' ORDER BY 工序种类',
            NULL, NULL, NULL, 'query,header', 65, 110, 1, 0, 0, NULL, 1);
GO
-- 字段译名(en;其余语言可由机翻兜底)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'工序种类' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'工序种类', 'en', N'Process Type', 'manual');
GO
PRINT N'产线导入+工序种类 就绪(幂等)';
GO
