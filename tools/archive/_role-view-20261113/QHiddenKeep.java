// QHiddenKeep.java —— 验证「隐藏字段不会被空串清空」(用户 2026-11-13 红线)
//
// 做法(测试库,验完复原):
//   1) 找一张草稿采购订单,给第一行的隐藏列「折扣单价」写哨兵值;
//   2) 用**界面会发的那种载荷**提交保存(该行带 折扣单价=''),其余行带原值;
//   3) 读回:哨兵还在 = 修复生效(旧行为会被写成 NULL)。
//
// 用法: java -cp lib\mssql-jdbc.jar archive\_role-view-20261113\QHiddenKeep.java <DB> [baseUrl]
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

public class QHiddenKeep {
    static String base = "http://127.0.0.1:8090";

    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES_TEST";
        if (a.length > 1) base = a[1];
        StringBuilder sb = new StringBuilder("# " + db + " @ " + base + "\n");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false";

        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            // 1) 找草稿 + 明细
            String docNo = null;
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT TOP 1 h.单据编号 FROM bd_pu_order h "
                         + "WHERE h.单据状态 = N'草稿' AND ISNULL(h.asp_cancel,'N')<>'Y' "
                         + "AND EXISTS (SELECT 1 FROM bl_pu_order l WHERE l.单据编号 = h.单据编号 AND ISNULL(l.asp_cancel,'N')<>'Y') "
                         + "ORDER BY h.id DESC")) {
                if (r.next()) docNo = r.getString(1);
            }
            if (docNo == null) { System.out.println("(测试库没有可用草稿,跳过)"); return; }
            sb.append("草稿单号 = ").append(docNo).append("\n");

            List<Object[]> rows = new ArrayList<>();   // [id, 折扣单价]
            try (PreparedStatement ps = c.prepareStatement("SELECT id, 折扣单价 FROM bl_pu_order "
                    + "WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id")) {
                ps.setString(1, docNo);
                try (ResultSet r = ps.executeQuery()) {
                    while (r.next()) rows.add(new Object[]{r.getObject(1), r.getString(2)});
                }
            }
            sb.append("明细行数 = ").append(rows.size()).append("\n");
            Object firstId = rows.get(0)[0];

            // 2) 哨兵
            String sentinel = "SENTINEL-KEEP-" + System.currentTimeMillis();
            try (PreparedStatement ps = c.prepareStatement("UPDATE bl_pu_order SET 折扣单价 = ? WHERE id = ?")) {
                ps.setString(1, sentinel);
                ps.setObject(2, firstId);
                ps.executeUpdate();
            }

            // 3) 造载荷:第一行带空串(界面口径),其余行带原值
            StringBuilder items = new StringBuilder("[");
            for (int i = 0; i < rows.size(); i++) {
                Object id = rows.get(i)[0];
                String v = Objects.equals(id, firstId) ? "" : (rows.get(i)[1] == null ? "" : String.valueOf(rows.get(i)[1]).replace("\"", "\\\""));
                if (i > 0) items.append(",");
                items.append("{\"id\":\"").append(id).append("\",\"折扣单价\":\"").append(v).append("\"}");
            }
            items.append("]");
            String body = "{\"panelCode\":\"PU_ORDER\",\"buttonName\":\"保存为草稿\",\"buttonParam\":{},"
                    + "\"formData\":{\"编号\":\"" + docNo + "\",\"单据编号\":\"" + docNo + "\","
                    + "\"detail\":{\"items\":" + items + "}}}";

            String token = login();
            String resp = post("/api/px/callButton", body, token);
            sb.append("保存响应 = ").append(resp.length() > 300 ? resp.substring(0, 300) : resp).append("\n");

            // 4) 读回
            String after = null;
            try (PreparedStatement ps = c.prepareStatement("SELECT 折扣单价 FROM bl_pu_order WHERE id = ?")) {
                ps.setObject(1, firstId);
                try (ResultSet r = ps.executeQuery()) { if (r.next()) after = r.getString(1); }
            }
            boolean kept = sentinel.equals(after);
            sb.append("哨兵保留 = ").append(kept ? "是(隐藏字段未被空串清空)" : "否(被清成了 " + after + ")").append("\n");
            sb.append(kept ? "RESULT: PASS" : "RESULT: FAIL").append("\n");

            // 5) 复原:把哨兵还原成原来的值
            try (PreparedStatement ps = c.prepareStatement("UPDATE bl_pu_order SET 折扣单价 = ? WHERE id = ?")) {
                ps.setString(1, rows.get(0)[1] == null ? null : String.valueOf(rows.get(0)[1]));
                ps.setObject(2, firstId);
                ps.executeUpdate();
            }
            sb.append("(已把该行 折扣单价 复原)\n");
        }
        Files.writeString(Paths.get("archive/_role-view-20261113/_q-hidden-keep-out.txt"), sb.toString());
        System.out.println(sb);
    }

    static String login() throws Exception {
        String body = "{\"userName\":\"admin\",\"password\":\"123456\",\"factory\":\"YJ_TEST\"}";
        String resp = post("/api/auth/login", body, null);
        int i = resp.indexOf("\"token\":\"");
        if (i < 0) throw new IllegalStateException("登录失败: " + resp);
        int j = resp.indexOf('"', i + 9);
        return resp.substring(i + 9, j);
    }

    static String post(String path, String body, String token) throws IOException, InterruptedException {
        HttpClient http = HttpClient.newHttpClient();
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(base + path))
                .header("Content-Type", "application/json;charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(body));
        if (token != null) b.header("Authorization", "Bearer " + token);
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString()).body();
    }
}
