package com.securecrypt.android.core.security

import android.security.keystore.KeyProperties
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import kotlin.experimental.xor

class EncryptionService(
    private val keyStoreManager: AndroidKeyStoreManager
) {
    companion object {
        private const val AES_KEY_SIZE = 32
        private const val GCM_TAG_LENGTH = 128
        private const val IV_SIZE = 16
        private const val SALT_SIZE = 16
        // OWASP recommendation for PBKDF2-HMAC-SHA256 (2023+)
        private const val PBKDF2_ITERATIONS = 600_000
        
        const val FILE_MAGIC = byteArrayOf(0x53, 0x43, 0x52, 0x59, 0x50, 0x54)
        const val FILE_VERSION: Byte = 0x01
    }
    
    private val secureRandom = SecureRandom()
    
    fun encryptData(plaintext: ByteArray, keyAlias: String): EncryptedData {
        val (cipher, iv) = keyStoreManager.getCipherForEncryption(keyAlias)
        
        val ciphertext = cipher.doFinal(plaintext)
        
        secureZeroMemory(plaintext)
        
        return EncryptedData(
            ciphertext = ciphertext,
            iv = iv,
            authTag = ciphertext.takeLast(16).toByteArray(),
            timestamp = System.currentTimeMillis()
        )
    }
    
    fun decryptData(encryptedData: EncryptedData, keyAlias: String): ByteArray {
        val cipher = keyStoreManager.getCipherForDecryption(keyAlias, encryptedData.iv)
        
        val plaintext = cipher.doFinal(encryptedData.ciphertext)
        
        return plaintext
    }
    
    fun encryptFile(inputPath: String, outputPath: String, masterPassword: CharArray): FileEncryptionResult {
        val salt = generateSalt()
        val derivedKey = deriveKeyFromPassword(masterPassword, salt)
        
        try {
            val keySpec = SecretKeySpec(derivedKey, "AES")
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val iv = generateIV()
            val gcmSpec = javax.crypto.spec.GCMParameterSpec(GCM_TAG_LENGTH, iv)
            
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec)
            
            val inputFile = java.io.File(inputPath)
            val outputFile = java.io.File(outputPath)
            
            inputFile.inputStream().use { input ->
                outputFile.outputStream().use { output ->
                    writeHeader(output, salt, iv)
                    
                    val buffer = ByteArray(8192)
                    var bytesRead: Int
                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        val encrypted = cipher.update(buffer, 0, bytesRead)
                        if (encrypted != null) {
                            output.write(encrypted)
                        }
                    }
                    
                    val finalBlock = cipher.doFinal()
                    output.write(finalBlock)
                }
            }
            
            val hmac = computeHMAC(outputFile.readBytes(), derivedKey)
            
            return FileEncryptionResult(
                success = true,
                outputPath = outputPath,
                hmac = hmac,
                originalSize = inputFile.length()
            )
        } finally {
            secureZeroMemory(derivedKey)
            secureZeroCharArray(masterPassword)
        }
    }
    
    fun decryptFile(inputPath: String, outputPath: String, masterPassword: CharArray): FileDecryptionResult {
        val inputFile = java.io.File(inputPath)
        
        try {
            inputFile.inputStream().use { input ->
                val (salt, iv) = readHeader(input)
                val derivedKey = deriveKeyFromPassword(masterPassword, salt)
                
                try {
                    val keySpec = SecretKeySpec(derivedKey, "AES")
                    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                    val gcmSpec = javax.crypto.spec.GCMParameterSpec(GCM_TAG_LENGTH, iv)
                    
                    cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec)
                    
                    val outputFile = java.io.File(outputPath)
                    outputFile.outputStream().use { output ->
                        val buffer = ByteArray(8192)
                        var bytesRead: Int
                        while (input.read(buffer).also { bytesRead = it } != -1) {
                            val decrypted = cipher.update(buffer, 0, bytesRead)
                            if (decrypted != null) {
                                output.write(decrypted)
                            }
                        }
                        
                        val finalBlock = cipher.doFinal()
                        output.write(finalBlock)
                    }
                    
                    return FileDecryptionResult(
                        success = true,
                        outputPath = outputPath,
                        decryptedSize = outputFile.length()
                    )
                } finally {
                    secureZeroMemory(derivedKey)
                }
            }
        } catch (e: javax.crypto.AEADBadTagException) {
            return FileDecryptionResult(
                success = false,
                error = "Integrity check failed - file may be tampered"
            )
        } finally {
            secureZeroCharArray(masterPassword)
        }
    }
    
    fun deriveKeyFromPassword(password: CharArray, salt: ByteArray): ByteArray {
        val spec = javax.crypto.spec.PBEKeySpec(password, salt, PBKDF2_ITERATIONS, AES_KEY_SIZE * 8)
        try {
            val factory = javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            return factory.generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }
    
    fun generateSalt(): ByteArray {
        val salt = ByteArray(SALT_SIZE)
        secureRandom.nextBytes(salt)
        return salt
    }
    
    fun generateIV(): ByteArray {
        val iv = ByteArray(IV_SIZE)
        secureRandom.nextBytes(iv)
        return iv
    }
    
    fun generateSecurePassword(
        length: Int = 24,
        includeUppercase: Boolean = true,
        includeLowercase: Boolean = true,
        includeNumbers: Boolean = true,
        includeSymbols: Boolean = true
    ): String {
        require(length >= 12) { "Password length must be at least 12 characters" }
        
        val charsets = mutableListOf<CharSequence>()
        if (includeUppercase) charsets.add("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        if (includeLowercase) charsets.add("abcdefghijklmnopqrstuvwxyz")
        if (includeNumbers) charsets.add("0123456789")
        if (includeSymbols) charsets.add("!@#$%^&*()_+-=[]{}|;:,.<>?")
        
        require(charsets.isNotEmpty()) { "At least one character set must be included" }
        
        val allChars = charsets.joinToString("")
        val password = CharArray(length)
        
        for (charset in charsets) {
            password[secureRandom.nextInt(length)] = charset[secureRandom.nextInt(charset.length)]
        }
        
        for (i in 0 until length) {
            if (password[i] == '\u0000') {
                password[i] = allChars[secureRandom.nextInt(allChars.length)]
            }
        }
        
        for (i in 0 until length - 1) {
            val j = secureRandom.nextInt(length)
            val temp = password[i]
            password[i] = password[j]
            password[j] = temp
        }
        
        return password.concatToString()
    }
    
    fun validatePasswordStrength(password: String): PasswordValidationResult {
        var score = 0
        val issues = mutableListOf<String>()
        
        if (password.length < 12) {
            issues.add("Password must be at least 12 characters")
        } else if (password.length >= 16) {
            score += 2
        } else {
            score += 1
        }
        
        if (password.any { it.isUpperCase() }) score += 1
        else issues.add("Add uppercase letters")
        
        if (password.any { it.isLowerCase() }) score += 1
        else issues.add("Add lowercase letters")
        
        if (password.any { it.isDigit() }) score += 1
        else issues.add("Add numbers")
        
        if (password.any { !it.isLetterOrDigit() }) score += 1
        else issues.add("Add special characters")
        
        val commonPatterns = listOf("password", "123456", "qwerty", "admin", "letmein", "welcome")
        if (commonPatterns.any { password.contains(it, ignoreCase = true) }) {
            issues.add("Contains common pattern")
            score = 0
        }
        
        if (password.length >= 4) {
            for (i in 0..password.length - 4) {
                val substring = password.substring(i, i + 4)
                if (substring.all { it == substring[0] }) {
                    issues.add("Contains repeated characters")
                    score = maxOf(0, score - 1)
                    break
                }
            }
        }
        
        val strength = when {
            score >= 5 -> PasswordStrength.VERY_STRONG
            score >= 4 -> PasswordStrength.STRONG
            score >= 3 -> PasswordStrength.MEDIUM
            score >= 2 -> PasswordStrength.WEAK
            else -> PasswordStrength.VERY_WEAK
        }
        
        return PasswordValidationResult(strength, score, issues)
    }
    
    private fun writeHeader(output: java.io.OutputStream, salt: ByteArray, iv: ByteArray) {
        output.write(FILE_MAGIC)
        output.write(FILE_VERSION.toInt())
        output.write(salt)
        output.write(iv)
    }
    
    private fun readHeader(input: java.io.InputStream): Pair<ByteArray, ByteArray> {
        val magic = ByteArray(6)
        input.read(magic)
        
        if (!magic.contentEquals(FILE_MAGIC)) {
            throw SecurityException("Invalid file format - not a SecureCrypt file")
        }
        
        val version = input.read()
        if (version != FILE_VERSION.toInt()) {
            throw SecurityException("Unsupported file version: $version")
        }
        
        val salt = ByteArray(SALT_SIZE)
        input.read(salt)
        
        val iv = ByteArray(IV_SIZE)
        input.read(iv)
        
        return Pair(salt, iv)
    }
    
    private fun computeHMAC(data: ByteArray, key: ByteArray): ByteArray {
        val hmacKey = key.copyOf(AES_KEY_SIZE)
        val innerKey = ByteArray(AES_KEY_SIZE) { i -> hmacKey[i] xor 0x36 }
        val outerKey = ByteArray(AES_KEY_SIZE) { i -> hmacKey[i] xor 0x5C }
        
        val innerHash = MessageDigest.getInstance("SHA-256").run {
            update(innerKey)
            digest(data)
        }
        
        val hmac = MessageDigest.getInstance("SHA-256").run {
            update(outerKey)
            digest(innerHash)
        }
        
        secureZeroMemory(hmacKey)
        secureZeroMemory(innerKey)
        secureZeroMemory(outerKey)
        
        return hmac
    }
    
    private fun secureZeroMemory(data: ByteArray) {
        for (i in data.indices) {
            data[i] = 0.toByte()
        }
    }
    
    private fun secureZeroCharArray(data: CharArray) {
        for (i in data.indices) {
            data[i] = '\u0000'
        }
    }
    
    fun secureClear(vararg data: ByteArray) {
        data.forEach { secureZeroMemory(it) }
    }
    
    fun secureClear(vararg data: CharArray) {
        data.forEach { secureZeroCharArray(it) }
    }
}

data class EncryptedData(
    val ciphertext: ByteArray,
    val iv: ByteArray,
    val authTag: ByteArray,
    val timestamp: Long
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as EncryptedData
        return ciphertext.contentEquals(other.ciphertext) &&
                iv.contentEquals(other.iv) &&
                authTag.contentEquals(other.authTag) &&
                timestamp == other.timestamp
    }
    
    override fun hashCode(): Int {
        var result = ciphertext.contentHashCode()
        result = 31 * result + iv.contentHashCode()
        result = 31 * result + authTag.contentHashCode()
        result = 31 * result + timestamp.hashCode()
        return result
    }
}

data class FileEncryptionResult(
    val success: Boolean,
    val outputPath: String,
    val hmac: ByteArray,
    val originalSize: Long
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as FileEncryptionResult
        return success == other.success &&
                outputPath == other.outputPath &&
                hmac.contentEquals(other.hmac) &&
                originalSize == other.originalSize
    }
    
    override fun hashCode(): Int {
        var result = success.hashCode()
        result = 31 * result + outputPath.hashCode()
        result = 31 * result + hmac.contentHashCode()
        result = 31 * result + originalSize.hashCode()
        return result
    }
}

data class FileDecryptionResult(
    val success: Boolean,
    val outputPath: String = "",
    val decryptedSize: Long = 0,
    val error: String? = null
)

enum class PasswordStrength {
    VERY_WEAK, WEAK, MEDIUM, STRONG, VERY_STRONG
}

data class PasswordValidationResult(
    val strength: PasswordStrength,
    val score: Int,
    val issues: List<String>
)
