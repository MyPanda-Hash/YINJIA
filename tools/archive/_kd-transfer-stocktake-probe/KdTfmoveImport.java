/**
 * 2026-10-18:把**金蝶正式账套 9.1 后已审核的调拨单**补录进 MES —— 走真实 HTTP 保存 + 审核。
 *
 * 为什么不直接写 SQL:审核要执行 StockLedgerService.applyTransfer 的两腿过账(kucun + 流水段 9/10),
 * 那段逻辑不能绕过;走 /api/px/callButton 与人在界面点「审核」是同一条路径。
 *
 * 口径(用户要求「日期编号要和拉取的单据日期对应」):
 *   · 单据编号 = 金蝶 bill_no(YCD-20260908-00001 等),单据日期 = 金蝶 bill_date —— 逐字对应;
 *   · ERP单号 = 金蝶单号,便于溯源;
 *   · 幂等:以 单据编号 为键,已存在则跳过。
 *
 * 用法(tools 目录):
 *   java -cp lib/mssql-jdbc.jar archive/_kd-transfer-stocktake-probe/KdTfmoveImport.java [jsonDir] [apiBase] [--apply]
 *   不带 --apply = dry-run(只校验+打印,不改库)
 */
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

public class KdTfmoveImport {

    static final String BEGIN = "2026-09-01";
    static final HttpClient HTTP = HttpClient.newHttpClient();
    static String base = "http://127.0.0.1:8090/api", token;
    static Connection db;

