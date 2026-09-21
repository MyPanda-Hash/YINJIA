/* ═══════════════════════════════════════════════════════════════════════════════
   migrate-mold-proc-revision.sql — 成型工艺清单补「修订记录」页签(2026-09-20)

   口径(用户):「给成型工艺清单也加上一个修订记录的页签,和组装工艺清单的一样」⇒
     页签 0 = 修订记录,列与组装工艺清单的修订记录页**逐字一致**
     (表区隐藏 / 序号 / 更改内容 / 更改原因 / 更改时间 / 责任人 / 备注)。
     页序、列序、列宽、设计像素都在**前端配置** recordSheetConfigs.js
     (RD_MOLD_PROC_DT_REVISION,断言⑦钉住与 RD_ASM_PROC 那份一致);本脚本只管"能不能落库/能不能读回"。

   两处改动:
     ① rd_mold_proc_detail 补 5 列(与 rd_asm_proc_detail **同名同型**)——
        行表已有 [表区]/[序号] + 配方表 8 列,修订记录行与配方行**共用同一张行表**,
        靠 [表区] 分块(修订记录 / 配方表),不新建物理表。
     ② [表区] 由 place='header' **改挂 'detail'** ——
        明细查询只取 place='detail' 的列(QueryService.loadDocs → fieldsAt("detail")),
        留在 header 时明细行上的 [表区] 永远查不回来,而前端 rowsOf() 正是按它过滤 ⇒
        **两张表重开单据都一行都看不见**(新增行当场看得见,保存后重开就空 —— 组装侧 2026-09-20 踩过同一个坑)。
        改挂而不是新增一行:同一面板内 label 不得重复
        (前端断言③ + PanelRegistry.byLabel/labelToCol 只取首个,重复会取错列)。

   [备注] 说明:RD_MOLD_PROC 早已有 place='header' 的 [备注](纸面未用),本轮再登记一条
     place='detail' 的 [备注] —— 明细查询按 place 取列,没有 detail 行这一列就查不回来;
     两行的 col_name 相同(都指向物理列 [备注]),fixture 按 col_name 归并,不会触发"label 重复"。

   幂等:列走 IF COL_LENGTH IS NULL;字段行按 (panel_code, col_name, place) NOT EXISTS 去重;
        列注释按 sys.extended_properties 判重(不覆盖既有描述)。
   用法:java -cp lib\mssql-jdbc.jar SqlRunner.java <jdbcUrl> yinjia env tools\migrate-mold-proc-revision.sql
        (或 sqlcmd -f 65001 -i —— 本机 sqlcmd **输出**编码跟随控制台 GBK,核对中文请走 JDBC/API)
   ═══════════════════════════════════════════════════════════════════════════════ */
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 1. 行表补列(类型与 rd_asm_proc_detail 的同名列一致,便于两面板对照)
-- ═══════════════════════════════════════════════════════════════════
BEGIN TRY
IF COL_LENGTH('rd_mold_proc_detail', N'更改内容') IS NULL ALTER TABLE rd_mold_proc_detail ADD [更改内容] nvarchar(1000) NULL;
IF COL_LENGTH('rd_mold_proc_detail', N'更改原因') IS NULL ALTER TABLE rd_mold_proc_detail ADD [更改原因] nvarchar(400)  NULL;
IF COL_LENGTH('rd_mold_proc_detail', N'更改时间') IS NULL ALTER TABLE rd_mold_proc_detail ADD [更改时间] nvarchar(100)  NULL;
IF COL_LENGTH('rd_mold_proc_detail', N'责任人')   IS NULL ALTER TABLE rd_mold_proc_detail ADD [责任人]   nvarchar(100)  NULL;
IF COL_LENGTH('rd_mold_proc_detail', N'备注')     IS NULL ALTER TABLE rd_mold_proc_detail ADD [备注]     nvarchar(400)  NULL;
END TRY BEGIN CATCH PRINT N'rd_mold_proc_detail 加列跳过'; END CATCH;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 2. [表区] 由 header 改挂 detail(字典 = 本面板两张逻辑表的表区值)
--    ⚠ 不能新增一条 detail 表区:同面板 label 不得重复,必须改挂同一行。
-- ═══════════════════════════════════════════════════════════════════
UPDATE yj_field
   SET place = N'detail',
       seq = 4,
       hidden = 0,
       width = 90,
       dict_sql = N'SELECT v FROM (VALUES (N''修订记录''),(N''配方表'')) AS t(v)'
 WHERE panel_code = N'RD_MOLD_PROC' AND col_name = N'表区' AND place = N'header';
GO

