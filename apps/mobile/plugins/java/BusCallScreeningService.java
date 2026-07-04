package com.bus.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.telecom.Call;
import android.telecom.CallScreeningService;

import androidx.annotation.RequiresApi;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

@RequiresApi(api = Build.VERSION_CODES.Q)
public class BusCallScreeningService extends CallScreeningService {

    static final String PREFS_NAME   = "bus_caller_id";
    static final String KEY_CACHE    = "contact_cache";
    static final String KEY_TOKEN    = "auth_token";
    static final String KEY_API_URL  = "api_url";
    static final String KEY_COUNTRY  = "country_iso";
    private static final String CHANNEL_ID = "bus_caller_id";
    private static final int    NOTIF_ID   = 7001;

    @Override
    public void onScreenCall(Call.Details callDetails) {
        try {
            Uri handle = callDetails.getHandle();
            String raw = handle != null ? handle.getSchemeSpecificPart() : null;

            if (raw != null && !raw.isEmpty()) {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String country = prefs.getString(KEY_COUNTRY, "ET");
                String hash = BusHashHelper.hashForLookup(raw, country);

                if (hash != null) {
                    CallerInfo info = lookupLocally(hash, prefs);
                    if (info != null) {
                        showCallerNotification(info.name, info.source);
                    } else {
                        final String h = hash;
                        final SharedPreferences p = prefs;
                        new Thread(() -> {
                            CallerInfo api = lookupViaApi(h, p);
                            if (api != null) showCallerNotification(api.name, api.source);
                        }).start();
                    }
                }
            }
        } catch (Exception ignored) {}

        respondToCall(callDetails, new CallResponse.Builder().build());
    }

    private CallerInfo lookupLocally(String hash, SharedPreferences prefs) {
        String json = prefs.getString(KEY_CACHE, null);
        if (json == null) return null;
        try {
            JSONObject cache = new JSONObject(json);
            if (cache.has(hash)) return new CallerInfo(cache.getString(hash), "Your contact");
        } catch (Exception ignored) {}
        return null;
    }

    private CallerInfo lookupViaApi(String hash, SharedPreferences prefs) {
        String token  = prefs.getString(KEY_TOKEN, null);
        String apiUrl = prefs.getString(KEY_API_URL, null);
        if (token == null || apiUrl == null) return null;
        try {
            URL url = new URL(apiUrl + "/api/contacts/search?hash=" + hash);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);

            if (conn.getResponseCode() == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                br.close();
                JSONObject body = new JSONObject(sb.toString());
                JSONObject busUser = body.optJSONObject("busUser");
                if (busUser != null) {
                    String name = busUser.optString("displayName", "");
                    if (name.isEmpty()) name = "BUS User …" + busUser.optString("phoneHint", "");
                    return new CallerInfo(name, "From BUS app");
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private void showCallerNotification(String name, String source) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "BUS Caller ID", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Identifies incoming callers found in BUS");
            nm.createNotificationChannel(ch);
        }

        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            : PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent pi = PendingIntent.getActivity(this, 0, openApp, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle(name)
            .setContentText(source)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setTimeoutAfter(30_000)
            .setAutoCancel(true)
            .setContentIntent(pi);

        nm.notify(NOTIF_ID, builder.build());
    }

    private static class CallerInfo {
        final String name;
        final String source;
        CallerInfo(String name, String source) { this.name = name; this.source = source; }
    }
}
