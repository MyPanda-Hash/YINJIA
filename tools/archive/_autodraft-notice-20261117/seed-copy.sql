-- 2026-11-17 「来料检验单审核自动生单 → 生产销售/仓库审核 知情消息」E2E 造数(仅测试库 HSDZ_MES_TEST)
-- 目的:测试库里 QC_INSP 只剩 IJ-2026-11-0001 一张活草稿,且它的 合格数量/不合格数量 都是 NULL ⇒ 审核既过不了
--       「合格数量必填」闸门,也不会生成任何下游单。为验证消息链路,把已作废的 IJ-2026-11-0019
--       (1 行:送检 10 / 合格 8 / 不合格 2,曾成功生成过 PI + TH)原样复制成一张新草稿 IJ-2026-11-0021。
-- 口径:整表列序动态拼接,除 identity id 外一字不改;明细的 入库单号 置 NULL(它属于上一轮生单回填)。
-- ⚠ 两个账套的兼容级别都是 100(SQL Server 2008 口径)⇒ 不能用 STRING_AGG/WITHIN GROUP,只能 FOR XML PATH。
SET NOCOUNT ON;

-- 幂等:重跑前先清掉上一轮(明细/头;明细无外键,先明细后头)
DELETE FROM qc_insp_detail WHERE 单据编号 = N'IJ-2026-11-0021';
DELETE FROM qc_insp WHERE 单据编号 = N'IJ-2026-11-0021';

-- ⚠ 计算列(如明细的 不良数量)不能出现在 INSERT 列表里 ⇒ 一律按 is_computed = 0 过滤
DECLARE @cols nvarchar(max), @sel nvarchar(max);
SELECT @cols = STUFF((SELECT ',' + QUOTENAME(name) FROM sys.columns
                       WHERE object_id = OBJECT_ID('qc_insp') AND name <> N'id' AND is_computed = 0
                       ORDER BY column_id FOR XML PATH('')), 1, 1, ''),
       @sel  = STUFF((SELECT ',' + CASE WHEN name = N'单据编号' THEN N'N''IJ-2026-11-0021''' ELSE QUOTENAME(name) END
                        FROM sys.columns WHERE object_id = OBJECT_ID('qc_insp') AND name <> N'id' AND is_computed = 0
                       ORDER BY column_id FOR XML PATH('')), 1, 1, '');
EXEC('INSERT INTO qc_insp (' + @cols + ') SELECT ' + @sel + ' FROM qc_insp WHERE 单据编号 = N''IJ-2026-11-0019''');

DECLARE @cols2 nvarchar(max), @sel2 nvarchar(max);
SELECT @cols2 = STUFF((SELECT ',' + QUOTENAME(name) FROM sys.columns
                        WHERE object_id = OBJECT_ID('qc_insp_detail') AND name <> N'id' AND is_computed = 0
                        ORDER BY column_id FOR XML PATH('')), 1, 1, ''),
       @sel2  = STUFF((SELECT ',' + CASE WHEN name = N'单据编号' THEN N'N''IJ-2026-11-0021'''
                                          WHEN name = N'入库单号' THEN N'NULL'
                                          ELSE QUOTENAME(name) END
                        FROM sys.columns WHERE object_id = OBJECT_ID('qc_insp_detail') AND name <> N'id' AND is_computed = 0
                       ORDER BY column_id FOR XML PATH('')), 1, 1, '');
PRINT 'DETAIL COLS: ' + @sel2;
EXEC('INSERT INTO qc_insp_detail (' + @cols2 + ') SELECT ' + @sel2 + ' FROM qc_insp_detail'
   + ' WHERE 单据编号 = N''IJ-2026-11-0019'' AND ISNULL(asp_cancel,''N'') <> ''Y''');

SELECT (SELECT COUNT(*) FROM qc_insp WHERE 单据编号 = N'IJ-2026-11-0021') AS 头行数,
       (SELECT COUNT(*) FROM qc_insp_detail WHERE 单据编号 = N'IJ-2026-11-0021') AS 明细行数;
SELECT id, 物料编码, 送检数量, 合格数量, 不合格数量, ISNULL(入库单号, N'(空)') AS 入库单号
  FROM qc_insp_detail WHERE 单据编号 = N'IJ-2026-11-0021';
