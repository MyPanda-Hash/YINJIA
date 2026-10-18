import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 2026-10-18:给「调拨单 / 盘点单」建**一张真实的演示单并保留**(用户口径「测试一下调拨单和盘点单,
 * 数据保留(正式库也一样保留一条)」)。
 *
 * <p>与 {@code TransferStocktakeE2E.java} 的分工:那个是**可重复跑、跑完自清理**的回归探针;
 * 这个是**只跑一次、结果留下**的演示数据播种 —— 两个账套各留一张已审核的调拨单 + 一张已审核的盘点单。
 *
 * <p>用法(tools 目录下):
 * <pre>
 *   java -cp "lib/mssql-jdbc.jar" archive/_transfer-stocktake-e2e/SeedDemoDocs.java
 *     默认 = 正式账套(YJ / HSDZ_MES);给第二参 YJ_TEST + HSDZ_MES_TEST 就是测试账套
 * </pre>
 * 参数:java ... SeedDemoDocs.java [factory] [dbName] [apiBase]
 */
public class SeedDemoDocs {

    static String factory = "YJ", dbName = "HSDZ_MES", base = "http://127.0.0.1:8090/api";
    static final HttpClient HTTP = HttpClient.newHttpClient();
    static String token;
    static Connection db;

    public static void main(String[] a) throws Exception {
        if (a.length > 0) factory = a[0];
        if (a.length > 1) dbName = a[1];
        if (a.length > 2) base = a[2].replaceAll("/+$", "") + "/api";
        String dbPass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        db = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + dbName + ";encrypt=false", "yinjia", dbPass);
        System.out.println("=== 播种演示单 @ " + factory + " / " + dbName + " ===");

        login();

        // ── 挑一行有货的库存(物料,仓库,批号),调出到一个**有真实仓位档案**的仓库 ──
        Map<String, Object> src = one(
                "SELECT TOP 1 k.wzdm, k.ckdm, k.lot_no, k.yl, k.price, i.[存货名称], i.[规格型号], i.[计量单位]"
                        + " FROM kucun k OUTER APPLY (SELECT TOP 1 x.[存货名称], x.[规格型号], x.[计量单位] FROM bs_inv x WHERE x.[存货编码]=k.wzdm ORDER BY x.id) i"
                        + " WHERE ISNULL(k.asp_cancel,'N') <> 'Y' AND k.yl >= 50 AND k.lot_no IS NOT NULL AND k.lot_no <> ''"
                        + "   AND k.ckdm IN (SELECT [仓库编码] FROM bs_wh WHERE ISNULL([状态],N'启用')=N'启用')"
                        + " ORDER BY k.yl DESC");
        if (src == null) throw new IllegalStateException("没有可用库存(yl>=50 且有批号),无法播种");
        String item = str(src.get("wzdm")), lot = str(src.get("lot_no")), srcWh = str(src.get("ckdm"));
        String srcWhName = str(one("SELECT TOP 1 [仓库名称] FROM bs_wh WHERE [仓库编码]=?", srcWh).get("仓库名称"));
        // 调入仓:必须是**已有真实仓位档案**的仓,这样演示单能带出真实库位(2026-10-18 第三批口径)
        Map<String, Object> dst = one(
                "SELECT TOP 1 w.[仓库编码] AS c, w.[仓库名称] AS n FROM bs_wh w"
                        + " WHERE w.[仓库编码] <> ? AND ISNULL(w.[状态],N'启用')=N'启用'"
                        + "   AND EXISTS (SELECT 1 FROM bs_wh_loc l WHERE l.[仓库]=w.[仓库名称] AND ISNULL(l.[停用],0)=0 AND ISNULL(l.[asp_cancel],'N')<>'Y')"
                        + " ORDER BY (SELECT COUNT(*) FROM bs_wh_loc l WHERE l.[仓库]=w.[仓库名称]) DESC", srcWh);
        if (dst == null) throw new IllegalStateException("没有带仓位档案的仓库,无法演示库位");
        String dstWh = str(dst.get("c")), dstWhName = str(dst.get("n"));
        String bin = str(one("SELECT TOP 1 [仓位编码] AS b FROM bs_wh_loc WHERE [仓库]=? AND ISNULL([停用],0)=0 AND ISNULL([asp_cancel],'N')<>'Y' ORDER BY [仓位编码]",
                dstWhName).get("b"));
        double before = dbl(one("SELECT ISNULL(yl,0) AS y FROM kucun WHERE wzdm=? AND ckdm=? AND lot_no=?", item, srcWh, lot).get("y"));
        System.out.printf("素材:%s / 批号 %s / %s(%.1f)→ %s · 仓位 %s%n", item, lot, srcWhName, before, dstWhName, bin);

        // ── ① 调拨单:20 个单位移库到目标仓的真实仓位,审核 ──
        Map<String, Object> line = new LinkedHashMap<>();
        line.put("序号", 1);
        line.put("存货编码", item);
        line.put("存货名称", str(src.get("存货名称")));
        line.put("规格型号", str(src.get("规格型号")));
        line.put("计量单位", str(src.get("计量单位")));
        line.put("批号", lot);
        line.put("调出仓库", srcWhName);
        line.put("调出仓库编码", srcWh);
        line.put("调入仓库", dstWhName);
        line.put("调入仓库编码", dstWh);
        line.put("调入仓位", bin);
        line.put("数量", 20);
        line.put("单价", src.get("price"));
        line.put("金额", 0);
        line.put("明细备注", "仓库间移库(演示单)");
        String transferNo = createDoc("TRANSFER", Map.of(
                "单据日期", java.time.LocalDate.now().toString(),
                "业务类型", "调拨",
                "调拨原因", "车间领用备料,由原料仓移至车间周转仓(演示数据)",
                "备注", "演示单:调拨单审核即双腿过账 kucun(调出仓-20 / 调入仓+20),公司总库存不变"), line);
        audit("TRANSFER", transferNo);
        double srcAfter = dbl(one("SELECT ISNULL(yl,0) AS y FROM kucun WHERE wzdm=? AND ckdm=? AND lot_no=?", item, srcWh, lot).get("y"));
        double dstAfter = dbl(one("SELECT ISNULL(yl,0) AS y FROM kucun WHERE wzdm=? AND ckdm=? AND lot_no=?", item, dstWh, lot).get("y"));
        System.out.printf("  调拨单 %s 已审核:调出仓 %.1f → %.1f,调入仓 → %.1f%n", transferNo, before, srcAfter, dstAfter);

