package com.yinjia.mes.panel;

import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.PanelRegistry;
import com.yinjia.mes.service.QueryService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产加工单拆单:按数量把一张加工单拆成多张(父子关联)。
 *
 * <p>依据:docs/design/补充设计-V2.0.md §3.2「拆单:MANU_ORDER 支持按数量拆分为多个工单(父子关联)」;
 * 参考库口径对应「排产数量按产线/批次分批下达」。原单保留为父单(拆分序号=0),拆出的子单填
 * 源工单号=原单号 + 拆分序号=1..N-1,数量按份数落位。
 *
 * <p>入参:formData.编号=加工单号;parameters 可选
 * <ul><li>{@code 拆分数}: 等分成几份(默认 2,上限 20)</li>
 * <li>{@code 拆分数量}: 逗号分隔的显式数量(仅单行加工单支持,份数=数量个数)</li></ul>
 * 守护:仅草稿可拆;已是子单(源工单号非空)不再拆。
 */
@Component
public class ManuSplitHandler implements PanelActionHandler {

    private static final int MAX_PARTS = 20;

    private final PanelRegistry registry;
    private final QueryService queryService;
    private final ButtonService buttonService;
    private final JdbcTemplate jdbc;

    public ManuSplitHandler(PanelRegistry registry, QueryService queryService, ButtonService buttonService,
                            JdbcTemplate jdbc) {
        this.registry = registry;
        this.queryService = queryService;
        this.buttonService = buttonService;
        this.jdbc = jdbc;
    }

