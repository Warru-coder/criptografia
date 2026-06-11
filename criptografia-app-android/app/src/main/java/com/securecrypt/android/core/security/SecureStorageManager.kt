package com.securecrypt.android.core.security

import android.content.Context
import androidx.security.crypto.MasterKeys
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.EncryptedFile
import java.io.File
import java.security.SecureRandom

class SecureStorageManager(
    private val context: Context
) {
    companion object {
        private const val PREFS_NAME = "securecrypt_secure_prefs"
        private const val KEY_MASTER_PASSWORD_HASH = "master_password_hash"
        private const val KEY_MASTER_PASSWORD_SALT = "master_password_salt"
        private const val KEY_BIOMETRIC_ENABLED = "biometric_enabled"
        private const val KEY_AUTO_LOCK_TIMEOUT = "auto_lock_timeout"
        private const val KEY_LAST_UNLOCK_TIME = "last_unlock_time"
        private const val KEY_SETUP_COMPLETE = "setup_complete"
        private const val KEY_SECURITY_LEVEL = "security_level"
        private const val KEY_FAILED_ATTEMPTS = "failed_attempts"
        private const val KEY_LOCKOUT_UNTIL = "lockout_until"
        private const val MAX_FAILED_ATTEMPTS = 5
        private const val LOCKOUT_DURATION_MS = 30000L
    }
    
    private val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
    
    private val encryptedPrefs: EncryptedSharedPreferences by lazy {
        EncryptedSharedPreferences.create(
            PREFS_NAME,
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }
    
    private val secureRandom = SecureRandom()
    
    fun storeMasterPasswordHash(hash: ByteArray) {
        val encoded = android.util.Base64.encodeToString(hash, android.util.Base64.NO_WRAP)
        encryptedPrefs.edit()
            .putString(KEY_MASTER_PASSWORD_HASH, encoded)
            .apply()
        secureZeroMemory(hash)
    }
    
    fun getMasterPasswordHash(): ByteArray? {
        val encoded = encryptedPrefs.getString(KEY_MASTER_PASSWORD_HASH, null)
        return encoded?.let {
            android.util.Base64.decode(it, android.util.Base64.NO_WRAP)
        }
    }

    fun storeMasterPasswordSalt(salt: ByteArray) {
        val encoded = android.util.Base64.encodeToString(salt, android.util.Base64.NO_WRAP)
        encryptedPrefs.edit()
            .putString(KEY_MASTER_PASSWORD_SALT, encoded)
            .apply()
    }

    fun getMasterPasswordSalt(): ByteArray? {
        val encoded = encryptedPrefs.getString(KEY_MASTER_PASSWORD_SALT, null)
        return encoded?.let {
            android.util.Base64.decode(it, android.util.Base64.NO_WRAP)
        }
    }
    
    fun isSetupComplete(): Boolean {
        return encryptedPrefs.getBoolean(KEY_SETUP_COMPLETE, false)
    }
    
    fun setSetupComplete(complete: Boolean) {
        encryptedPrefs.edit()
            .putBoolean(KEY_SETUP_COMPLETE, complete)
            .apply()
    }
    
    fun isBiometricEnabled(): Boolean {
        return encryptedPrefs.getBoolean(KEY_BIOMETRIC_ENABLED, false)
    }
    
    fun setBiometricEnabled(enabled: Boolean) {
        encryptedPrefs.edit()
            .putBoolean(KEY_BIOMETRIC_ENABLED, enabled)
            .apply()
    }
    
    fun getAutoLockTimeoutMs(): Long {
        return encryptedPrefs.getLong(KEY_AUTO_LOCK_TIMEOUT, 300000)
    }
    
    fun setAutoLockTimeoutMs(timeoutMs: Long) {
        encryptedPrefs.edit()
            .putLong(KEY_AUTO_LOCK_TIMEOUT, timeoutMs)
            .apply()
    }
    
    fun recordUnlockTime() {
        encryptedPrefs.edit()
            .putLong(KEY_LAST_UNLOCK_TIME, System.currentTimeMillis())
            .apply()
    }
    
    fun isLocked(): Boolean {
        if (!isSetupComplete()) return false
        
        val timeout = getAutoLockTimeoutMs()
        if (timeout == -1L) return false
        
        val lastUnlock = encryptedPrefs.getLong(KEY_LAST_UNLOCK_TIME, 0)
        return System.currentTimeMillis() - lastUnlock > timeout
    }
    
    fun recordFailedAttempt(): Boolean {
        val attempts = encryptedPrefs.getInt(KEY_FAILED_ATTEMPTS, 0) + 1
        val editor = encryptedPrefs.edit()
            .putInt(KEY_FAILED_ATTEMPTS, attempts)
        
        if (attempts >= MAX_FAILED_ATTEMPTS) {
            editor.putLong(KEY_LOCKOUT_UNTIL, System.currentTimeMillis() + LOCKOUT_DURATION_MS)
        }
        
        editor.apply()
        return attempts >= MAX_FAILED_ATTEMPTS
    }
    
    fun isLockedOut(): Boolean {
        val lockoutUntil = encryptedPrefs.getLong(KEY_LOCKOUT_UNTIL, 0)
        if (System.currentTimeMillis() < lockoutUntil) {
            return true
        }
        
        if (lockoutUntil > 0) {
            encryptedPrefs.edit()
                .putInt(KEY_FAILED_ATTEMPTS, 0)
                .putLong(KEY_LOCKOUT_UNTIL, 0)
                .apply()
        }
        
        return false
    }
    
    fun getLockoutRemainingMs(): Long {
        val lockoutUntil = encryptedPrefs.getLong(KEY_LOCKOUT_UNTIL, 0)
        return maxOf(0, lockoutUntil - System.currentTimeMillis())
    }
    
    fun resetFailedAttempts() {
        encryptedPrefs.edit()
            .putInt(KEY_FAILED_ATTEMPTS, 0)
            .putLong(KEY_LOCKOUT_UNTIL, 0)
            .apply()
    }
    
    fun getFailedAttempts(): Int {
        return encryptedPrefs.getInt(KEY_FAILED_ATTEMPTS, 0)
    }
    
    fun createEncryptedFile(file: File): EncryptedFile {
        return EncryptedFile.Builder(
            file,
            context,
            masterKeyAlias,
            EncryptedFile.FileEncryptionScheme.AES256_GCM_HKDF_4KB
        ).build()
    }
    
    fun clearAllSecureData() {
        encryptedPrefs.edit()
            .clear()
            .apply()
    }
    
    private fun secureZeroMemory(data: ByteArray) {
        for (i in data.indices) {
            data[i] = 0.toByte()
        }
    }
}
