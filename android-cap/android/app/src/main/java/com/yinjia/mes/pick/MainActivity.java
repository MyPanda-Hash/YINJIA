package com.yinjia.mes.pick;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;

import com.getcapacitor.BridgeActivity;

/**
 * 银嘉系统 · 安卓壳(Capacitor)
 *
 * 2026-10-21(用户反馈):「最上方的按钮按不到,会被手机的摄像头(状态栏/挖孔)挡住」。
 * 原因:targetSdk 35 起安卓**强制 edge-to-edge**,页面一直画到状态栏下面,
 *   网页顶部的按钮正好落在刘海/摄像头区域 ⇒ 点不到。
 * 处置:给内容区加「系统栏 + 刘海」高度的内边距,并把状态栏图标改成深色(浅底才看得清)。
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySystemBarInsets();
    }

    private void applySystemBarInsets() {
        final View content = findViewById(android.R.id.content);
        if (content == null) return;
        content.setBackgroundColor(Color.parseColor("#F5F6F7"));
        content.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                int top = 0;
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

        // 状态栏图标:浅色底要深色字(edge-to-edge 下 setStatusBarColor 已无效,只能控图标)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.setSystemBarsAppearance(
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        }
    }
}