        // ── ② 盘点单:对刚调入的仓做一次单行抽盘,实盘 = 账面 − 2(盘亏),仓位带真实库位 ──
        double bookBefore = dstAfter;
        double actual = bookBefore - 2;
        Map<String, Object> sline = new LinkedHashMap<>();
        sline.put("序号", 1);
        sline.put("存货编码", item);
        sline.put("存货名称", str(src.get("存货名称")));
        sline.put("规格型号", str(src.get("规格型号")));
        sline.put("计量单位", str(src.get("计量单位")));
        sline.put("批号", lot);
        sline.put("仓库", dstWhName);
        sline.put("仓库编码", dstWh);
        sline.put("仓位", bin);
        sline.put("实盘数量", actual);
        sline.put("明细备注", "月末抽盘(演示单)");
        String takeNo = createDoc("STOCKTAKE", Map.of(
                "单据日期", java.time.LocalDate.now().toString(),
                "业务类型", "盘点",
                "盘点类型", "抽盘",
                "盘点人", "admin",
                "备注", "演示单:盘点单审核按实盘差异调平 kucun(盘盈则入库、盘亏则出库)"), sline);
        audit("STOCKTAKE", takeNo);
        double takeAfter = dbl(one("SELECT ISNULL(yl,0) AS y FROM kucun WHERE wzdm=? AND ckdm=? AND lot_no=?", item, dstWh, lot).get("y"));
        System.out.printf("  盘点单 %s 已审核:账面 %.1f → 现存量 %.1f(实盘 %.1f)%n", takeNo, bookBefore, takeAfter, actual);
        System.out.println("  结论:" + (Math.abs(takeAfter - actual) < 0.0001 ? "盘点后库存 == 实盘数量 ✔" : "盘点后库存 != 实盘 ✘"));
        System.out.println("\n保留单据:调拨单 " + transferNo + " / 盘点单 " + takeNo);
    }

    static String createDoc(String panel, Map<String, Object> head, Map<String, Object> line) throws Exception {
        Map<String, Object> fd = new LinkedHashMap<>(head);
        fd.put("detail", Map.of("items", List.of(line)));
        post("/px/callButton", Map.of("panelCode", panel, "buttonName", "保存", "formData", fd, "buttonParam", Map.of()));
        String table = "TRANSFER".equals(panel) ? "bd_transfer" : "bd_stocktake";
        Map<String, Object> last = one("SELECT TOP 1 [单据编号] AS no FROM " + table + " ORDER BY id DESC");
        return str(last.get("no"));
    }

    static void audit(String panel, String no) throws Exception {
        post("/px/callButton", Map.of("panelCode", panel, "buttonName", "审核",
                "formData", Map.of("编号", no), "buttonParam", Map.of()));
    }

    static void login() throws Exception {
        String raw = postRaw("/auth/login", Map.of("userName", "admin", "password", "123456", "factory", factory));
        var m = java.util.regex.Pattern.compile("\"token\"\\s*:\\s*\"([^\"]+)\"").matcher(raw);
        if (!m.find()) throw new IllegalStateException("登录失败:" + raw);
        token = m.group(1);
        System.out.println("登录成功(admin / " + factory + ")");
    }

    static String post(String path, Map<String, Object> body) throws Exception {
        String raw = postRaw(path, body);
        var c = java.util.regex.Pattern.compile("\"code\"\\s*:\\s*(-?\\d+)").matcher(raw);
        int code = c.find() ? Integer.parseInt(c.group(1)) : -1;
        if (code != 200) {
            var m = java.util.regex.Pattern.compile("\"message\"\\s*:\\s*\"([^\"]*)\"").matcher(raw);
            throw new IllegalStateException(m.find() ? m.group(1) : raw);
        }
        return raw;
    }

    static String postRaw(String path, Map<String, Object> body) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(base + path))
                .header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(json(body), StandardCharsets.UTF_8));
        if (token != null) b.header("Authorization", "Bearer " + token);
        HttpResponse<String> r = HTTP.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        return r.body();
    }

    static Map<String, Object> one(String sql, Object... args) throws Exception {
        try (PreparedStatement ps = db.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                Map<String, Object> m = new LinkedHashMap<>();
                for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) m.put(rs.getMetaData().getColumnLabel(i), rs.getObject(i));
                return m;
            }
        }
    }

    static String str(Object o) { return o == null ? null : String.valueOf(o).trim(); }
    static double dbl(Object o) { return o == null ? 0 : Double.parseDouble(String.valueOf(o)); }

    @SuppressWarnings("unchecked")
    static String json(Object o) {
        if (o == null) return "null";
        if (o instanceof String s) return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "") + "\"";
        if (o instanceof Number || o instanceof Boolean) return String.valueOf(o);
        if (o instanceof Map<?, ?> m) {
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<?, ?> e : m.entrySet()) {
                if (!first) sb.append(',');
                first = false;
                sb.append(json(String.valueOf(e.getKey()))).append(':').append(json(e.getValue()));
            }
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
