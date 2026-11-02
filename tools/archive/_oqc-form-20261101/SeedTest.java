import java.sql.*;
import java.util.*;

/**
 * SeedTest.java —— 给**测试账套** HSDZ_MES_TEST 铺一间「出厂检验报告」E2E 演示数据(2026-11-01)。
 * 只写 HSDZ_MES_TEST,不碰正式库;ids 由 identity 生成。
 * 用法: java -cp tools/lib/mssql-jdbc.jar SeedTest.java [apply|cleanup|check]
 */
public class SeedTest {
    static final String PROD = "HSDZ_MES";
    static final String TEST = "HSDZ_MES_TEST";
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + PROD + ";encrypt=false;loginTimeout=10";
    static final String SALE_NO = "XSCK-2026-11-99001";
    static final String ASM_NO = "ZJ-2026-10-0135";
    static final String FIRST_NO = "SJ-2026-10-0160";
    static final String PROC_NO = "ZC-2026-10-0126";
    static final String[] PLAN_NOS = {"IP-2026-10-0007", "IP-2026-10-0008", "IP-2026-10-0009", "IP-2026-10-0011"};

    public static void main(String[] a) throws Exception {
        String mode = a.length > 0 ? a[0] : "apply";
        try (Connection c = DriverManager.getConnection(URL, "yinjia", "Yinjia@2026")) {
            switch (mode) {
                case "apply" -> { cleanup(c); apply(c); check(c); }
                case "cleanup" -> { cleanup(c); check(c); }
                case "check" -> check(c);
                default -> System.out.println("mode: apply | cleanup | check");
            }
        }
    }

    // ---------------- 复制正式库行 → 测试库 ----------------
    static void copy(Connection c, String table, String where) throws SQLException {
        List<String> cols = insertableCols(c, table);
        String colList = String.join(", ", cols);
        exec(c, "DELETE FROM " + TEST + ".dbo.[" + table + "] WHERE " + where);
        String sql = "INSERT INTO " + TEST + ".dbo.[" + table + "] (" + colList + ") SELECT " + colList
                + " FROM " + PROD + ".dbo.[" + table + "] WHERE " + where;
        int n = exec(c, sql);
        System.out.println("[copy] " + table + " <- " + n + " 行  (" + where + ")");
    }

    /** 该表可插入列 = 两库共有 ∩ 非 identity ∩ 非 computed(用正式库元数据判 identity/computed) */
    static List<String> insertableCols(Connection c, String table) throws SQLException {
        Set<String> test = new LinkedHashSet<>(columnNames(c, TEST, table));
        Set<String> prod = new LinkedHashSet<>(columnNames(c, PROD, table));
        List<String> out = new ArrayList<>();
        for (String col : prod) {
            if (test.contains(col) && !isIdentityOrComputed(c, table, col)) out.add("[" + col + "]");
        }
        return out;
    }

    static List<String> columnNames(Connection c, String db, String table) throws SQLException {
        List<String> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement("SELECT COLUMN_NAME FROM " + db
                + ".INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(rs.getString(1)); }
        }
        return out;
    }