    static int p = 0; static String src;
    static Object parse() {
        skip(); char c = src.charAt(p);
        if (c == '{') return obj(); if (c == '[') return arr();
        if (c == '"') return str();
        if (src.startsWith("true", p)) { p += 4; return Boolean.TRUE; }
        if (src.startsWith("false", p)) { p += 5; return Boolean.FALSE; }
        if (src.startsWith("null", p)) { p += 4; return null; }
        int s = p; while (p < src.length() && "-+.eE0123456789".indexOf(src.charAt(p)) >= 0) p++;
        return Double.valueOf(src.substring(s, p));
    }
    static void skip() { while (p < src.length() && Character.isWhitespace(src.charAt(p))) p++; }
    static Map<String, Object> obj() {
        Map<String, Object> m = new LinkedHashMap<>(); p++; skip();
        if (src.charAt(p) == '}') { p++; return m; }
        while (true) {
            skip(); String k = str(); skip(); p++;
            m.put(k, parse()); skip();
            if (src.charAt(p) == ',') { p++; continue; }
            p++; return m;
        }
    }
    static List<Object> arr() {
        List<Object> l = new ArrayList<>(); p++; skip();
        if (src.charAt(p) == ']') { p++; return l; }
        while (true) {
            l.add(parse()); skip();
            if (src.charAt(p) == ',') { p++; continue; }
            p++; return l;
        }
    }
    static String str() {
        p++; StringBuilder sb = new StringBuilder();
        while (true) {
            char c = src.charAt(p++);
            if (c == '"') break;
            if (c == '\\') {
                char e = src.charAt(p++);
                switch (e) {
                    case 'n' -> sb.append('\n'); case 't' -> sb.append('\t'); case 'r' -> sb.append('\r');
                    case 'u' -> { sb.append((char) Integer.parseInt(src.substring(p, p + 4), 16)); p += 4; }
                    default -> sb.append(e);
                }
            } else sb.append(c);
        }
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    public static void main(String[] a) throws Exception {
        String dir = a.length > 0 && !a[0].startsWith("--") && !a[0].startsWith("http")
                ? a[0] : "tools/archive/_kd-transfer-stocktake-fields";
        for (String x : a) if (x.startsWith("http")) base = x.replaceAll("/+$", "") + "/api";
        boolean apply = Arrays.asList(a).contains("--apply");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        db = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", pass);
        login();

        src = Files.readString(Path.of(dir, "tfmove-full.json"), StandardCharsets.UTF_8); p = 0;
        List<Object> all = (List<Object>) parse();
        List<Map<String, Object>> picked = new ArrayList<>();
        for (Object o : all) {
            Map<String, Object> d = (Map<String, Object>) ((Map<String, Object>) o).get("detail");
            String date = s(d.get("bill_date"));
            if (date != null && date.compareTo(BEGIN) >= 0 && "C".equals(s(d.get("bill_status")))) picked.add(d);
        }
        picked.sort(Comparator.comparing(x -> s(x.get("bill_date"))));
        System.out.printf("=== 金蝶调拨单 %s 起已审核:%d 张 === %s%n", BEGIN, picked.size(),
                apply ? "" : "(dry-run,加 --apply 才写库)");

        int ok = 0, skip = 0, bad = 0, pending = 0;
        boolean resync = Arrays.asList(a).contains("--resync");
        for (Map<String, Object> d : picked) {
            String no = s(d.get("bill_no")), date = s(d.get("bill_date"));
            List<Map<String, Object>> ents = (List<Map<String, Object>>) d.get("material_entity");
            if (ents == null || ents.isEmpty()) { System.out.println("  [跳过] " + no + " 无分录"); skip++; continue; }

            int exist = count("SELECT COUNT(*) FROM bd_transfer WHERE 单据编号=?", no);
            boolean audited = count("SELECT COUNT(*) FROM yj_doc_status WHERE panel_code='TRANSFER' AND doc_no=? AND shr IS NOT NULL", no) > 0;
            if (exist > 0 && audited) { System.out.println("  [跳过] " + no + " 已存在且已审核"); skip++; continue; }
            if (exist > 0 && !resync) { System.out.println("  [跳过] " + no + " 已存在(草稿;用 --resync 重存再审核)"); skip++; continue; }

            List<String> pr = new ArrayList<>();
            for (Map<String, Object> e : ents) {
                String mat = s(e.get("material_number")), oc = s(e.get("out_stock_number")), ic = s(e.get("in_stock_number"));
                if (mat == null || count("SELECT COUNT(*) FROM bs_inv WHERE 存货编码=?", mat) == 0) pr.add("存货不存在:" + mat);
                if (oc == null || count("SELECT COUNT(*) FROM bs_wh WHERE 仓库编码=?", oc) == 0) pr.add("调出仓不存在:" + oc);
                if (ic == null || count("SELECT COUNT(*) FROM bs_wh WHERE 仓库编码=?", ic) == 0) pr.add("调入仓不存在:" + ic);
            }
            if (!pr.isEmpty()) { System.out.println("  [拒绝] " + no + " " + pr); bad++; continue; }

            // 【口径 P3】调出仓该物料合计无货 ⇒ 只落单据不过账(硬过会做出负库存)
            List<String> noStock = new ArrayList<>();
            for (Map<String, Object> e : ents) {
                String mat = s(e.get("material_number")), oc = s(e.get("out_stock_number"));
                Double tot = sumStock(mat, oc);
                double need = Double.parseDouble(fmt(e.get("qty")));
                if (tot == null || tot < need) noStock.add(mat + "@" + oc + " 合计" + (tot == null ? 0 : tot) + " < 需" + need);
            }

            System.out.printf("  %s %s 分录%d: %s%s%n", no, date, ents.size(), ents.stream()
                    .map(e -> s(e.get("material_number")) + "/" + normLotLabel(s(e.get("batch_no")))
                            + " " + fmt(e.get("qty")) + " " + s(e.get("out_stock_number")) + "→" + s(e.get("in_stock_number")))
                    .reduce((x, y) -> x + " | " + y).orElse(""),
                    noStock.isEmpty() ? "" : "  [无货挂起] " + noStock);
            if (!apply) { ok++; continue; }

            if (!noStock.isEmpty()) {
                if (exist == 0) { saveOnly(d, ents, no); }
                markPending(no, "金蝶调拨单 " + no + " 补录:调出仓合计库存不足(" + String.join(";", noStock) + "),只落单据未过账");
                pending++;
                continue;
            }
            String res = push(d, ents, no);
            if (res == null) ok++; else { System.out.println("    -> 失败:" + res); bad++; }
        }
        System.out.printf("%n=== 结果:过账 %d / 挂起(只落单据) %d / 跳过 %d / 拒绝 %d ===%n", ok, pending, skip, bad);
        System.exit(bad > 0 ? 1 : 0);
    }

    static String normLotLabel(String batch) {
        if (batch == null || batch.isEmpty()) return "无批号";
        return "PC0000".equalsIgnoreCase(batch) ? "无批号" : batch;
    }

    /** 该 (物料,仓库) 合计可用量(所有批号之和) */
    static Double sumStock(String mat, String wh) throws Exception {
        try (PreparedStatement ps = db.prepareStatement("SELECT SUM(yl) FROM kucun WHERE wzdm=? AND ckdm=?")) {
            ps.setString(1, mat); ps.setString(2, wh);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? (Double) rs.getObject(1) : null; }
        }
    }

    /** 只保存不审核(无货挂起用) */
    static void saveOnly(Map<String, Object> d, List<Map<String, Object>> ents, String no) throws Exception {
        List<Object> items = buildItems(d, ents, no);
        Map<String, Object> fd = new LinkedHashMap<>();
        fd.put("编号", no);
        fd.put("单据日期", s(d.get("bill_date")));
        fd.put("业务类型", "调拨");
        fd.put("备注", nz(s(d.get("remark"))));
        fd.put("ERP单号", no);
        fd.put("detail", Map.of("items", items));
        String r = call("保存为草稿", fd);
        System.out.println("    -> 已落单据(草稿,未过账)" + (r == null ? "" : " 失败:" + r));
    }

    /** 在单据备注里写明挂起原因(便于用户识别) */
    static void markPending(String no, String note) throws Exception {
        try (PreparedStatement ps = db.prepareStatement("UPDATE bd_transfer SET 备注=? WHERE 单据编号=?")) {
            ps.setString(1, note); ps.setString(2, no); ps.executeUpdate();
        }
    }

