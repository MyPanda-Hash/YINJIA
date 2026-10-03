import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * 自动计算字段体检(只读探针,2026-10 采购链「自动计算」任务)。
 *
 * 目的:把 backend PanelConfigService.buildCalcRules 的判定逻辑在**库侧**复现一遍,
 * 输出每张单据面板「明细自动计算规则」的预测结果 + 关键标签存在性,用于回答
 * 「整个链路有关自动计算的字段是否都会自动计算」。
 *
 * 用法(在 tools 目录):
 *   set YINJIA_SQL_PASS=<口令>
 *   java -cp lib\mssql-jdbc.jar archive/_CalcAudit.java [库名] [输出文件]
 * 库名默认 HSDZ_MES,输出默认 archive/_calc-audit.md
 */
public class _CalcAudit {

    static final String[] QTY  = {"数量", "实收数量"};
    static final String[] PRICE = {"单价", "售价"};
    static final String[] AMT  = {"金额", "销售金额"};
    static final String[] TPRICE = {"含税单价", "含税售价"};
    static final String[] TAMT = {"含税金额", "含税销售金额"};

    static String pick(Set<String> labels, String[] cand) {
        for (String c : cand) if (labels.contains(c)) return c;
        return null;
    }

    /** 与 buildCalcRules 逐条对齐的预测(顺序也一致) */
    static List<String> predict(Set<String> L) {
        String qty = pick(L, QTY), price = pick(L, PRICE), amt = pick(L, AMT);
        String tprice = pick(L, TPRICE), tamt = pick(L, TAMT);
        boolean hasPrice = price != null;
        List<String> out = new ArrayList<>();
        if (qty != null && hasPrice && amt != null) out.add(amt + " = " + qty + " * " + price + "  (round 2)");
        if (hasPrice && L.contains("税率%") && tprice != null) out.add(tprice + " = " + price + " * (1 + 税率% / 100)  (round 4)");
        if (qty != null && tprice != null && tamt != null) out.add(tamt + " = " + qty + " * " + tprice + "  (round 2)");
        if (amt != null && L.contains("税率%") && L.contains("税额")) out.add("税额 = " + amt + " * 税率% / 100  (round 2)");
        if (qty != null && hasPrice && L.contains("折扣%") && L.contains("折扣金额")) out.add("折扣金额 = " + qty + " * " + price + " * 折扣% / 100  (round 2)");
        if (qty != null && L.contains("单重") && L.contains("总重")) out.add("总重 = 单重 * " + qty + "  (round 4)");
        return out;
    }

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        Path out = Path.of(args.length > 1 ? args[1] : "archive/_calc-audit.md");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";

