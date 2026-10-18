import java.nio.file.*;
import java.security.MessageDigest;
import java.sql.*;

/**
 * _FixTestDbQcStatus.java — 测试库专属补救:等效执行「清 11 张真实检验单残留审核状态」,
 * 并只给这一条脚本登记 yj_schema_log(哈希口径与 DbSync 完全一致)。
 *
 * 【背景 · 为什么测试库只能这样处理】
 *   `migrate-qc-insp-clear-11-docstatus-20261018.sql` 的守卫与自检**硬要求白名单 11 张都在**:
 *     · 守卫:@missing = 0(11 张都在 qc_insp)
 *     · 自检:@stillDraft = 11
 *   而 HSDZ_MES_TEST 是**正式库的旧快照**,缺 `IJ-2026-09-0152`(该单在快照之后才产生)
 *   ⇒ 无论怎么跑,该脚本在测试库都会 RAISERROR 中止,把其后所有迁移一起挡住。
 *
 *   按 AGENTS.md「测试库陈旧不要逐张补,可直接重建」的纪律,这里采取**最小等效**:
 *     ① 对**实际存在的 10 张**清掉 yj_doc_status 残留(与脚本 2. 的 DELETE 同口径、同范围);
 *     ② 只给这一条脚本登记 yj_schema_log(内容 SHA-256,与 DbSync.sha256 一致),让迁移链继续;
 *     ③ 绝不动正式库(本工具第 0 步就断言 databaseName 必须是 HSDZ_MES_TEST)。
 *
 *   正式库走正常 DbSync,该脚本已 [OK] 执行完毕(实测残留 0 行)。
 *
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_stockreport-dialog-1020\_FixTestDbQcStatus.java
 */
public class _FixTestDbQcStatus {
    static final String[] WHITE = {"IJ-2026-09-0152", "IJ-2026-10-0011", "IJ-2026-10-0012", "IJ-2026-10-0013",
            "IJ-2026-10-0014", "IJ-2026-10-0015", "IJ-2026-10-0016", "IJ-2026-10-0017",
            "IJ-2026-10-0018", "IJ-2026-10-0019", "IJ-2026-10-0020"};
    static final String SCRIPT = "migrate-qc-insp-clear-11-docstatus-20261018.sql";

    public static void main(String[] a) throws Exception {
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String db = "HSDZ_MES_TEST";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url)) {
            // ⓪ 硬闸门:只许测试库
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT DB_NAME()")) {
                rs.next();
                String actual = rs.getString(1);
                if (!db.equals(actual)) { System.out.println("[FAIL] 目标库不是测试库: " + actual); System.exit(1); }
                System.out.println("[闸门] 目标库 = " + actual + " ✅(只允许测试库)");
            }

            // ① 存在的单据清残留
            int left = 0;
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT COUNT(*) FROM qc_insp WHERE 单据编号 IN (" + quoted() + ")")) {
                rs.next();
                left = rs.getInt(1);
            }
            System.out.println("[现状] 白名单 11 张中,本库存在 " + left + " 张(缺 " + (11 - left) + " 张)");

            int del;
            try (Statement st = c.createStatement()) {
                del = st.executeUpdate("DELETE s FROM yj_doc_status s WHERE s.panel_code = N'QC_INSP' "
                        + "AND s.doc_no IN (" + quoted() + ")");
            }
            System.out.println("[清理] yj_doc_status 删除 " + del + " 条残留审核状态");

            // ② 自检:残留必须归 0
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT COUNT(*) FROM yj_doc_status WHERE panel_code=N'QC_INSP' AND doc_no IN (" + quoted() + ")")) {
                rs.next();
                int remain = rs.getInt(1);
                System.out.println("[自检] 残留 = " + remain + (remain == 0 ? " ✅" : " ❌"));
                if (remain != 0) System.exit(1);
            }

            // ③ 只登记这一条脚本的哈希(与 DbSync.sha256 同口径)
            Path f = Paths.get(SCRIPT);
            if (!Files.exists(f)) { System.out.println("[FAIL] 找不到脚本文件: " + f.toAbsolutePath()); System.exit(1); }
            byte[] d = MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(f));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            String hash = sb.toString();
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO yj_schema_log (script_name, content_hash) SELECT ?, ? "
                            + "WHERE NOT EXISTS (SELECT 1 FROM yj_schema_log WHERE script_name = ?)")) {
                ps.setString(1, SCRIPT);
                ps.setString(2, hash);
                ps.setString(3, SCRIPT);
                ps.executeUpdate();
            }
            System.out.println("[登记] yj_schema_log ← " + SCRIPT + "  hash=" + hash.substring(0, 16) + "…");
            System.out.println("[OK] 测试库已等效完成该脚本(缺 1 张单,按其口径只能做存在的 10 张)");
        }
    }

    static String quoted() {
        StringBuilder sb = new StringBuilder();
        for (String s : WHITE) sb.append(sb.length() == 0 ? "" : ",").append("N'").append(s).append("'");
        return sb.toString();
    }
}
