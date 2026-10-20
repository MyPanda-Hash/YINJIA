package com.yinjia.mes.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * 银嘉 MES · 安卓壳(2026-10-20)
 *
 * 为什么做成「WebView + 原生扫码桥」而不是重写一套原生界面:
 *   · MES 是 Vue3 单页应用,面板/字段全部由数据库元数据驱动 —— 重写等于把整套引擎再实现一遍;
 *   · 现场真正缺的只有两件原生能力:**摄像头扫码**、**可配置的服务器地址**(接口号);
 *   · 其余(登录、面板、领料)直接复用同一套网页,升级只改服务器,不用重新发 APK。
 *
 * 这个 Activity 做三件事:
 *   ① 首次启动弹「接口地址」设置(存 SharedPreferences),之后 WebView 加载 {地址}/#/login;
 *   ② 顶部一条细工具条:显示当前接口号 + 设置 + 扫码(原生相机);
 *   ③ 向网页注入 window.YjNative 桥:
 *        YjNative.scan()        —— 打开原生扫码页,结果回调 window.__yjScanResult(code, ok)
 *        YjNative.getBaseUrl()  —— 当前接口地址
 *        YjNative.toast(msg)    —— 原生提示
 */
public class MainActivity extends Activity {

    /** 接口号(服务器地址)的存储键;默认值只是占位,首次启动会要求填写 */
    public static final String PREF = "yj_mes";
    public static final String KEY_BASE = "base_url";
    public static final String DEFAULT_BASE = "http://192.168.1.10:8090";

    private static final int REQ_SCAN = 1001;

    private WebView web;
    private TextView baseLabel;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(com.yinjia.mes.app.R.layout.activity_main);

        baseLabel = (TextView) findViewById(com.yinjia.mes.app.R.id.base_label);
        web = (WebView) findViewById(com.yinjia.mes.app.R.id.webview);

        findViewById(com.yinjia.mes.app.R.id.btn_settings).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { showServerDialog(); }
        });
        findViewById(com.yinjia.mes.app.R.id.btn_scan).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { startScan(); }
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // 站内链接留在 WebView;非 http(s) 交给系统
                if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignore) { }
                return true;
            }
        });
        // 摄像头权限:以后网页里要用 getUserMedia(HTTPS)时这里放行;不申请则直接拒绝
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override public void run() { request.grant(request.getResources()); }
                });
            }
        });
        web.addJavascriptInterface(new Bridge(), "YjNative");

        String base = getBase();
        if (base == null || base.trim().length() == 0) {
            showServerDialog();
        } else {
            load(base);
        }
    }

    // ───────────────────────── 接口地址 ─────────────────────────

    private String getBase() {
        SharedPreferences sp = getSharedPreferences(PREF, MODE_PRIVATE);
        return sp.getString(KEY_BASE, "");
    }

    private void setBase(String url) {
        String v = url == null ? "" : url.trim();
        if (v.endsWith("/")) v = v.substring(0, v.length() - 1);
        getSharedPreferences(PREF, MODE_PRIVATE).edit().putString(KEY_BASE, v).apply();
    }

    private void load(String base) {
        baseLabel.setText(base);
        // 直接进登录页;登录后由网页自己的路由接管
        web.loadUrl(base + "/#/login");
    }

    /** 「接口号」设置:就是服务器地址(IP:端口),它连着哪台服务器/哪个账套由服务器配置决定 */
    private void showServerDialog() {
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        input.setHint("http://192.168.1.10:8090");
        String cur = getBase();
        input.setText(cur == null || cur.length() == 0 ? DEFAULT_BASE : cur);
        input.setSelection(input.getText().length());

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        int p = (int) (16 * getResources().getDisplayMetrics().density);
        box.setPadding(p, p / 2, p, 0);
        TextView tip = new TextView(this);
        tip.setText("填写 MES 服务器地址(接口号),例如 http://192.168.1.10:8090。\n手机需与服务器同一网络;保存后自动重新加载。");
        tip.setTextSize(13);
        tip.setTextColor(Color.parseColor("#666666"));
        box.addView(tip);
        box.addView(input);

        new AlertDialog.Builder(this)
                .setTitle("接口地址")
                .setView(box)
                .setPositiveButton("保存并连接", new DialogInterface.OnClickListener() {
                    @Override public void onClick(DialogInterface d, int w) {
                        String v = input.getText().toString().trim();
                        if (v.length() == 0 || !(v.startsWith("http://") || v.startsWith("https://"))) {
                            Toast.makeText(MainActivity.this, "地址要以 http:// 或 https:// 开头", Toast.LENGTH_LONG).show();
                            return;
                        }
                        setBase(v);
                        load(getBase());
                    }
                })
                .setNegativeButton("取消", null)
                .setNeutralButton("恢复默认", new DialogInterface.OnClickListener() {
                    @Override public void onClick(DialogInterface d, int w) {
                        setBase(DEFAULT_BASE);
                        load(DEFAULT_BASE);
                    }
                })
                .show();
    }

    // ───────────────────────── 扫码 ─────────────────────────

    private void startScan() {
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(android.Manifest.permission.CAMERA)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.CAMERA}, REQ_SCAN);
            return;
        }
        startActivityForResult(new Intent(this, ScanActivity.class), REQ_SCAN);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_SCAN) {
            if (grantResults.length > 0 && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                startActivityForResult(new Intent(this, ScanActivity.class), REQ_SCAN);
            } else {
                Toast.makeText(this, "没有相机权限,扫不了码;可在系统设置里开启", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_SCAN) return;
        final String code = (resultCode == RESULT_OK && data != null) ? data.getStringExtra("code") : "";
        final String js = "window.__yjScanResult && window.__yjScanResult(" + quote(code) + ", " + (code != null && code.length() > 0) + ")";
        runOnUiThread(new Runnable() {
            @Override public void run() { web.evaluateJavascript(js, null); }
        });
    }

    /** 拼一个 JS 字符串字面量(转义反斜杠/引号/换行),避免条码里带引号打断脚本 */
    private static String quote(String s) {
        if (s == null) return "''";
        StringBuilder b = new StringBuilder("'");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': b.append("\\\\"); break;
                case '\'': b.append("\\'"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                default: b.append(c);
            }
        }
        return b.append("'").toString();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    /** 暴露给网页的 JS 桥:window.YjNative.* */
    private class Bridge {
        @JavascriptInterface
        public void scan() {
            runOnUiThread(new Runnable() {
                @Override public void run() { startScan(); }
            });
        }

        @JavascriptInterface
        public String getBaseUrl() {
            return getBase();
        }

        @JavascriptInterface
        public void setBaseUrl(String url) {
            setBase(url);
        }

        @JavascriptInterface
        public void toast(String msg) {
            final String m = msg;
            runOnUiThread(new Runnable() {
                @Override public void run() { Toast.makeText(MainActivity.this, m, Toast.LENGTH_SHORT).show(); }
            });
        }

        @JavascriptInterface
        public String appVersion() {
            return "1.0.0";
        }
    }
}
