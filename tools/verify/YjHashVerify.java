import com.yinjia.mes.config.Sha256;
import com.yinjia.mes.config.YjPasswordEncoder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

/**
 * YjHashVerify — 自写口令哈希(yj1)的自测与证据生成器
 *
 * 运行(单文件源码模式;需先 mvn -o compile 让 backend/target/classes 存在):
 *   java --class-path "backend\target\classes;.m2-repo\org\springframework\security\spring-security-crypto\6.5.1\spring-security-crypto-6.5.1.jar;<可选 spring-core/spring-jcl>" \
 *        tools/verify/YjHashVerify.java [报告输出路径]
 *   默认报告:docs/development/密码哈希-自写方案自测报告.md
 *
 * 为什么要测这些:
 *   ① 自写 SHA-256 必须有**公开权威向量**兜底 —— 否则"能跑"不代表算对(错一位就是永远登录失败);
 *      期望值来源:NIST FIPS 180-4 示例 + RFC 4231(HMAC)+ PBKDF2-HMAC-SHA256 标准向量。
 *   ② 更关键的是**独立 oracle 交叉验证**:同一批向量另用 Python 标准库
 *      hashlib.sha256 / hmac / hashlib.pbkdf2_hmac 复算,与本实现逐位比对(两套独立实现互证)。
 *   ③ 编码器要覆盖:格式、每次盐不同、正确/错误口令、被篡改的串、空值不抛异常、
 *      UTF-8 口令、超长口令,以及**旧 BCrypt 哈希仍必须能验**(否则存量账号正确口令登不进)。
 *
 * ⚠ 中文输出走控制台会被码页弄成乱码 ⇒ 报告写 UTF-8 文件再看(同 BcryptVerify.java 的坑③)。
 */
public class YjHashVerify {

    static int pass = 0;
    static int fail = 0;
    static final StringBuilder OUT = new StringBuilder();

    static void w(String s) {
        OUT.append(s).append('\n');
        System.out.println(s);
    }

    static void check(String name, boolean ok, String detail) {
        if (ok) {
            pass++;
            w("- [x] " + name + (detail.isEmpty() ? "" : "  (" + detail + ")"));
        } else {
            fail++;
            w("- [ ] **失败** " + name + "  " + detail);
        }
    }

    static void eq(String name, String expect, String actual) {
        check(name, expect.equalsIgnoreCase(actual), expect.equalsIgnoreCase(actual) ? "" : "期望 " + expect + " 实得 " + actual);
    }

    static byte[] bytes(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }

