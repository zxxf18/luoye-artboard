# The bridge is reached from JavaScript through an explicit @JavascriptInterface
# method. Keep it and the bridge payload types in release builds.
-keepclassmembers class cn.com.yebuluo.AndroidBridge {
    public <methods>;
}
