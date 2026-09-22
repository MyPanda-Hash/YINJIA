package com.yinjia.mes.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import io.jsonwebtoken.security.Keys;

/** JWT 生成与校验(模式对齐 light-mes JwtUtil) */
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expireHours;

    public JwtUtil(@Value("${yinjia.jwt.secret}") String secret,
                   @Value("${yinjia.jwt.expire-hours:24}") long expireHours) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(bytes, 0, padded, 0, bytes.length);
            bytes = padded;
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.expireHours = expireHours;
    }

    /** 令牌里的身份:账号 + 登录时选的工厂(ADR-0003 一系统两账套)。 */
    public record Token(String username, String factory) {}

    /**
     * 签发令牌。factory 为登录页所选工厂(YJ / YJ_TEST),写进令牌声明 ——
     * JwtAuthFilter 按它把该请求线程切到对应库,故**令牌签发时绑定工厂、改选必须重登**。
     */
    public String generate(String username, String factory) {
        Date now = new Date();
        return Jwts.builder()
                .subject(username)
                .claim("factory", factory)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expireHours * 3600_000L))
                .signWith(key)
                .compact();
    }

    /** 解析令牌;失败返回 null。旧令牌无 factory 声明时回退正式库(安全默认,见 DataSourceRouter)。 */
    public Token parse(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload();
            String factory = claims.get("factory", String.class);
            return new Token(claims.getSubject(), factory == null || factory.isBlank() ? "YJ" : factory);
        } catch (Exception e) {
            return null;
        }
    }

    /** 校验并返回用户名;失败返回 null */
    public String validate(String token) {
        Token t = parse(token);
        return t == null ? null : t.username();
    }
}
