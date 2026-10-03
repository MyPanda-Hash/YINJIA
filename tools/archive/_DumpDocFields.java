import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;

/**
 * _DumpDocFields.java — 一次性探针:导出采购链四单(QC_RECV/QC_INSP/QC_RETURN/PURCHASE_IN)
 * 的面板字段(yj_field)与表头/明细物理列(sys.columns),供《采购链四单字段与显示字段》文档取证。
 * 用法(在 tools 目录下): java -cp lib\mssql-jdbc.jar archive\_DumpDocFields.java [库名] [输出目录]
 */
public class _DumpDocFields {
    static final String[] PANELS = {"QC_RECV", "QC_INSP", "QC_RETURN", "PURCHASE_IN"};
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        Path out = Path.of(args.length > 1 ? args[1] : "archive/_dump-out");
        Files.createDirectories(out);
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true",
                USER, PASS)) {
            StringBuilder sb = new StringBuilder();
            header(sb, c, db);
            for (String p : PANELS) {
                panel(sb, c, p, out);
            }
            Path f = out.resolve("fields-" + db + ".md");
            Files.writeString(f, sb.toString(), StandardCharsets.UTF_8);
            System.out.println("[ok] " + f.toAbsolutePath());
        }
    }

    static void header(StringBuilder sb, Connection c, String db) throws SQLException {
        sb.append("# dump db=").append(db).append('\n');
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(
                     "SELECT panel_code,panel_name,panel_name_en,category,mode,head_table,line_table,code_col,date_col,prefix,page_size,detail_key,module_group FROM yj_panel WHERE panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN')")) {
            while (rs.next()) {
                sb.append("PANEL\t").append(rs.getString(1)).append('\t')
                        .append(rs.getString(2)).append('\t')
                        .append(rs.getString(3)).append('\t')
                        .append(rs.getString(4)).append('\t')
                        .append(rs.getString(5)).append('\t')
                        .append(rs.getString(6)).append('\t')
                        .append(rs.getString(7)).append('\t')
                        .append(rs.getString(8)).append('\t')
                        .append(rs.getString(9)).append('\t')
                        .append(rs.getString(10)).append('\t')
                        .append(rs.getInt(11)).append('\t')
                        .append(rs.getString(12)).append('\t')
                        .append(rs.getString(13)).append('\n');
            }
        }
    }

    static void panel(StringBuilder sb, Connection c, String panel, Path out) throws Exception {
        sb.append("\n===== ").append(panel).append(" =====\n");
        sb.append("-- yj_field (place, seq)\n");
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT col_name,label,data_type,place,seq,width,editable,required,hidden,visible,"
                        + "alias,ref_panel,ref_field,display_field,ref_filter,dict_sql,label_en,col_group,id "
                        + "FROM yj_field WHERE panel_code=? ORDER BY place,seq,id")) {
            ps.setString(1, panel);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    sb.append("FIELD\t").append(nz(rs.getString("place"))).append('\t')
                            .append(rs.getInt("seq")).append('\t')
                            .append(nz(rs.getString("label"))).append('\t')
                            .append(nz(rs.getString("col_name"))).append('\t')
                            .append(nz(rs.getString("data_type"))).append('\t')
                            .append(rs.getObject("width") == null ? "" : String.valueOf(rs.getInt("width"))).append('\t')
                            .append(rs.getBoolean("editable") ? "E" : "-")
                            .append(rs.getBoolean("required") ? "R" : "-")
                            .append(rs.getBoolean("hidden") ? "H" : "-")
                            .append(rs.getBoolean("visible") ? "V" : "-").append('\t')
                            .append(nz(rs.getString("alias"))).append('\t')
                            .append(nz(rs.getString("ref_panel"))).append('\t')
                            .append(nz(rs.getString("ref_field"))).append('\t')
                            .append(nz(rs.getString("display_field"))).append('\t')
                            .append(nz(rs.getString("ref_filter"))).append('\t')
                            .append(nz(rs.getString("dict_sql"))).append('\t')
                            .append(nz(rs.getString("label_en"))).append('\t')
                            .append(nz(rs.getString("col_group"))).append('\t')
                            .append(rs.getInt("id")).append('\n');
                }
            }
        }
        try (PreparedStatement ps = c.prepareStatement("SELECT config FROM yj_panel WHERE panel_code=?")) {
            ps.setString(1, panel);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String cfg = rs.getString(1);
                    Path f = out.resolve(panel + ".config.json");
                    Files.writeString(f, cfg == null ? "" : cfg, StandardCharsets.UTF_8);
                    sb.append("-- config.json -> ").append(f.getFileName()).append(" len=")
                            .append(cfg == null ? 0 : cfg.length()).append('\n');
                }
            }
        }
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT t.name AS tbl, c.name AS col, ty.name AS cty, c.max_length, c.is_nullable, "
                        + "CAST(ep.value AS nvarchar(500)) AS cmt "
                        + "FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id "
                        + "JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
                        + "LEFT JOIN sys.extended_properties ep ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_Description' "
                        + "WHERE t.name IN (SELECT head_table FROM yj_panel WHERE panel_code=? UNION SELECT line_table FROM yj_panel WHERE panel_code=?) "
                        + "ORDER BY t.name, c.column_id")) {
            ps.setString(1, panel);
            ps.setString(2, panel);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    sb.append("COL\t").append(rs.getString("tbl")).append('\t')
                            .append(rs.getString("col")).append('\t')
                            .append(rs.getString("cty")).append('(').append(rs.getInt("max_length")).append(')').append('\t')
                            .append(rs.getBoolean("is_nullable") ? "null" : "NOT NULL").append('\t')
                            .append(nz(rs.getString("cmt"))).append('\n');
                }
            }
        }
    }

    static String nz(String s) {
        return s == null ? "" : s.replace('\t', ' ').replace('\n', ' ').replace('\r', ' ');
    }
}
