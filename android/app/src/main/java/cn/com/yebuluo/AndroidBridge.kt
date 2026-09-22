package cn.com.yebuluo

import android.webkit.JavascriptInterface

/** Narrow bridge exposed only to the trusted APK page. */
class AndroidBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun post(channel: String, payload: String) {
        activity.handleBridge(channel, payload)
    }

    @JavascriptInterface
    fun closeResult(payload: String) {
        activity.handleCloseResult(payload)
    }

    @JavascriptInterface
    fun closeError(message: String) {
        activity.handleCloseError(message)
    }
}
