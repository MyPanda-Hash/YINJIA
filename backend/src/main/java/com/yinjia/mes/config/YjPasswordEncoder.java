package com.yinjia.mes.config;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

/**
 * 自写口令编码器:新口令一律用本仓库自写的 PBKDF2-HMAC-SHA256(前缀 {@value #PREFIX})存放,
 * 存量 BCrypt 哈希**继续可验**(过渡期),登录成功时由调用方顺手升级成新格式。
 *
 * 存储格式(全部 ASCII、自解释、可被任何语言按 tools/verify/YjHashVerify.java 的规格复现):
 * <pre>
 *   yj1$&lt;迭代次数&gt;$&lt;盐 16 字节的 32 位 hex&gt;$&lt;派生密钥 32 字节的 64 位 hex&gt;
 *   例:yj1$12000$3f0a…（32）$9c21…（64）      计 112 字符,列宽 nvarchar(400) 够用
 * </pre>
 *
 * 为什么保留 BCrypt 分支(2026-09-21 实测教训,勿删):
 *   库中存量 10 个账号全是 `$2a$10$…`;BCrypt 不可逆,拿不到明文就无法预先换算法。
 *   若 matches() 只认新格式,这些账号**用正确口令也登不进去**(仓库文档
 *   《密码哈希口径-BCrypt.md》§⑦ 实测就是这个结果:HTTP 409)。
 *
 * 安全口径(诚实说明,详见 docs/adr/0005-自写口令哈希.md):
 *   - 每次换 16 字节随机盐(盐用 {@link SecureRandom}:盐的随机源不是"加密函数",
 *     自写伪随机会让盐可预测、等于白加盐,故这里仍用平台随机源);
 *   - 迭代 {@value #ITERATIONS} 次,登录一次约几十毫秒 —— 与原先 BCrypt cost=10 体感相当;
 *   - 抗 CPU 暴力与 BCrypt 相当;**抗 GPU/ASIC 明显弱于 BCrypt**(bcrypt 的 4KB 随机访存天然抗并行,
 *     SHA-256 没有这个性质)。所以口令长度/复杂度这一道门不能省。
 */
public class YjPasswordEncoder implements PasswordEncoder {

    /** 新格式前缀(带算法版本号,日后换算法只需加 yj2) */
    public static final String PREFIX = "yj1$";

    /** 迭代次数:实测 50000 次 ≈ 50ms/次,对齐原先 BCrypt cost=10 的登录体感(量测见自测报告 §8) */
    public static final int ITERATIONS = 50000;

    /** 盐长度(字节) */
    public static final int SALT_BYTES = 16;

    /** 派生密钥长度(字节)= SHA-256 输出 */
    public static final int DK_BYTES = 32;

    /** 迭代次数上限:防止被塞入畸形哈希(如 yj1$2000000000$…)拖死登录线程 */
    private static final int MAX_ITERATIONS = 5_000_000;

    private final SecureRandom random = new SecureRandom();

    /** 只用于校验存量 BCrypt 哈希;新口令不再经过它 */
    private final BCryptPasswordEncoder legacyBcrypt = new BCryptPasswordEncoder();

    @Override
    public String encode(CharSequence rawPassword) {
        if (rawPassword == null) throw new IllegalArgumentException("rawPassword 不能为 null");
        byte[] salt = new byte[SALT_BYTES];
        random.nextBytes(salt);
        byte[] dk = Sha256.pbkdf2(utf8(rawPassword), salt, ITERATIONS, DK_BYTES);
        return PREFIX + ITERATIONS + "$" + Sha256.hex(salt) + "$" + Sha256.hex(dk);
    }

    @Override
    public boolean matches(CharSequence rawPassword, String encodedPassword) {
        if (rawPassword == null || encodedPassword == null) return false;
        String stored = encodedPassword.trim();               // 兼容定长列/尾空格
        if (stored.isEmpty()) return false;

        if (stored.startsWith(PREFIX)) return matchesYj1(rawPassword, stored);

        // 存量:标准 BCrypt($2a$/$2b$/$2y$)。delegating 前缀形态 {bcrypt}$2a$… 也认。
        String bcrypt = stored.startsWith("{bcrypt}") ? stored.substring("{bcrypt}".length()) : stored;
        if (bcrypt.startsWith("$2a$") || bcrypt.startsWith("$2b$") || bcrypt.startsWith("$2y$")) {
            try {
                return legacyBcrypt.matches(rawPassword, bcrypt);
            } catch (RuntimeException e) {
                return false;                                  // 畸形串一律判否,不让登录接口 500
            }
        }
        return false;                                          // 未知算法:判否(绝不退化成明文比较)
    }

    /**
     * 是否需要升级存储格式 —— 存量 BCrypt 判 true,登录成功后调用方重新 encode 一次即可完成迁移。
     * Spring Security 的约定方法(默认 false),这里覆写使过渡期自动收敛。
     */
    @Override
    public boolean upgradeEncoding(String encodedPassword) {
        if (encodedPassword == null) return false;
        String stored = encodedPassword.trim();
        if (stored.startsWith("{bcrypt}")) return true;
        if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) return true;
        String[] f = stored.split("\\$");
        // 新格式但迭代数被调高过(或将来加盐长度),也提示升级
        if (f.length == 4 && "yj1".equals(f[0])) {
            try {
                return Integer.parseInt(f[1]) < ITERATIONS;
            } catch (NumberFormatException e) {
                return true;
            }
        }
        return false;
    }

    private boolean matchesYj1(CharSequence rawPassword, String stored) {
        String[] f = stored.split("\\$");
        if (f.length != 4 || !"yj1".equals(f[0])) return false;
        int iterations;
        try {
            iterations = Integer.parseInt(f[1]);
        } catch (NumberFormatException e) {
            return false;
        }
        if (iterations < 1 || iterations > MAX_ITERATIONS) return false;
        byte[] salt = Sha256.unhex(f[2]);
        byte[] dk = Sha256.unhex(f[3]);
        if (salt == null || salt.length != SALT_BYTES || dk == null || dk.length != DK_BYTES) return false;
        byte[] calc = Sha256.pbkdf2(utf8(rawPassword), salt, iterations, DK_BYTES);
        return Sha256.constantTimeEquals(calc, dk);
    }

    private static byte[] utf8(CharSequence s) {
        return s.toString().getBytes(StandardCharsets.UTF_8);
    }
}
