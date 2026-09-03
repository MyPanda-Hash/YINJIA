/* 孤儿状态/审批记录检查:单据主数据已不存在的记录(按面板line_table动态查) */
import java.sql.*;
import java.util.*;

public class _OrphanCheck {
    static final String URL = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = "Yinjia@2026";

    public static void main(String[] args) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            // 各面板 line_table 动态查询是否存在对应单据
            List<Map<String, Object>> panels = query(c, "SELECT panel_code, line_table FROM yj_panel WHERE line_table IS NOT NULL AND mode='doc'");
            int orphanStatus = 0, orphanApproval = 0;
            for (Map<String, Object> p : panels) {
                String pc = String.valueOf(p.get("panel_code"));
                String tbl = String.valueOf(p.get("line_table"));
                if (!tbl.matches("[A-Za-z0-9_]+")) continue;
                try {
                    Integer n = queryInt(c, "SELECT COUNT(*) FROM yj_doc_status s WHERE s.panel_code=? AND NOT EXISTS (SELECT 1 FROM [" + tbl + "] t WHERE t.[" + "单据编号" + "]=s.doc_no)", pc);
                    orphanStatus += n == null ? 0 : n;
                    Integer n2 = queryInt(c, "SELECT COUNT(*) FROM yj_form_approval a WHERE a.panel_code=? AND NOT EXISTS (SELECT 1 FROM [" + tbl + "] t WHERE t.[单据编号]=a.form_no)", pc);
                    orphanApproval += n2 == null ? 0 : n2;
                } catch (Exception e) { /* 视图表跳过 */ }
            }
            System.out.println("orphan doc_status=" + orphanStatus + " orphan approvals=" + orphanApproval);
            // 面板引用检查
            System.out.println("bs_bom used by: " + queryStr(c, "SELECT panel_code FROM yj_panel WHERE line_table='bs_bom' OR head_table='bs_bom'"));
            System.out.println("View_SCGD used by: " + queryStr(c, "SELECT panel_code FROM yj_panel WHERE line_table='View_SCGD' OR head_table='View_SCGD'"));
            System.out.println("tables in views: " + queryInt(c, "SELECT COUNT(DISTINCT o.name) FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id WHERE m.definition LIKE '%from [View_SCGD]%' OR m.definition LIKE '%View_SCGD%'"));
        }
    }

    static List<Map<String, Object>> query(Connection c, String sql) throws Exception {
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(sql)) {
            List<Map<String, Object>> out = new ArrayList<>();
            ResultSetMetaData md = rs.getMetaData();
            while (rs.next()) { Map<String, Object> m = new HashMap<>(); for (int i = 1; i <= md.getColumnCount(); i++) m.put(md.getColumnName(i), rs.getObject(i)); out.add(m); }
            return out;
        }
    }
    static Integer queryInt(Connection c, String sql, Object... args) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return rs.getInt(1); }
        }
    }
    static String queryStr(Connection c, String sql) throws Exception {
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(sql)) {
            StringBuilder sb = new StringBuilder();
            while (rs.next()) sb.append(rs.getString(1)).append(',');
            return sb.length() == 0 ? "(none)" : sb.toString();
        }
    }
}
