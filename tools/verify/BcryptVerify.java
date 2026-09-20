import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * BcryptVerify — 确认 yj_user.password_hash 就是标准 BCrypt,并为 C/C++ 实现产出自测向量
 *
 * 运行(单文件源码模式,无需先编译):
 *   java --class-path "<spring-security-crypto.jar;spring-core.jar;spring-jcl.jar>" \
 *        tools/verify/BcryptVerify.java <库中某账号的 password_hash> [报告输出路径]
 *
 * ⚠ 三个 Windows 上真踩到的坑:
 *   ① jar 路径是 .m2-repo\org\springframework\security\spring-security-crypto\<版本>\…,
 *      不是 …\spring-security-crypto-<版本>.jar(少了版本目录 —— ClassNotFound 就是这个原因);
 *   ② BCryptPasswordEncoder 在 org.springframework.security.crypto.**bcrypt**(不是 .password);
 *   ③ 中文输出走控制台会被码页弄成乱码 ⇒ 报告写 UTF-8 文件再看
 *      (默认写 docs/development/密码哈希口径-BCrypt.md,命令行第二参数可覆盖)。
 *
 * 查清的事:
 *   ① 服务端 encoder = new BCryptPasswordEncoder()(即 BCrypt:$2a$、cost 10、16 字节随机盐)
 *   ② 60 字符 = $2a$10$<22位盐><31位摘要>,盐内嵌,取出即可独立复算
 *   ③ 口令按 UTF-8 字节参与运算
 *   ④ 超 72 字节:BCrypt.hashpw 抛异常,但 BCryptPasswordEncoder.matches 对超长口令返回
 *      false(登录侧表现为"用户名或密码错误",不会 500)
 *   ⑤ 追加 NUL:jBCrypt 系对 $2a$ 会补 '\0',Spring 不补
 */
public class BcryptVerify {

    static final StringBuilder OUT = new StringBuilder();

    static void w(String s) {
        OUT.append(s).append('\n');
        System.out.println(s);
    }

    public static void main(String[] args) throws IOException {
        String stored = args.length > 0 && !args[0].isBlank() ? args[0]
                : "$2a$10$Moj1FDdhyiS6pr406akaJey.Vj60Awm31ETy34qZh2NWxXHbjDt2a";
        Path report = Path.of(args.length > 1 ? args[1]
                : "docs\\development\\密码哈希口径-BCrypt.md");

        w("# BCrypt 口径核实报告(由服务端同款库算出)");
        w("");
        w("## 库中样本哈希");
        w("");
        w("- 值:`" + stored + "`");
        w("- 长度=" + stored.length() + " 版本=`" + stored.substring(0, 4) + "` cost=" + stored.substring(4, 6)
                + " 盐(22字符)=`" + stored.substring(7, 29) + "`");
        String salt = stored.substring(0, 29);      // $2a$10$ + 22 位盐 = bcrypt 的完整 salt 串

        w("");
        w("## ① 服务端校验入口(两处都 true 才算对上)");
        w("");
        w("- `BCrypt.checkpw(\"123456\", 库中值)` = **" + BCrypt.checkpw("123456", stored) + "**");
        w("- `new BCryptPasswordEncoder().matches(\"123456\", 库中值)` = **"
                + new BCryptPasswordEncoder().matches("123456", stored) + "**");
        w("- 错误口令(\"123457\") = " + BCrypt.checkpw("123457", stored) + "(应为 false)");

        w("");
        w("## ② 用取出的盐复算(证明盐内嵌、任何语言都能独立复现)");
        w("");
        String re = BCrypt.hashpw("123456", salt);
        w("- 复算 = `" + re + "`");
        w("- 与库中逐字符一致 = **" + re.equals(stored) + "**");

        w("");
        w("## ③ 是否追加 NUL(决定 C 实现口径)");
        w("");
        String withNul = BCrypt.hashpw("123456\0", salt);
        w("- 带 NUL = `" + withNul + "`");
        w("- 与不带 NUL 相同 = " + withNul.equals(re) + " ⇒ 不同即证明服务端**不**追加 NUL(照标准 bcrypt 写)");

        w("");
        w("## ④ 中文口令 = 按 UTF-8 字节参与(不是 UTF-16/本地码页)");
        w("");
        for (String cn : new String[]{"银嘉123456", "测试口令", "Aa1!中文"}) {
            w("- pw=`" + cn + "` UTF-8 字节数=" + cn.getBytes(StandardCharsets.UTF_8).length
                    + " → `" + BCrypt.hashpw(cn, salt) + "`");
        }

        w("");
        w("## ⑤ 超 72 字节:Spring 6.x 抛异常(不是静默截断)");
        w("");
        String long80 = "a".repeat(80);
        try {
            BCrypt.hashpw(long80, salt);
            w("- 80 字节口令:未抛异常(=旧 jBCrypt 截断行为)");
        } catch (IllegalArgumentException e) {
            w("- 80 字节口令 → 抛 `IllegalArgumentException: " + e.getMessage() + "`(BCrypt.java hashpw 处)");
        }
        try {
            boolean m = new BCryptPasswordEncoder().matches(long80, stored);
            w("- `BCryptPasswordEncoder.matches(80 字节)` 不抛异常,返回 **" + m
                    + "** ⇒ 登录接口收到超长口令 = 直接判定口令错误(不会 500)");
        } catch (IllegalArgumentException e) {
            w("- `BCryptPasswordEncoder.matches(80 字节)` → 同样抛:`" + e.getMessage() + "`");
        }
        try {
            boolean m73 = new BCryptPasswordEncoder().matches("a".repeat(73), stored);
            w("- `matches(73 字节)` 返回 **" + m73 + "**(边界:72 内可用,>72 判错)");
        } catch (IllegalArgumentException e) {
            w("- `matches(73 字节)` 抛:`" + e.getMessage() + "`");
        }
        String cn24 = "中".repeat(24);   // 72 字节
        w("- 72 字节整(24 个汉字)可用:`" + BCrypt.hashpw(cn24, salt) + "`");

        w("");
        w("## ⑥ 给 C/C++ 实现的自测向量(固定盐,期望值由服务端同款库算出)");
        w("");
        w("盐 = `" + salt + "`");
        w("");
        w("| 口令(pw) | 期望哈希 |");
        w("|---|---|");
        for (String pw : new String[]{"123456", "abc123", "银嘉123456", "Passw0rd!中文", ""}) {
            w("| `" + pw + "` | `" + BCrypt.hashpw(pw, salt) + "` |");
        }
        w("");
        w("反例(判错即实现跑偏):");
        w("");
        w("| 错误写法 | 会得到 | 说明 |");
        w("|---|---|---|");
        w("| pw 后补 `\\0` | `" + withNul + "` | jBCrypt 系做法,Spring 不是这个 |");
        w("| pw 超过 72 字节仍截断计算 | 应改为拒绝 | Spring 直接抛异常 |");
        w("");

        Files.createDirectories(report.getParent());
        Files.writeString(report, OUT.toString(), StandardCharsets.UTF_8);
        System.out.println("[report] " + report);
    }
}
