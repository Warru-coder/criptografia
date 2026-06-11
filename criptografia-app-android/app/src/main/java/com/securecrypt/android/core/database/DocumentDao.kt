package com.securecrypt.android.core.database

import com.securecrypt.android.data.model.DocumentEntry
import kotlinx.coroutines.flow.Flow

@androidx.room.Dao
interface DocumentDao {
    
    @androidx.room.Query("SELECT * FROM documents ORDER BY title ASC")
    fun getAllDocuments(): Flow<List<DocumentEntry>>
    
    @androidx.room.Query("SELECT * FROM documents WHERE id = :id")
    suspend fun getDocumentById(id: Long): DocumentEntry?
    
    @androidx.room.Query("SELECT * FROM documents WHERE title LIKE '%' || :query || '%' OR originalFileName LIKE '%' || :query || '%' OR tags LIKE '%' || :query || '%'")
    fun searchDocuments(query: String): Flow<List<DocumentEntry>>
    
    @androidx.room.Query("SELECT * FROM documents WHERE isFavorite = 1 ORDER BY title ASC")
    fun getFavoriteDocuments(): Flow<List<DocumentEntry>>
    
    @androidx.room.Query("SELECT * FROM documents WHERE mimeType LIKE :mimeTypePattern ORDER BY title ASC")
    fun getDocumentsByType(mimeTypePattern: String): Flow<List<DocumentEntry>>
    
    @androidx.room.Insert
    suspend fun insertDocument(document: DocumentEntry): Long
    
    @androidx.room.Update
    suspend fun updateDocument(document: DocumentEntry)
    
    @androidx.room.Delete
    suspend fun deleteDocument(document: DocumentEntry)
    
    @androidx.room.Query("DELETE FROM documents WHERE id = :id")
    suspend fun deleteDocumentById(id: Long)
    
    @androidx.room.Query("UPDATE documents SET accessCount = accessCount + 1, lastAccessed = :timestamp WHERE id = :id")
    suspend fun incrementAccessCount(id: Long, timestamp: Long = System.currentTimeMillis())
    
    @androidx.room.Query("UPDATE documents SET isFavorite = :isFavorite WHERE id = :id")
    suspend fun toggleFavorite(id: Long, isFavorite: Boolean)
    
    @androidx.room.Query("SELECT COUNT(*) FROM documents")
    fun getDocumentCount(): Flow<Int>
    
    @androidx.room.Query("SELECT SUM(fileSize) FROM documents")
    fun getTotalStorageUsed(): Flow<Long?>
    
    @androidx.room.Query("DELETE FROM documents")
    suspend fun deleteAllDocuments()
}