    @Override
    public boolean supports(String panelCode, String action) {
        return "MANU_ORDER".equals(panelCode) && "拆单".equals(action);
    }

    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> handle(PanelActionContext context) {
        Object noObj = context.formData() == null ? null : context.formData().get("编号");
        if (noObj == null || String.valueOf(noObj).isBlank()) throw new IllegalArgumentException("缺少表单编号");
        String sourceNo = String.valueOf(noObj);

        // 已结案守卫先于状态守卫:结案单被拒时给出"先取消结案"的精确指引(而非笼统的"仅草稿可拆")
        Integer closed = jdbc.queryForObject(
                "SELECT CASE WHEN ISNULL(结案,'N') = 'Y' THEN 1 ELSE 0 END FROM bd_manu_order WHERE 合同号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                Integer.class, sourceNo);
        if (closed != null && closed == 1)
            throw new IllegalStateException("该加工单已结案,不可拆单;如需调整请先取消结案");

        Map<String, Object> st = buttonService.docStatus("MANU_ORDER", sourceNo);
        String status = String.valueOf(st.get("status"));
        if (!"草稿".equals(status)) throw new IllegalStateException("仅草稿加工单可拆单,当前状态:" + status);

        PanelRegistry.PanelDef def = registry.panel("MANU_ORDER");
        Map<String, Object> doc = queryService.loadOneDoc(def, sourceNo);
        Map<String, Object> head = new LinkedHashMap<>(doc);
        Object detailObj = head.remove("detail");
        List<Map<String, Object>> lines = new ArrayList<>();
        if (detailObj instanceof Map<?, ?> dm && dm.get("items") instanceof List<?> l) {
            for (Object o : l) if (o instanceof Map<?, ?> m) lines.add(new LinkedHashMap<>((Map<String, Object>) m));
        }
        if (lines.isEmpty()) throw new IllegalStateException("加工单无明细行,不能拆单");

        // 已是子单不再拆(保持父→子两层)
        Object srcNo = head.get("源工单号");
        if (srcNo != null && !String.valueOf(srcNo).isBlank())
            throw new IllegalStateException("该加工单已是拆分子单(源工单号=" + srcNo + "),不再拆单");

        // 拆分量:显式数量(仅单行)或等分 N 份;**逐行按各自数量切分**,份内合计守恒
        Map<String, Object> params = context.parameters();
        double[][] qty = buildQuantities(params, lines);   // [份][行]
        int n = qty.length;
        if (n < 2) throw new IllegalStateException("拆分数至少为 2");

        // 父单标记 + 第一份数量留原单(头/行同步改写,保证头级合计与行合计一致)
        jdbc.update("UPDATE bd_manu_order SET 拆分序号=0 WHERE 合同号=?", sourceNo);
        String codeCol = def.codeCol() == null || def.codeCol().isBlank() ? "合同号" : def.codeCol();
        double parentQty = 0;
        for (int i = 0; i < lines.size(); i++) {
            double q0 = qty[0][i];
            parentQty += q0;
            jdbc.update("UPDATE bl_manu_order SET 数量=?, 需求数量=?, 排产数量=? WHERE 合同号=? AND id=?",
                    q0, q0, q0, sourceNo, lineId(lines.get(i)));
        }
        jdbc.update("UPDATE bd_manu_order SET 需求数量=?, 排产数量=? WHERE 合同号=?", parentQty, parentQty, sourceNo);

        // 子单:源工单号=原单号,拆分序号=1..n-1
        List<String> created = new ArrayList<>();
        for (int p = 1; p < n; p++) {
            Map<String, Object> childHead = copyHead(head);
            childHead.put("源工单号", sourceNo);
            childHead.put("拆分序号", p);
            double headQty = 0;
            List<Map<String, Object>> childLines = new ArrayList<>();
            for (int i = 0; i < lines.size(); i++) {
                double q = qty[p][i];
                headQty += q;
                childLines.add(copyLine(lines.get(i), q));
            }
            childHead.put("需求数量", headQty);
            childHead.put("排产数量", headQty);
            Map<String, Object> formData = new LinkedHashMap<>(childHead);
            formData.put("detail", Map.of("items", childLines));
            Map<String, Object> saved = buttonService.save(def, formData, false);
            created.add(String.valueOf(saved.get("编号")));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", sourceNo);
        out.put("生成张数", created.size());
        out.put("编号清单", created);
        out.put("单据状态", "草稿");
        out.put("gotoPanel", "MANU_ORDER");
        out.put("codeCol", codeCol);
        return out;
    }

    /**
     * 切分矩阵 [份][行]:
     * <ul><li>{@code 拆分数量}(逗号分隔)仅单行加工单支持,直接取用,并要求合计与原数量一致(防超拆/少拆);</li>
     * <li>{@code 拆分数} 等分时**逐行以该行自身数量为基准**切分(多行加工单各行互不影响),首份吸收舍入余数,
     * 保证每行「各份之和 == 原数量」。</li></ul>
     */
    private double[][] buildQuantities(Map<String, Object> params, List<Map<String, Object>> lines) {
        Object explicit = params == null ? null : params.get("拆分数量");
        if (explicit != null && !String.valueOf(explicit).isBlank()) {
            if (lines.size() != 1) throw new IllegalStateException("显式拆分数量仅支持单行加工单");
            List<Double> list = new ArrayList<>();
            for (String s : String.valueOf(explicit).split("[,，]")) {
                if (s.isBlank()) continue;
                try { list.add(Double.parseDouble(s.trim())); }
                catch (NumberFormatException e) { throw new IllegalArgumentException("拆分数量格式错误:" + s); }
            }
            if (list.size() < 2) throw new IllegalStateException("拆分数量至少给出 2 份");
            double given = list.stream().mapToDouble(Double::doubleValue).sum();
            double base = qtyOf(lines.get(0));
            if (Math.abs(given - base) > 0.0001)
                throw new IllegalStateException("拆分数量合计 " + round(given) + " 与原数量 " + round(base) + " 不一致");
            double[][] out = new double[list.size()][1];
            for (int p = 0; p < list.size(); p++) out[p][0] = round(list.get(p));
            return out;
        }
        int n = 2;
        Object cnt = params == null ? null : params.get("拆分数");
        if (cnt != null && !String.valueOf(cnt).isBlank()) {
            try { n = Integer.parseInt(String.valueOf(cnt).trim()); }
            catch (NumberFormatException e) { throw new IllegalArgumentException("拆分数格式错误:" + cnt); }
        }
        if (n < 2 || n > MAX_PARTS) throw new IllegalArgumentException("拆分数需在 2~" + MAX_PARTS + " 之间");
        double[][] out = new double[n][lines.size()];
        for (int i = 0; i < lines.size(); i++) {
            double base = qtyOf(lines.get(i));
            double each = round(base / n);
            for (int p = 0; p < n; p++) out[p][i] = each;
            out[0][i] = round(base - each * (n - 1));   // 首份吸收舍入余数,保合计守恒
        }
        return out;
    }

    private Map<String, Object> copyHead(Map<String, Object> head) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (String k : List.of("客户", "客户编码", "销售订单号", "预完工日", "预开工日", "开工日期", "完工日期",
                "生产线", "测试程序", "机构", "重量", "负责人", "单据类型", "来料性质", "来料单号", "采购入库单号",
                "外包单号", "领料单号", "单价", "金额", "备注")) {   // 2026-09-23 A 类死列下线:生产订单客户/启用派工等不再复制
            Object v = head.get(k);
            if (v != null && !String.valueOf(v).isBlank()) out.put(k, v);
        }
        out.put("单据日期", java.time.LocalDate.now().toString());
        return out;
    }

    private Map<String, Object> copyLine(Map<String, Object> line, double qty) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (String k : List.of("产品编码", "存货图片", "产品名称", "规格型号", "型号",
                "生产单位", "批号", "单价", "金额", "备注")) {   // 生产类型/适用BOM/BOM展开方式 已下线
            Object v = line.get(k);
            if (v != null && !String.valueOf(v).isBlank()) out.put(k, v);
        }
        out.put("数量", qty);
        out.put("需求数量", qty);
        out.put("排产数量", qty);
        return out;
    }

    private Object lineId(Map<String, Object> line) {
        Object id = line.get("id");
        return id == null ? line.get("ID") : id;
    }

    private static double qtyOf(Map<String, Object> line) {
        for (String f : List.of("排产数量", "需求数量", "数量")) {
            Object v = line.get(f);
            if (v == null) continue;
            if (v instanceof Number n) return n.doubleValue();
            try { return Double.parseDouble(String.valueOf(v).trim()); } catch (NumberFormatException ignore) { }
        }
        return 0;
    }

    private static double round(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }
}
