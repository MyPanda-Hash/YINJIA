/*
 * _ProbeQcItemPlan.java — 检验项目/检验方案落地核对 + 「方案→检验项」取数复核(2026-10-09,一次性)
 *
 * 用途:不启服务,直接在实库上核对 migrate-qc-item-plan.sql 的效果,并**逐字复现**
 *       ButtonService.matchInspPlan / planItems 两段 SQL,证明:
 *         ① 列/字段/译名/播种/表区回填 全部落地;
 *         ② 按产品匹配方案命中正确(CAS-18 → QP-CAS18 → 2 条目数项目);
 *         ③ 未建档产品不命中(⇒ 建单侧维持现状两行,存量零影响);
 *         ④ **刻意不按类别匹配** 的效果(同类别其它商品不误套 YJ-Q-125)。
 *
 * 用法(在 tools 目录下):
 *   java -cp lib\mssql-jdbc.jar archive\_ProbeQcItemPlan.java            # 输出到 _ProbeQcItemPlan.out.txt
 *   YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar archive\_ProbeQcItemPlan.java
 *
 * 只读:全部 SELECT。
 */
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.sql.*;

public class _ProbeQcItemPlan {

    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    static PrintStream out;
    static int bad = 0;

    public static void main(String[] args) throws Exception {
        String outPath = args.length > 0 ? args[0] : "archive/_ProbeQcItemPlan.out.txt";
        out = new PrintStream(new FileOutputStream(outPath), true, "UTF-8");
        out.println("== 库: " + DB + " ==");

        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            section1Columns(c);
            section2Fields(c);
            section3Translations(c);
            section4Seed(c);
            section5TableArea(c);
            section6Match(c);
        }
        out.println(bad == 0 ? "\n[PASS] 检验项目/检验方案 落地与取数全部符合预期" : "\n[FAIL] " + bad + " 项不符");
        out.close();
        if (bad != 0) System.exit(1);
    }

    static void ok(String name, boolean cond) { ok(name, cond, ""); }

    static void ok(String name, boolean cond, String extra) {
        out.println((cond ? "  ✅ " : "  ❌ ") + name + (extra == null || extra.isEmpty() ? "" : " — " + extra));
        if (!cond) bad++;
    }

    /* ① 列 */
    static void section1Columns(Connection c) throws SQLException {
        out.println("\n=== ① 补列 ===");
        int a = cols(c, "bs_qc_plan", "取样规则", "文件编码", "执行标准");
        ok("bs_qc_plan +3(取样规则/文件编码/执行标准)", a == 3, a + "/3");
        int b = cols(c, "bs_qc_item", "方案编码", "序号", "取样要求", "检验方法", "合格处置", "不合格处置");
        ok("bs_qc_item +6(方案编码/序号/取样要求/检验方法/合格处置/不合格处置)", b == 6, b + "/6");
        for (String t : new String[]{"qc_mold_insp", "qc_cut_insp", "qc_asm_insp"}) {
            int h = cols(c, t + "_head", "检验方案", "文件编码", "执行标准");
            int d = cols(c, t + "_detail", "表区", "检验方法");
            ok(t + ":头 +3 / 行 +2", h == 3 && d == 2, "头 " + h + "/3,行 " + d + "/2");
        }
    }

    static int cols(Connection c, String table, String... names) throws SQLException {
        int n = 0;
        for (String name : names) {
            try (PreparedStatement ps = c.prepareStatement("SELECT COL_LENGTH(N'dbo." + table + "', ?) AS L")) {
                ps.setString(1, name);
                try (ResultSet r = ps.executeQuery()) { if (r.next() && r.getObject(1) != null) n++; }
            }
        }
        return n;
    }

    /* ② yj_field 登记 */
    static void section2Fields(Connection c) throws SQLException {
        out.println("\n=== ② 面板字段登记 ===");
        ok("QC_ITEM +6 字段", count(c, "SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_ITEM' AND col_name IN (N'方案编码',N'序号',N'取样要求',N'检验方法',N'合格处置',N'不合格处置')").equals(6));
        ok("QC_PLAN +3 字段", count(c, "SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_PLAN' AND col_name IN (N'取样规则',N'文件编码',N'执行标准')").equals(3));
        ok("三类检验单 各 +5 字段(表头 3 + 明细 2)",
                count(c, "SELECT COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP',N'QC_CUT_INSP',N'QC_ASM_INSP') AND col_name IN (N'检验方案',N'文件编码',N'执行标准',N'表区',N'检验方法')").equals(15));
        rs(c, "SELECT panel_code, col_name, place, seq FROM yj_field WHERE col_name=N'检验方案' AND panel_code LIKE 'QC[_]%INSP' ORDER BY panel_code", "  检验方案字段");
    }

    /* ③ 译名 */
    static void section3Translations(Connection c) throws SQLException {
        out.println("\n=== ③ en 译名 ===");
        int n = count(c, "SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND locale='en' AND ref_key IN "
                + "(N'方案编码',N'序号',N'取样规则',N'取样要求',N'检验方法',N'合格处置',N'不合格处置',N'检验方案',N'文件编码',N'执行标准',N'表区')");
        ok("11 条 en 词条齐", n == 11, n + "/11");
    }

    /* ④ 播种 */
    static void section4Seed(Connection c) throws SQLException {
        out.println("\n=== ④ 播种(YJ-Q-125 真数据)===");
        rs(c, "SELECT 方案编码, 方案名称, 适用存货, ISNULL(适用存货类别,N'') AS 类别, 检验方式, ISNULL(文件编码,N'') AS 文件, ISNULL(取样规则,N'') AS 取样规则 FROM bs_qc_plan WHERE 方案编码 IN (N'QP-CAS18',N'QP-YCAS23') ORDER BY 方案编码", "  方案");
        rs(c, "SELECT 方案编码, 序号, 项目编码, 项目名称, 检验标准, 判定规则, ISNULL(CAST(标准上限 AS nvarchar(20)),N'') AS 上限, ISNULL(检验方法,N'') AS 方法 FROM bs_qc_item WHERE 方案编码=N'QP-CAS18' ORDER BY 序号", "  成品项目");
        ok("成品 CAS-18 项目 2 条", count(c, "SELECT COUNT(*) FROM bs_qc_item WHERE 方案编码=N'QP-CAS18'").equals(2));
        ok("原料 Y-CAS-23 项目 12 条(性能 1 + 卫生安全 11)", count(c, "SELECT COUNT(*) FROM bs_qc_item WHERE 方案编码=N'QP-YCAS23'").equals(12));
    }

    /* ⑤ 表区回填 */
    static void section5TableArea(Connection c) throws SQLException {
        out.println("\n=== ⑤ 存量明细「表区」回填 ===");
        rs(c, "SELECT N'qc_asm_insp_detail' AS t, ISNULL(表区,N'(NULL)') AS 表区, COUNT(*) AS n FROM qc_asm_insp_detail GROUP BY 表区"
                + " UNION ALL SELECT N'qc_mold_insp_detail', ISNULL(表区,N'(NULL)'), COUNT(*) FROM qc_mold_insp_detail GROUP BY 表区"
                + " UNION ALL SELECT N'qc_cut_insp_detail', ISNULL(表区,N'(NULL)'), COUNT(*) FROM qc_cut_insp_detail GROUP BY 表区", "  分布");
        ok("无残留 NULL 表区",
                count(c, "SELECT (SELECT COUNT(*) FROM qc_asm_insp_detail WHERE 表区 IS NULL)+(SELECT COUNT(*) FROM qc_mold_insp_detail WHERE 表区 IS NULL)+(SELECT COUNT(*) FROM qc_cut_insp_detail WHERE 表区 IS NULL)").equals(0));
    }

    /* ⑥ 取数复核:逐字复现 ButtonService.matchInspPlan / planItems */
    static void section6Match(Connection c) throws SQLException {
        out.println("\n=== ⑥ 「方案→检验项」取数复核(与后端同 SQL)===");
        checkProduct(c, "CAS-18", "Y料", true);
        checkProduct(c, "C-75-01", "X烧结炭棒/滤芯（45#）", false);
        String cat = one(c, "SELECT ISNULL(所属类别,N'') FROM bs_inv WHERE 存货编码=N'BHP-12'");
        out.println("  · 对照:同类别(" + cat + ")另一商品 BHP-12 —— 若按类别匹配就会被误套 YJ-Q-125 的目数标准");
        checkProduct(c, "BHP-12", "BHP-12", false);
    }

    static void checkProduct(Connection c, String code, String name, boolean expectHit) throws SQLException {
        String planNo = null;
        String sql = "SELECT TOP 1 方案编码 FROM dbo.bs_qc_plan p"
                + " WHERE ISNULL(p.停用,0)=0 AND ISNULL(p.asp_cancel,'N')<>'Y'"
                + "   AND ISNULL(p.适用存货,N'')<>N''"
                + "   AND (p.适用存货 = ? OR p.适用存货 = ? OR p.适用存货 ="
                + "        ISNULL((SELECT TOP 1 存货名称 FROM dbo.bs_inv"
                + "                 WHERE 存货编码=? AND ISNULL(asp_cancel,'N')<>'Y'),N''))"
                + " ORDER BY p.id";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, code); ps.setString(2, name); ps.setString(3, code);
            try (ResultSet r = ps.executeQuery()) { if (r.next()) planNo = r.getString(1); }
        } catch (SQLException e) { out.println("  ❌ " + code + " 取方案报错: " + e.getMessage()); bad++; return; }
        ok("产品 " + code + "(" + name + ") → " + (expectHit ? "应命中方案" : "应不命中"), expectHit == (planNo != null),
                planNo == null ? "无方案(⇒建单维持通用模板)" : planNo);
        if (planNo != null) {
            rs(c, "SELECT 序号, 项目名称, 检验标准 FROM bs_qc_item WHERE 方案编码=N'" + planNo + "' AND ISNULL(停用,0)=0 ORDER BY ISNULL(序号,9999), id",
                    "    → 将带入的检验项");
        }
    }

    /* ---------- 小工具 ---------- */
    static Integer count(Connection c, String sql) throws SQLException {
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) { return r.next() ? r.getInt(1) : 0; }
    }

    static String one(Connection c, String sql) throws SQLException {
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) { return r.next() ? r.getString(1) : null; }
    }

    static void rs(Connection c, String sql, String label) throws SQLException {
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
            ResultSetMetaData md = r.getMetaData();
            out.println(label + ":");
            int n = 0;
            while (r.next()) {
                StringBuilder sb = new StringBuilder("      ");
                for (int i = 1; i <= md.getColumnCount(); i++) {
                    sb.append(md.getColumnLabel(i)).append('=').append(r.getString(i));
                    if (i < md.getColumnCount()) sb.append(" | ");
                }
                out.println(sb);
                n++;
            }
            if (n == 0) out.println("      (空)");
        }
    }
}
