package com.yinjia.mes.config;

import com.yinjia.mes.service.SupplierPortalService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 供应商会话收口闸门(2026-10-24)。
 *
 * <p>用户口径:「供应商可以通过登录供应商配置的账号登录进来,<b>只能看到供应商采购打印面版
 * (和对应供应商编码的数据)</b>……<b>没有别的权限</b>。」
 *
 * <p>前端把菜单树裁到只剩一条并**不能**算数 —— 拿到令牌直接调 /api/px/* 照样能读任意面板。
 * 故在过滤器层做**默认拒绝**:只要当前登录账号落在 {@code yj_supplier_account} 里(供应商会话),
 * 除少数几条"任何登录人都需要"的只读接口外,**全部 /api 请求一律 403**。
 * 放行清单刻意写死、不含任何业务面板接口:
 * <ul>
 *   <li>{@code /api/supplier/portal/*} —— 供应商门户自己的接口(内部再做 requireSupplier + 供应商编码过滤);</li>
 *   <li>{@code /api/auth/logout}、{@code /api/auth/changePassword} —— 退出与自助改密;</li>
 *   <li>{@code /api/auth/perms}、{@code /api/auth/userinfo} —— 会话身份与权限清单
 *       (前端启动时据此重建供应商菜单;内网部署下不是敏感面);</li>
 *   <li>{@code /api/locale/*} —— 语言包(任何登录人都要);</li>
 *   <li>{@code /api/base/factory/list} —— 账套清单(登录页与顶栏显示用,不含业务数据)。</li>
 * </ul>
 *
 * <p>为什么是 Filter 而不是在 PermissionService 里加判断:供应商会话要挡的是**所有**入口
 * (PxController/ReportController/StockController/… 几十个控制器,将来还会加新的),
 * 逐个加判断必然漏;这里按"身份"一刀切,新增的接口**默认对供应商不可见**,不需要回头登记。
 *
 * <p>性能:每个已认证请求多一次主键唯一索引查询(约几十微秒)。换来的是**停用/改绑立即生效**
 * —— 不必等令牌过期,也不必维护一份会长歪的缓存。
 *
 * <p>顺序:`@Order(0)` 使其排在 Spring Security 过滤器链(默认 -100 区间之后)之前被注册;
 * 此时 {@link JwtAuthFilter} 已把身份与账套路由放好 —— 与 {@code @Order(-1)} 的注册过滤器同一保证,
 * 单测里也按"先 JwtAuthFilter 再本过滤器"的顺序调用。
 */
@Component
@Order(0)
public class SupplierPortalGuardFilter extends OncePerRequestFilter {

    private final SupplierPortalService portal;

    public SupplierPortalGuardFilter(SupplierPortalService portal) {
        this.portal = portal;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI() == null ? "" : request.getRequestURI();
        if (!path.startsWith("/api/") && !path.equals("/api")) {
            chain.doFilter(request, response);   // 静态资源/页面照常
            return;
        }
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
            chain.doFilter(request, response);   // 未登录:交给 SecurityConfig 的 permitAll / 401 规则
            return;
        }
        String supplierCode;
        try {
            supplierCode = portal.supplierCodeOf(auth.getName());
        } catch (RuntimeException e) {
            // supplierCodeOf 自身已吞异常;这里兜底:库不可用不能把全员打成 500,照常放行(= 不误伤内部账号)
            chain.doFilter(request, response);
            return;
        }
        if (supplierCode == null) {
            chain.doFilter(request, response);   // 内部账号:照旧
            return;
        }
        if (allowed(path)) {
            chain.doFilter(request, response);
            return;
        }
        deny(response, supplierCode.isEmpty()
                ? "供应商账号已停用,请联系采购部"
                : "供应商账号仅可使用「供应商采购打印」,无其它权限");
    }

    /** 供应商会话唯一放行清单(全是只读/自身接口,永不含业务面板接口) */
    private static boolean allowed(String path) {
        if (path.startsWith("/api/supplier/portal/")) return true;
        return path.equals("/api/auth/logout")
                || path.equals("/api/auth/changePassword")
                || path.equals("/api/auth/perms")
                || path.equals("/api/auth/userinfo")
                || path.startsWith("/api/locale/")
                || path.equals("/api/base/factory/list");
    }

    /**
     * 403 走项目既定形状(HTTP 200 + body code 403,见 GlobalExceptionHandler)——前端
     * request.js 据此提示而不是整页登出(登出会让供应商以为"账号坏了")。
     */
    private static void deny(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json;charset=UTF-8");
        String body = "{\"code\":403,\"message\":\"" + message.replace("\"", "\\\"") + "\",\"data\":null}";
        response.getWriter().write(body);
    }
}
