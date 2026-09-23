package com.yinjia.mes.config;

/**
 * 自写 SHA-256 / HMAC-SHA256 / PBKDF2-HMAC-SHA256。
 *
 * 为什么自写:业务要求口令哈希不依赖任何现成密码学封装(JDK 的 MessageDigest/Mac/SecretKeyFactory、
 * 或第三方 bcrypt 实现一律不用),算法细节留在本仓库里可审、可移植(小程序/C 端要按同一规格复现时,
 * 这份代码就是唯一权威规格)。决策与代价见 docs/adr/0005-自写口令哈希.md。
 *
 * 规格(FIPS 180-4 / RFC 2104 / RFC 8018):
 *   digest   : 标准 SHA-256(大端、64 轮压缩、0x80 补位 + 64 位比特长度)
 *   hmac     : HMAC-SHA256,块长 64 字节;key 超 64 字节先 digest;ipad 0x36 / opad 0x5c
 *   pbkdf2   : DK = T1||T2||…,Ti = U1⊕U2⊕…⊕Uc,U1 = HMAC(P, S||INT32BE(i)),Uj = HMAC(P, U(j-1))
 *   constantTimeEquals : 逐字节异或累加,不提前 return(防时序侧信道)
 *
 * 正确性:与 NIST 示例、RFC 4231(HMAC)、PBKDF2-HMAC-SHA256 标准向量逐位一致,
 * 并用 Python 标准库 hashlib/hmac 独立复算交叉验证 —— 见 tools/verify/YjHashVerify.java 与其生成的报告。
 *
 * 注意:本类**不是**通用密码学工具箱,只实现口令哈希需要的这三件;不要拿它去别处当加密用。
 */
public final class Sha256 {

    private Sha256() {
    }

    /** SHA-256 轮常量(前 64 个质数立方根小数部分的前 32 位,大端) */
    private static final int[] K = {
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    };

    /** 初始哈希值(前 8 个质数平方根小数部分的前 32 位) */
    private static final int[] H0 = {
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    };

    private static final int BLOCK = 64;

    /** SHA-256;入参 null 返回 null */
    public static byte[] digest(byte[] msg) {
        if (msg == null) return null;
        int[] h = H0.clone();
        int len = msg.length;
        int full = len / BLOCK;
        for (int i = 0; i < full; i++) compress(h, msg, i * BLOCK);

        byte[] tail = new byte[BLOCK];
        int rem = len - full * BLOCK;
        System.arraycopy(msg, full * BLOCK, tail, 0, rem);
        tail[rem] = (byte) 0x80;                       // 补位:一个 1 后跟 0
        if (rem >= 56) {                               // 放不下 8 字节长度 ⇒ 再压一整块
            compress(h, tail, 0);
            java.util.Arrays.fill(tail, (byte) 0);
        }
        long bits = (long) len * 8;                    // 64 位大端比特长度
        for (int i = 0; i < 8; i++) tail[56 + i] = (byte) (bits >>> (56 - 8 * i));
        compress(h, tail, 0);
        return toBytes(h);
    }

    private static void compress(int[] h, byte[] block, int off) {
        int[] w = new int[64];
        for (int t = 0; t < 16; t++) {
            int i = off + t * 4;
            w[t] = ((block[i] & 0xff) << 24) | ((block[i + 1] & 0xff) << 16)
                    | ((block[i + 2] & 0xff) << 8) | (block[i + 3] & 0xff);
        }
        for (int t = 16; t < 64; t++) {
            int x = w[t - 15];
            int y = w[t - 2];
            int s0 = Integer.rotateRight(x, 7) ^ Integer.rotateRight(x, 18) ^ (x >>> 3);
            int s1 = Integer.rotateRight(y, 17) ^ Integer.rotateRight(y, 19) ^ (y >>> 10);
            w[t] = w[t - 16] + s0 + w[t - 7] + s1;
        }
        int a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
        for (int t = 0; t < 64; t++) {
            int S1 = Integer.rotateRight(e, 6) ^ Integer.rotateRight(e, 11) ^ Integer.rotateRight(e, 25);
            int ch = (e & f) ^ (~e & g);
            int t1 = hh + S1 + ch + K[t] + w[t];
            int S0 = Integer.rotateRight(a, 2) ^ Integer.rotateRight(a, 13) ^ Integer.rotateRight(a, 22);
            int maj = (a & b) ^ (a & c) ^ (b & c);
            int t2 = S0 + maj;
            hh = g;
            g = f;
            f = e;
            e = d + t1;
            d = c;
            c = b;
            b = a;
            a = t1 + t2;
        }
        h[0] += a;
        h[1] += b;
        h[2] += c;
        h[3] += d;
        h[4] += e;
        h[5] += f;
        h[6] += g;
        h[7] += hh;
    }

