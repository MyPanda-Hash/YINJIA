import java.sql.*;
import java.util.*;

/**
 * 为订单结转里的产品补一份《出货检验计划》+《成型工艺清单》(幂等)。
 *
 * 目的:按 2026-11-24 新判据(有 1PCS 出功能、有 1% 出表观、有成型清单出首件)让自动出单跑起来。
 * 只插必要的头/明细行,不审批(留下草稿,由品质确认后审核)。
 */
public class SeedPlanData {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=%s;encrypt=false;trustServerCertificate=true";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String code = a.length > 1 ? a[1] : "A-32-32";
        try (Connection c = DriverManager.getConnection(String.format(URL, db), USER, PASS)) {
            c.setAutoCommit(false);
            System.out.println("== " + db + " / 产品 " + code + " ==");
            String name = orderName(c, code);
            if (name == null) {
                System.out.println("[SKIP] 订单结转里没有这个产品(bl_so_order 无该存货编码)");
                return;
            }
            System.out.println("产品名称(取自销售订单行): " + name);

            String planNo = ensurePlan(c, code, name);
            String moldNo = ensureMold(c, code, name);
            c.commit();

            System.out.println("[OK] 出货检验计划 " + planNo + " / 成型工艺清单 " + moldNo);
            verify(c, code, planNo);
        }
    }

    static String orderName(Connection c, String code) throws SQLException {
        try (PreparedStatement p = c.prepareStatement(
                "SELECT TOP 1 ISNULL(l.[存货名称],N'') FROM bd_so_order o"
                        + " JOIN bl_so_order l ON l.[单据编号]=o.[单据编号]"
                        + " WHERE LTRIM(RTRIM(l.[存货编码]))=? AND ISNULL(l.asp_cancel,'N')<>'Y'"
                        + "   AND ISNULL(o.asp_cancel,'N')<>'Y' ORDER BY o.[单据日期] DESC")) {
            p.setString(1, code);
            try (ResultSet r = p.executeQuery()) { return r.next() ? r.getString(1) : null; }
        }
    }

    /** 出货检验计划:头 + 2 行 1PCS(功能)+ 3 行 1%(表观) */
    static String ensurePlan(Connection c, String code, String name) throws SQLException {
        try (PreparedStatement p = c.prepareStatement(
                "SELECT TOP 1 [单据编号] FROM dbo.rd_insp_plan_head WHERE LTRIM(RTRIM(ISNULL([产品编号],N'')))=?"
                        + " AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC")) {
            p.setString(1, code);
            try (ResultSet r = p.executeQuery()) {
                if (r.next()) {
                    String no = r.getString(1);
                    System.out.println("[SKIP] 已有对应该产品的出货检验计划:" + no);
                    return no;
                }
            }
        }
        String no = nextNo(c, "IP", "rd_insp_plan_head");
        try (PreparedStatement p = c.prepareStatement(
                "INSERT INTO dbo.rd_insp_plan_head (单据编号, 单据日期, 文档编号, 标题, 版本号, 密级, 产品编号,"
                        + " 管理人, 编写人, 备注, asp_user1, asp_time1, asp_cancel)"
                        + " VALUES (?,?,?,?,?,?,?,?,?,?,?,GETDATE(),N'N')")) {
            p.setString(1, no);
            p.setString(2, LocalDateStr.now());
            p.setString(3, code);                       // 文档编号(NOT NULL)= 产品编号,便于追溯
            p.setString(4, code + " 出货检验计划");
            p.setString(5, "V" + LocalDateStr.now() + "-01");
            p.setString(6, "内部");
            p.setString(7, code);
            p.setString(8, "admin");
            p.setString(9, "admin");
            p.setString(10, "按 2026-11-24 口径补录:1PCS=功能、1%=表观");
            p.setString(11, "admin");
            p.executeUpdate();
        }
        String[][] rows = {
                {"1", "压降", "≤ 3 kPa(1.0 L/min)", "1PCS/一个生产批次", "压降测试台", "功能"},
                {"2", "抗压强度", "≥ 8 kgf", "1PCS/一个生产批次", "强度试验机", "功能"},
                {"3", "炭棒表观状态", "无裂纹、无明显缺料、无脏污", "生产量*1%", "目视", "表观"},
                {"4", "外径", "外径 32±0.5 mm;长度 121±1 mm", "生产量*1%", "卡尺/千分尺", "表观"},
                {"5", "出货重量", "≥ 25 g/支", "生产量*1%", "电子秤", "表观"},
        };
        for (String[] row : rows) {
            try (PreparedStatement p2 = c.prepareStatement(
                    "INSERT INTO dbo.rd_insp_plan_detail (单据编号, 序号, 控制项目, 控制标准及要求, 检测频率,"
                            + " 控制方法, 检验内容, 检验类别, asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,GETDATE(),N'N')")) {
                p2.setString(1, no);
                p2.setString(2, row[0]);
                p2.setString(3, row[1]);
                p2.setString(4, row[2]);
                p2.setString(5, row[3]);
                p2.setString(6, row[4]);
                p2.setString(7, row[5]);
                p2.setString(8, row[5]);
                p2.setString(9, "admin");
                p2.executeUpdate();
            }
        }
        System.out.println("[ADD] 出货检验计划 " + no + "(2 行 1PCS + 3 行 1%)");
        return no;
    }

    /** 成型工艺清单:头(产品编号带 -tb,与 2026-10-27 口径一致);明细物料行非必需,首件单只读头 */
    static String ensureMold(Connection c, String code, String name) throws SQLException {
        String moldCode = code + "-tb";
        try (PreparedStatement p = c.prepareStatement(
                "SELECT TOP 1 [单据编号] FROM dbo.rd_mold_proc_head"
                        + " WHERE LTRIM(RTRIM(ISNULL([产品编号],N''))) IN (?,?) AND ISNULL(asp_cancel,'N')<>'Y'"
                        + " ORDER BY id DESC")) {
            p.setString(1, code);
            p.setString(2, moldCode);
            try (ResultSet r = p.executeQuery()) {
                if (r.next()) {
                    String no = r.getString(1);
                    System.out.println("[SKIP] 已有对应该产品的成型工艺清单:" + no);
                    return no;
                }
            }
        }
        String no = nextNo(c, "MP", "rd_mold_proc_head");
        try (PreparedStatement p = c.prepareStatement(
                "INSERT INTO dbo.rd_mold_proc_head (单据编号, 单据日期, 表单管理人, 密级, 版本号, 产品编号,"
                        + " 产品名称, 生产车间, 外观要求, 长度要求, 外径mm, 外径公差, 密度管控要求,"
                        + " 强度要求kgf, 压降标准kpa, 压降是否测试, 备注, asp_user1, asp_time1, asp_cancel)"
                        + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,GETDATE(),N'N')")) {
            p.setString(1, no);
            p.setString(2, LocalDateStr.now());
            p.setString(3, "admin");
            p.setString(4, "保密");
            p.setString(5, "V" + LocalDateStr.now() + "-01");
            p.setString(6, moldCode);
            p.setString(7, name);
            p.setString(8, "成型车间");
            p.setString(9, "无裂纹、无明显缺料、无脏污");
            p.setString(10, "121±1 mm");
            p.setString(11, "32");
            p.setString(12, "±0.5");
            p.setString(13, "按工艺要求");
            p.setString(14, "8");
            p.setString(15, "3");
            p.setString(16, "是");
            p.setString(17, "按 2026-11-24 口径补录(首件检验取本清单)");
            p.setString(18, "admin");
            p.executeUpdate();
        }
        System.out.println("[ADD] 成型工艺清单 " + no + "(产品编号 " + moldCode + ")");
        return no;
    }

    /** 下一个单号:前缀 + yyyy-MM + 4 位流水(按已有最大流水 +1,冲突时再 +1) */
    static String nextNo(Connection c, String prefix, String table) throws SQLException {
        String ym = LocalDateStr.now().substring(0, 7);
        int max = 0;
        try (PreparedStatement p = c.prepareStatement(
                "SELECT ISNULL(MAX(TRY_CAST(RIGHT([单据编号],4) AS int)),0) FROM dbo." + table
                        + " WHERE [单据编号] LIKE ?")) {
            p.setString(1, prefix + "-" + ym + "-%");
            try (ResultSet r = p.executeQuery()) { if (r.next()) max = r.getInt(1); }
        }
        String no;
        int n = max + 1;
        while (true) {
            no = prefix + "-" + ym + "-" + String.format("%04d", n);
            try (PreparedStatement p = c.prepareStatement(
                    "SELECT COUNT(*) FROM dbo." + table + " WHERE [单据编号]=?")) {
                p.setString(1, no);
                try (ResultSet r = p.executeQuery()) {
                    if (!r.next() || r.getInt(1) == 0) return no;
                }
            }
            n++;
        }
    }

    static void verify(Connection c, String code, String planNo) throws SQLException {
        System.out.println("-- 复核(判据口径)");
        for (String[] q : new String[][]{
                {"成型工艺清单命中", "SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.rd_mold_proc_head"
                        + " WHERE LTRIM(RTRIM(ISNULL([产品编号],N''))) IN (N'" + code + "', N'" + code + "-tb')"
                        + " AND ISNULL(asp_cancel,'N')<>'Y') THEN 1 ELSE 0 END"},
                {"1PCS 行数", "SELECT COUNT(*) FROM dbo.rd_insp_plan_detail WHERE 单据编号=N'" + planNo
                        + "' AND CHARINDEX(N'1PCS', UPPER(ISNULL(检测频率,N'')))>0"},
                {"1% 行数", "SELECT COUNT(*) FROM dbo.rd_insp_plan_detail WHERE 单据编号=N'" + planNo
                        + "' AND CHARINDEX(N'1%', UPPER(ISNULL(检测频率,N'')))>0"}}) {
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(q[1])) {
                if (r.next()) System.out.println("   " + q[0] + " = " + r.getString(1));
            }
        }
    }

    static final class LocalDateStr {
        static String now() { return java.time.LocalDate.now().toString(); }
    }
}
