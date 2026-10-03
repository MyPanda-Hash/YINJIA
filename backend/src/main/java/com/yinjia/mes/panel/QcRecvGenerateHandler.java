package com.yinjia.mes.panel;

import com.yinjia.mes.service.PanelRegistry;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 送料暂收单(QC_RECV)「生单」——按**商品基本档案的「来料检验」逐行分流**(2026-10-05 用户口径)。
 *
 * <p><b>用户口径</b>:「暂收单到来料检验单或者采购入库单的生单,需要通过商品基本档案的编码对应来看
 * 来料检验这个字段是否为是,如果为是则生单为检验单,否则直接入库单,不是现在的两个生单按钮;
 * 而且同个单据不同商品一个为是一个为否,则分别生成检验单和入库单。」
 *
 * <p><b>做法</b>:把原先人工二选一的两个按钮(生成来料检验单 / 生成采购入库单)收敛成**一个**「生单」,
 * 去向由数据决定 ——
 * <ol>
 *   <li>载入暂收单的候选行与**剩余量**({@link PushGenerateHandler#batchLines},与生单校验同一份口径);</li>
 *   <li>按行「物料编码」回查商品基本档案 {@code bs_inv.存货编码} 的 {@code 来料检验}:</li>
 *   <li>{@code 是} ⇒ 归 {@code QC_INSP}(来料检验单);其余(含 {@code 否}、空值、档案里查不到的商品)
 *       ⇒ 归 {@code PURCHASE_IN}(采购入库单,**免检直达**);</li>
 *   <li>两组**各生成一张草稿**(某组无行就不生成),逐行按量占用、继承同一批次键/批次号 ——
 *       同一张暂收单因此可以同时产出检验单与入库单,互不干扰。</li>
 * </ol>
 *
 * <p><b>为什么"查不到就当否"</b>:与既有口径一致 —— 商品档案的「来料检验」未填写即视为否
 * (见 {@code tools/migrate-inv-inspection-default-no.sql});档案里根本没有该编码(N 年前的老物料)
 * 时同样按免检走,否则一条脏数据会整单生不出单。这类编码在返回里以「未登记商品」带给前端提示,
 * 是可被看见的异常,不会静默。
 *
 * <p>本动作在 {@code PanelConfigService.PUSH_TARGETS} 里登记为 {@code QC_INSP} 只是**路由标记**
 * (按钮据此不置灰;该映射同时被前端用来判断要不要弹分批对话框,而暂收单本身带批次号、从不弹框),
 * 真正的分流在本类 —— 故它同时登记在 {@link PushGenerateHandler} 的 {@code CUSTOM_OWNED},
 * 通用推式生单处理器不认领这条动作(一个动作只能有一个处理器,见 PanelActionRegistry)。
 */
@Component
public class QcRecvGenerateHandler implements PanelActionHandler {

    /** 本动作的宿主面板与动作名(与 PanelConfigService.PANDA_BUTTONS / PUSH_TARGETS 同源,改一处须同改) */
    public static final String PANEL = "QC_RECV";
    public static final String ACTION = "生成检验或入库单";

    /** 分流去向:走检验 / 免检直达 */
    private static final String INSPECTION_TARGET = "QC_INSP";
    private static final String RECEIPT_TARGET = "PURCHASE_IN";

    /** 商品档案「来料检验」判定为"要走检验"的取值;其余一切取值(含空、含档案里没有该编码)一律免检 */
    private static final String INSPECTION_YES = "是";

    /** 数量比较容差(与 PushGenerateHandler 的 0.000001 同口径) */
    private static final double EPS = 1e-6;

    private final PushGenerateHandler pushGenerate;
    private final PanelRegistry registry;
    private final JdbcTemplate jdbc;

    public QcRecvGenerateHandler(PushGenerateHandler pushGenerate, PanelRegistry registry, JdbcTemplate jdbc) {
        this.pushGenerate = pushGenerate;
        this.registry = registry;
        this.jdbc = jdbc;
    }

    @Override
    public boolean supports(String panelCode, String action) {
        return PANEL.equals(panelCode) && ACTION.equals(action);
    }

    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> handle(PanelActionContext context) {
        Object noObj = context.formData() == null ? null : context.formData().get("编号");
        if (noObj == null || String.valueOf(noObj).isBlank()) throw new IllegalArgumentException("缺少表单编号");
        String sourceNo = String.valueOf(noObj);
        String user = context.userName();

        // 1) 候选行 + 剩余量:取自 batchLines(与 generateBatch 的校验同一份口径,免得两处各算一套)
        Map<String, Object> probe = pushGenerate.batchLines(PANEL, INSPECTION_TARGET, sourceNo);
        List<Map<String, Object>> rows = probe.get("lines") instanceof List<?> l
                ? (List<Map<String, Object>>) l : List.of();

        // 2) 商品基本档案的「来料检验」:一次 IN 查询拿全,不逐行查库
        Map<String, String> flags = inspectionFlagsOf(rows);

        // 3) 逐行分流(剩余量为 0 的行 = 已送满,不参与)
        Map<String, Double> toInspection = new LinkedHashMap<>();
        Map<String, Double> toReceipt = new LinkedHashMap<>();
        Set<String> unregistered = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) {
            double qty = numOf(r.get("剩余数量"));
            if (qty <= EPS) continue;
            String lineKey = str(r.get("lineKey"));
            if (lineKey.isEmpty()) continue;
            String code = str(r.get("物料编码"));
            String flag = flags.get(code.trim());
            if (INSPECTION_YES.equals(flag)) {
                toInspection.put(lineKey, qty);
            } else {
                if (flag == null) unregistered.add(code);   // 档案里查不到 → 按否(免检),并把编码报给前端
                toReceipt.put(lineKey, qty);
            }
        }
        if (toInspection.isEmpty() && toReceipt.isEmpty()) {
            throw new IllegalStateException("该单据已无剩余可生单(各明细行均已生成下游单据)");
        }

        // 4) 两组各生成一张草稿(某组无行则不出单)—— 同一事务:任一张失败则两张都不落库
        List<Map<String, Object>> made = new ArrayList<>();
        if (!toInspection.isEmpty()) made.add(generate(INSPECTION_TARGET, sourceNo, user, toInspection));
        if (!toReceipt.isEmpty()) made.add(generate(RECEIPT_TARGET, sourceNo, user, toReceipt));

        Map<String, Object> first = made.get(0);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", first.get("编号"));
        out.put("单据状态", "草稿");
        out.put("gotoPanel", first.get("面板"));
        out.put("批次号", first.get("批次号"));
        out.put("生成清单", made);
        if (!unregistered.isEmpty()) out.put("未登记商品", new ArrayList<>(unregistered));
        return out;
    }

    /**
     * 生成一组:委托通用分批生单({@link PushGenerateHandler#generateBatch})—— 头行映射、批次号继承、
     * 按量占用、批次台账、检验目录联动全部走既有那一套,本类只负责"哪些行去哪个面板"。
     *
     * @param qtyByLine 行键 → 本次数量(该组的全部剩余行)
     */
    private Map<String, Object> generate(String target, String sourceNo, String user, Map<String, Double> qtyByLine) {
        Map<String, Object> res = pushGenerate.generateBatch(PANEL, target, sourceNo, user, qtyByLine, null, null);
        String newNo = str(res.get("编号"));
        Map<String, Object> one = new LinkedHashMap<>();
        one.put("面板", target);
        one.put("面板名称", registry.panel(target).name());   // 中文面板名(前端 tt() 出译名)
        one.put("编号", newNo);
        one.put("批次号", res.get("批次号"));
        one.put("行数", countLines(target, newNo, qtyByLine.size()));
        one.put("合计数量", res.get("本次送料合计"));
        return one;
    }

    /** 目标单实际落库的明细行数(取不到时退回"本次送料行数",只为把提示写准) */
    private int countLines(String target, String newNo, int fallback) {
        try {
            PanelRegistry.PanelDef def = registry.panel(target);
            if (def.lineTable() == null || def.groupCol() == null || newNo.isEmpty()) return fallback;
            Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM " + def.lineTable()
                    + " WHERE [" + def.groupCol() + "] = ?", Integer.class, newNo);
            return n == null ? fallback : n;
        } catch (Exception ignore) {
            return fallback;      // 计数失败不该影响生单结果
        }
    }

    /**
     * 候选行的「来料检验」标志:按行的 物料编码 → 商品基本档案(bs_inv)的 存货编码,一次 IN 查询。
     * 返回 编码 → 取值;档案里**没有**该编码时不出现在结果里(调用方以 null 判"未登记")。
     */
    private Map<String, String> inspectionFlagsOf(List<Map<String, Object>> rows) {
        Set<String> codes = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) {
            String c = str(r.get("物料编码")).trim();
            if (!c.isEmpty()) codes.add(c);
        }
        Map<String, String> out = new LinkedHashMap<>();
        if (codes.isEmpty()) return out;
        String placeholders = String.join(",", Collections.nCopies(codes.size(), "?"));
        // 编码两侧可能有历史空格(char 尾空格等),比较与取值都先 TRIM,免得因空格判成"未登记"
        jdbc.query("SELECT LTRIM(RTRIM(存货编码)) AS code, LTRIM(RTRIM(ISNULL(来料检验, N''))) AS flag"
                        + " FROM bs_inv WHERE LTRIM(RTRIM(存货编码)) IN (" + placeholders + ")",
                // 块体 lambda:表达式体(返回 putIfAbsent 的值)会让 RowCallbackHandler / ResultSetExtractor 重载歧义
                rs -> { out.putIfAbsent(rs.getString("code"), rs.getString("flag")); },
                codes.toArray());
        return out;
    }

    private static double numOf(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        if (v == null) return 0d;
        try { return Double.parseDouble(String.valueOf(v).trim()); } catch (Exception e) { return 0d; }
    }

    private static String str(Object o) { return o == null ? "" : String.valueOf(o).trim(); }
}
