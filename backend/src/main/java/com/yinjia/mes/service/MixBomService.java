package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 「混料物料清单」({@code bs_mix_bom},面板 {@code MIX_BOM})的**唯一取数口径**(2026-11-18)。
 *
 * <h3>为什么要有这个类</h3>
 * 2026-11-18 用户口径:
 * <ul>
 *   <li>「生成工单领料的时候,关联物料清单生成混料领料单,从根据物料清单领料改为根据混料物料清单生成。」</li>
 *   <li>「扫码混料也是一样,扫工单码查询对应的物料清单,带出需要称重的物料,带入的bom从物料清单改为
 *       混料物料清单。」</li>
 * </ul>
 * 两条链路(生成工单领料 → 混料领料单;手机扫码 → 扫码混料)以前各读各的表
 * ({@code bs_asm_bom} 半成品那张 / 遗留 {@code mate}),同一套配方要维护两处、还常不一致。
 * 现在**都收口到本类**,以后改定位键/单位换算/排序只改这一处。
 *
 * <h3>定位键</h3>
 * {@code bs_mix_bom.产品编号 + 烧结类型} 是清单的定位键(见 {@link ProcBomArchiveSyncService})。
 * 清单里的产品编号是**原始产品编码**:归档时已剥掉烧结单的 {@code -tb} 后缀,也不带半成品的
 * {@code **TB} 标记。所以取数时把调用方给的编码归一成候选集再查:
 * <pre>
 *   C-87**TB   → C-87      (半成品编码:工单领料按半成品找它的混料配方)
 *   A-48-41-tb → A-48-41   (烧结工艺清单里的写法)
 *   T410       → T410      (成品编码:扫码混料按工单产品找)
 * </pre>
 * 同一产品可能有**两种烧结**各一张清单(烧结工艺清单 / X烧结工艺清单)⇒ 按
 * 「烧结工艺清单 → X烧结工艺清单 → 其它」优先取一张,**不把两张的行合并**(合并会把同一物料算两遍)。
 *
 * <h3>用量口径(与领料/称重两端共用)</h3>
 * 混料清单里的「单支含量g」是**每 1 支成品的克数**,而材料出库单/电子秤按**存货档案的计量单位**记账
 * (粉料多是 kg)。所以标准用量 = 单支含量g 按单位换算:
 * <ul>
 *   <li>单位 kg / 千克 / 公斤 ⇒ ÷1000</li>
 *   <li>单位 t / 吨 ⇒ ÷1,000,000</li>
 *   <li>其它(g / 支 / 空)⇒ 原值(不猜、不编造)</li>
 * </ul>
 * 该换算与测试库演示数据脚本 {@code tools/seed-test-mix-bom-20261118.sql} 的落数口径一致
 * (单支约 190~200 g,kg 料按 /1000 记账)。
 *
 * <p>清单里的「添加比例 / 设计添加量」是配方口径(百分比),**不参与**领料量计算,只随行带回供展示。
 */
@Service
public class MixBomService {

    /** 面板码(与 {@link ProcBomArchiveSyncService#PANEL_MIX_BOM} 同一张面板) */
    public static final String PANEL = ProcBomArchiveSyncService.PANEL_MIX_BOM;

    private final JdbcTemplate jdbc;