        StringBuilder sb = new StringBuilder();
        sb.append("# 单据面板「明细自动计算」体检 — 库 ").append(db).append("\n\n");
        sb.append("判定口径 = `PanelConfigService.buildCalcRules`(前端 `calculateDetailRow` 消费同一份规则)。\n\n");

        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            Map<String, String> panelNames = new LinkedHashMap<>();
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT panel_code, panel_name FROM yj_panel WHERE mode='doc' ORDER BY panel_code")) {
                while (rs.next()) panelNames.put(rs.getString(1), rs.getString(2));
            }
            Map<String, Set<String>> detailLabels = new LinkedHashMap<>();
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT panel_code, label FROM yj_field WHERE place LIKE '%detail%' GROUP BY panel_code, label")) {
                while (rs.next()) {
                    detailLabels.computeIfAbsent(rs.getString(1), k -> new LinkedHashSet<>()).add(rs.getString(2));
                }
            }

            sb.append("| 面板 | 名称 | 明细字段数 | 预测自动计算规则 |\n|---|---|---|---|\n");
            for (Map.Entry<String, String> e : panelNames.entrySet()) {
                Set<String> L = detailLabels.getOrDefault(e.getKey(), Set.of());
                List<String> rules = predict(L);
                sb.append("| ").append(e.getKey()).append(" | ").append(e.getValue()).append(" | ")
                  .append(L.size()).append(" | ")
                  .append(rules.isEmpty() ? "**(无)**" : String.join("<br>", rules))
                  .append(" |\n");
            }

            // 采购链逐张明细标签清单(核对「有没有该算的字段却没规则」)
            String[] chain = {"PU_REQ", "PU_ORDER", "QC_RECV", "QC_INSP", "QC_RETURN", "QC_TC_IN",
                              "PURCHASE_IN", "SO_ORDER", "SALE_OUT", "MATERIAL_OUT", "OUTSOURCE_IN",
                              "FINISH_IN", "OTHER_IN", "OTHER_OUT", "OUTSOURCE_ISSUE", "MANU_ORDER"};
            sb.append("\n## 链上各单据明细字段全集\n\n");
            for (String p : chain) {
                Set<String> L = detailLabels.getOrDefault(p, Set.of());
                if (L.isEmpty()) { sb.append("- **").append(p).append("**: (无明细字段)\n"); continue; }
                sb.append("- **").append(p).append("**: ").append(String.join("、", L)).append("\n");
            }

            // 落库体检:金额类列「有量有价却空」/「与价×量不符」
            sb.append("\n## 落库体检(金额列是否真的算出来了)\n\n");
            String[][] checks = {
                {"PURCHASE_IN", "bl_purchase_in", "单价", "实收数量", "金额", "bd_purchase_in", "单据编号"},
                {"QC_RECV", "sl_recv_detail", "单价", "数量", "金额", "sl_recv", "单据编号"},
                {"PU_ORDER", "bl_pu_order", "单价", "数量", "金额", "bd_pu_order", "单据编号"},
                {"SALE_OUT", "bl_sale_out", "售价", "数量", "销售金额", "bd_sale_out", "单据编号"},
                {"SO_ORDER", "bl_so_order", "单价", "数量", "金额", "bd_so_order", "单据编号"},
                {"MATERIAL_OUT", "bl_material_out", "单价", "数量", "金额", "bd_material_out", "单据编号"},
            };
            sb.append("| 面板 | 行表 | 总行 | 有量有价 | 有量有价但金额空 | 金额≠价×量 |\n|---|---|---|---|---|---|\n");
            for (String[] k : checks) {
                String sql = "SELECT COUNT(*),"
                        + " SUM(CASE WHEN " + q(k[2]) + " IS NOT NULL AND " + q(k[2]) + "<>0 AND " + q(k[3]) + " IS NOT NULL THEN 1 ELSE 0 END),"
                        + " SUM(CASE WHEN " + q(k[2]) + " IS NOT NULL AND " + q(k[2]) + "<>0 AND " + q(k[3]) + " IS NOT NULL AND " + q(k[4]) + " IS NULL THEN 1 ELSE 0 END),"
                        + " SUM(CASE WHEN " + q(k[4]) + " IS NOT NULL AND " + q(k[2]) + " IS NOT NULL AND " + q(k[3]) + " IS NOT NULL"
                        + "          AND ABS(" + q(k[4]) + " - " + q(k[2]) + "*" + q(k[3]) + ") > 0.011 THEN 1 ELSE 0 END)"
                        + " FROM " + q(k[1]) + " WHERE ISNULL(asp_cancel,'N')<>'Y'";
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
                    if (rs.next()) {
                        sb.append("| ").append(k[0]).append(" | ").append(k[1]).append(" | ")
                          .append(rs.getInt(1)).append(" | ").append(rs.getInt(2)).append(" | ")
                          .append(rs.getInt(3)).append(" | ").append(rs.getInt(4)).append(" |\n");
                    }
                } catch (SQLException ex) {
                    sb.append("| ").append(k[0]).append(" | ").append(k[1]).append(" | (跳过: ").append(ex.getMessage().replace('\n',' ')).append(") | | | |\n");
                }
            }
        }
        Files.writeString(out, sb.toString(), StandardCharsets.UTF_8);
        System.out.println("[OK] " + out.toAbsolutePath() + " (" + sb.length() + " chars)");
    }

    static String q(String ident) { return "[" + ident + "]"; }
}
