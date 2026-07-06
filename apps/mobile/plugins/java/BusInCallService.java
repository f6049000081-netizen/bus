package com.bus.app;

import android.content.Intent;
import android.os.Build;
import android.telecom.Call;
import android.telecom.InCallService;

import androidx.annotation.RequiresApi;

@RequiresApi(api = Build.VERSION_CODES.M)
public class BusInCallService extends InCallService {

    public static volatile Call activeCall;

    @Override
    public void onCallAdded(Call call) {
        super.onCallAdded(call);
        activeCall = call;

        if (call.getState() == Call.STATE_RINGING) {
            String number = "";
            if (call.getDetails().getHandle() != null) {
                number = call.getDetails().getHandle().getSchemeSpecificPart();
            }
            Intent intent = new Intent(this, BusIncomingCallActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.putExtra("caller_number", number);
            startActivity(intent);
        }
    }

    @Override
    public void onCallRemoved(Call call) {
        super.onCallRemoved(call);
        if (activeCall == call) activeCall = null;
    }

    public static void answerActiveCall() {
        if (activeCall != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            activeCall.answer(0);
        }
    }

    public static void rejectActiveCall() {
        if (activeCall != null) {
            activeCall.disconnect();
        }
    }
}