    public MixBomService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 一张有效的混料物料清单(抬头 + 归一化明细行)。
     *
     * @param docNo       清单单据编号(号池 MIX)
     * @param productCode 清单上的产品编号(已是原始编码)
     * @param productName 产品名称
     * @param sinterType  烧结类型(烧结工艺清单 / X烧结工艺清单)
     * @param sourceNo    产生本清单的烧结单号(溯源自 {@code 来源单号})
     * @param lines       明细行(见 {@link #rowsOf(String)} 的键)
     */
    public record Doc(String docNo, String productCode, String productName, String sinterType,
                      String sourceNo, String version, List<Map<String, Object>> lines) {
        public boolean isEmpty() { return lines == null || lines.isEmpty(); }
    }

    /**
     * 按产品编码取混料物料清单。
     *
     * @param productCode 工单产品编码 / 半成品编码 / 烧结单调用的产品编号(自动归一,见类注释)
     * @return 永远非 null;没维护时 {@link Doc#isEmpty()} = true(调用方据此给"没有维护用料"的提示)
     */
    public Doc of(String productCode) {
        List<String> codes = candidates(productCode);
        if (codes.isEmpty()) return emptyDoc();
        String in = String.join(",", java.util.Collections.nCopies(codes.size(), "?"));
        // 有效清单 = 未作废(行) + 未停用 + 没被「删除单据」作废(yj_doc_status.canceled='Y',
         // 作废只写状态不删行,只看 asp_cancel 会把废单当有效清单取走 —— 与 WorkOrderBomService 同口径)。
        List<Map<String, Object>> docs = jdbc.queryForList(
                "SELECT TOP 1 b.[单据编号] AS no, b.[产品编号] AS prod, ISNULL(b.[产品名称],N'') AS pname,"
                        + " ISNULL(b.[烧结类型],N'') AS stype, ISNULL(b.[来源单号],N'') AS src,"
                        + " MAX(ISNULL(b.[版本号],N'')) AS ver"
                        + " FROM dbo.bs_mix_bom b"
                        + " WHERE b.[产品编号] IN (" + in + ")"
                        + "   AND ISNULL(b.asp_cancel,'N') <> 'Y'"
                        + "   AND ISNULL(b.[状态],N'启用') <> N'停用'"
                        + "   AND NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status s WHERE s.panel_code = 'MIX_BOM'"
                        + "       AND s.doc_no = b.[单据编号] AND s.canceled = 'Y')"
                        + " GROUP BY b.[单据编号], b.[产品编号], b.[产品名称], b.[烧结类型], b.[来源单号]"
                        + " ORDER BY CASE WHEN ISNULL(b.[烧结类型],N'') = N'烧结工艺清单' THEN 0"
                        + "               WHEN ISNULL(b.[烧结类型],N'') = N'X烧结工艺清单' THEN 1 ELSE 2 END,"
                        + "          MAX(ISNULL(b.[版本号],N'')) DESC, b.[单据编号] DESC",
                codes.toArray());
        if (docs.isEmpty()) {
            List<Map<String, Object>> orphans = jdbc.queryForList(
                    "SELECT TOP 1 b.[单据编号] AS no FROM dbo.bs_mix_bom b"
                            + " WHERE b.[产品编号] IN (" + in + ")"
                            + "   AND ISNULL(b.asp_cancel,'N') <> 'Y'"
                            + "   AND ISNULL(b.[状态],N'启用') <> N'停用'",
                    codes.toArray());
            if (!orphans.isEmpty()) {
                // 有清单但被「删除单据」作废了:把原因说清楚,别让人以为是"没维护"
                throw new IllegalStateException("该产品的混料物料清单「" + str(orphans.get(0).get("no"))
                        + "」已被删除,不能再取料:请到 数据建模 → 物料及价格 → 混料物料清单 重新维护"
                        + "(或重新归档对应烧结工艺清单)");
            }
            return emptyDoc();
        }
        Map<String, Object> doc = docs.get(0);
        Doc head = new Doc(str(doc.get("no")), str(doc.get("prod")), str(doc.get("pname")),
                str(doc.get("stype")), str(doc.get("src")), str(doc.get("ver")), List.of());
        return new Doc(head.docNo(), head.productCode(), head.productName(), head.sinterType(),
                head.sourceNo(), head.version(), linesOf(head.docNo()));
    }

    /**
     * 归一化明细行(扫码混料 / 混料领料单共用一份取数)。
     *
     * <p>键与既有物料清单口径保持一致,调用方(明细页/扫料解锁/整单校验/生单)不必分辨来源:
     * <pre>
     *   物料编号 / 物料名称 / 规格型号 / 单位
     *   标准用量(单件用量,已按存货单位换算) / 损耗量(混料清单没有该列 ⇒ 恒 0) / 备注
     *   单支含量g / 添加比例 / 设计添加量 / 物料种类 / 行序   ← 展示与追溯用
     * </pre>
     * 同一物料在清单里出现多行时**只认第一行**(不累加,免得把重复录入算成两倍;与旧口径一致);
     * 没有物料编号的行跳过(扫不了码、也领不了料)。
     *
     * @param productCode 产品编码(自动归一候选,见类注释)
     */
    public List<Map<String, Object>> rowsOf(String productCode) {
        return of(productCode).lines();
    }

    /** 按清单单据编号取明细行(供 {@link #of(String)} 内部使用;也便于回填/自检直接按号取) */
    public List<Map<String, Object>> linesOf(String docNo) {
        String no = str(docNo);
        if (no.isEmpty()) return List.of();
        List<Map<String, Object>> raw = jdbc.queryForList(
                "SELECT ISNULL(b.[行序],0) AS seq, ISNULL(b.[物料种类],N'') AS kind,"
                        + " ISNULL(b.[物料编号],N'') AS code, ISNULL(b.[物料名称],N'') AS name,"
                        + " ISNULL(b.[添加比例],N'') AS ratio, ISNULL(b.[单支含量g],N'') AS content,"
                        + " ISNULL(b.[设计添加量],N'') AS design, ISNULL(b.[行备注],N'') AS memo,"
                        + " ISNULL(i.[存货名称],N'') AS invName, ISNULL(i.[规格型号],N'') AS invSpec,"
                        + " ISNULL(i.[计量单位],N'') AS invUnit"
                        + " FROM dbo.bs_mix_bom b"
                        + " LEFT JOIN dbo.bs_inv i ON i.[存货编码] = b.[物料编号] AND ISNULL(i.asp_cancel,'N') <> 'Y'"
                        + " WHERE b.[单据编号] = ? AND ISNULL(b.asp_cancel,'N') <> 'Y'"
                        + " ORDER BY ISNULL(b.[行序],999), b.id", no);
        List<Map<String, Object>> out = new ArrayList<>();
        java.util.Set<String> seen = new LinkedHashSet<>();
        for (Map<String, Object> r : raw) {
            String code = str(r.get("code"));
            if (code.isEmpty() || !seen.add(code)) continue;
            String unit = str(r.get("invUnit"));
            double grams = num(r.get("content"));
            double usage = toStockQty(grams, unit);
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("物料编号", code);
            v.put("物料名称", firstNonBlank(str(r.get("name")), str(r.get("invName")), code));
            v.put("规格型号", str(r.get("invSpec")));
            v.put("单位", unit);
            // 单件用量(存货单位)。领料端与扫码端都按「本值 × 数量」算需求,别再各乘一次
            v.put("标准用量", round6(usage));
            v.put("损耗量", 0d);
            v.put("备注", str(r.get("memo")));
            v.put("单支含量g", round6(grams));
            v.put("添加比例", str(r.get("ratio")));
            v.put("设计添加量", str(r.get("design")));
            v.put("物料种类", str(r.get("kind")));
            v.put("行序", intOf(r.get("seq")));
            out.add(v);
        }
        return out;
    }

    // ═══════════════════════════ 归一化 / 换算 ═══════════════════════════

    /**
     * 产品编码 → 混料清单候选集(去重、保序)。
     *
     * <p>归一规则与前后端既有的「产品编号双形态」一致:去掉结尾的 {@code -tb}(大小写不敏感)
     * 与半成品标记 {@code **TB}(大小写不敏感),原值也一起作为候选(历史单可能两种写法都有)。
     */
    static List<String> candidates(String productCode) {
        String raw = str(productCode);
        if (raw.isEmpty()) return List.of();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        out.add(raw);
        String base = raw.replaceAll("(?i)\\*\\*TB\\s*$", "").trim();
        out.add(base);
        String noTb = base.replaceAll("(?i)-tb\\s*$", "").trim();
        out.add(noTb);
        out.removeIf(s -> s == null || s.isBlank());
        return new ArrayList<>(out);
    }

    /**
     * 单支含量(g) → 该物料存货单位的单件用量。
     *
     * <p>见类注释「用量口径」:只做 kg/吨 → 克 的明确换算,认不出的单位原样返回(不猜)。
     */
    static double toStockQty(double grams, String unit) {
        String u = str(unit).toLowerCase(Locale.ROOT).replace(" ", "");
        if (u.isEmpty()) return grams;
        if (u.equals("kg") || u.equals("千克") || u.equals("公斤") || u.equals("kgs")) return grams / 1000d;
        if (u.equals("t") || u.equals("吨")) return grams / 1_000_000d;
        return grams;
    }

    /** 文本数量 → double:支持 "19.9"、"1,234.5"、"324g"、"1/124"(取首个数字;解析不出 0) */
    static double num(Object raw) {
        String s = str(raw);
        if (s.isEmpty()) return 0d;
        int slash = s.indexOf('/');
        if (slash > 0 && slash < s.length() - 1) {
            double a = num(s.substring(0, slash));
            double b = num(s.substring(slash + 1));
            return b == 0 ? 0d : a / b;
        }
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("-?\\d+(?:\\.\\d+)?").matcher(s.replace(",", ""));
        if (!m.find()) return 0d;
        try {
            return Double.parseDouble(m.group());
        } catch (NumberFormatException e) {
            return 0d;
        }
    }

    private static double round6(double v) {
        return BigDecimal.valueOf(v).setScale(6, RoundingMode.HALF_UP).doubleValue();
    }

    private static Doc emptyDoc() {
        return new Doc("", "", "", "", "", "", List.of());
    }

    private static String firstNonBlank(String... vals) {
        for (String v : vals) if (v != null && !v.isBlank()) return v;
        return "";
    }

    private static int intOf(Object v) {
        if (v instanceof Number n) return n.intValue();
        try {
            return v == null ? 0 : Integer.parseInt(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}
