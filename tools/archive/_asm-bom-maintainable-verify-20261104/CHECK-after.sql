-- ============================================================================
-- CHECK-after:组装物料清单(ASM_BOM)表头可维护 · 迁移后逐条断言(2026-11-04)
--
-- 用途:迁移**之后**跑一遍(只读),逐项断言迁移目标全部达成;全部 PASS 时
--       最后一行输出 RESULT: PASS、违规项数 = 0。
-- 口径:与迁移脚本 tools/migrate-asm-bom-maintainable-20261104.sql §7 自检同源,
--       另补「面板形态未变 / 物理表未动 / 明细子件编码可编辑」等守卫项。
-- 只读:全部是 SELECT,不写任何表。
-- 用法(在 tools 目录;Q.java 按 GO 分批执行并打印结果集):
--   java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_1019-questions\Q.java HSDZ_MES archive\_asm-bom-maintainable-verify-20261104\CHECK-after.sql
--   java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_1019-questions\Q.java HSDZ_MES_TEST archive\_asm-bom-maintainable-verify-20261104\CHECK-after.sql
--   事务内演练见 README.md 的「演练」段(执行迁移 → 跑本脚本 → ROLLBACK)。
-- ============================================================================
SET NOCOUNT ON;
GO

-- 1~15 项断言 + 违规汇总 + RESULT,一个批次一个结果集
DECLARE @chk TABLE (seq int, item nvarchar(200), expected nvarchar(200), actual nvarchar(200), ok bit);

-- 1. 表头 editable=1 条数 = 8
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 1, N'表头 editable=1 条数', N'8', CAST(COUNT(*) AS nvarchar(20)),
       CASE WHEN COUNT(*) = 8 THEN 1 ELSE 0 END
  FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%' AND editable = 1;

-- 2. 表头可编辑集合精确 = 设计 8 字段(双向差集 0)
DECLARE @wantOn TABLE (label nvarchar(60) PRIMARY KEY);
INSERT INTO @wantOn (label) VALUES
    (N'产品编码'), (N'产品名称'), (N'规格型号'), (N'工序'),
    (N'版本号'), (N'默认BOM'), (N'工艺路线名称'), (N'备注');
DECLARE @actOn TABLE (label nvarchar(60));
INSERT INTO @actOn (label)
SELECT label FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%' AND editable = 1;
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 2, N'表头可编辑集合(=8 字段,双向差集 0)', N'0 差异',
       CAST((SELECT COUNT(*) FROM @actOn a WHERE NOT EXISTS (SELECT 1 FROM @wantOn w WHERE w.label = a.label))
            + (SELECT COUNT(*) FROM @wantOn w WHERE NOT EXISTS (SELECT 1 FROM @actOn a WHERE a.label = w.label)) AS nvarchar(20)),
       CASE WHEN NOT EXISTS (SELECT label FROM @actOn EXCEPT SELECT label FROM @wantOn)
             AND NOT EXISTS (SELECT label FROM @wantOn EXCEPT SELECT label FROM @actOn)
            THEN 1 ELSE 0 END;

-- 3. 仍 editable=0 的表头字段集合精确 = {单据编号, 来源, 状态}
DECLARE @wantOff TABLE (label nvarchar(60) PRIMARY KEY);
INSERT INTO @wantOff (label) VALUES (N'单据编号'), (N'来源'), (N'状态');
DECLARE @actOff TABLE (label nvarchar(60));
INSERT INTO @actOff (label)
SELECT label FROM yj_field WHERE panel_code = 'ASM_BOM' AND place LIKE N'%header%' AND editable = 0;
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 3, N'仍只读表头集合(= 单据编号/来源/状态)', N'0 差异',
       CAST((SELECT COUNT(*) FROM @actOff a WHERE NOT EXISTS (SELECT 1 FROM @wantOff w WHERE w.label = a.label))
            + (SELECT COUNT(*) FROM @wantOff w WHERE NOT EXISTS (SELECT 1 FROM @actOff a WHERE a.label = w.label)) AS nvarchar(20)),
       CASE WHEN NOT EXISTS (SELECT label FROM @actOff EXCEPT SELECT label FROM @wantOff)
             AND NOT EXISTS (SELECT label FROM @wantOff EXCEPT SELECT label FROM @actOff)
            THEN 1 ELSE 0 END;

