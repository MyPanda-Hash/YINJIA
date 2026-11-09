import java.sql.*;

/** 只读探针:全库「数量类」列 + 同表是否有单位列(评估"按单位精度统一"的改造面)。 */
public class U3 {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String qty = "SELECT c.TABLE_NAME AS t, c.COLUMN_NAME AS c, c.DATA_TYPE AS ty, c.NUMERIC_SCALE AS sc FROM INFORMATION_SCHEMA.COLUMNS c "
            + "WHERE c.TABLE_SCHEMA='dbo' AND c.DATA_TYPE IN ('decimal','numeric') "
            + "AND (c.COLUMN_NAME LIKE N'%数量%' OR c.COLUMN_NAME LIKE N'%结存%' OR c.COLUMN_NAME LIKE N'%库存%') "
            + "ORDER BY c.TABLE_NAME, c.COLUMN_NAME";
        String unit = "SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS "
            + "WHERE TABLE_SCHEMA='dbo' AND COLUMN_NAME IN (N'单位',N'计量单位')";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            java.util.Map<String, String> units = new java.util.HashMap<>();
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(unit)) {
                while (rs.next()) units.putIfAbsent(rs.getString("t"), rs.getString("c"));
            }
            int total = 0, withUnit = 0;
            StringBuilder noUnit = new StringBuilder();
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(qty)) {
                String last = "";
                while (rs.next()) {
                    String t = rs.getString("t");
                    if (!t.equals(last)) {
                        last = t;
                    }
                    total++;
                    String u = units.get(t);
                    if (u != null) withUnit++;
                    else if (noUnit.length() < 800) noUnit.append(t).append('.')
                            .append(rs.getString("c")).append("  ");
                }
            }
            System.out.println(db + " 数量类列=" + total + " 其中同表有单位列=" + withUnit);
            System.out.println("无单位列的表(前 800 字): " + noUnit);
            System.out.println("--- 有单位列的表清单 ---");
            for (String t : new java.util.TreeSet<>(units.keySet())) System.out.println("  " + t + " -> " + units.get(t));
        }
    }
}
