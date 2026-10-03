package cn.com.yebuluo

import android.content.Context
import android.media.MediaPlayer
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/** Small MediaPlayer adapter. Devices without a MIDI codec report an error to the bridge. */
class AndroidMusic(private val context: Context) {
    private var player: MediaPlayer? = null
    private var title = "尚未选择音乐"
    private var duration = 0
    var volume = 0.35f
        set(value) {
            field = value.coerceIn(0f, 1f)
            player?.setVolume(field, field)
    }

    fun loadAsset(path: String, name: String) {
        val assetPath = if (path.startsWith("www/")) path else "www/$path"
        // Built-in tracks are packaged uncompressed so MediaPlayer can read
        // them straight from the APK. This avoids a cache write and a second
        // full-file read whenever a child switches tracks. Keep the previous
        // temporary-file path as a fallback for old APKs where the asset is
        // compressed or the device rejects an asset descriptor.
        try {
            context.assets.openFd(assetPath).use { descriptor ->
                loadDescriptor(descriptor, name)
            }
            return
        } catch (_: Exception) {
            releasePlayer()
        }

        val temp = File.createTempFile("luoye-music-", ".mid", context.cacheDir)
        try {
            context.assets.open(assetPath).use { input ->
                FileOutputStream(temp).use { output -> input.copyTo(output) }
            }
            loadFile(temp, name)
        } finally {
            temp.delete()
        }
    }

    fun loadBytes(bytes: ByteArray, name: String) {
        val temp = File.createTempFile("luoye-music-", ".mid", context.cacheDir)
        FileOutputStream(temp).use { it.write(bytes) }
        try {
            loadFile(temp, name)
        } finally {
            temp.delete()
        }
    }

    private fun loadFile(file: File, name: String) {
        releasePlayer()
        player = MediaPlayer().apply {
            setDataSource(file.absolutePath)
            isLooping = true
            prepare()
            setVolume(volume, volume)
        }
        title = name
        duration = player?.duration?.coerceAtLeast(0) ?: 0
    }

    private fun loadDescriptor(descriptor: android.content.res.AssetFileDescriptor, name: String) {
        releasePlayer()
        player = MediaPlayer().apply {
            setDataSource(descriptor.fileDescriptor, descriptor.startOffset, descriptor.length)
            isLooping = true
            prepare()
            setVolume(volume, volume)
        }
        title = name
        duration = player?.duration?.coerceAtLeast(0) ?: 0
    }

    fun play() { player?.start() }
    fun stop() { player?.pause(); player?.seekTo(0) }

    fun state() = JSONObject()
        .put("name", title)
        .put("duration", duration / 1000.0)
        .put("position", (player?.currentPosition ?: 0) / 1000.0)
        .put("playing", player?.isPlaying == true)
        .put("volume", volume)
        .put("peak", 0)

    fun release() = releasePlayer()

    private fun releasePlayer() {
        player?.stop()
        player?.release()
        player = null
    }
}
