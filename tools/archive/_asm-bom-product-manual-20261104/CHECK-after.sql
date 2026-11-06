-- ============================================================================
-- 组装物料清单(ASM_BOM)「产品编码可手输 + 工序移出表头」迁移后只读断言(2026-11-04 晚)
--
-- 配套迁移:tools/migrate-asm-bom-product-manual-20261104.sql
-- 用法(在 tools 目录,两账套各跑一遍):
--   java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar SqlRunner.java ^
--     "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" ^
--     yinjia env archive\_asm-bom-product-manual-20261104\CHECK-after.sql
-- 期望:末行 RESULT: PASS、violations = 0;任一项不满足会把违规项打进结果集。
-- ============================================================================
SET NOCOUNT ON;
GO

DECLARE @r TABLE (id int IDENTITY(1,1), item nvarchar(120), expect nvarchar(200), actual nvarchar(200), verdict nvarchar(10));

-- 1. 产品编码:文本 / 可编辑 / 必填 / 无任何参照配置
INSERT INTO @r (item, expect, actual)
SELECT N'1 产品编码 数据/可编辑/必填/无参照',
       N'文本 / editable=1 / required=1 / ref=NULL',
       ISNULL(d.data_type, N'<NULL>') + N' / ' + CAST(ISNULL(d.editable, -1) AS nvarchar(5))
       + N' / ' + CAST(ISNULL(d.required, -1) AS nvarchar(5))
       + N' / ' + CASE WHEN d.ref_panel IS NULL AND d.ref_field IS NULL AND d.display_field IS NULL THEN N'NULL' ELSE N'有值' END
  FROM yj_field d WHERE d.panel_code = 'ASM_BOM' AND d.label = N'产品编码';

-- 2. 工序:不在表头、只剩 query 查询条件、不再必填
INSERT INTO @r (item, expect, actual)
SELECT N'2 工序 place(不得含 header)', N'query', ISNULL(MAX(place), N'<缺行>')
  FROM yj_field WHERE panel_code = 'ASM_BOM' AND label = N'工序';
INSERT INTO @r (item, expect, actual)
SELECT N'3 工序 表头行数', N'0', CAST(COUNT(*) AS nvarchar(5))
  FROM yj_field WHERE panel_code = 'ASM_BOM' AND label = N'工序' AND place LIKE N'%header%';
INSERT INTO @r (item, expect, actual)
SELECT N'4 工序 editable/required', N'0 / 0',
       CAST(ISNULL(MAX(CAST(editable AS int)), -1) AS nvarchar(5)) + N' / ' + CAST(ISNULL(MAX(CAST(required AS int)), -1) AS nvarchar(5))
  FROM yj_field WHERE panel_code = 'ASM_BOM' AND label = N'工序';

-- 5. headDefaults:状态=启用 + 工序=组装
INSERT INTO @r (item, expect, actual)
SELECT N'5 headDefaults.状态', N'启用', ISNULL(JSON_VALUE((SELECT config FROM yj_panel WHERE panel_code='ASM_BOM'), N'$.headDefaults."状态"'), N'<NULL>');
INSERT INTO @r (item, expect, actual)
SELECT N'6 headDefaults.工序', N'组装', ISNULL(JSON_VALUE((SELECT config FROM yj_panel WHERE panel_code='ASM_BOM'), N'$.headDefaults."工序"'), N'<NULL>');

-- 7. 不再有空工序行(下游按 工序=N'组装' 取数)
INSERT INTO @r (item, expect, actual)
SELECT N'7 空工序行数', N'0', CAST(COUNT(*) AS nvarchar(5)) FROM dbo.bs_asm_bom WHERE ISNULL(工序, N'') = N'';

-- 8. 非组装工序行(当前业务只有组装;将来录成型/切炭时应 >0,属设计变更不属回归)
INSERT INTO @r (item, expect, actual)
SELECT N'8 非组装工序行数(现状)', N'0', CAST(COUNT(*) AS nvarchar(5)) FROM dbo.bs_asm_bom WHERE ISNULL(工序, N'组装') <> N'组装';

-- 9. 面板字段总数/表头字段数(只做下限;本迁移不增删字段)
INSERT INTO @r (item, expect, actual)
SELECT N'9 面板字段总数', N'>=19', CAST(COUNT(*) AS nvarchar(5)) FROM yj_field WHERE panel_code = 'ASM_BOM';
INSERT INTO @r (item, expect, actual)
SELECT N'10 表头字段数', N'10(装配后)', CAST(COUNT(*) AS nvarchar(5))
  FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%';