    static boolean isIdentityOrComputed(Connection c, String table, String col) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT is_identity, is_computed FROM " + PROD + ".sys.columns WHERE object_id = OBJECT_ID(?) AND name = ?")) {
            ps.setString(1, PROD + ".dbo.[" + table + "]");
            ps.setString(2, col);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getBoolean(1) || rs.getBoolean(2);
            }
        }
        return false;
    }

    // ---------------- 铺数 ----------------
    static void apply(Connection c) throws SQLException {
        System.out.println("== ① 出货检验计划(2 个产品 4 张计划) → 测试库");
        copy(c, "rd_insp_plan_head", "单据编号 IN (" + sqlIn(PLAN_NOS) + ")");
        copy(c, "rd_insp_plan_detail", "单据编号 IN (" + sqlIn(PLAN_NOS) + ")");

        System.out.println("== ② 三张检验单(B-92-25 的工单 GD-2026-10-0221/1)");
        copy(c, "qc_asm_insp_head", "单据编号 = N'" + ASM_NO + "'");
        copy(c, "qc_asm_insp_detail", "单据编号 = N'" + ASM_NO + "'");
        copy(c, "qc_first_insp_head", "单据编号 = N'" + FIRST_NO + "'");
        copy(c, "qc_first_insp_detail", "单据编号 = N'" + FIRST_NO + "'");
        copy(c, "qc_proc_insp_head", "单据编号 = N'" + PROC_NO + "'");
        copy(c, "qc_proc_insp_detail", "单据编号 = N'" + PROC_NO + "'");
        copy(c, "yj_doc_status", "panel_code = N'QC_ASM_INSP' AND doc_no = N'" + ASM_NO + "'");

        System.out.println("== ③ 演示销售出库单 " + SALE_NO);
        exec(c, "DELETE FROM " + TEST + ".dbo.bl_sale_out WHERE 单据编号 = N'" + SALE_NO + "'");
        exec(c, "DELETE FROM " + TEST + ".dbo.bd_sale_out WHERE 单据编号 = N'" + SALE_NO + "'");
        exec(c, "INSERT INTO " + TEST + ".dbo.bd_sale_out (单据编号, 单据日期, 业务类型, 客户, 结算客户, 单据状态)"
                + " VALUES (N'" + SALE_NO + "', '2026-11-01', N'', N'伊可普', N'伊可普', N'已审核')");
        insertSaleLine(c, "B-92-25", "碱性炭棒(1018项目)", "45(OD)*21(ID)*256.5(L)", "PCS", 300, "20261017");
        insertSaleLine(c, "C-23-11", "PP棉复合A级炭棒", "62.5*41.5*498.5", "PCS", 100, "PC0000");
        System.out.println("[sale-out] " + SALE_NO + " 已建(2 行;第 1 行批号能命中成品检验单,第 2 行 PC0000 走回落)");
    }

    static void insertSaleLine(Connection c, String code, String name, String spec, String unit,
                               int qty, String lot) throws SQLException {
        String sql = "INSERT INTO " + TEST + ".dbo.bl_sale_out (单据编号, 存货名称, 存货编码, 规格型号, 计量单位, 数量, 批号)"
                + " VALUES (?,?,?,?,?,?,?)";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, SALE_NO); ps.setString(2, name); ps.setString(3, code);
            ps.setString(4, spec); ps.setString(5, unit); ps.setInt(6, qty); ps.setString(7, lot);
            ps.executeUpdate();
        }
        System.out.println("[sale-line] " + code + " 批号=" + lot + " 数量=" + qty);
    }

    // ---------------- 清理 ----------------
    static void cleanup(Connection c) throws SQLException {
        System.out.println("== 清理测试库演示数据(只动本次铺的东西)");
        // 生成的出厂检验报告(演示单号从 XSCK-2026-11-99001 来的,按出库单号反查)
        exec(c, "DELETE d FROM " + TEST + ".dbo.qc_oqc_detail d JOIN " + TEST + ".dbo.qc_oqc_head h ON h.单据编号 = d.单据编号"
                + " WHERE h.出库单号 = N'" + SALE_NO + "'");
        exec(c, "DELETE s FROM " + TEST + ".dbo.yj_doc_status s JOIN " + TEST + ".dbo.qc_oqc_head h ON h.单据编号 = s.doc_no"
                + " WHERE s.panel_code = N'QC_OQC_REPORT' AND h.出库单号 = N'" + SALE_NO + "'");
        exec(c, "DELETE FROM " + TEST + ".dbo.qc_oqc_head WHERE 出库单号 = N'" + SALE_NO + "'");
        exec(c, "DELETE FROM " + TEST + ".dbo.bl_sale_out WHERE 单据编号 = N'" + SALE_NO + "'");
        exec(c, "DELETE FROM " + TEST + ".dbo.bd_sale_out WHERE 单据编号 = N'" + SALE_NO + "'");
        for (String t : new String[]{"rd_insp_plan_head", "rd_insp_plan_detail"}) {
            exec(c, "DELETE FROM " + TEST + ".dbo.[" + t + "] WHERE 单据编号 IN (" + sqlIn(PLAN_NOS) + ")");
        }
        for (String[] pair : new String[][]{
                {"qc_asm_insp_head", ASM_NO}, {"qc_asm_insp_detail", ASM_NO},
                {"qc_first_insp_head", FIRST_NO}, {"qc_first_insp_detail", FIRST_NO},
                {"qc_proc_insp_head", PROC_NO}, {"qc_proc_insp_detail", PROC_NO}}) {
            exec(c, "DELETE FROM " + TEST + ".dbo.[" + pair[0] + "] WHERE 单据编号 = N'" + pair[1] + "'");
        }
        exec(c, "DELETE FROM " + TEST + ".dbo.yj_doc_status WHERE panel_code = N'QC_ASM_INSP' AND doc_no = N'" + ASM_NO + "'");
        System.out.println("[cleanup] done");
    }

    // ---------------- 自检 ----------------
    static void check(Connection c) throws SQLException {
        System.out.println("== 自检(读测试库)");
        q(c, "SELECT 产品编号, COUNT(*) n FROM " + TEST + ".dbo.v_oqc_std GROUP BY 产品编号 ORDER BY 产品编号", "v_oqc_std 行数");
        q(c, "SELECT 单据编号, 单据日期, 客户 FROM " + TEST + ".dbo.bd_sale_out WHERE 单据编号 = N'" + SALE_NO + "'", "演示出库单头");
        q(c, "SELECT id, 存货编码, 存货名称, 批号, 数量 FROM " + TEST + ".dbo.bl_sale_out WHERE 单据编号 = N'" + SALE_NO + "' ORDER BY id", "演示出库单行");
        q(c, "SELECT 单据编号, 批次号, 工单号, 工单行号 FROM " + TEST + ".dbo.qc_asm_insp_head WHERE 单据编号 = N'" + ASM_NO + "'", "成品检验单");
        q(c, "SELECT COUNT(*) n FROM " + TEST + ".dbo.qc_asm_insp_detail WHERE 单据编号 = N'" + ASM_NO + "'", "成品检验明细行数");
        q(c, "SELECT COUNT(*) n FROM " + TEST + ".dbo.qc_oqc_head WHERE 出库单号 = N'" + SALE_NO + "'", "已生成的报告数");
    }

    static void q(Connection c, String sql, String label) {
        System.out.println("-- " + label);
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) head.append(m.getColumnLabel(i)).append(i < m.getColumnCount() ? " | " : "");
            System.out.println("   " + head);
            while (rs.next()) {
                StringBuilder sb = new StringBuilder("   ");
                for (int i = 1; i <= m.getColumnCount(); i++) sb.append(rs.getObject(i)).append(i < m.getColumnCount() ? " | " : "");
                System.out.println(sb);
            }
        } catch (SQLException e) { System.out.println("   [ERR] " + e.getMessage()); }
    }

    static int exec(Connection c, String sql) throws SQLException {
        try (Statement s = c.createStatement()) { return s.executeUpdate(sql); }
    }

    static String sqlIn(String[] arr) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < arr.length; i++) { if (i > 0) sb.append(", "); sb.append("N'").append(arr[i]).append("'"); }
        return sb.toString();
    }
}
