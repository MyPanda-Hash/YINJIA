-- migrate-qc-insp-rec-material-ref-20261009.sql
-- 检验数据记录(QC_INSP_REC):「物料名称 / 物料编码」关联「商品」档案(INV),选一次商品两个一并填入
--
-- 【用户口径 · 2026-10-09】
--   「检验数据记录的物料名称和物料编码要关联商品,并且要两个一并填入。」
--
-- 【现状(改前实测,两账套一致)】
--   QC_INSP_REC 抬头两列都是**手填文本框**,与同族单据不一致:
--     物料名称 header seq30(文本,required=1)/ query seq10(文本)
--     物料编码 header seq40(文本)/ query seq20(文本)
--   而 来料检验单 QC_INSP / 送料暂收单 QC_RECV / 暂收退回单 QC_RETURN / 采购订单 PU_ORDER
--   这四张的写法是:物料编码 = 参照 INV/存货编码(display 存货名称)、物料名称 = 参照 INV/存货名称
--   —— 即「商品档案」的 存货编码 / 存货名称。
--
-- 【做法(纯元数据:零 DDL、零新表、零后端接口、零前端硬编码面板名/列名)】
--   ① 物料编码(header + query 两行):data_type 文本 → 参照,
--      ref_panel='INV', ref_field='存货编码', display_field='存货名称';
--   ② 物料名称(header + query 两行):data_type 文本 → 参照,
--      ref_panel='INV', ref_field='存货名称', display_field='存货名称'。
--
-- 【「两个一并填入」怎么来的 —— 不新造逻辑,复用既有参照带回机制】
--   参照带回映射由 PanelConfigService.buildRefMap 按「引用面板字段 → 本面板字段」现算,
--   其中同义词表 REF_SYNONYMS 已有两条(VO 存货档案 → 单据异名字段):
--       存货编码 → 材料编码 / 产品编码 / **物料编码**
--       存货名称 → 材料名称 / 产品名称 / **物料名称**
--   ⇒ 两列互为对方的回带目标:点「物料编码」选商品 → 物料名称同时填上;
--     点「物料名称」选商品 → 物料编码同时填上。前端只负责开参照弹窗 + 按 refMap 写值。
--
-- 【配套代码(同提交)】frontend/src/core/views/QcInspRecSheet.vue
--   抬头两格加商品参照控件(点击弹 RefPickDialog,确认后写 refField,再按 refMap 整串带回),
--   与 DataRecordSheet / RecordSheetPanels 的既有参照单元格同款。
--
-- 【幂等】UPDATE 按 (panel_code, col_name) 窄条件 —— 重复执行影响 0 行;
--   末尾自检「两列四行 = 参照/INV/正确的 ref_field」,不满足即 RAISERROR。
--   两个账套都执行:先 HSDZ_MES,后 HSDZ_MES_TEST。

SET NOCOUNT ON;

DECLARE @before int = (SELECT COUNT(*) FROM yj_field
                        WHERE panel_code = N'QC_INSP_REC' AND col_name IN (N'物料名称', N'物料编码'));
PRINT N'【改前】QC_INSP_REC 物料两列字段行数(应为 4 = 两列 x header/query):' + CAST(@before AS nvarchar(10));
IF @before <> 4
    RAISERROR(N'QC_INSP_REC 的 物料名称/物料编码 字段行数不是 4,先核对 yj_field 再执行本脚本', 16, 1);
GO

-- ① 物料编码 → 参照 商品(INV):选中写「存货编码」,列表按「存货名称」挑
UPDATE yj_field
   SET data_type     = N'参照',
       ref_panel     = N'INV',
       ref_field     = N'存货编码',
       display_field = N'存货名称'
 WHERE panel_code = N'QC_INSP_REC'
   AND col_name   = N'物料编码';

-- ② 物料名称 → 参照 商品(INV):选中写「存货名称」
UPDATE yj_field
   SET data_type     = N'参照',
       ref_panel     = N'INV',
       ref_field     = N'存货名称',
       display_field = N'存货名称'
 WHERE panel_code = N'QC_INSP_REC'
   AND col_name   = N'物料名称';
GO

PRINT N'【改后】QC_INSP_REC 物料两列:';
SELECT place, seq, col_name, label, data_type, ref_panel, ref_field, display_field, editable, required, hidden, visible
  FROM yj_field
 WHERE panel_code = N'QC_INSP_REC' AND col_name IN (N'物料名称', N'物料编码')
 ORDER BY place, seq, id;

-- ── 自检 ①:四行必须都是「参照 / INV」,且 ref_field 与列名对应 ──
DECLARE @ok int = (SELECT COUNT(*) FROM yj_field
                    WHERE panel_code = N'QC_INSP_REC' AND col_name IN (N'物料名称', N'物料编码')
                      AND data_type = N'参照' AND ref_panel = N'INV'
                      AND ((col_name = N'物料编码' AND ref_field = N'存货编码')
                        OR (col_name = N'物料名称' AND ref_field = N'存货名称')));
PRINT N'【自检①】物料两列已成 参照/INV 且 ref_field 正确:' + CAST(@ok AS nvarchar(10)) + N'/4';
IF @ok <> 4
    RAISERROR(N'物料两列没有全部落到 参照/INV —— 元数据未生效', 16, 1);

-- ── 自检 ②:本面板**除这两列外不应有别的 INV 参照**(越界 = 0;只报数不拦,便于日后新增参照字段时复跑) ──
DECLARE @other int = (SELECT COUNT(*) FROM yj_field
                       WHERE panel_code = N'QC_INSP_REC' AND data_type = N'参照'
                         AND col_name NOT IN (N'物料名称', N'物料编码'));
PRINT N'【自检②】QC_INSP_REC 其余参照字段行数(信息项,越界应为 0):' + CAST(@other AS nvarchar(10));

-- ── 自检 ③:物理列仍在(参照是显示层语义,落库列不改类型;列不在则保存会 500) ──
DECLARE @cols int = (SELECT COUNT(*) FROM sys.columns
                      WHERE object_id = OBJECT_ID(N'qc_insp_rec') AND name IN (N'物料名称', N'物料编码'));
PRINT N'【自检③】qc_insp_rec 物理列 物料名称/物料编码 就位:' + CAST(@cols AS nvarchar(10)) + N'/2';
IF @cols <> 2
    RAISERROR(N'qc_insp_rec 缺 物料名称/物料编码 物理列', 16, 1);

PRINT N'检验数据记录(QC_INSP_REC)物料两列关联商品(INV)完成';
