-- 2026-11-17 「来料检验单审核自动生单 → 草稿消息」E2E 造数(仅测试库 HSDZ_MES_TEST)
--
-- 目的:测试库里 QC_INSP 只剩 IJ-2026-11-0001 一张活草稿,而它的 合格数量/不合格数量 都是 NULL
--       ⇒ 审核过不了「合格数量必填」闸门,也不会生成任何下游单。为验证消息链路,把已作废的
--       IJ-2026-11-0019(1 行:送检 10 / 合格 8 / 不合格 2,历史上成功生成过 PI + TH)整表复制成一张新草稿。
-- 口径:整表列序动态拼接,除 identity id 外一字不改;明细的 入库单号 置 NULL(属上一轮生单回填);
--       计算列(如明细的 不良数量)一律按 is_computed = 0 排除。
-- 用法:改下面 @new 即可反复造数(脚本幂等:先删同号再插)。
-- ⚠ 两账套兼容级别都是 100(SQL Server 2008 口径)⇒ 不能用 STRING_AGG/WITHIN GROUP,只能 FOR XML PATH。
SET NOCOUNT ON;

DECLARE @new nvarchar(40) = N'IJ-2026-11-0022';   -- ← 本次要造的检验单号
DECLARE @src nvarchar(40) = N'IJ-2026-11-0019';   -- ← 复制来源(已作废、含合格/不合格各一行)

-- 幂等:重跑前先清掉上一轮(明细/头;无外键,先明细后头)
DELETE FROM qc_insp_detail WHERE 单据编号 = @new;
DELETE FROM qc_insp WHERE 单据编号 = @new;

DECLARE @cols nvarchar(max), @sel nvarchar(max), @where nvarchar(max);
SELECT @cols = STUFF((SELECT ',' + QUOTENAME(name) FROM sys.columns
                       WHERE object_id = OBJECT_ID('qc_insp') AND name <> N'id' AND is_computed = 0
                       ORDER BY column_id FOR XML PATH('')), 1, 1, ''),
       @sel  = STUFF((SELECT ',' + CASE WHEN name = N'单据编号' THEN N'N''' + @new + N'''' ELSE QUOTENAME(name) END
                        FROM sys.columns WHERE object_id = OBJECT_ID('qc_insp') AND name <> N'id' AND is_computed = 0
                       ORDER BY column_id FOR XML PATH('')), 1, 1, '');
SET @where = N' FROM qc_insp WHERE 单据编号 = N''' + @src + N'''';
EXEC(N'INSERT INTO qc_insp (' + @cols + N') SELECT ' + @sel + @where);

DECLARE @cols2 nvarchar(max), @sel2 nvarchar(max), @where2 nvarchar(max);
SELECT @cols2 = STUFF((SELECT ',' + QUOTENAME(name) FROM sys.columns
                        WHERE object_id = OBJECT_ID('qc_insp_detail') AND name <> N'id' AND is_computed = 0
                        ORDER BY column_id FOR XML PATH('')), 1, 1, ''),
       @sel2  = STUFF((SELECT ',' + CASE WHEN name = N'单据编号' THEN N'N''' + @new + N''''
                                          WHEN name = N'入库单号' THEN N'NULL'
                                          ELSE QUOTENAME(name) END
                        FROM sys.columns WHERE object_id = OBJECT_ID('qc_insp_detail') AND name <> N'id' AND is_computed = 0
                       ORDER BY column_id FOR XML PATH('')), 1, 1, '');
SET @where2 = N' FROM qc_insp_detail WHERE 单据编号 = N''' + @src + N''' AND ISNULL(asp_cancel,''N'') <> ''Y''';
EXEC(N'INSERT INTO qc_insp_detail (' + @cols2 + N') SELECT ' + @sel2 + @where2);

SELECT (SELECT COUNT(*) FROM qc_insp WHERE 单据编号 = @new) AS X头行数,
       (SELECT COUNT(*) FROM qc_insp_detail WHERE 单据编号 = @new) AS X明细行数;
SELECT id, 物料编码, 送检数量, 合格数量, 不合格数量, ISNULL(入库单号, N'(空)') AS 入库单号
  FROM qc_insp_detail WHERE 单据编号 = @new;