-- 11. 物理表结构未动
INSERT INTO @r (item, expect, actual)
SELECT N'11 bs_asm_bom 列数', N'>=47', CAST(COUNT(*) AS nvarchar(5))
  FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_asm_bom');
INSERT INTO @r (item, expect, actual)
SELECT N'12 bs_asm_bom.备注 列', N'存在', CASE WHEN COL_LENGTH('dbo.bs_asm_bom', N'备注') IS NULL THEN N'缺失' ELSE N'存在' END;

-- 12. 面板形态未变(单表 doc)
INSERT INTO @r (item, expect, actual)
SELECT N'13 面板形态', N'doc / bs_asm_bom / head_table NULL',
       ISNULL(mode, N'') + N' / ' + ISNULL(line_table, N'') + N' / ' + ISNULL(head_table, N'NULL')
  FROM yj_panel WHERE panel_code = 'ASM_BOM';

-- 13. 迁移已登记(yj_schema_log)
INSERT INTO @r (item, expect, actual)
SELECT N'14 迁移登记行数', N'1', CAST(COUNT(*) AS nvarchar(5))
  FROM yj_schema_log WHERE script_name LIKE N'%migrate-asm-bom-product-manual-20261104%';

-- 判定
UPDATE @r SET verdict = CASE
    WHEN item LIKE N'1 %'  THEN CASE WHEN actual = N'文本 / 1 / 1 / NULL' THEN N'PASS' ELSE N'FAIL' END
    WHEN item LIKE N'2 %'  THEN CASE WHEN actual = N'query' THEN N'PASS' ELSE N'FAIL' END
    WHEN item LIKE N'3 %'  THEN CASE WHEN actual = N'0' THEN N'PASS' ELSE N'FAIL' END
    WHEN item LIKE N'4 %'  THEN CASE WHEN actual = N'0 / 0' THEN N'PASS' ELSE N'FAIL' END
    WHEN item LIKE N'5 %'  THEN CASE WHEN actual = N'启用' THEN N'PASS' ELSE N'FAIL' END
    WHEN item LIKE N'6 %'  THEN CASE WHEN actual = N'组装' THEN N'PASS' ELSE N'FAIL' END
    WHEN item LIKE N'7 %'  THEN CASE WHEN actual = N'0' THEN N'PASS' ELSE N'FAIL' END
    WHEN item LIKE N'8 %'  THEN CASE WHEN actual = N'0' THEN N'PASS' ELSE N'FAIL' END
    WHEN item LIKE N'9 %'  THEN CASE WHEN TRY_CAST(actual AS int) >= 19 THEN N'PASS' ELSE N'FAIL' END
    WHEN item LIKE N'10 %' THEN CASE WHEN actual = N'10' THEN N'PASS' ELSE N'FAIL' END
    WHEN item LIKE N'11 %' THEN CASE WHEN TRY_CAST(actual AS int) >= 47 THEN N'PASS' ELSE N'FAIL' END
    WHEN item LIKE N'12 %' THEN CASE WHEN actual = N'存在' THEN N'PASS' ELSE N'FAIL' END
    WHEN item LIKE N'13 %' THEN CASE WHEN actual = N'doc / bs_asm_bom / NULL' THEN N'PASS' ELSE N'FAIL' END
    WHEN item LIKE N'14 %' THEN CASE WHEN actual = N'1' THEN N'PASS' ELSE N'FAIL' END
    ELSE N'FAIL' END;

SELECT DB_NAME() AS db_name, item, expect, actual, verdict FROM @r ORDER BY id;

DECLARE @violations int = (SELECT COUNT(*) FROM @r WHERE verdict <> N'PASS');
SELECT N'900' AS id, N'违规项数(violations)' AS item, CAST(0 AS nvarchar(200)) AS expect,
       CAST(@violations AS nvarchar(200)) AS actual,
       CASE WHEN @violations = 0 THEN N'PASS' ELSE N'FAIL' END AS verdict
UNION ALL
SELECT N'999', N'== RESULT ==', N'PASS',
       CASE WHEN @violations = 0 THEN N'全部 ' + CAST((SELECT COUNT(*) FROM @r) AS nvarchar(5)) + N' 项通过'
            ELSE N'违规 ' + CAST(@violations AS nvarchar(5)) + N' 项' END,
       CASE WHEN @violations = 0 THEN N'RESULT: PASS' ELSE N'RESULT: FAIL' END;
GO
