package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产工单行 ↔ 成型工艺清单配方的深模块。
 *
 * <p>接口只有两个业务动作：读取当前工单行可用配方、按工单行获取混料配方快照。
 * 配方筛选、研发单状态门禁、比例归一化、数量快照及幂等替换都集中在这里，
 * 页面与报工入口不再各自拼 SQL 或重复解释百分比。</p>
 *
 * <p>绑定保存的是研发配方的快照，而不是只保存一个配方单号：研发新版本发布后，
 * 已开始生产的工单仍按获取当时的物料、配料比和单支含量执行。</p>
 */
@Service
public class WorkOrderRecipeService {

    private static final String FORMULA_PANEL = "RD_MOLD_PROC";
    private static final String FORMULA_AREA = "配方表";

    private final JdbcTemplate jdbc;

    public WorkOrderRecipeService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 读取一个生产工单行及其当前可用成型配方。 */
    public Map<String, Object> get(String workOrderNo, Long rowId, Double mixingQty) {
        WorkOrderRow row = resolveRow(workOrderNo, rowId);
        Formula formula = findUsableFormula(row.productCode());
        double qty = mixingQty != null ? mixingQty : row.planQty();
        if (!Double.isFinite(qty) || qty < 0) throw new IllegalArgumentException("混料数量不能为负数");

        List<Map<String, Object>> items = formula.items().stream()
                .map(x -> itemView(x, qty))
                .toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("工单号", row.workOrderNo());
        out.put("工单行id", row.id());
        out.put("工单行号", row.lineNo());
        out.put("产品编号", row.productCode());
        out.put("产品名称", row.productName());
        out.put("排产数量", row.planQty());
        out.put("混料数量", qty);
        out.put("配方单号", formula.no());
        out.put("配方版本", formula.version());
        out.put("配方状态", formula.status());
        out.put("配方行", items);
        out.put("已有快照", snapshotOf(row.id()));
        return out;
    }

    /** 获取并替换一个工单行的有效混料配方快照。 */
    @Transactional
    public Map<String, Object> bind(String workOrderNo, Long rowId, Double mixingQty, String user) {
        if (mixingQty == null || !Double.isFinite(mixingQty) || mixingQty <= 0)
            throw new IllegalArgumentException("混料数量必须大于 0");
        WorkOrderRow row = resolveRow(workOrderNo, rowId);
        Formula formula = findUsableFormula(row.productCode());

        // 同一个工单行只能有一个有效混料口径；历史快照保留以便追溯。
        jdbc.update("UPDATE dbo.wo_mixing_head SET asp_cancel='Y', asp_user2=?, asp_time2=?"
                        + " WHERE 工单行id=? AND ISNULL(asp_cancel,'N')<>'Y'",
                safeUser(user), LocalDateTime.now(), row.id());
        jdbc.update("UPDATE dbo.plang SET [成型配方单号]=?, [成型配方版本]=?, [配方关联时间]=?, [配方关联人]=?"
                        + " WHERE id=? AND pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'",
                formula.no(), formula.version(), LocalDateTime.now(), safeUser(user), row.id(), row.workOrderNo());

        Long headId = jdbc.queryForObject("INSERT INTO dbo.wo_mixing_head"
                        + "([工单号],[工单行id],[工单行号],[配方单号],[配方版本],[产品编号],[产品名称],[混料数量],[单位],[状态],[asp_user1],[asp_time1])"
                        + " OUTPUT INSERTED.id VALUES (?,?,?,?,?,?,?,?,N'支',N'有效',?,?)",
                Long.class, row.workOrderNo(), row.id(), row.lineNo(), formula.no(), formula.version(), row.productCode(),
                row.productName(), mixingQty, safeUser(user), LocalDateTime.now());
        if (headId == null) throw new IllegalStateException("未取到混料配方快照编号");

        List<Map<String, Object>> resultItems = new ArrayList<>();
        for (FormulaItem item : formula.items()) {
            Double planUse = item.singleContent() == null ? null : mixingQty * item.singleContent();
            jdbc.update("INSERT INTO dbo.wo_mixing_detail"
                            + "([混料头id],[工单号],[工单行id],[工单行号],[配方单号],[配方版本],[序号],[物料种类],[物料编号],[物料名称],[配料比],[单支物料含量],[设计添加量],[计划用量],[asp_user1],[asp_time1])"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    headId, row.workOrderNo(), row.id(), row.lineNo(), formula.no(), formula.version(), item.seq(),
                    item.kind(), item.code(), item.name(), item.ratio(), item.singleContent(), item.design(), planUse,
                    safeUser(user), LocalDateTime.now());
            Map<String, Object> view = itemView(item, mixingQty);
            resultItems.add(view);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("混料头id", headId);
        out.put("工单号", row.workOrderNo());
        out.put("工单行id", row.id());
        out.put("工单行号", row.lineNo());
        out.put("产品编号", row.productCode());
        out.put("产品名称", row.productName());
        out.put("混料数量", mixingQty);
        out.put("配方单号", formula.no());
        out.put("配方版本", formula.version());
        out.put("配方状态", formula.status());
        out.put("配方行", resultItems);
        return out;
    }

    private Map<String, Object> snapshotOf(long rowId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 id AS 混料头id, 配方单号, 配方版本, 混料数量, 状态"
                        + " FROM dbo.wo_mixing_head WHERE 工单行id=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC", rowId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Map<String, Object> itemView(FormulaItem item, double qty) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("序号", item.seq());
        m.put("物料种类", item.kind());
        m.put("物料编号", item.code());
        m.put("物料名称", item.name());
        m.put("配料比", item.ratio());
        m.put("单支物料含量", item.singleContent());
        m.put("设计添加量", item.design());
        m.put("计划用量", item.singleContent() == null ? null : qty * item.singleContent());
        return m;
    }

    private WorkOrderRow resolveRow(String no, Long rowId) {
        if (no == null || no.isBlank()) throw new IllegalArgumentException("请提供工单号");
        if (rowId == null) throw new IllegalArgumentException("请提供工单行id");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 id, pl_no, pl_xc, ISNULL(dm,N'') AS dm, ISNULL(mc,N'') AS mc, ISNULL(pl_sl,0) AS pl_sl"
                        + " FROM dbo.plang WHERE id=? AND pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'", rowId, no.trim());
        if (rows.isEmpty()) throw new IllegalArgumentException("生产工单行不存在或已作废");
        Map<String, Object> r = rows.get(0);
        return new WorkOrderRow(((Number) r.get("id")).longValue(), String.valueOf(r.get("pl_no")),
                intValue(r.get("pl_xc")), String.valueOf(r.get("dm")), String.valueOf(r.get("mc")),
                number(r.get("pl_sl")));
    }

