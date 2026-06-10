package com.securecrypt.android.data.repository

import com.securecrypt.android.core.database.PasswordDao
import com.securecrypt.android.core.database.DocumentDao
import com.securecrypt.android.core.database.NoteDao
import com.securecrypt.android.core.security.EncryptionService
import com.securecrypt.android.core.security.AndroidKeyStoreManager
import com.securecrypt.android.data.model.PasswordEntry
import com.securecrypt.android.data.model.DocumentEntry
import com.securecrypt.android.data.model.NoteEntry
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PasswordRepository @Inject constructor(
    private val passwordDao: PasswordDao,
    private val encryptionService: EncryptionService,
    private val keyStoreManager: AndroidKeyStoreManager
) {
    
    fun getAllPasswords(): Flow<List<DecryptedPassword>> {
        return passwordDao.getAllPasswords().map { entries ->
            entries.mapNotNull { decryptPassword(it) }
        }
    }
    
    fun searchPasswords(query: String): Flow<List<DecryptedPassword>> {
        return passwordDao.searchPasswords(query).map { entries ->
            entries.mapNotNull { decryptPassword(it) }
        }
    }
    
    fun getFavoritePasswords(): Flow<List<DecryptedPassword>> {
        return passwordDao.getFavoritePasswords().map { entries ->
            entries.mapNotNull { decryptPassword(it) }
        }
    }
    
    suspend fun getPasswordById(id: Long): DecryptedPassword? {
        val entry = passwordDao.getPasswordById(id)
        return entry?.let { decryptPassword(it) }
    }
    
    suspend fun savePassword(
        title: String,
        username: String,
        password: String,
        url: String = "",
        notes: String = "",
        category: String = "",
        tags: String = ""
    ): Result<Long> {
        return try {
            val keyAlias = AndroidKeyStoreManager.DATA_KEY_ALIAS
            val (cipher, iv) = keyStoreManager.getCipherForEncryption(keyAlias)
            
            val encryptedUsername = cipher.doFinal(username.toByteArray(Charsets.UTF_8))
            val encryptedPassword = cipher.doFinal(password.toByteArray(Charsets.UTF_8))
            val encryptedUrl = if (url.isNotEmpty()) cipher.doFinal(url.toByteArray(Charsets.UTF_8)) else ByteArray(0)
            val encryptedNotes = if (notes.isNotEmpty()) cipher.doFinal(notes.toByteArray(Charsets.UTF_8)) else ByteArray(0)
            
            val entry = PasswordEntry(
                title = title,
                encryptedUsername = encryptedUsername,
                encryptedPassword = encryptedPassword,
                encryptedUrl = encryptedUrl,
                encryptedNotes = encryptedNotes,
                category = category,
                iv = iv,
                tags = tags
            )
            
            val id = passwordDao.insertPassword(entry)
            Result.success(id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updatePassword(
        id: Long,
        title: String,
        username: String,
        password: String,
        url: String = "",
        notes: String = "",
        category: String = "",
        tags: String = ""
    ): Result<Unit> {
        return try {
            val keyAlias = AndroidKeyStoreManager.DATA_KEY_ALIAS
            val (cipher, iv) = keyStoreManager.getCipherForEncryption(keyAlias)
            
            val encryptedUsername = cipher.doFinal(username.toByteArray(Charsets.UTF_8))
            val encryptedPassword = cipher.doFinal(password.toByteArray(Charsets.UTF_8))
            val encryptedUrl = if (url.isNotEmpty()) cipher.doFinal(url.toByteArray(Charsets.UTF_8)) else ByteArray(0)
            val encryptedNotes = if (notes.isNotEmpty()) cipher.doFinal(notes.toByteArray(Charsets.UTF_8)) else ByteArray(0)
            
            val entry = PasswordEntry(
                id = id,
                title = title,
                encryptedUsername = encryptedUsername,
                encryptedPassword = encryptedPassword,
                encryptedUrl = encryptedUrl,
                encryptedNotes = encryptedNotes,
                category = category,
                iv = iv,
                updatedAt = System.currentTimeMillis(),
                tags = tags
            )
            
            passwordDao.updatePassword(entry)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun deletePassword(id: Long): Result<Unit> {
        return try {
            passwordDao.deletePasswordById(id)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun toggleFavorite(id: Long, isFavorite: Boolean): Result<Unit> {
        return try {
            passwordDao.toggleFavorite(id, isFavorite)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun incrementAccessCount(id: Long): Result<Unit> {
        return try {
            passwordDao.incrementAccessCount(id)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun deleteAll(): Result<Unit> {
        return try {
            passwordDao.deleteAllPasswords()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun getPasswordCount(): Flow<Int> {
        return passwordDao.getPasswordCount()
    }
    
    private fun decryptPassword(entry: PasswordEntry): DecryptedPassword? {
        return try {
            val keyAlias = AndroidKeyStoreManager.DATA_KEY_ALIAS
            val cipher = keyStoreManager.getCipherForDecryption(keyAlias, entry.iv)
            
            val username = String(cipher.doFinal(entry.encryptedUsername), Charsets.UTF_8)
            
            val cipher2 = keyStoreManager.getCipherForDecryption(keyAlias, entry.iv)
            val password = String(cipher2.doFinal(entry.encryptedPassword), Charsets.UTF_8)
            
            val url = if (entry.encryptedUrl.isNotEmpty()) {
                val cipher3 = keyStoreManager.getCipherForDecryption(keyAlias, entry.iv)
                String(cipher3.doFinal(entry.encryptedUrl), Charsets.UTF_8)
            } else ""
            
            val notes = if (entry.encryptedNotes.isNotEmpty()) {
                val cipher4 = keyStoreManager.getCipherForDecryption(keyAlias, entry.iv)
                String(cipher4.doFinal(entry.encryptedNotes), Charsets.UTF_8)
            } else ""
            
            DecryptedPassword(
                id = entry.id,
                title = entry.title,
                username = username,
                password = password,
                url = url,
                notes = notes,
                category = entry.category,
                createdAt = entry.createdAt,
                updatedAt = entry.updatedAt,
                lastAccessed = entry.lastAccessed,
                accessCount = entry.accessCount,
                isFavorite = entry.isFavorite,
                tags = entry.tags
            )
        } catch (e: Exception) {
            null
        }
    }
}

data class DecryptedPassword(
    val id: Long,
    val title: String,
    val username: String,
    val password: String,
    val url: String,
    val notes: String,
    val category: String,
    val createdAt: Long,
    val updatedAt: Long,
    val lastAccessed: Long,
    val accessCount: Int,
    val isFavorite: Boolean,
    val tags: String
)