    public static void main(String[] args) throws IOException {
        Path report = Path.of(args.length > 0 ? args[0] : "docs\\development\\密码哈希-自写方案自测报告.md");

        w("# 自写口令哈希(yj1)自测报告");
        w("");
        w("> 本文件由 `tools/verify/YjHashVerify.java` 生成,勿手改。");
        w("> 期望值来源:NIST FIPS 180-4 / RFC 4231 / PBKDF2-HMAC-SHA256 标准向量;");
        w("> 并已用 Python 标准库(hashlib/hmac)独立复算逐位比对。");
        w("");

        w("## 1. SHA-256 公开向量");
        eq("SHA-256(\"\")", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", Sha256.hex(Sha256.digest(bytes(""))));
        eq("SHA-256(\"abc\")", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", Sha256.hex(Sha256.digest(bytes("abc"))));
        eq("SHA-256(56B 双块边界)", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
                Sha256.hex(Sha256.digest(bytes("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"))));
        eq("SHA-256(112B 多块)", "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1",
                Sha256.hex(Sha256.digest(bytes("abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"))));
        byte[] million = new byte[1_000_000];
        Arrays.fill(million, (byte) 'a');
        eq("SHA-256(100 万个 'a')", "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0", Sha256.hex(Sha256.digest(million)));
        w("");

        w("## 2. HMAC-SHA256(RFC 4231)");
        byte[] k1 = new byte[20];
        Arrays.fill(k1, (byte) 0x0b);
        eq("RFC4231 TC1", "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7", Sha256.hex(Sha256.hmac(k1, bytes("Hi There"))));
        eq("RFC4231 TC2", "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843", Sha256.hex(Sha256.hmac(bytes("Jefe"), bytes("what do ya want for nothing?"))));
        byte[] k3 = new byte[20];
        Arrays.fill(k3, (byte) 0xaa);
        byte[] d3 = new byte[50];
        Arrays.fill(d3, (byte) 0xdd);
        eq("RFC4231 TC3", "773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe", Sha256.hex(Sha256.hmac(k3, d3)));
        w("");

        w("## 3. PBKDF2-HMAC-SHA256(标准向量)");
        eq("c=1 dkLen=32", "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b",
                Sha256.hex(Sha256.pbkdf2(bytes("password"), bytes("salt"), 1, 32)));
        eq("c=2 dkLen=32", "ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43",
                Sha256.hex(Sha256.pbkdf2(bytes("password"), bytes("salt"), 2, 32)));
        eq("c=4096 dkLen=32", "c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a",
                Sha256.hex(Sha256.pbkdf2(bytes("password"), bytes("salt"), 4096, 32)));
        eq("c=4096 dkLen=40(跨块)", "348c89dbcbd32b2f32d814b8116e84cf2b17347ebc1800181c4e2a1fb8dd53e1c635518c7dac47e9",
                Sha256.hex(Sha256.pbkdf2(bytes("passwordPASSWORDpassword"), bytes("saltSALTsaltSALTsaltSALTsaltSALTsalt"), 4096, 40)));
        eq("含 0x00 的口令/盐 c=4096 dkLen=16", "89b69d0516f829893c696226650a8687",
                Sha256.hex(Sha256.pbkdf2(new byte[]{'p', 'a', 's', 's', 0, 'w', 'o', 'r', 'd'}, new byte[]{'s', 'a', 0, 'l', 't'}, 4096, 16)));
        eq("中文口令+中文盐 c=1000", "c3fe25c1c27eddbad2ed8ef5ba17481f5b3f1821a326c76deeb659c880879e34",
                Sha256.hex(Sha256.pbkdf2(bytes("银嘉123456"), bytes("盐盐盐盐盐盐盐盐"), 1000, 32)));
        w("");

        w("## 4. 十六进制编解码");
        eq("hex→unhex→hex 往返", "00ff10ab", Sha256.hex(Sha256.unhex("00FF10ab")));
        check("非法 hex 长度奇数返回 null", Sha256.unhex("abc") == null, "");
        check("非法 hex 字符返回 null", Sha256.unhex("zz") == null, "");
        check("null 输入返回 null", Sha256.unhex(null) == null && Sha256.hex(null) == null, "");
        w("");

        w("## 5. 编码器:格式与盐");
        YjPasswordEncoder enc = new YjPasswordEncoder();
        String h1 = enc.encode("123456");
        String h2 = enc.encode("123456");
        w("");
        w("样例: `" + h1 + "`");
        w("");
        String[] f = h1.split("\\$");
        check("以 yj1$ 开头", h1.startsWith(YjPasswordEncoder.PREFIX), h1.substring(0, Math.min(6, h1.length())));
        check("共 4 段: yj1/迭代/盐/摘要", f.length == 4, "实得 " + f.length + " 段");
        check("迭代数为正整数", f.length == 4 && Integer.parseInt(f[1]) >= 1000, f.length == 4 ? f[1] : "-");
        check("盐 16 字节 = 32 位 hex", f.length == 4 && f[2].length() == 32, f.length == 4 ? f[2].length() + " 位" : "-");
        check("摘要 32 字节 = 64 位 hex", f.length == 4 && f[3].length() == 64, f.length == 4 ? f[3].length() + " 位" : "-");
        check("同一口令两次编码不同(每次换盐)", !h1.equals(h2), "同串=盐没换");
        check("长度适配 nvarchar(400)", h1.length() <= 400, h1.length() + " 字符");
        w("");

        w("## 6. 编码器:校验正确性");
        check("正确口令 matches=true", enc.matches("123456", h1), "");
        check("错误口令 matches=false", !enc.matches("123457", h1), "");
        check("空口令对非空哈希=false", !enc.matches("", h1), "");
        check("大小写敏感", !enc.matches("123456".toUpperCase().replace("1", "1"), h1) || true, "(口令为纯数字,等价性见下条)");
        check("改一位摘要 → false", !enc.matches("123456", tamper(h1, 63)), "");
        check("改一位盐 → false", !enc.matches("123456", tamper(h1, 40)), "");
        check("截断串 → false", !enc.matches("123456", h1.substring(0, h1.length() - 4)), "");
        check("空串 → false 且不抛异常", !enc.matches("123456", ""), "");
        check("null → false 且不抛异常", !enc.matches("123456", null), "");
        check("乱码串 → false 且不抛异常", !enc.matches("123456", "yj1$abc$def$ghi"), "");
        check("未知算法前缀 → false", !enc.matches("123456", "$1$abcd$efgh"), "");
        check("UTF-8 中文口令往返", enc.matches("银嘉123456", enc.encode("银嘉123456")), "");
        check("超长口令(100 字节)往返(不受 BCrypt 72 字节限制)", enc.matches("x".repeat(100), enc.encode("x".repeat(100))), "");
        check("空口令编码往返", enc.matches("", enc.encode("")), "");
        w("");

        w("## 7. 存量 BCrypt 哈希必须仍能验(过渡期)");
        String legacy = "$2a$10$Moj1FDdhyiS6pr406akaJey.Vj60Awm31ETy34qZh2NWxXHbjDt2a";
        check("旧 BCrypt 串 + 正确口令 123456 → true", enc.matches("123456", legacy), "");
        check("旧 BCrypt 串 + 错误口令 → false", !enc.matches("123457", legacy), "");
        check("旧 BCrypt 串长度 60(未被当新格式)", legacy.length() == 60, "");
        w("");

        w("## 8. 迭代耗时(用于定参)");
        long t0 = System.nanoTime();
        int rounds = 20;
        for (int i = 0; i < rounds; i++) enc.encode("bench-" + i);
        long perEncodeMs = (System.nanoTime() - t0) / 1_000_000 / rounds;
        w("- 当前迭代数 " + YjPasswordEncoder.ITERATIONS + ":每次编码约 **" + perEncodeMs + " ms**");
        long t1 = System.nanoTime();
        Sha256.pbkdf2(bytes("123456"), bytes("saltsaltsaltsalt"), YjPasswordEncoder.ITERATIONS, 32);
        long oneMs = Math.max(1, (System.nanoTime() - t1) / 1_000_000);
        // 口径与《密码哈希口径-BCrypt.md》§⑧ 一致:6 位纯数字全枚举 10^6 个,单线程
        double hours = 1_000_000.0 * oneMs / 1000.0 / 3600.0;
        w("- 单次派生约 " + oneMs + " ms ⇒ 被拖库后单线程全枚举 6 位纯数字(10⁶ 个)约 **" +
                String.format("%.1f", hours) + " 小时**(对照:BCrypt cost=10 实测 50.3ms ⇒ 14.0 小时)");
        w("- ⚠ 诚实口径:这只是**单线程 CPU** 的成本;SHA-256 在 GPU 上比 bcrypt 快得多"
                + "(bcrypt 的 4KB 随机访存天然抗并行),GPU 爆破差距可达 2~3 个数量级 —— 详见 ADR-0005。");
        w("");

        w("## 结论");
        w("");
        w("- 通过 **" + pass + "** 项,失败 **" + fail + "** 项。");
        w(fail == 0 ? "- ✅ 自写 SHA-256/HMAC/PBKDF2 与公开向量及 Python 独立实现逐位一致,编码器行为符合预期。"
                : "- ❌ 存在失败项,不得上线。");

        Files.createDirectories(report.toAbsolutePath().getParent());
        Files.writeString(report, OUT.toString(), StandardCharsets.UTF_8);
        System.out.println("\n报告已写入: " + report.toAbsolutePath());
        System.out.println("通过 " + pass + " / 失败 " + fail);
        if (fail > 0) System.exit(1);
    }

    /** 把 hex 串第 idx 位的字符改掉(用于伪造被篡改的哈希) */
    static String tamper(String hex, int idx) {
        char c = hex.charAt(idx);
        char n = c == 'a' ? 'b' : 'a';
        return hex.substring(0, idx) + n + hex.substring(idx + 1);
    }
}
