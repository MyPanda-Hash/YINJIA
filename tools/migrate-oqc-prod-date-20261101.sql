/* migrate-oqc-prod-date-20261101.sql(2026-11-01 14:0x):出厂检验报告 —— 生产日期随生产批次带入
 *
 * 背景(用户 2026-11-01 下午报障)：「当前如果是带入了批次号为什么连生产日期都没有呢？」
 *   · 生成代码 createOne 里 生产日期 **固定写 NULL**(2026-10-30 设计口径「业务未录 → 纸上留空」);
 *   · 报告取数的成品检验单 qc_asm_insp_head **没有生产日期列**,所以批次号带进来了、生产日期一直空;
 *   · 批次号 = 完工时自动生成的「完工日」标签(实测 20261017 ↔ plang.完工时间 2026-10-17)。
 *
 * 本脚本把**存量报告**的生产日期按同一口径回填(新生成由 OqcReportService.resolveProductionDate 写入),
 * 优先级与 Java 实现一致(2026-11-01 定:批次号 = 完工日,优先于首件检验日的兜底):
 *   ① 工单行完工时间(plang.完工时间,按 工单号+工单行号 定位);
 *   ② 批次号可解析为 yyyyMMdd → 该日期(完工日标签;旧数据没有完工时间时的等价来源);
 *   ③ 首件检验单.生产日期(同 工单号+工单行号)兜底。
 * 只填 NULL,不改已有值(④ 仅更正本脚本首版按错误顺序回填的行);都推不出来的保持 NULL。幂等。
 * 两账套执行(正式 HSDZ_MES / 测试 HSDZ_MES_TEST)。
 */

/* ============ A. ① 从工单行完工时间回填 ============ */
UPDATE h
   SET h.[生产日期] = CONVERT(date, p.[完工时间])
  FROM dbo.qc_oqc_head h
  JOIN dbo.plang p
    ON p.[pl_no] = h.[工单号]
   AND ISNULL(p.[pl_xc], 0) = ISNULL(h.[工单行号], 0)
   AND ISNULL(p.[asp_cancel], 'N') <> 'Y'
 WHERE h.[生产日期] IS NULL
   AND ISNULL(h.[工单号], N'') <> N''
   AND p.[完工时间] IS NOT NULL;
PRINT N'[OK] ① 生产日期 · 工单行完工时间回填';

/* ============ B. ② 从批次号(yyyyMMdd,完工日标签)回填 ============ */
-- ⚠ 正式/测试库 compatibility_level = 100(兼容 SQL Server 2008),**没有 TRY_CONVERT**;
--   用 ISDATE() 先判合法日期,再用 CONVERT(date, xxx, 23) 严格转换(2026-11-01 首跑踩坑)。
UPDATE dbo.qc_oqc_head
   SET [生产日期] = CONVERT(date, STUFF(STUFF([批次号], 5, 0, N'-'), 8, 0, N'-'), 23)
 WHERE [生产日期] IS NULL
   AND ISNULL([批次号], N'') LIKE N'[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
   AND ISDATE(STUFF(STUFF([批次号], 5, 0, N'-'), 8, 0, N'-')) = 1;
PRINT N'[OK] ② 生产日期 · 批次号(完工日标签)回填';

/* ============ C. ③ 从首件检验单生产日期回填(仅剩 NULL 的;首件日可能早于完工日,作兜底) ============ */
UPDATE h
   SET h.[生产日期] = CONVERT(date, f.[生产日期])
  FROM dbo.qc_oqc_head h
  JOIN dbo.qc_first_insp_head f
    ON f.[工单号] = h.[工单号]
   AND ISNULL(f.[工单行号], 0) = ISNULL(h.[工单行号], 0)
   AND ISNULL(f.[asp_cancel], 'N') <> 'Y'
 WHERE h.[生产日期] IS NULL
   AND ISNULL(h.[工单号], N'') <> N''
   AND f.[生产日期] IS NOT NULL;
PRINT N'[OK] ③ 生产日期 · 首件检验单兜底回填';

/* ============ D. ④ 更正首版顺序错误(首件日 先于 批次日 回填的行) ============ */
-- 首版脚本把「首件检验单生产日期」排在「批次号」之前,导致本轮已回填的行可能写成首件日
-- (例:测试账套 OQC-2026-11-0003 = 2026-10-15,而批次 20261017 ⇒ 应为 2026-10-17)。
-- 只在「当前值恰好等于该工单行首件检验单生产日期、且与批次日不同」时更正 —— 不覆盖人工填写值。
UPDATE h
   SET h.[生产日期] = CONVERT(date, STUFF(STUFF(h.[批次号], 5, 0, N'-'), 8, 0, N'-'), 23)
  FROM dbo.qc_oqc_head h
  JOIN dbo.qc_first_insp_head f
    ON f.[工单号] = h.[工单号]
   AND ISNULL(f.[工单行号], 0) = ISNULL(h.[工单行号], 0)
   AND ISNULL(f.[asp_cancel], 'N') <> 'Y'
 WHERE ISNULL(h.[批次号], N'') LIKE N'[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
   AND ISDATE(STUFF(STUFF(h.[批次号], 5, 0, N'-'), 8, 0, N'-')) = 1
   AND h.[生产日期] = CONVERT(date, f.[生产日期])
   AND h.[生产日期] <> CONVERT(date, STUFF(STUFF(h.[批次号], 5, 0, N'-'), 8, 0, N'-'), 23);
PRINT N'[OK] ④ 生产日期 · 首版顺序更正(首件日 → 批次日)';
GO

/* ============ E. 「生产日期」列中文注明(补注:说明取自哪里) ============ */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.qc_oqc_head')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_oqc_head'), N'生产日期', 'ColumnId')
                 AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description',
       N'生产日期(生成报告时按生产批次带入):①工单行完工时间 plang.完工时间 ②批次号可解析 yyyyMMdd ③首件检验单生产日期;都取不到留空',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_oqc_head', N'COLUMN', N'生产日期';
ELSE
  PRINT N'[SKIP] 生产日期 列注明已存在';
GO

/* ============ F. 自检 ============ */
DECLARE @bad int = (
  SELECT COUNT(*) FROM dbo.qc_oqc_head h
   WHERE ISNULL(h.[批次号], N'') LIKE N'[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
     AND ISDATE(STUFF(STUFF(h.[批次号], 5, 0, N'-'), 8, 0, N'-')) = 1
     AND h.[生产日期] IS NOT NULL
     AND h.[生产日期] <> CONVERT(date, STUFF(STUFF(h.[批次号], 5, 0, N'-'), 8, 0, N'-'), 23)
     AND EXISTS (SELECT 1 FROM dbo.qc_first_insp_head f
                  WHERE f.[工单号] = h.[工单号] AND ISNULL(f.[工单行号],0) = ISNULL(h.[工单行号],0)
                    AND ISNULL(f.[asp_cancel],'N') <> 'Y' AND h.[生产日期] = CONVERT(date, f.[生产日期])));
IF @bad > 0 RAISERROR(N'生产日期回填自检失败:仍有 = 首件日 却未更正为批次日的报告', 16, 1);
DECLARE @filled int = (SELECT COUNT(*) FROM dbo.qc_oqc_head WHERE [生产日期] IS NOT NULL);
DECLARE @nulls int = (SELECT COUNT(*) FROM dbo.qc_oqc_head WHERE [生产日期] IS NULL);
PRINT N'生产日期回填完成:已有值 ' + CAST(@filled AS nvarchar(10)) + N' 张,空值 ' + CAST(@nulls AS nvarchar(10)) + N' 张(空=无批次/无工单行,属正常)';
GO
