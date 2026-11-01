/* ============================================================================
   migrate-bom-material-list-status-20261030.sql
   ── 物料清单状态回填：已归档的产品信息表 ⇒ 它那张物料清单也标已归档 ────────────
   ============================================================================
   【用户口径 2026-10-30】
     「产品信息表处于审批的时候，物料清单是草稿状态；审批通过归档的时候物料清单也同时归档」
   前半 + 后半的联动已写进 ButtonService：
     · 保存(提交审批) → syncProdBomToMaterialList(..., archived=false) ⇒ 物料清单 = 草稿
     · 归档           → markArchived 里 syncProdBomToMaterialList(..., archived=true) ⇒ 已归档
   本脚本补**历史数据**：此前物料清单只在归档时写行、从不写 yj_doc_status ⇒ 老单的物料清单
   一律显示「草稿」。按「产品信息表已归档 + 物料清单确实存在」两条同时成立来回填，其余不动。

   ⚠ 只 MERGE 状态行，不改 mate 的任何行；键 = 产品编号（物料清单 m_no 存的就是产品编号）。
   ⚠ 幂等：重复执行结果一致。
   三个库都要执行：本地 HSDZ_MES / HSDZ_MES_TEST / 客户服务器 HSDZ_MES。
   ============================================================================ */

SET NOCOUNT ON;
GO

MERGE yj_doc_status AS t
USING (
    SELECT DISTINCT h.[产品编号] AS doc_no
      FROM rd_prod_info_head h
      JOIN yj_doc_status s
        ON s.panel_code = 'RD_PROD_INFO' AND s.doc_no = h.[单据编号] AND s.archived = 'Y'
     WHERE ISNULL(h.asp_cancel, 'N') <> 'Y'
       AND ISNULL(h.[产品编号], '') <> ''
       AND EXISTS (SELECT 1 FROM mate m WHERE m.m_no = h.[产品编号] AND ISNULL(m.asp_cancel, 'N') <> 'Y')
) AS src
ON t.panel_code = 'WLBOM' AND t.doc_no = src.doc_no
WHEN MATCHED THEN
    UPDATE SET archived = 'Y', pending = 'N', saved = 1,
               archived_at = CASE WHEN t.archived_at IS NULL THEN GETDATE() ELSE t.archived_at END,
               update_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (panel_code, doc_no, archived, pending, saved, archived_at, update_at)
    VALUES ('WLBOM', src.doc_no, 'Y', 'N', 1, GETDATE(), GETDATE());
GO

/* ── 核验：参与回填的物料清单条数 ─────────────────────────────────────────── */
SELECT COUNT(*) AS 已归档物料清单
  FROM yj_doc_status
 WHERE panel_code = 'WLBOM' AND archived = 'Y';
GO
