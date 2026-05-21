package com.securecrypt.android.core.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class AndroidKeyStoreManager {
    
    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val MASTER_KEY_ALIAS = "securecrypt_master_key"
        const val DATA_KEY_ALIAS = "securecrypt_data_key"
        private const val KEY_SIZE = 256
        private const val GCM_TAG_LENGTH = 128
        private const val IV_SIZE = 16
    }
    
    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply {
        load(null)
    }
    
    fun generateMasterKey(userAuthenticationRequired: Boolean = true): SecretKey {
        if (keyStore.containsAlias(MASTER_KEY_ALIAS)) {
            deleteKey(MASTER_KEY_ALIAS)
        }
        
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        )
        
        val builder = KeyGenParameterSpec.Builder(MASTER_KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(KEY_SIZE)
            .setUserAuthenticationRequired(userAuthenticationRequired)
            .setUserAuthenticationValidityDurationSeconds(30)
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            builder.setUnlockedDeviceRequired(true)
            builder.setIsStrongBoxBacked(true)
        }
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            builder.setDevicePropertiesRequired(
                KeyGenParameterSpec.DEVICE_PROPERTY_SECURE_WITHIN_SO
            )
        }
        
        keyGenerator.init(builder.build())
        return keyGenerator.generateKey()
    }
    
    fun generateDataKey(): SecretKey {
        if (keyStore.containsAlias(DATA_KEY_ALIAS)) {
            deleteKey(DATA_KEY_ALIAS)
        }
        
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        )
        
        val builder = KeyGenParameterSpec.Builder(DATA_KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(KEY_SIZE)
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            builder.setUnlockedDeviceRequired(true)
        }
        
        keyGenerator.init(builder.build())
        return keyGenerator.generateKey()
    }
    
    fun getKey(alias: String): SecretKey? {
        return keyStore.getKey(alias, null) as? SecretKey
    }
    
    fun getCipherForEncryption(alias: String): Pair<Cipher, ByteArray> {
        val key = getKey(alias)
            ?: throw IllegalStateException("Key not found: $alias")
        
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        
        val iv = cipher.iv
        if (iv.size != IV_SIZE) {
            throw IllegalStateException("Invalid IV size")
        }
        
        return Pair(cipher, iv)
    }
    
    fun getCipherForDecryption(alias: String, iv: ByteArray): Cipher {
        val key = getKey(alias)
            ?: throw IllegalStateException("Key not found: $alias")
        
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.DECRYPT_MODE, key, spec)
        
        return cipher
    }
    
    fun deleteKey(alias: String) {
        if (keyStore.containsAlias(alias)) {
            keyStore.deleteEntry(alias)
        }
    }
    
    fun keyExists(alias: String): Boolean {
        return keyStore.containsAlias(alias)
    }
    
    fun clearAllKeys() {
        keyStore.aliases().toList().forEach { alias ->
            deleteKey(alias)
        }
    }
}
