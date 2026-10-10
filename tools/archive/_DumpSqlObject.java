import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/**
 * _DumpSqlObject.java — 把某个库对象的定义(视图/存储过程/函数)原样导出成文件(UTF-8 无 BOM)。
 *
 * 用途:做迁移脚本时要把正式库的视图定义**逐字节**搬进脚本,不能靠控制台回显(会换行/截断)。
 *
 * 用法(在 tools 目录):
 *   java -cp lib\mssql-jdbc.jar archive\_DumpSqlObject.java <JDBC> <用户> <密码|env> <对象名> <输出文件>
 * 例:
 *   java -cp lib\mssql-jdbc.jar archive\_DumpSqlObject.java \
 *     "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env dbo.v_manu_schedule out.sql
 */
public class _DumpSqlObject {
    public static void main(String[] args) throws Exception {
        if (args.length < 5) {
            System.err.println("用法: _DumpSqlObject <JDBC> <用户> <密码|env> <对象名> <输出文件>");
            System.exit(2);
        }
        String url = args[0], user = args[1];
        String pass = args[2].equals("env") ? System.getenv("YINJIA_SQL_PASS") : args[2];
        String obj = args[3];
        Path out = Path.of(args[4]);
        try (Connection c = DriverManager.getConnection(url, user, pass);
             PreparedStatement ps = c.prepareStatement(
                 "SELECT m.definition FROM sys.sql_modules m WHERE m.object_id = OBJECT_ID(?)")) {
            ps.setString(1, obj);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    System.err.println("[FAIL] 对象不存在或没有定义: " + obj);
                    System.exit(1);
                }
                String def = rs.getString(1);
                Files.writeString(out, def, StandardCharsets.UTF_8);
                System.out.println("[OK] " + obj + " → " + out.toAbsolutePath() + "  (" + def.length() + " 字符)");
            }
        }
    }
}
