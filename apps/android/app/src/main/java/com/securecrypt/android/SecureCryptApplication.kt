package com.securecrypt.android

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class SecureCryptApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        Thread.setDefaultUncaughtExceptionHandler { _, e ->
            android.util.Log.e("SecureCrypt", "Uncaught exception", e)
        }
    }
}
