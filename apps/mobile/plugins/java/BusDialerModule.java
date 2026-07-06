package com.bus.app;

import android.Manifest;
import android.app.Activity;
import android.app.role.RoleManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.telecom.TelecomManager;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class BusDialerModule extends ReactContextBaseJavaModule implements ActivityEventListener {

    private static final int REQUEST_CODE = 5050;
    private Promise pendingPromise;

    public BusDialerModule(ReactApplicationContext ctx) {
        super(ctx);
        ctx.addActivityEventListener(this);
    }

    @Override
    public String getName() { return "BusDialer"; }

    @ReactMethod
    public void isDefaultDialer(Promise promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            promise.resolve(false);
            return;
        }
        Activity activity = getCurrentActivity();
        if (activity == null) { promise.resolve(false); return; }
        RoleManager rm = (RoleManager) activity.getSystemService(Context.ROLE_SERVICE);
        promise.resolve(rm.isRoleHeld(RoleManager.ROLE_DIALER));
    }

    @ReactMethod
    public void requestDialerRole(Promise promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            promise.resolve("UNSUPPORTED");
            return;
        }
        Activity activity = getCurrentActivity();
        if (activity == null) { promise.reject("NO_ACTIVITY", "No current activity"); return; }
        RoleManager rm = (RoleManager) activity.getSystemService(Context.ROLE_SERVICE);
        if (rm.isRoleHeld(RoleManager.ROLE_DIALER)) {
            promise.resolve("GRANTED");
            return;
        }
        pendingPromise = promise;
        activity.startActivityForResult(
            rm.createRequestRoleIntent(RoleManager.ROLE_DIALER), REQUEST_CODE);
    }

    @ReactMethod
    public void makeCall(String number, Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            Context ctx = getReactApplicationContext();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && activity != null) {
                RoleManager rm = (RoleManager) activity.getSystemService(Context.ROLE_SERVICE);
                if (rm.isRoleHeld(RoleManager.ROLE_DIALER) &&
                    ctx.checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) {
                    TelecomManager tm = (TelecomManager) ctx.getSystemService(Context.TELECOM_SERVICE);
                    tm.placeCall(Uri.fromParts("tel", number, null), null);
                    promise.resolve("direct");
                    return;
                }
            }

            Intent intent = new Intent(Intent.ACTION_DIAL);
            intent.setData(Uri.parse("tel:" + Uri.encode(number)));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            promise.resolve("dialer");
        } catch (Exception e) {
            promise.reject("CALL_FAILED", e.getMessage(), e);
        }
    }

    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_CODE && pendingPromise != null) {
            pendingPromise.resolve(resultCode == Activity.RESULT_OK ? "GRANTED" : "DENIED");
            pendingPromise = null;
        }
    }

    @Override
    public void onNewIntent(Intent intent) {}
}
