import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * Deploy generator: produce deploy-all.sql (CREATE TABLE + INSERT data for tables that exist
 * locally but not on the remote server, plus CREATE OR ALTER VIEW for views missing remotely).
 * Run from tools dir: java -cp lib/mssql-jdbc.jar _DeployGen.java
 */
public class _DeployGen {
    static final String LOCAL_URL = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10";
    static final String LOCAL_USER = "yinjia";
    static final String LOCAL_PASS = "Yinjia@2026";
    static final String REMOTE_URL = "jdbc:sqlserver://36.140.66.163:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=15";
    static final String REMOTE_USER = "sa";
    static final String REMOTE_PASS = "MES0109@@mes0109%%";
    static final String OUT = "C:/INCER/YINJIA-MES/tools/deploy-all.sql";

    public static void main(String[] args) throws Exception {
        try (Connection lc = DriverManager.getConnection(LOCAL_URL, LOCAL_USER, LOCAL_PASS);
             Connection rc = DriverManager.getConnection(REMOTE_URL, REMOTE_USER, REMOTE_PASS)) {
            Set<String> localTables = names(lc, "SELECT name FROM sys.tables");
            Set<String> remoteTables = names(rc, "SELECT name FROM sys.tables");
            Set<String> diffTables = new TreeSet<>(localTables);
            diffTables.removeAll(remoteTables);
            diffTables.remove("t1");
            diffTables.remove("t2");
            diffTables.remove("dtproperties");

            Set<String> localViews = names(lc, "SELECT name FROM sys.views");
            Set<String> remoteViews = names(rc, "SELECT name FROM sys.views");
            Set<String> diffViews = new TreeSet<>(localViews);
            diffViews.removeAll(remoteViews);

            System.out.println("local tables=" + localTables.size() + " remote=" + remoteTables.size()
                    + " diffTables=" + diffTables.size());
            System.out.println("local views=" + localViews.size() + " remote=" + remoteViews.size()
                    + " diffViews=" + diffViews.size());

            StringBuilder sb = new StringBuilder();
            for (String t : diffTables) {
                sb.append(genTable(lc, t)).append("\nGO\n");
            }
            for (String v : diffViews) {
                String ddl = viewDdl(lc, v);
                if (ddl != null) sb.append(ddl).append("\nGO\n");
                else System.out.println("[WARN] no definition for view " + v);
            }
            Files.writeString(Path.of(OUT), sb.toString(), StandardCharsets.UTF_8);
            System.out.println("written " + OUT + " bytes=" + sb.length());
        }
    }