-- 4. 参照字段条数 = 2
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 4, N'参照字段条数(data_type=参照)', N'2', CAST(COUNT(*) AS nvarchar(20)),
       CASE WHEN COUNT(*) = 2 THEN 1 ELSE 0 END
  FROM yj_field WHERE panel_code = 'ASM_BOM' AND data_type = N'参照';

-- 5. 参照配置:产品编码 + 子件编码,均 ref_panel=INV / ref_field=存货编码 / display_field=存货名称
DECLARE @wantRef TABLE (label nvarchar(60) PRIMARY KEY);
INSERT INTO @wantRef (label) VALUES (N'产品编码'), (N'子件编码');
DECLARE @actRef TABLE (label nvarchar(60));
INSERT INTO @actRef (label)
SELECT label FROM yj_field
 WHERE panel_code = 'ASM_BOM' AND data_type = N'参照'
   AND ref_panel = N'INV' AND ref_field = N'存货编码' AND display_field = N'存货名称';
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 5, N'参照配置集合(=产品编码/子件编码,INV 存货编码->存货名称)', N'0 差异',
       CAST((SELECT COUNT(*) FROM @actRef a WHERE NOT EXISTS (SELECT 1 FROM @wantRef w WHERE w.label = a.label))
            + (SELECT COUNT(*) FROM @wantRef w WHERE NOT EXISTS (SELECT 1 FROM @actRef a WHERE a.label = w.label)) AS nvarchar(20)),
       CASE WHEN NOT EXISTS (SELECT label FROM @actRef EXCEPT SELECT label FROM @wantRef)
             AND NOT EXISTS (SELECT label FROM @wantRef EXCEPT SELECT label FROM @actRef)
            THEN 1 ELSE 0 END;

-- 6. 默认BOM data_type = 下拉框
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 6, N'默认BOM data_type', N'下拉框', ISNULL(MAX(data_type), N'<缺失>'),
       CASE WHEN SUM(CASE WHEN data_type = N'下拉框' THEN 1 ELSE 0 END) = 1 THEN 1 ELSE 0 END
  FROM yj_field WHERE panel_code = 'ASM_BOM' AND label = N'默认BOM';

-- 7. 默认BOM 字典含 是/否
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 7, N'默认BOM 字典(dict_sql 含 是/否)', N'含 是 + 否', ISNULL(MAX(dict_sql), N'<空>'),
       CASE WHEN SUM(CASE WHEN dict_sql LIKE N'%是%' AND dict_sql LIKE N'%否%' THEN 1 ELSE 0 END) = 1 THEN 1 ELSE 0 END
  FROM yj_field WHERE panel_code = 'ASM_BOM' AND label = N'默认BOM';

-- 8. 默认BOM 保持 editable=1
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 8, N'默认BOM editable', N'1(true)', CAST(ISNULL(MAX(CAST(editable AS int)), -1) AS nvarchar(20)),
       CASE WHEN SUM(CASE WHEN editable = 1 THEN 1 ELSE 0 END) = 1 THEN 1 ELSE 0 END
  FROM yj_field WHERE panel_code = 'ASM_BOM' AND label = N'默认BOM';

-- 9. yj_panel.config 含 headDefaults
DECLARE @cfg nvarchar(max);
SELECT @cfg = config FROM yj_panel WHERE panel_code = 'ASM_BOM';
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 9, N'yj_panel.config 含 headDefaults', N'1', CASE WHEN @cfg LIKE N'%headDefaults%' THEN N'1' ELSE N'0' END,
       CASE WHEN @cfg LIKE N'%headDefaults%' THEN 1 ELSE 0 END;

-- 10. yj_panel.config 含 状态=启用
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 10, N'yj_panel.config 含 状态/启用', N'1',
       CASE WHEN @cfg LIKE N'%状态%' AND @cfg LIKE N'%启用%' THEN N'1' ELSE N'0' END,
       CASE WHEN @cfg LIKE N'%状态%' AND @cfg LIKE N'%启用%' THEN 1 ELSE 0 END;

