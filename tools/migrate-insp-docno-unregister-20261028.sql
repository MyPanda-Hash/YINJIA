/* ============================================================
   migrate-insp-docno-unregister-20261028.sql
   把 RD_INSP_PLAN 的「文档编号」从 yj_field 注销(不再上纸)

   【为什么】用户口径(2026-10-28,方案 A):
     「这个默认的编号去掉，只保留背景提示词：请填写编号」

   纸面那个格子原来绑的是 yj_field.文档编号,而 rd_insp_plan_head.文档编号 上的
   数据库默认值 N'YJ-RD001' 让全部单据都是同一个串 ⇒ 看着像"固定编号"。
   它跟真实单据号(IP-2026-10-0015)无关。

   【为什么用 hidden 而不是 DELETE 行】
     · 前端的编号格绑哪个键由 `docNoKeyOf(head)` 判定:head 里**有「文档编号」这个键**
       就用它,否则用「单据编号」。而 head 的键来自**下发的前端字段**(hidden=1 不下发)
       ⇒ 把这一条 hidden=1 就够了,物理列和历史值都不动;
     · 保留行 = 随时可回滚(把它改回 hidden=0 就恢复),删除行要重建才知道原 seq/宽度。

   【配套】tools/migrate-drop-insp-docno-default-20261028.sql 负责删数据库默认约束。
   【幂等】按 panel_code + col_name 定位,已 hidden 的不重复写。
   【两账套】HSDZ_MES 与 HSDZ_MES_TEST 都执行。
   ============================================================ */

SET NOCOUNT ON;

PRINT '=== 迁移前:RD_INSP_PLAN 的编号类字段 ===';
SELECT id, col_name, label, place, seq, hidden, visible
FROM yj_field
WHERE panel_code = N'RD_INSP_PLAN' AND col_name IN (N'文档编号', N'单据编号')
ORDER BY col_name;

/* ── 注销「文档编号」(header 那条) ──
   ⚠ 只改 place=header 的那一条:query 那条是列表页筛选用的,与纸面无关,不能一起动
   (同面板确有两条 文档编号:header/30 与 query/30,见下方自检)。 */
UPDATE yj_field
   SET hidden = 1,
       visible = 1
 WHERE panel_code = N'RD_INSP_PLAN'
   AND col_name = N'文档编号'
   AND ISNULL(hidden, 0) = 0;
PRINT '注销(RD_INSP_PLAN.文档编号 hidden=1)影响行数: ' + CAST(@@ROWCOUNT AS varchar(10));
GO

/* ── 自检 1:文档编号 已全部 hidden ── */
PRINT '=== 自检 1:RD_INSP_PLAN.文档编号 应全部 hidden=1 ===';
SELECT id, place, seq, hidden, visible
FROM yj_field
WHERE panel_code = N'RD_INSP_PLAN' AND col_name = N'文档编号'
ORDER BY id;

SELECT CASE WHEN COUNT(*) = 0 THEN N'[PASS] RD_INSP_PLAN.文档编号 已全部 hidden'
            ELSE N'[FAIL] 仍有 visible 的 文档编号 行'
       END AS 自检1
FROM yj_field
WHERE panel_code = N'RD_INSP_PLAN' AND col_name = N'文档编号' AND ISNULL(hidden, 0) = 0;

/* ── 自检 2:「单据编号」必须仍可见(它是纸面将要显示的那个真号) ── */
PRINT '=== 自检 2:RD_INSP_PLAN.单据编号 必须仍可见 ===';
SELECT CASE WHEN COUNT(*) = 1 THEN N'[PASS] 单据编号 仍可见(纸面将显示 IP-… 自动号)'
            ELSE N'[FAIL] 单据编号 不见了 —— 纸面会没有编号可显示'
       END AS 自检2
FROM yj_field
WHERE panel_code = N'RD_INSP_PLAN' AND col_name = N'单据编号' AND ISNULL(hidden, 0) = 0;

/* ── 自检 3:越界守卫(别的面板一行都不许动) ── */
PRINT '=== 自检 3:越界检查(其它面板的 文档编号 应保持原状) ===';
SELECT panel_code, COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(hidden,0)=1 THEN 1 ELSE 0 END) AS 已隐藏
FROM yj_field
WHERE col_name = N'文档编号' AND panel_code <> N'RD_INSP_PLAN'
GROUP BY panel_code
ORDER BY panel_code;
GO