    private static byte[] toBytes(int[] h) {
        byte[] out = new byte[32];
        for (int i = 0; i < 8; i++) {
            out[i * 4] = (byte) (h[i] >>> 24);
            out[i * 4 + 1] = (byte) (h[i] >>> 16);
            out[i * 4 + 2] = (byte) (h[i] >>> 8);
            out[i * 4 + 3] = (byte) h[i];
        }
        return out;
    }

    /** HMAC-SHA256(RFC 2104) */
    public static byte[] hmac(byte[] key, byte[] msg) {
        if (key == null || msg == null) return null;
        byte[] k = key.length > BLOCK ? digest(key) : key.clone();
        byte[] ipad = new byte[BLOCK];
        byte[] opad = new byte[BLOCK];
        for (int i = 0; i < BLOCK; i++) {
            byte b = i < k.length ? k[i] : 0;
            ipad[i] = (byte) (b ^ 0x36);
            opad[i] = (byte) (b ^ 0x5c);
        }
        byte[] inner = digest(concat(ipad, msg));
        return digest(concat(opad, inner));
    }

    /** PBKDF2-HMAC-SHA256(RFC 8018),dkLen 字节派生密钥 */
    public static byte[] pbkdf2(byte[] password, byte[] salt, int iterations, int dkLen) {
        if (password == null || salt == null) return null;
        if (iterations < 1 || dkLen < 1) throw new IllegalArgumentException("iterations/dkLen 必须为正");
        final int hLen = 32;
        int blocks = (dkLen + hLen - 1) / hLen;
        byte[] out = new byte[blocks * hLen];
        for (int i = 1; i <= blocks; i++) {
            byte[] idx = {(byte) (i >>> 24), (byte) (i >>> 16), (byte) (i >>> 8), (byte) i};
            byte[] u = hmac(password, concat(salt, idx));
            byte[] t = u.clone();
            for (int c = 1; c < iterations; c++) {
                u = hmac(password, u);
                for (int j = 0; j < hLen; j++) t[j] ^= u[j];
            }
            System.arraycopy(t, 0, out, (i - 1) * hLen, hLen);
        }
        byte[] dk = new byte[dkLen];
        System.arraycopy(out, 0, dk, 0, dkLen);
        return dk;
    }

    /** 字节数组转小写十六进制;null 进 null 出 */
    public static String hex(byte[] b) {
        if (b == null) return null;
        char[] cs = new char[b.length * 2];
        final char[] digits = "0123456789abcdef".toCharArray();
        for (int i = 0; i < b.length; i++) {
            cs[i * 2] = digits[(b[i] >> 4) & 0xf];
            cs[i * 2 + 1] = digits[b[i] & 0xf];
        }
        return new String(cs);
    }

    /** 十六进制转字节;长度奇数、含非 hex 字符、null 一律返回 null(调用方按校验失败处理) */
    public static byte[] unhex(String s) {
        if (s == null) return null;
        int n = s.length();
        if (n % 2 != 0) return null;
        byte[] out = new byte[n / 2];
        for (int i = 0; i < n; i += 2) {
            int hi = digit(s.charAt(i));
            int lo = digit(s.charAt(i + 1));
            if (hi < 0 || lo < 0) return null;
            out[i / 2] = (byte) ((hi << 4) | lo);
        }
        return out;
    }

    private static int digit(char c) {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        if (c >= 'A' && c <= 'F') return c - 'A' + 10;
        return -1;
    }

    /** 常量时间比较:长度不同直接 false(长度是公开信息),同长度则逐字节异或累加、不提前返回 */
    public static boolean constantTimeEquals(byte[] a, byte[] b) {
        if (a == null || b == null || a.length != b.length) return false;
        int diff = 0;
        for (int i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }

    private static byte[] concat(byte[] a, byte[] b) {
        byte[] out = new byte[a.length + b.length];
        System.arraycopy(a, 0, out, 0, a.length);
        System.arraycopy(b, 0, out, a.length, b.length);
        return out;
    }
}
