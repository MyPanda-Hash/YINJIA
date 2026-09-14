package com.yinjia.mes.config;

/**
 * 登录工厂 → 数据源路由(ADR-0003:一系统两账套)。
 * 登录时选择的工厂写入 JWT 工厂声明;JwtAuthFilter 按声明把当前请求线程切到对应库:
 *   YJ      → HSDZ_MES(正式)
 *   YJ_TEST → HSDZ_MES_TEST(测试)
 * 线程无上下文(启动任务/定时/未带令牌)一律落正式库 —— 安全默认。
 */
public class DataSourceRouter extends org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource {

    public static final String PROD = "YJ";
    public static final String TEST = "YJ_TEST";

    private static final ThreadLocal<String> CTX = new ThreadLocal<>();

    /** 切换当前线程的工厂(只认 PROD/TEST,其余落正式) */
    public static void use(String factory) {
        CTX.set(TEST.equals(factory) ? TEST : PROD);
    }

    /** 请求结束必须清理(容器线程复用,不清会串库) */
    public static void clear() {
        CTX.remove();
    }

    public static String current() {
        String f = CTX.get();
        return f == null || f.isBlank() ? PROD : f;
    }

    @Override
    protected Object determineCurrentLookupKey() {
        return current();
    }
}
