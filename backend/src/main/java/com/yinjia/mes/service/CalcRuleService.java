package com.yinjia.mes.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * 明细「自动计算」规则引擎(2026-10-05,采购入库单金额任务)。
 *
 * <p><b>为什么要有这个类</b>:改前「金额 = 数量×单价」这类派生列**只有前端在算**
 * ({@code PanelxList.calculateDetailRow} 挂在单元格 @change 上),而**生单与保存两条
 * 落库路径从来不重算** —— 于是"来料检验单审核自动生成采购入库单"产生的行只有
 * 实收数量/单价、金额为空(2026-10-05 实测:bl_purchase_in 269 行有量有价,128 行金额为空);
 * 分批送料把上游整单金额原样带到暂收行上也没人纠正(sl_recv_detail 226 行有量有价,
 * 160 行 金额 ≠ 数量×单价)。派生列必须**在落库那一刻由服务端算一遍**才算数。
 *
 * <p><b>单一真源</b>:规则只在本类生成一次 ——
 *  · {@code PanelConfigService} 把 {@link #asContract} 下发给前端(detail.tabs[].calc),浏览器改一格即时算;
 *  · {@code ButtonService.upsertLineRows} 在写行表前用 {@link #applyRules} 算一遍,保证落库值一致。
 * 两边同一份规则、同一个求值口径,不存在"界面看着对、库里是空"。
 *
 * <p><b>公式语言</b>:字段名即明细行键(永远是中文标签,ADR-0001),支持 + - * / ( ),
 * 例:{@code 数量*单价}、{@code 单价*(1+税率%/100)}。与前端
 * {@code core/panel/calcRules.js} 的求值器逐条对齐(含"入参全空则不写入"的守卫)。
 */
@Service
public class CalcRuleService {

    /** 一条明细计算规则:目标字段标签 ← 公式(round = 结果小数位) */
    public record Rule(String target, String formula, int round) {}

    /** 已解析的公式(RPN + 引用到的变量名) */
    private record Formula(List<Object> rpn, Set<String> vars) {}

    private static final Pattern TOKEN =
            Pattern.compile("\\d+(?:\\.\\d+)?|[+\\-*/()]|[^\\s+\\-*/()]+");
    private static final Pattern NUMBER = Pattern.compile("\\d+(?:\\.\\d+)?");
    private static final Set<String> OPS = Set.of("+", "-", "*", "/");

    private final Map<String, Formula> astCache = new ConcurrentHashMap<>();

    // ==================== 规则生成 ====================

    /** 面板明细字段的自动计算规则(按 place 含 detail 的字段推导)。 */
    public List<Rule> rulesFor(PanelRegistry.PanelDef def) {
        return def == null ? List.of() : rulesFor(def.fieldsAt("detail"));
    }

    /**
     * 明细自动计算规则:按字段组合推导常见公式(字段名=行键,引擎按中文名取值求值)。
     * 兼容两套命名:标准(单价/金额/含税单价/含税金额)与销售(售价/销售金额/含税售价/含税销售金额)。
     *
     * <p>只有「入参齐全」才生成规则 —— 例如某面板有 金额/数量 却没有 单价(OUTSOURCE_ORDER),
     * 就不该凭空造一条算不出来的规则。
     */
    public List<Rule> rulesFor(List<PanelRegistry.FieldDef> detailFields) {
        Set<String> labels = new LinkedHashSet<>();
        for (PanelRegistry.FieldDef f : detailFields) labels.add(f.label());
        List<Rule> out = new ArrayList<>();
        // 数量列:优先"数量",退而"实收数量"
        String qty = labels.contains("数量") ? "数量" : labels.contains("实收数量") ? "实收数量" : null;
        // 单价/金额列:标准 或 销售命名(SALE_OUT 用 售价/销售金额/含税售价/含税销售金额)
        String price = labels.contains("单价") ? "单价" : labels.contains("售价") ? "售价" : null;
        String amount = labels.contains("金额") ? "金额" : labels.contains("销售金额") ? "销售金额" : null;
        String taxPrice = labels.contains("含税单价") ? "含税单价" : labels.contains("含税售价") ? "含税售价" : null;
        String taxAmount = labels.contains("含税金额") ? "含税金额" : labels.contains("含税销售金额") ? "含税销售金额" : null;
        boolean hasPrice = price != null;
        if (qty != null && hasPrice && amount != null) out.add(new Rule(amount, qty + "*" + price, 2));
        if (hasPrice && labels.contains("税率%") && taxPrice != null) {
            out.add(new Rule(taxPrice, price + "*(1+税率%/100)", 4));
        }
        if (qty != null && taxPrice != null && taxAmount != null) out.add(new Rule(taxAmount, qty + "*" + taxPrice, 2));
        if (amount != null && labels.contains("税率%") && labels.contains("税额")) {
            out.add(new Rule("税额", amount + "*税率%/100", 2));
        }
        if (qty != null && hasPrice && labels.contains("折扣%") && labels.contains("折扣金额")) {
            out.add(new Rule("折扣金额", qty + "*" + price + "*折扣%/100", 2));
        }
        if (qty != null && labels.contains("单重") && labels.contains("总重")) {
            out.add(new Rule("总重", "单重*" + qty, 4));
        }
        // 来料检验单:损耗率 = 损耗 / 送检数量(口径出自 qc_insp_detail.损耗率 列注释「按 0~1 小数存」,
        // 见 tools/migrate-qc-insp-fields.sql)。「损耗」本身是现场实测值,保持手工填写,不推导。
        if (labels.contains("损耗率") && labels.contains("损耗") && labels.contains("送检数量")) {
            out.add(new Rule("损耗率", "损耗/送检数量", 4));
        }
        return out;
    }

    // ==================== 前端契约 ====================

    /** 规则 → 前端 detail.tabs[].calc 的 JSON 形态({target, formula, round}) */
    public List<Map<String, Object>> asContract(List<Rule> rules) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Rule r : rules) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("target", r.target());
            m.put("formula", r.formula());
            m.put("round", r.round());
            out.add(m);
        }
        return out;
    }

    // ==================== 求值 ====================

    /**
     * 就地套用规则(行只增不改键:目标标签写回同一 Map)。
     *
     * <p><b>入参全空则不写入</b>:一条规则的**所有**引用字段都为空时跳过 ——
     * 否则"单价、数量都没填"的行会因为别的格子被改(如备注)而把手工填的金额抹成 0。
     * 只要有一个入参有值就照常算(缺失项按 0 参与运算,与前端一致)。
     *
     * @return 实际写入的规则条数
     */
    public int applyRules(List<Rule> rules, Map<String, Object> row) {
        if (rules == null || rules.isEmpty() || row == null) return 0;
        int applied = 0;
        for (Rule rule : rules) {
            Formula f;
            try {
                f = parse(rule.formula());
            } catch (RuntimeException e) {
                continue;   // 公式写坏不该打死整张单的保存
            }
            if (f.vars().isEmpty()) continue;
            boolean anyInput = false;
            for (String v : f.vars()) {
                if (!isEmpty(row.get(v))) { anyInput = true; break; }
            }
            if (!anyInput) continue;
            double value = eval(f, row);
            if (!Double.isFinite(value)) value = 0;
            row.put(rule.target(), BigDecimal.valueOf(round(value, rule.round()))
                    .setScale(Math.max(0, rule.round()), RoundingMode.HALF_UP));
            applied++;
        }
        return applied;
    }

    /** 公式引用到的输入字段名(供调用方判断"入参齐不齐") */
    public Set<String> inputsOf(String formula) {
        return parse(formula).vars();
    }

    private Formula parse(String expr) {
        return astCache.computeIfAbsent(String.valueOf(expr), CalcRuleService::build);
    }

    private static Formula build(String expr) {
        List<String> tokens = new ArrayList<>();
        var m = TOKEN.matcher(expr);
        while (m.find()) tokens.add(m.group());
        List<Object> rpn = new ArrayList<>();
        Deque<String> ops = new ArrayDeque<>();
        Set<String> vars = new LinkedHashSet<>();
        for (String t : tokens) {
            if (NUMBER.matcher(t).matches()) {
                rpn.add(Double.parseDouble(t));
            } else if ("(".equals(t)) {
                ops.push(t);
            } else if (")".equals(t)) {
                while (!ops.isEmpty() && !"(".equals(ops.peek())) rpn.add(ops.pop());
                if (!ops.isEmpty()) ops.pop();
            } else if (OPS.contains(t)) {
                while (!ops.isEmpty() && !"(".equals(ops.peek()) && prec(ops.peek()) >= prec(t)) rpn.add(ops.pop());
                ops.push(t);
            } else {
                vars.add(t);
                rpn.add(t);
            }
        }
        while (!ops.isEmpty()) rpn.add(ops.pop());
        return new Formula(rpn, vars);
    }

    private static int prec(String op) {
        return ("*".equals(op) || "/".equals(op)) ? 2 : 1;
    }

    private static double eval(Formula f, Map<String, Object> row) {
        Deque<Double> st = new ArrayDeque<>();
        for (Object t : f.rpn()) {
            if (t instanceof Double d) {
                st.push(d);
                continue;
            }
            String s = (String) t;
            if (!OPS.contains(s)) {
                st.push(num(row.get(s)));
                continue;
            }
            double b = st.isEmpty() ? 0 : st.pop();
            double a = st.isEmpty() ? 0 : st.pop();
            st.push(switch (s) {
                case "+" -> a + b;
                case "-" -> a - b;
                case "*" -> a * b;
                default -> b == 0 ? 0 : a / b;
            });
        }
        return st.isEmpty() ? 0 : st.pop();
    }

    private static boolean isEmpty(Object v) {
        return v == null || (v instanceof CharSequence cs && cs.toString().isBlank());
    }

    private static double num(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * 财务口径十进制四舍五入 —— 逐位对齐前端 {@code engine.roundDecimal}:
     * 修正 15.5 * 1.13 = 17.514999… 一类二进制浮点边界,避免同一笔金额前后端两位不同。
     */
    public static double round(double value, int digits) {
        if (!Double.isFinite(value)) return 0;
        double factor = Math.pow(10, digits);
        double scaled = value * factor;
        double tolerance = Math.pow(2, -52) * Math.max(1, Math.abs(scaled)) * 4;
        double rounded = scaled >= 0
                ? Math.floor(scaled + 0.5 + tolerance)
                : Math.ceil(scaled - 0.5 - tolerance);
        return rounded / factor;
    }
}
