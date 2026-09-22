package com.yinjia.mes.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/** Bearer Token 解析 -> SecurityContext(对齐 light-mes JwtAuthFilter) */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    public JwtAuthFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        boolean routed = false;
        if (header != null && header.startsWith("Bearer ")) {
            JwtUtil.Token t = jwtUtil.parse(header.substring(7));
            if (t != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                // ADR-0003:按令牌里的工厂声明把**本次请求线程**切到对应库(YJ=正式 / YJ_TEST=测试)。
                // 必须在拿到连接之前切:AbstractRoutingDataSource 是在 getConnection() 时取当前上下文。
                DataSourceRouter.use(t.factory());
                routed = true;
                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                        t.username(), null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        try {
            chain.doFilter(request, response);
        } finally {
            // 容器线程复用:不清会把下一次请求(可能是别的工厂)带进错误的库
            if (routed) DataSourceRouter.clear();
        }
    }
}