-- ═══════════════════════════════════════════════════════════════════
-- 3. 明细字段登记(label 即数据键;seq 100.. 避开配方表既有 10..70)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.place, v.seq, v.width, v.editable, v.required, v.hidden, v.visible
FROM (VALUES
  ('RD_MOLD_PROC', N'更改内容', N'更改内容', N'文本', N'detail', 100, 200, 1, 0, 0, 1),
  ('RD_MOLD_PROC', N'更改原因', N'更改原因', N'文本', N'detail', 110, 140, 1, 0, 0, 1),
  ('RD_MOLD_PROC', N'更改时间', N'更改时间', N'文本', N'detail', 120, 100, 1, 0, 0, 1),
  ('RD_MOLD_PROC', N'责任人',   N'责任人',   N'文本', N'detail', 130,  90, 1, 0, 0, 1),
  ('RD_MOLD_PROC', N'备注',     N'备注',     N'文本', N'detail', 140, 200, 1, 0, 0, 1)
) AS v(panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                   WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name AND f.place = v.place);
GO

-- 译名:5 个 label 全部是**跨面板共享的中文键**(RD_ASM_PROC/RD_SPEC_DOC 早在用),
-- 译名行 scope='field' 按 label 全局共享 ⇒ 无需新增(AGENTS.md 多语言规范:已有译名的标签不重复插)。
-- 页签题「修订记录」同理:组装侧 i18n-asm-proc-redesign.sql 已给 10 语言。

-- ═══════════════════════════════════════════════════════════════════
-- 4. 列注释(MS_Description;已有不覆盖,列不存在跳过)
-- ═══════════════════════════════════════════════════════════════════
IF OBJECT_ID('tempdb..#revisioncols') IS NOT NULL DROP TABLE #revisioncols;
CREATE TABLE #revisioncols (col sysname PRIMARY KEY, descr nvarchar(400));
INSERT INTO #revisioncols (col, descr) VALUES
  (N'更改内容', N'修订记录·更改内容(成型工艺清单页签0;与 rd_asm_proc_detail 同名同型)'),
  (N'更改原因', N'修订记录·更改原因(成型工艺清单页签0)'),
  (N'更改时间', N'修订记录·更改时间(成型工艺清单页签0)'),
  (N'责任人',   N'修订记录·责任人(成型工艺清单页签0)'),
  (N'备注',     N'修订记录·备注(成型工艺清单页签0;头表另有同名历史列)');
DECLARE @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM #revisioncols;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH('rd_mold_proc_detail', @c) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                      WHERE major_id = OBJECT_ID('rd_mold_proc_detail') AND name = 'MS_Description'
                        AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_mold_proc_detail'), @c, 'ColumnId'))
    EXEC sp_addextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', N'rd_mold_proc_detail', N'COLUMN', @c;
  FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 5. 校验输出(列在位 + [表区] 已挂 detail)
-- ═══════════════════════════════════════════════════════════════════
SELECT N'rd_mold_proc_detail.更改内容' AS 检查项, CASE WHEN COL_LENGTH('rd_mold_proc_detail', N'更改内容') IS NULL THEN N'MISSING' ELSE N'OK' END AS 结果
UNION ALL SELECT N'rd_mold_proc_detail.更改原因', CASE WHEN COL_LENGTH('rd_mold_proc_detail', N'更改原因') IS NULL THEN N'MISSING' ELSE N'OK' END
UNION ALL SELECT N'rd_mold_proc_detail.更改时间', CASE WHEN COL_LENGTH('rd_mold_proc_detail', N'更改时间') IS NULL THEN N'MISSING' ELSE N'OK' END
UNION ALL SELECT N'rd_mold_proc_detail.责任人',   CASE WHEN COL_LENGTH('rd_mold_proc_detail', N'责任人')   IS NULL THEN N'MISSING' ELSE N'OK' END
UNION ALL SELECT N'rd_mold_proc_detail.备注',     CASE WHEN COL_LENGTH('rd_mold_proc_detail', N'备注')     IS NULL THEN N'MISSING' ELSE N'OK' END
UNION ALL SELECT N'yj_field RD_MOLD_PROC.表区@detail', CAST(COUNT(*) AS nvarchar) + N' 行(应为 1)'
  FROM yj_field WHERE panel_code = N'RD_MOLD_PROC' AND col_name = N'表区' AND place = N'detail';
GO
SELECT place, seq, col_name, label FROM yj_field
WHERE panel_code = N'RD_MOLD_PROC' AND place = N'detail' ORDER BY seq;
GO
PRINT N'migrate-mold-proc-revision.sql 完成:成型工艺清单补修订记录页签(页签 0)';
GO
