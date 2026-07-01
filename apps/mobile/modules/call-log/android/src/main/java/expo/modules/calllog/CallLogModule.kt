package expo.modules.calllog

import android.Manifest
import android.content.pm.PackageManager
import android.provider.CallLog
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CallLogModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoCallLog")

    AsyncFunction("getCallFrequencies") {
      val context = appContext.reactContext
        ?: throw Exception("No React context")

      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG)
          != PackageManager.PERMISSION_GRANTED) {
        return@AsyncFunction emptyList<Map<String, Any>>()
      }

      val cutoff = System.currentTimeMillis() - (90L * 24 * 60 * 60 * 1000)
      val cursor = context.contentResolver.query(
        CallLog.Calls.CONTENT_URI,
        arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.DATE),
        "${CallLog.Calls.DATE} > ?",
        arrayOf(cutoff.toString()),
        "${CallLog.Calls.DATE} DESC"
      ) ?: return@AsyncFunction emptyList<Map<String, Any>>()

      val callCounts = mutableMapOf<String, Int>()
      cursor.use {
        val numberIdx = it.getColumnIndex(CallLog.Calls.NUMBER)
        if (numberIdx == -1) return@AsyncFunction emptyList<Map<String, Any>>()
        while (it.moveToNext()) {
          val number = it.getString(numberIdx) ?: continue
          callCounts[number] = (callCounts[number] ?: 0) + 1
        }
      }

      callCounts.map { (number, count) ->
        mapOf("number" to number, "count" to count)
      }
    }
  }
}
