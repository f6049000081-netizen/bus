package com.bus.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

public class BusIncomingCallActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        String callerNumber = getIntent().getStringExtra("caller_number");
        if (callerNumber == null || callerNumber.isEmpty()) callerNumber = "Unknown";

        String displayName = lookupName(callerNumber);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#0F172A"));
        root.setPadding(64, 128, 64, 128);

        TextView badge = new TextView(this);
        badge.setText("BUS  ·  Incoming Call");
        badge.setTextColor(Color.parseColor("#6366F1"));
        badge.setTextSize(13f);
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(0, 0, 0, 24);
        root.addView(badge);

        TextView nameView = new TextView(this);
        nameView.setText(displayName != null ? displayName : callerNumber);
        nameView.setTextColor(Color.WHITE);
        nameView.setTextSize(30f);
        nameView.setGravity(Gravity.CENTER);
        nameView.setPadding(0, 0, 0, 8);
        root.addView(nameView);

        if (displayName != null) {
            TextView numView = new TextView(this);
            numView.setText(callerNumber);
            numView.setTextColor(Color.parseColor("#94A3B8"));
            numView.setTextSize(17f);
            numView.setGravity(Gravity.CENTER);
            root.addView(numView);
        }

        TextView status = new TextView(this);
        status.setText("Incoming call…");
        status.setTextColor(Color.parseColor("#64748B"));
        status.setTextSize(14f);
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, 24, 0, 80);
        root.addView(status);

        LinearLayout btns = new LinearLayout(this);
        btns.setOrientation(LinearLayout.HORIZONTAL);
        btns.setGravity(Gravity.CENTER);

        Button rejectBtn = new Button(this);
        rejectBtn.setText("Decline");
        rejectBtn.setTextColor(Color.WHITE);
        rejectBtn.setBackgroundColor(Color.parseColor("#DC2626"));
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(0, 140, 1f);
        rp.setMargins(0, 0, 24, 0);
        rejectBtn.setLayoutParams(rp);
        rejectBtn.setOnClickListener(v -> {
            BusInCallService.rejectActiveCall();
            finish();
        });
        btns.addView(rejectBtn);

        Button answerBtn = new Button(this);
        answerBtn.setText("Answer");
        answerBtn.setTextColor(Color.WHITE);
        answerBtn.setBackgroundColor(Color.parseColor("#16A34A"));
        LinearLayout.LayoutParams ap = new LinearLayout.LayoutParams(0, 140, 1f);
        answerBtn.setLayoutParams(ap);
        answerBtn.setOnClickListener(v -> {
            BusInCallService.answerActiveCall();
            finish();
        });
        btns.addView(answerBtn);

        root.addView(btns);
        setContentView(root);
    }

    private String lookupName(String number) {
        try {
            SharedPreferences prefs = getSharedPreferences(BusCallScreeningService.PREFS_NAME, Context.MODE_PRIVATE);
            String country = prefs.getString(BusCallScreeningService.KEY_COUNTRY, "ET");
            String hash = BusHashHelper.hashForLookup(number, country);
            if (hash == null) return null;
            String json = prefs.getString(BusCallScreeningService.KEY_CACHE, null);
            if (json == null) return null;
            JSONObject cache = new JSONObject(json);
            String name = cache.optString(hash, "");
            return name.isEmpty() ? null : name;
        } catch (Exception ignored) {
            return null;
        }
    }
}