    private Formula findUsableFormula(String productCode) {
        if (productCode == null || productCode.isBlank()) throw new IllegalStateException("工单未填写产品编号,不能获取成型配方");
        List<Map<String, Object>> heads = jdbc.queryForList(
                "SELECT TOP 1 h.[单据编号], ISNULL(h.[版本号],N'') AS 版本号,"
                        + " CASE WHEN ISNULL(s.archived,'N')='Y' THEN N'已归档' ELSE N'已审核' END AS 状态"
                        + " FROM dbo.rd_mold_proc_head h JOIN dbo.yj_doc_status s ON s.panel_code=? AND s.doc_no=h.[单据编号]"
                        + " WHERE h.[产品编号]=? AND ISNULL(h.asp_cancel,'N')<>'Y'"
                        + " AND ISNULL(s.canceled,'N')<>'Y' AND (ISNULL(s.archived,'N')='Y' OR ISNULL(s.shr,N'')<>'')"
                        + " ORDER BY CASE WHEN ISNULL(s.archived,'N')='Y' THEN 0 ELSE 1 END, h.id DESC",
                FORMULA_PANEL, productCode.trim());
        if (heads.isEmpty()) throw new IllegalStateException("该产品没有已审核/已归档的成型工艺清单配方");
        Map<String, Object> h = heads.get(0);
        String no = String.valueOf(h.get("单据编号"));
        List<FormulaItem> items = new ArrayList<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT ISNULL([序号],N'') AS 序号, ISNULL([物料种类],N'') AS 物料种类,"
                        + " ISNULL([物料编号],N'') AS 物料编号, ISNULL([物料名称],N'') AS 物料名称,"
                        + " NULLIF(LTRIM(RTRIM([实际添加比例])),N'') AS 实际添加比例,"
                        + " NULLIF(LTRIM(RTRIM([单支物料含量])),N'') AS 单支物料含量,"
                        + " ISNULL([设计添加量],N'') AS 设计添加量"
                        + " FROM dbo.rd_mold_proc_detail WHERE [单据编号]=? AND [表区]=?"
                        + " AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id", no, FORMULA_AREA)) {
            String code = text(r.get("物料编号"));
            String name = text(r.get("物料名称"));
            if (code.isBlank() && name.isBlank()) continue;
            String actual = text(r.get("实际添加比例"));
            String design = text(r.get("设计添加量"));
            // 配料比是研发配方计算后的「实际添加比例」；绝不回退读「设计添加量」，
            // 后者在折算物料行表示克/支，混作比例会使投料量失真。
            Double ratio = parseRatio(actual);
            Double content = parseNumber(text(r.get("单支物料含量")));
            if (ratio == null) throw new IllegalStateException("配方行 " + text(r.get("序号")) + " 缺少有效实际添加比例,请先重新计算并保存配方");
            if (content == null) throw new IllegalStateException("配方行 " + text(r.get("序号")) + " 缺少有效单支物料含量,不能计算混料用量");
            items.add(new FormulaItem(text(r.get("序号")), text(r.get("物料种类")), code, name,
                    ratio, content, design));
        }
        if (items.isEmpty()) throw new IllegalStateException("成型工艺清单配方表没有有效物料行");
        return new Formula(no, text(h.get("版本号")), text(h.get("状态")), items);
    }

    private static Double parseRatio(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.trim();
        boolean percent = s.endsWith("%");
        if (percent) s = s.substring(0, s.length() - 1).trim();
        try {
            double n = Double.parseDouble(s);
            if (percent || n > 1d) n /= 100d;
            return Double.isFinite(n) ? n : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Double parseNumber(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            double n = Double.parseDouble(raw.trim().replace("%", ""));
            return Double.isFinite(n) ? n : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String safeUser(String user) { return user == null || user.isBlank() ? "system" : user; }
    private static String text(Object v) { return v == null ? "" : String.valueOf(v).trim(); }
    private static double number(Object v) { return v instanceof Number n ? n.doubleValue() : parseNumber(text(v)) == null ? 0d : parseNumber(text(v)); }
    private static int intValue(Object v) { return v instanceof Number n ? n.intValue() : (int) number(v); }

    private record WorkOrderRow(long id, String workOrderNo, int lineNo, String productCode, String productName, double planQty) { }
    private record Formula(String no, String version, String status, List<FormulaItem> items) { }
    private record FormulaItem(String seq, String kind, String code, String name, Double ratio, Double singleContent, String design) { }
}
