package com.yinjia.mes.pick;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

/**
 * 银嘉系统 · 安卓壳(Capacitor)
 *
 * 2026-10-21 三件事:
 *  ① 「最上方的按钮按不到,会被手机的摄像头挡住」:targetSdk 35 强制 edge-to-edge,
 *     页面画到状态栏下 ⇒ 给内容区加 systemBars|displayCutout 的内边距 + 深色状态栏图标。
 *  ② 「扫码失败:The Google Barcode Scanner Module is not available」:
 *     @capacitor-mlkit/barcode-scanning 用的是 play-services-code-scanner(**按需下载模块**),
 *     国内无 GMS 的机器装不上 ⇒ 改用**自带 ZXing 的 ScanActivity**(纯 Java、离线、不依赖 GMS),
 *     通过 window.YjNative.scan() 桥调用,与手搓版同一套实现、前端代码零改动。
 *  ③ 扫码结果回传网页:window.__yjScanResult(code, ok)。
 */
public class MainActivity extends BridgeActivity {

    private static final int REQ_SCAN = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySystemBarInsets();
        attachScanBridge();
    }

    // ─────────────────────── ① 状态栏 / 刘海 insets ───────────────────────

    private void applySystemBarInsets() {
        final View content = findViewById(android.R.id.content);
        if (content == null) return;
        content.setBackgroundColor(Color.parseColor("#F5F6F7"));
        content.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                int top;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    android.graphics.Insets bars = insets.getInsets(
                            WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    top = bars.top;
                } else {
                    top = insets.getSystemWindowInsetTop();
                }
                v.setPadding(0, top, 0, 0);
                return insets;
            }
        });
        content.requestApplyInsets();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.setSystemBarsAppearance(
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        }
    }

    // ─────────────────────── ② 扫码桥(ZXing)───────────────────────

    private void attachScanBridge() {
        try {
            WebView web = getBridge().getWebView();
            if (web == null) return;
            web.addJavascriptInterface(new ScanBridge(), "YjNative");
        } catch (Exception e) {
            // 桥注入失败不影响主体;网页会退化成「手输/扫码枪」
        }
    }

    /** 暴露给网页:window.YjNative.scan() / toast() / getBaseUrl() */
    private class ScanBridge {
        @JavascriptInterface
        public void scan() {
            runOnUiThread(new Runnable() {
                @Override public void run() { startScan(); }
            });
        }

        @JavascriptInterface
        public void toast(String msg) {
            final String m = msg;
            runOnUiThread(new Runnable() {
                @Override public void run() { Toast.makeText(MainActivity.this, m, Toast.LENGTH_SHORT).show(); }
            });
        }

        /** Capacitor 版后端地址不在原生侧(前端 localStorage 管),这里返回空串让网页走自己的逻辑 */
        @JavascriptInterface
        public String getBaseUrl() {
            return "";
        }

        @JavascriptInterface
        public String appVersion() {
            return "1.0.0-cap";
        }
    }

    private void startScan() {
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_SCAN);
            return;
        }
        startActivityForResult(new Intent(this, ScanActivity.class), REQ_SCAN);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_SCAN) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startActivityForResult(new Intent(this, ScanActivity.class), REQ_SCAN);
        } else {
            Toast.makeText(this, "没有相机权限,扫不了码;可在「设置 → 应用 → 银嘉系统 → 权限」里开启",
                    Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);   // 先给 Capacitor 插件处理
        if (requestCode != REQ_SCAN) return;
        final String code = (resultCode == RESULT_OK && data != null) ? data.getStringExtra("code") : "";
        final String js = "window.__yjScanResult && window.__yjScanResult(" + quote(code) + ", "
                + (code != null && code.length() > 0) + ")";
        runOnUiThread(new Runnable() {
            @Override public void run() {
                WebView web = getBridge().getWebView();
                if (web != null) web.evaluateJavascript(js, null);
            }
        });
    }

    /** JS 字符串字面量转义(条码里可能带引号/反斜杠) */
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
}
