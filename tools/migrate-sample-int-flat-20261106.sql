-- migrate-sample-int-flat-20261106.sql — 内部（开发样品申请单）改成「共享表」：不审批、行可增删、表头可筛选、每页 10/20/50
--
-- 用户口径(2026-11-06)原文：
--   「这个单进行一个调整，表头字段可以搜索筛选查询，这个内部的样品的不需要审批，样品状态字段允许进行修改，
--     这个表可以新增数据行进行填写，不需要提交审批，就是一个共享文件面板，可以设置10行/20行/50行进行页面切换，
--     防止一页数据太多了」
--
-- 改前：RD_SAMPLE_INT 是**头行式文书面板**(mode=doc, head=rd_sample_int_head / line=rd_sample_int_detail,
--   走 提交审批 → 确认 两步流程)。实测 14 个业务字段**全在头表**，明细表只有单据编号+留痕列 ——
--   也就是说这张单本来就是"一行一条申请"，只是被头行结构 + 审批壳套住了。
--
-- 改后：mode='archive' + head_table=NULL + line_table=rd_sample_int_head（**单表长列表**，
--   架构与 商品档案(INV)/共享文件库(RD_SHARE_FILE) 同一套）：
--     · 列表每行一条样品申请，行内直接编辑、可「新增行 / 作废行」；
--     · 表头每列都有 🔍 筛选（含升降序）—— 就是用户要的「像 excel 表格一样筛选查询」；
--     · 无审批：档案面板没有 提交审批/审批通过 按钮，保存即生效；
--     · 每页条数 10/20/50（前端 ARCH_SIZE_OPTS 同步补这三个档位），超过就翻页。
--     · 单据编号(SPN-…) 由后端在 saveArchive 插入行时按 prefix 自动出号（见 ButtonService 该处注释），
--       仅当面板同时声明 code_col + prefix 时生效 —— 现存档案里没有别的面板命中，零影响。
--
-- 数据：19 行(生产)/2 行(本地) 原样留在 rd_sample_int_head，不需要搬表；旧的 rd_sample_int_detail
--   （只有留痕列、无业务数据）保留留档，不再被面板引用。
-- 幂等：UPDATE 带窄条件 + 行数守卫；字段 place/seq 一律按 label 重设，重跑结果不变。
-- 适用：本地/生产通用（先正式 HSDZ_MES、后测试 HSDZ_MES_TEST）。

IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ── 1. 面板改「档案(单表长列表)」 ──────────────────────────────────────────
DECLARE @n INT;
UPDATE yj_panel
SET mode = N'archive',
    line_table = N'rd_sample_int_head',
    head_table = NULL,
    group_col = NULL,
    page_size = 20
WHERE panel_code = N'RD_SAMPLE_INT';
SET @n = @@ROWCOUNT;
IF @n <> 1 RAISERROR(N'[FAIL] RD_SAMPLE_INT 改档案式命中 %d 行(期望 1)', 12, 1, @n) WITH NOWAIT;
GO

-- ── 2. 字段：全部落到列表列 + 查询条件（表头可筛选/可查） ──────────────────
DECLARE @n2 INT;
UPDATE yj_field SET place = N'query,detail' WHERE panel_code = N'RD_SAMPLE_INT';
SET @n2 = @@ROWCOUNT;
IF @n2 < 12 RAISERROR(N'[FAIL] RD_SAMPLE_INT 字段 place 只更新了 %d 行(期望 ≥12)', 12, 1, @n2) WITH NOWAIT;
GO

-- ── 3. 列序按用户截图：申请日期(单据日期) / 申请人 / 样品编号(单据编号) / 项目名 …
--      只改 seq，不动 col_name / label（label 就是数据键，改它等于改契约）。
UPDATE yj_field SET seq = CASE label
    WHEN N'单据日期'   THEN 10
    WHEN N'申请人'     THEN 20
    WHEN N'单据编号'   THEN 30
    WHEN N'项目名'     THEN 40
    WHEN N'炭棒尺寸'   THEN 50
    WHEN N'数量'       THEN 60
    WHEN N'样品背景'   THEN 70
    WHEN N'配方要求'   THEN 80
    WHEN N'工艺要求'   THEN 90
    WHEN N'物料批次要求' THEN 100
    WHEN N'期望交期'   THEN 110
    WHEN N'确认人'     THEN 120
    WHEN N'样品状态'   THEN 130
    WHEN N'备注'       THEN 140
    ELSE seq END
WHERE panel_code = N'RD_SAMPLE_INT';
GO

-- ── 4. 共享表口径：申请人/确认人可手填（原来由审批链回写、只读）；
--      样品状态本来就 editable=1，这里再钉一次，避免以后被别的脚本改回只读。
UPDATE yj_field SET editable = 1
WHERE panel_code = N'RD_SAMPLE_INT' AND label IN (N'申请人', N'确认人', N'样品状态');
GO

-- ── 5. 自检 ────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'RD_SAMPLE_INT'
               AND mode = N'archive' AND line_table = N'rd_sample_int_head' AND head_table IS NULL)
  RAISERROR(N'[FAIL] RD_SAMPLE_INT 未切成单表档案式', 12, 1) WITH NOWAIT;
GO
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'RD_SAMPLE_INT' AND place LIKE N'%detail%') < 12
  RAISERROR(N'[FAIL] RD_SAMPLE_INT 的列表列不足 12 个', 12, 1) WITH NOWAIT;
GO
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_SAMPLE_INT'
           AND label IN (N'样品状态', N'申请人', N'确认人') AND ISNULL(editable, 0) = 0)
  RAISERROR(N'[FAIL] 样品状态/申请人/确认人 仍有不可编辑的', 12, 1) WITH NOWAIT;
GO

SELECT panel_code, mode, line_table, head_table, group_col, code_col, prefix, page_size FROM yj_panel WHERE panel_code = N'RD_SAMPLE_INT';
GO
SELECT seq, label, place, editable FROM yj_field WHERE panel_code = N'RD_SAMPLE_INT' ORDER BY seq;
GO
RAISERROR(N'[PASS] 内部开发样品申请单已是共享表（单表长列表 · 无审批 · 列可筛选 · 每页 10/20/50）', 10, 1) WITH NOWAIT;
GO
