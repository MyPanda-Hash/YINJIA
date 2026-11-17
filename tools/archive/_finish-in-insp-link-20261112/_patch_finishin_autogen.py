"""Patch (2026-11-12 phase2b): 最后一道工序报工审核 → 按日期批次自动生成产成品入库单草稿。
在 ButtonService.java 插入:
  · runWoAuditHooks 里 woInspGenerate 之后调用 finishInDraftFromReport(...);
  · 新增方法 finishInDraftFromReport / lastProcessOf / latestAuditedInsp(放在 syncCloseAfterAsmInsp 之前)。
幂等:已存在则跳过。
"""
import os, sys

PATH = r'D:\workspace\yinjia\backend\src\main\java\com\yinjia\mes\service\ButtonService.java'
raw = open(PATH, encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n')
if 'finishInDraftFromReport' in s:
    print('[SKIP] already patched'); sys.exit(0)

METHODS = '''    // ══════════════════════════════════════════════════════════════════════════════════
    // 最后一道工序报工审核 → 按「一个日期批次一张」自动生成**产成品入库单草稿**(2026-11-12,用户口径 A)
    //   用户原话:「产成品入库单在当前生产工单最后一道工序报工产生数量时自动生成。或者需要选单选这个
    //   生产工单才生成这样手动操作好控制生产批次。」
    //   口径:
    //     · 只在**最后一道工序**(工艺路线最后一步:优先 wo_process_line 工序序最大,回退 plang.工艺路线→bs_route)
    //       的报工审核时生成;
    //     · 一个「(工单号, 工单行号, 批次号)」= 一张入库草稿;同批次已有未作废入库单则跳过(幂等);
    //     · 入库数量 = 该批次**已审核报工量**合计(scjl.wgzt 非空),生成后仓库仍可改;
    //     · 两张检验单号:自动匹配同工单行**最新已审核**的出货检验功能/表观单,匹配不到留空(仓库再选);
    //     · 只生成**草稿**:提交/审核仍走 assertFinishInInspLink 门禁(两张检验单已审核 + 该批次双合格)。
    //   ⚠ 任何异常只 warn 不阻断报工审核(入库单生成是派生动作)。
    // ══════════════════════════════════════════════════════════════════════════════════
    private void finishInDraftFromReport(String panelCode, String reportNo, String user) {
        if (!"WO_REPORT".equals(panelCode)) return;
        try {
            java.util.List<java.util.Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT ISNULL(s.gldh,N'') AS wo, ISNULL(s.[工单行号],0) AS xc, ISNULL(s.gxdm,N'') AS op,"
                            + " ISNULL(s.lot_no,N'') AS batch, ISNULL(s.wzdm,N'') AS inv, ISNULL(s.mc,N'') AS invName,"
                            + " ISNULL(s.gg,N'') AS spec, ISNULL(s.jldw,N'') AS unit"
                            + " FROM dbo.scjl s WHERE s.sc_no=? AND ISNULL(s.asp_cancel,'N')<>'Y'", reportNo);
            if (rows.isEmpty()) return;
            String wh = finishWarehouse();
            for (java.util.Map<String, Object> r : rows) {
                String wo = str(r.get("wo"));
                int xc = (int) numOr(r.get("xc"));
                String op = str(r.get("op"));
                String batch = str(r.get("batch"));
                if (wo.isEmpty() || op.isEmpty() || batch.isEmpty()) continue;
                String lastOp = lastProcessOf(wo, xc);
                if (lastOp.isEmpty() || !lastOp.equals(op)) continue;
                Integer exists = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(asp_cancel,'N')<>'Y'"
                                + " AND 加工单号=? AND ISNULL(工单行号,0)=? AND 批次号=?",
                        Integer.class, wo, xc, batch);
                if (exists != null && exists > 0) continue;   // 同批次已生成(含人工建的):不重复
                Double qty = jdbc.queryForObject(
                        "SELECT ISNULL(SUM(sl),0) FROM dbo.scjl WHERE ISNULL(asp_cancel,'N')<>'Y'"
                                + " AND gldh=? AND ISNULL([工单行号],0)=? AND ISNULL(lot_no,N'')=?"
                                + " AND ISNULL(wgzt,N'')<>N''", Double.class, wo, xc, batch);
                if (qty == null || qty <= 0) continue;
                String procNo = latestAuditedInsp("QC_PROC_INSP", "qc_proc_insp_head", wo, xc);
                String asmNo = latestAuditedInsp("QC_ASM_INSP", "qc_asm_insp_head", wo, xc);
                java.util.Map<String, Object> head = new java.util.LinkedHashMap<>();
                head.put("单据日期", java.time.LocalDate.now().toString());
                head.put("业务类型", "产成品入库");
                head.put("仓库", wh);
                head.put("加工单号", wo);
                head.put("工单行号", xc);
                head.put("批次号", batch);
                if (!procNo.isEmpty()) head.put("出货检验功能单号", procNo);
                if (!asmNo.isEmpty()) head.put("出货检验表观单号", asmNo);
                head.put("备注", "由报工单 " + reportNo + " 最后一道工序(" + op + ")报工自动生成;入库数量=该批次已审报工量合计");
                java.util.Map<String, Object> line = new java.util.LinkedHashMap<>();
                line.put("产品编码", str(r.get("inv")));
                line.put("产品名称", str(r.get("invName")));
                String spec = str(r.get("spec"));
                if (!spec.isEmpty()) line.put("规格型号", spec);
                String unit = str(r.get("unit"));
                if (!unit.isEmpty()) line.put("计量单位", unit);
                line.put("批次号", batch);
                line.put("实收数量", qty);
                line.put("仓库", wh);
                head.put("detail", java.util.Map.of("items", java.util.List.of(line)));
                java.util.Map<String, Object> saved = save(registry.panel("FINISH_IN"), head, false);
                log.info("[FINISH_IN] 报工 {} 自动生成产成品入库单草稿 {} (工单 {} 行 {} 批次 {} 数量 {})",
                        reportNo, saved.get("编号"), wo, xc, batch, qty);
            }
        } catch (Exception e) {
            log.warn("[FINISH_IN] 报工 {} 自动生成产成品入库单失败(不阻断报工审核): {}", reportNo, e.getMessage());
        }
    }

    /** 工单行的**最后一道工序**名称:优先工序台账(wo_process_line.工序序最大),回退 工单行工艺路线(bs_route.加工顺序最大);取不到返回空(不猜)。 */
    private String lastProcessOf(String wo, int xc) {
        try {
            java.util.List<String> ops = jdbc.queryForList(
                    "SELECT TOP 1 w.工序 FROM dbo.wo_process_line w"
                            + " JOIN dbo.plang p ON p.pl_no = w.工单号 AND p.id = w.工单行id"
                            + " WHERE w.工单号=? AND ISNULL(p.pl_xc,0)=? AND ISNULL(w.asp_cancel,'N')<>'Y'"
                            + " ORDER BY ISNULL(w.工序序,0) DESC", String.class, wo, xc);
            if (!ops.isEmpty() && ops.get(0) != null && !ops.get(0).isBlank()) return ops.get(0).trim();
            java.util.List<String> ops2 = jdbc.queryForList(
                    "SELECT TOP 1 r.工序名称 FROM dbo.plang p"
                            + " JOIN dbo.bs_route r ON r.工艺路线编码 = p.工艺路线"
                            + " WHERE p.pl_no=? AND ISNULL(p.pl_xc,0)=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                            + " AND ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.工序名称,N'')<>N''"
                            + " ORDER BY ISNULL(r.加工顺序,999) DESC", String.class, wo, xc);
            return ops2.isEmpty() || ops2.get(0) == null ? "" : ops2.get(0).trim();
        } catch (RuntimeException e) {
            log.warn("[FINISH_IN] 取工单 {} 行 {} 最后一道工序失败: {}", wo, xc, e.getMessage());
            return "";
        }
    }

    /** 同工单行、**最新一张已审核**的某检验单号;没有返回空串(入库单上留空待人工选)。 */
    private String latestAuditedInsp(String panelCode, String headTable, String wo, int xc) {
        try {
            java.util.List<String> nos = jdbc.queryForList(
                    "SELECT TOP 1 h.单据编号 FROM dbo." + headTable + " h"
                            + " WHERE ISNULL(h.工单号,N'')=? AND ISNULL(h.工单行号,0)=? AND ISNULL(h.asp_cancel,'N')<>'Y'"
                            + " AND EXISTS (SELECT 1 FROM dbo.yj_doc_status s WHERE s.panel_code=?"
                            + " AND s.doc_no=CAST(h.单据编号 AS nvarchar(100)) AND s.shr IS NOT NULL"
                            + " AND ISNULL(s.canceled,'N')<>'Y') ORDER BY h.id DESC", String.class, wo, xc, panelCode);
            return nos.isEmpty() || nos.get(0) == null ? "" : nos.get(0).trim();
        } catch (RuntimeException e) {
            log.warn("[FINISH_IN] 匹配 {} 检验单失败(工单 {} 行 {}): {}", panelCode, wo, xc, e.getMessage());
            return "";
        }
    }

'''
ANCHOR = '    /**\n     * 组装成品检验单 审核/弃审 → 重算其所属**工单**各行的结案状态。'
i = s.find(ANCHOR)
if i < 0:
    print('[FAIL] anchor for methods not found'); sys.exit(1)
s = s[:i] + METHODS + s[i:]

CALL_ANCHOR = '        woInspGenerate(def.code(), no, user);\n'
j = s.find(CALL_ANCHOR)
if j < 0:
    print('[FAIL] woInspGenerate call not found'); sys.exit(1)
pos = j + len(CALL_ANCHOR)
s = s[:pos] + '        // 最后一道工序报工审核 → 按日期批次自动生成产成品入库单草稿(2026-11-12 phase2b)\n        finishInDraftFromReport(def.code(), no, user);\n' + s[pos:]

open(PATH, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
print('[OK] patched finishInDraftFromReport, crlf=', crlf)