    static Set<String> names(Connection c, String sql) throws Exception {
        Set<String> out = new TreeSet<>();
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(sql)) {
            while (rs.next()) out.add(rs.getString(1));
        }
        return out;
    }

    /** Column meta rows for a table. */
    static List<String[]> columns(Connection c, String table) throws Exception {
        List<String[]> cols = new ArrayList<>();
        String sql = "SELECT c.name, ty.name AS typ, c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity, "
                + "c.is_computed, dc.definition AS def FROM sys.columns c "
                + "JOIN sys.types ty ON ty.user_type_id = c.user_type_id "
                + "LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id "
                + "WHERE c.object_id = OBJECT_ID(?) ORDER BY c.column_id";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    cols.add(new String[] { rs.getString("name"), rs.getString("typ"),
                            String.valueOf(rs.getInt("max_length")), String.valueOf(rs.getInt("precision")),
                            String.valueOf(rs.getInt("scale")), rs.getBoolean("is_nullable") ? "1" : "0",
                            rs.getBoolean("is_identity") ? "1" : "0", rs.getBoolean("is_computed") ? "1" : "0",
                            rs.getString("def") });
                }
            }
        }
        return cols;
    }

    static String colType(String typ, String maxLen, String prec, String scale) {
        switch (typ) {
            case "nvarchar": case "nchar":
                return typ + (maxLen.equals("-1") ? "(max)" : "(" + (Integer.parseInt(maxLen) / 2) + ")");
            case "varchar": case "char": case "varbinary": case "binary":
                return typ + (maxLen.equals("-1") ? "(max)" : "(" + maxLen + ")");
            case "decimal": case "numeric":
                return typ + "(" + prec + "," + scale + ")";
            case "text": case "ntext": case "image": case "xml":
                return typ;
            default:
                return typ;
        }
    }

    static String genTable(Connection c, String table) throws Exception {
        List<String[]> cols = columns(c, table);
        StringBuilder ddl = new StringBuilder();
        ddl.append("IF OBJECT_ID('dbo.").append(table).append("','U') IS NULL CREATE TABLE dbo.[")
                .append(table).append("] (\n");
        boolean hasIdentity = false;
        List<String[]> dataCols = new ArrayList<>();
        for (String[] col : cols) {
            if (col[7].equals("1")) continue; // computed
            dataCols.add(col);
            if (col[6].equals("1")) hasIdentity = true;
            ddl.append("  [").append(col[0]).append("] ").append(colType(col[1], col[2], col[3], col[4]));
            if (col[6].equals("1")) ddl.append(" IDENTITY(1,1)");
            ddl.append(col[5].equals("1") ? " NULL" : " NOT NULL");
            if (col[8] != null && !col[8].isBlank()) ddl.append(" DEFAULT ").append(col[8]);
            ddl.append(",\n");
        }
        ddl.setLength(ddl.length() - 2);
        ddl.append("\n);\n");

        // data rows
        String colList = String.join(",", dataCols.stream().map(x -> "[" + x[0] + "]").toList());
        long rowCount = 0;
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery("SELECT COUNT(*) FROM [" + table + "]")) {
            if (rs.next()) rowCount = rs.getLong(1);
        }
        if (rowCount > 0) {
            if (hasIdentity) ddl.append("SET IDENTITY_INSERT [").append(table).append("] ON;\n");
            String select = "SELECT " + colList + " FROM [" + table + "]";
            List<String> rowsSql = new ArrayList<>();
            StringBuilder vals = new StringBuilder();
            int batch = 0;
            try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(select)) {
                while (rs.next()) {
                    List<String> literals = new ArrayList<>();
                    for (int i = 0; i < dataCols.size(); i++) {
                        literals.add(literal(rs.getString(i + 1), dataCols.get(i)[1]));
                    }
                    if (vals.length() > 0) vals.append(",\n");
                    vals.append("(").append(String.join(",", literals)).append(")");
                    batch++;
                    if (batch >= 200) {
                        rowsSql.add("INSERT INTO [" + table + "] (" + colList + ") VALUES\n" + vals + ";");
                        vals.setLength(0);
                        batch = 0;
                    }
                }
            }
            if (vals.length() > 0) rowsSql.add("INSERT INTO [" + table + "] (" + colList + ") VALUES\n" + vals + ";");
            for (String r : rowsSql) ddl.append(r).append("\n");
            if (hasIdentity) ddl.append("SET IDENTITY_INSERT [").append(table).append("] OFF;\n");
        }
        System.out.println("  table " + table + " rows=" + rowCount);
        return ddl.toString();
    }

    static String literal(String v, String type) {
        if (v == null) return "NULL";
        switch (type) {
            case "int": case "bigint": case "smallint": case "tinyint":
            case "bit": case "decimal": case "numeric": case "money": case "smallmoney":
            case "float": case "real":
                return v;
            default:
                return "N'" + v.replace("'", "''") + "'";
        }
    }

    static String viewDdl(Connection c, String view) throws Exception {
        String sql = "SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID(?)";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, view);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String def = rs.getString(1);
                    if (def == null) return null;
                    def = def.replaceFirst("(?i)CREATE\\s+VIEW", "CREATE OR ALTER VIEW");
                    return def.trim();
                }
            }
        }
        return null;
    }
}
