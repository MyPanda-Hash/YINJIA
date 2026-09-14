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

    public String generate(String username) {
        return generate(username, DataSourceRouter.PROD);
    }

    /** 令牌携带登录工厂(ADR-0003):JwtAuthFilter 按它路由数据源 */
    public String generate(String username, String factory) {
        Date now = new Date();
        return Jwts.builder()
                .subject(username)
                .claim("factory", DataSourceRouter.PROD.equals(factory) || DataSourceRouter.TEST.equals(factory) ? factory : DataSourceRouter.PROD)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expireHours * 3600_000L))
                .signWith(key)
                .compact();
    }

    /** 校验并返回用户名;失败返回 null */
    public String validate(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload();
            return claims.getSubject();
        } catch (Exception e) {
            return null;
        }
    }

    /** 校验并取出工厂声明;无令牌/解析失败返回 null(调用方按正式库兜底) */
    public String factoryOf(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload();
            Object f = claims.get("factory");
            return f == null ? null : String.valueOf(f);
        } catch (Exception e) {
            return null;
        }
    }
}