    static List<Object> buildItems(Map<String, Object> d, List<Map<String, Object>> ents, String no) {
        List<Object> items = new ArrayList<>();
        int seq = 1;
        for (Map<String, Object> e : ents) {
            Map<String, Object> it = new LinkedHashMap<>();
            it.put("序号", seq++);
            it.put("存货编码", s(e.get("material_number")));
            it.put("存货名称", nz(s(e.get("material_name"))));
            it.put("规格型号", nz(s(e.get("material_model"))));
            it.put("计量单位", nz(s(e.get("unit_name"))));
            String batch = s(e.get("batch_no"));
            if (batch != null && !batch.isEmpty() && !"PC0000".equalsIgnoreCase(batch)) it.put("批号", batch);
            it.put("调出仓库", safeWhName(s(e.get("out_stock_number"))));
            it.put("调出仓库编码", s(e.get("out_stock_number")));
            it.put("调入仓库", safeWhName(s(e.get("in_stock_number"))));
            it.put("调入仓库编码", s(e.get("in_stock_number")));
            it.put("数量", Double.parseDouble(fmt(e.get("qty"))));
            it.put("明细备注", "金蝶调拨单 " + no + " 补录");
            items.add(it);
        }
        return items;
    }

    static String safeWhName(String code) {
        try { return whName(code); } catch (Exception e) { return code; }
    }

    static String push(Map<String, Object> d, List<Map<String, Object>> ents, String no) throws Exception {
        List<Object> items = buildItems(d, ents, no);
        Map<String, Object> fd = new LinkedHashMap<>();
        fd.put("编号", no);
        fd.put("单据日期", s(d.get("bill_date")));
        fd.put("业务类型", "调拨");
        fd.put("备注", nz(s(d.get("remark"))));
        fd.put("ERP单号", no);
        fd.put("detail", Map.of("items", items));
        String r1 = call("保存", fd);
        if (r1 != null) return "保存失败:" + r1;
        String r2 = call("审核", Map.of("编号", no));
        if (r2 != null) return "审核失败:" + r2;
        System.out.println("    -> 已保存并审核");
        return null;
    }

    static String call(String button, Map<String, Object> formData) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("panelCode", "TRANSFER");
        body.put("buttonName", button);
        body.put("formData", formData);
        body.put("buttonParam", Map.of());
        HttpRequest req = HttpRequest.newBuilder(URI.create(base + "/px/callButton"))
                .header("Content-Type", "application/json; charset=utf-8")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(json(body), StandardCharsets.UTF_8)).build();
        String out = HTTP.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)).body();
        var m = java.util.regex.Pattern.compile("\"code\"\\s*:\\s*(-?\\d+)").matcher(out);
        int code = m.find() ? Integer.parseInt(m.group(1)) : -1;
        if (code == 200) return null;
        var mm = java.util.regex.Pattern.compile("\"message\"\\s*:\\s*\"([^\"]*)\"").matcher(out);
        return mm.find() ? mm.group(1).replace("\\n", " ") : out;
    }

    static void login() throws Exception {
        String out = HTTP.send(HttpRequest.newBuilder(URI.create(base + "/auth/login"))
                .header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString("{\"userName\":\"admin\",\"password\":\"123456\"}", StandardCharsets.UTF_8)).build(),
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)).body();
        var m = java.util.regex.Pattern.compile("\"token\"\\s*:\\s*\"([^\"]+)\"").matcher(out);
        if (!m.find()) throw new IllegalStateException("登录失败:" + out);
        token = m.group(1);
        System.out.println("登录成功(admin)");
    }

    static String whName(String code) throws Exception {
        try (PreparedStatement ps = db.prepareStatement("SELECT TOP 1 仓库名称 FROM bs_wh WHERE 仓库编码=?")) {
            ps.setString(1, code);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getString(1) : code; }
        }
    }
    static int count(String sql, String arg) throws Exception {
        try (PreparedStatement ps = db.prepareStatement(sql)) {
            ps.setString(1, arg);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getInt(1) : 0; }
        }
    }
    static String fmt(Object o) {
        if (o == null) return "0";
        double v = Double.parseDouble(String.valueOf(o));
        if (v == Math.rint(v)) return String.valueOf((long) v);
        return java.math.BigDecimal.valueOf(v).stripTrailingZeros().toPlainString();
    }
    static String s(Object o) { return o == null ? null : String.valueOf(o).trim(); }
    static String nz(String o) { return o == null ? "" : o; }

    @SuppressWarnings("unchecked")
    static String json(Object o) {
        if (o == null) return "null";
        if (o instanceof String s) return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "") + "\"";
        if (o instanceof Number || o instanceof Boolean) return String.valueOf(o);
        if (o instanceof Map<?, ?> m) {
            StringBuilder sb = new StringBuilder("{");
            boolean f = true;
            for (Map.Entry<?, ?> e : m.entrySet()) { if (!f) sb.append(','); f = false; sb.append(json(String.valueOf(e.getKey()))).append(':').append(json(e.getValue())); }
            return sb.append('}').toString();
        }
        if (o instanceof List<?> l) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < l.size(); i++) { if (i > 0) sb.append(','); sb.append(json(l.get(i))); }
            return sb.append(']').toString();
        }
        return json(String.valueOf(o));
    }
}