-- 11. 面板字段总数仍 19(不许增删字段行)
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 11, N'面板字段总数', N'19', CAST(COUNT(*) AS nvarchar(20)),
       CASE WHEN COUNT(*) = 19 THEN 1 ELSE 0 END
  FROM yj_field WHERE panel_code = 'ASM_BOM';

-- 12. 面板形态未变:1 行、doc、line_table=bs_asm_bom、head_table=NULL、group_col=单据编号
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 12, N'面板行数与形态(doc/bs_asm_bom/head_table NULL/单据编号)', N'1 行且形态不变',
       CAST(COUNT(*) AS nvarchar(20)) + N' 行',
       CASE WHEN COUNT(*) = 1 AND SUM(CASE WHEN mode = 'doc' AND line_table = 'bs_asm_bom'
                                             AND head_table IS NULL AND group_col = N'单据编号' THEN 1 ELSE 0 END) = 1
            THEN 1 ELSE 0 END
  FROM yj_panel WHERE panel_code = 'ASM_BOM';

-- 13. 物理表未动:bs_asm_bom 仍 47 列
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 13, N'bs_asm_bom 列数(本迁移不改表结构)', N'47',
       CAST(COUNT(*) AS nvarchar(20)),
       CASE WHEN COUNT(*) = 47 THEN 1 ELSE 0 END
  FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_asm_bom');

-- 14. 表头 备注 指向的物理列仍在
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 14, N'bs_asm_bom.备注 列存在', N'1',
       CASE WHEN COL_LENGTH('dbo.bs_asm_bom', N'备注') IS NOT NULL THEN N'1' ELSE N'0' END,
       CASE WHEN COL_LENGTH('dbo.bs_asm_bom', N'备注') IS NOT NULL THEN 1 ELSE 0 END;

-- 15. 明细 子件编码 仍可编辑(选料在明细行内可改)
INSERT INTO @chk (seq, item, expected, actual, ok)
SELECT 15, N'子件编码 明细可编辑', N'1',
       CAST(COUNT(*) AS nvarchar(20)),
       CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END
  FROM yj_field WHERE panel_code = 'ASM_BOM' AND label = N'子件编码'
   AND place LIKE N'%detail%' AND editable = 1;

-- ══════════ 汇总输出:逐项 PASS/FAIL + 违规项数 + RESULT ══════════
SELECT seq, item, expected, actual, CASE WHEN ok = 1 THEN N'PASS' ELSE N'FAIL' END AS verdict
  FROM @chk
UNION ALL
SELECT 900, N'违规项数(violations)', N'0', CAST((SELECT COUNT(*) FROM @chk WHERE ok = 0) AS nvarchar(20)),
       CASE WHEN (SELECT COUNT(*) FROM @chk WHERE ok = 0) = 0 THEN N'PASS' ELSE N'FAIL' END
UNION ALL
SELECT 999, N'== RESULT ==', N'PASS',
       CAST((SELECT COUNT(*) FROM @chk WHERE ok = 1) AS nvarchar(20)) + N'/' + CAST((SELECT COUNT(*) FROM @chk) AS nvarchar(20)) + N' 项通过',
       CASE WHEN (SELECT COUNT(*) FROM @chk WHERE ok = 0) = 0 THEN N'RESULT: PASS' ELSE N'RESULT: FAIL' END
 ORDER BY seq;
GO

-- 16. 登记信息(信息项,不参与 PASS/FAIL):DbSync run 成功会写 yj_schema_log;手工执行则可能为空
SELECT DB_NAME() AS db_name,
       N'migrate-asm-bom-maintainable-20261104.sql' AS script_name,
       ISNULL((SELECT content_hash   FROM yj_schema_log WHERE script_name = N'migrate-asm-bom-maintainable-20261104.sql'), N'<未登记>') AS content_hash,
       CONVERT(varchar(19), (SELECT applied_at FROM yj_schema_log WHERE script_name = N'migrate-asm-bom-maintainable-20261104.sql'), 120) AS applied_at;
GO
