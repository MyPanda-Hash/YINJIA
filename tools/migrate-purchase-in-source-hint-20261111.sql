/* ============================================================================
 * migrate-purchase-in-source-hint-20261111.sql
 * 采购入库单「来源 / 来源单号」:从**表头字段**改回**隐藏列 + 界面提示**
 * ----------------------------------------------------------------------------
 * 用户口径演进(同一天,第二轮):
 *   第一轮(已落):「采购入库单在表头最末尾,加一个来源(可能是直接暂收来的,可能是检验单来的,
 *                  也可能是特采来的)和显示对应的单据编号」→ 做成表头两个只读格子。
 *   第二轮(本脚):「**不要做成字段,做成个按钮或者是提示就行**」→ 格子撤掉,值仍要能看见。
 *
 * 本脚本做的事:
 *   把 yj_field 里 `来源` / `来源单号` 两行设回 hidden=1 / visible=0 ——
 *   表头不再占格子,但**列照旧有值**(通用查询是 selectCols(fieldsAt("header")),不看 hidden),
 *   前端在单据号旁边用一条可点的小提示显示:`来源: 来料检验单 IJ-2026-10-0064`
 *   (PanelxList 表头条 / PanelxForm 标题行,取数见 frontend/src/core/panel/sourceHint.js)。
 *
 *   不删行、不改标签: `来源` 这个数据键仍是写入口径(后端 colLabel 按列名反查标签写值),
 *   只是不再显示成格子。`place` 保持 header、`seq` 保持 900/910,将来若要用「表头调整」翻出来,
 *   位置也还在最末尾。
 *
 * 幂等:窄条件 UPDATE + 行数守卫;两账套各跑一遍。
 * ========================================================================== */

SET NOCOUNT ON;
GO

DECLARE @cnt int;
SELECT @cnt = COUNT(*) FROM yj_field
 WHERE panel_code = N'PURCHASE_IN' AND col_name IN (N'来源单据', N'来源单号');
IF @cnt <> 2
    RAISERROR(N'[来源提示] PURCHASE_IN 的来源类字段行数为 %d,预期 2 行,已中止', 16, 1, @cnt);

/* 来源(物理列 来源单据):隐藏,但保留表头位置与只读标记 */
UPDATE yj_field
   SET visible = 0, hidden = 1, editable = 0, required = 0
 WHERE panel_code = N'PURCHASE_IN' AND col_name = N'来源单据' AND label IN (N'来源', N'来源单据');
PRINT N'[字段] PURCHASE_IN.来源 → 隐藏(hidden=1),改由单据号旁提示显示';

/* 来源单号:同样隐藏 */
UPDATE yj_field
   SET visible = 0, hidden = 1, editable = 0, required = 0
 WHERE panel_code = N'PURCHASE_IN' AND col_name = N'来源单号';
PRINT N'[字段] PURCHASE_IN.来源单号 → 隐藏(hidden=1),改由单据号旁提示显示';
GO

/* ---- 自检:两行都必须是 hidden=1 / visible=0,且标签仍是 `来源` / `来源单号` ---- */
IF (SELECT COUNT(*) FROM yj_field
     WHERE panel_code = N'PURCHASE_IN' AND col_name IN (N'来源单据', N'来源单号')
       AND hidden = 1 AND visible = 0 AND editable = 0) <> 2
    RAISERROR(N'[自检失败] PURCHASE_IN 的来源两列没有全部隐藏', 16, 1);

IF NOT EXISTS (SELECT 1 FROM yj_field
                WHERE panel_code = N'PURCHASE_IN' AND col_name = N'来源单据' AND label = N'来源')
    RAISERROR(N'[自检失败] PURCHASE_IN.来源单据 的标签不是「来源」(写入口径依赖它)', 16, 1);
GO

/* ---- 取证输出 ---- */
SELECT f.id, f.label, f.col_name, f.place, f.seq, f.visible, f.hidden, f.editable
  FROM yj_field f
 WHERE f.panel_code = N'PURCHASE_IN' AND f.col_name IN (N'来源单据', N'来源单号')
 ORDER BY f.seq;

-- 表头可见字段数(含 6 个附件位;提示取代格子后应为 23 —— 原先 25,即把 来源 / 来源单号 两格撤掉)
SELECT COUNT(*) AS PURCHASE_IN_表头可见字段数
  FROM yj_field
 WHERE panel_code = N'PURCHASE_IN' AND hidden = 0 AND visible = 1
   AND (place LIKE N'%header%' OR place = N'query');
GO
