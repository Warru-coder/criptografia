package com.securecrypt.android

import com.securecrypt.android.core.security.AndroidKeyStoreManager
import com.securecrypt.android.core.security.EncryptionService
import com.securecrypt.android.core.security.PasswordStrength
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class EncryptionServiceTest {
    
    private lateinit var encryptionService: EncryptionService
    
    @Before
    fun setup() {
        val keyStoreManager = AndroidKeyStoreManager()
        encryptionService = EncryptionService(keyStoreManager)
    }
    
    @Test
    fun `generateSalt returns 16 bytes`() {
        val salt = encryptionService.generateSalt()
        assertEquals(16, salt.size)
    }
    
    @Test
    fun `generateIV returns 16 bytes`() {
        val iv = encryptionService.generateIV()
        assertEquals(16, iv.size)
    }
    
    @Test
    fun `generated salts are unique`() {
        val salt1 = encryptionService.generateSalt()
        val salt2 = encryptionService.generateSalt()
        assertFalse(salt1.contentEquals(salt2))
    }
    
    @Test
    fun `generated IVs are unique`() {
        val iv1 = encryptionService.generateIV()
        val iv2 = encryptionService.generateIV()
        assertFalse(iv1.contentEquals(iv2))
    }
    
    @Test
    fun `generateSecurePassword meets minimum length`() {
        val password = encryptionService.generateSecurePassword(length = 16)
        assertTrue(password.length >= 16)
    }
    
    @Test
    fun `generateSecurePassword with default settings is strong`() {
        val password = encryptionService.generateSecurePassword()
        val result = encryptionService.validatePasswordStrength(password)
        assertTrue(result.score >= 4)
    }
    
    @Test
    fun `generateSecurePassword throws for length less than 12`() {
        assertThrows(IllegalArgumentException::class.java) {
            encryptionService.generateSecurePassword(length = 8)
        }
    }
    
    @Test
    fun `validatePasswordStrength detects weak password`() {
        val result = encryptionService.validatePasswordStrength("weak")
        assertEquals(PasswordStrength.VERY_WEAK, result.strength)
    }
    
    @Test
    fun `validatePasswordStrength detects common patterns`() {
        val result = encryptionService.validatePasswordStrength("password123")
        assertEquals(PasswordStrength.VERY_WEAK, result.strength)
        assertTrue(result.issues.any { it.contains("common pattern", ignoreCase = true) })
    }
    
    @Test
    fun `validatePasswordStrength detects repeated characters`() {
        val result = encryptionService.validatePasswordStrength("aaaaaaaaaaaa")
        assertTrue(result.issues.any { it.contains("repeated", ignoreCase = true) })
    }
    
    @Test
    fun `validatePasswordStrength accepts strong password`() {
        val result = encryptionService.validatePasswordStrength("Str0ng!P@ssw0rd#2024")
        assertTrue(result.score >= 4)
        assertTrue(result.strength == PasswordStrength.STRONG || result.strength == PasswordStrength.VERY_STRONG)
    }
    
    @Test
    fun `validatePasswordStrength requires minimum 12 characters`() {
        val result = encryptionService.validatePasswordStrength("Short1!")
        assertTrue(result.issues.any { it.contains("12 characters", ignoreCase = true) })
    }
    
    @Test
    fun `secureClear zeros byte array`() {
        val data = ByteArray(16) { it.toByte() }
        encryptionService.secureClear(data)
        assertTrue(data.all { it == 0.toByte() })
    }
}
