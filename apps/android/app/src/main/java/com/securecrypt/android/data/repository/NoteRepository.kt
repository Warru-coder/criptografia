package com.securecrypt.android.data.repository

import com.securecrypt.android.core.database.NoteDao
import com.securecrypt.android.core.security.AndroidKeyStoreManager
import com.securecrypt.android.core.security.EncryptionService
import com.securecrypt.android.data.model.NoteEntry
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NoteRepository @Inject constructor(
    private val noteDao: NoteDao,
    private val encryptionService: EncryptionService,
    private val keyStoreManager: AndroidKeyStoreManager
) {
    
    fun getAllNotes(): Flow<List<DecryptedNote>> {
        return noteDao.getAllNotes().map { entries ->
            entries.mapNotNull { decryptNote(it) }
        }
    }
    
    fun searchNotes(query: String): Flow<List<DecryptedNote>> {
        return noteDao.searchNotes(query).map { entries ->
            entries.mapNotNull { decryptNote(it) }
        }
    }
    
    fun getFavoriteNotes(): Flow<List<DecryptedNote>> {
        return noteDao.getFavoriteNotes().map { entries ->
            entries.mapNotNull { decryptNote(it) }
        }
    }
    
    suspend fun getNoteById(id: Long): DecryptedNote? {
        val entry = noteDao.getNoteById(id)
        return entry?.let { decryptNote(it) }
    }
    
    suspend fun saveNote(
        title: String,
        content: String,
        tags: String = ""
    ): Result<Long> {
        return try {
            val keyAlias = AndroidKeyStoreManager.DATA_KEY_ALIAS
            val (cipher, iv) = keyStoreManager.getCipherForEncryption(keyAlias)
            
            val encryptedContent = cipher.doFinal(content.toByteArray(Charsets.UTF_8))
            
            val entry = NoteEntry(
                title = title,
                encryptedContent = encryptedContent,
                iv = iv,
                tags = tags
            )
            
            val id = noteDao.insertNote(entry)
            Result.success(id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateNote(
        id: Long,
        title: String,
        content: String,
        tags: String = ""
    ): Result<Unit> {
        return try {
            val keyAlias = AndroidKeyStoreManager.DATA_KEY_ALIAS
            val (cipher, iv) = keyStoreManager.getCipherForEncryption(keyAlias)
            
            val encryptedContent = cipher.doFinal(content.toByteArray(Charsets.UTF_8))
            
            val entry = NoteEntry(
                id = id,
                title = title,
                encryptedContent = encryptedContent,
                iv = iv,
                updatedAt = System.currentTimeMillis(),
                tags = tags
            )
            
            noteDao.updateNote(entry)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun deleteNote(id: Long): Result<Unit> {
        return try {
            noteDao.deleteNoteById(id)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun toggleFavorite(id: Long, isFavorite: Boolean): Result<Unit> {
        return try {
            noteDao.toggleFavorite(id, isFavorite)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun deleteAll(): Result<Unit> {
        return try {
            noteDao.deleteAllNotes()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun getNoteCount(): Flow<Int> {
        return noteDao.getNoteCount()
    }
    
    private fun decryptNote(entry: NoteEntry): DecryptedNote? {
        return try {
            val keyAlias = AndroidKeyStoreManager.DATA_KEY_ALIAS
            val cipher = keyStoreManager.getCipherForDecryption(keyAlias, entry.iv)
            
            val content = String(cipher.doFinal(entry.encryptedContent), Charsets.UTF_8)
            
            DecryptedNote(
                id = entry.id,
                title = entry.title,
                content = content,
                createdAt = entry.createdAt,
                updatedAt = entry.updatedAt,
                isFavorite = entry.isFavorite,
                tags = entry.tags
            )
        } catch (e: Exception) {
            null
        }
    }
}

data class DecryptedNote(
    val id: Long,
    val title: String,
    val content: String,
    val createdAt: Long,
    val updatedAt: Long,
    val isFavorite: Boolean,
    val tags: String
)
