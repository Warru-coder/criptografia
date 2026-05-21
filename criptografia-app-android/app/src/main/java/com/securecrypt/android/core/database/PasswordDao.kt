package com.securecrypt.android.core.database

import androidx.room.TypeConverter
import com.securecrypt.android.data.model.PasswordEntry
import com.securecrypt.android.data.model.DocumentEntry
import com.securecrypt.android.data.model.NoteEntry
import kotlinx.coroutines.flow.Flow

@androidx.room.Dao
interface PasswordDao {
    
    @androidx.room.Query("SELECT * FROM passwords ORDER BY title ASC")
    fun getAllPasswords(): Flow<List<PasswordEntry>>
    
    @androidx.room.Query("SELECT * FROM passwords WHERE id = :id")
    suspend fun getPasswordById(id: Long): PasswordEntry?
    
    @androidx.room.Query("SELECT * FROM passwords WHERE title LIKE '%' || :query || '%' OR tags LIKE '%' || :query || '%'")
    fun searchPasswords(query: String): Flow<List<PasswordEntry>>
    
    @androidx.room.Query("SELECT * FROM passwords WHERE isFavorite = 1 ORDER BY title ASC")
    fun getFavoritePasswords(): Flow<List<PasswordEntry>>
    
    @androidx.room.Query("SELECT * FROM passwords WHERE category = :category ORDER BY title ASC")
    fun getPasswordsByCategory(category: String): Flow<List<PasswordEntry>>
    
    @androidx.room.Insert
    suspend fun insertPassword(password: PasswordEntry): Long
    
    @androidx.room.Update
    suspend fun updatePassword(password: PasswordEntry)
    
    @androidx.room.Delete
    suspend fun deletePassword(password: PasswordEntry)
    
    @androidx.room.Query("DELETE FROM passwords WHERE id = :id")
    suspend fun deletePasswordById(id: Long)
    
    @androidx.room.Query("UPDATE passwords SET accessCount = accessCount + 1, lastAccessed = :timestamp WHERE id = :id")
    suspend fun incrementAccessCount(id: Long, timestamp: Long = System.currentTimeMillis())
    
    @androidx.room.Query("UPDATE passwords SET isFavorite = :isFavorite WHERE id = :id")
    suspend fun toggleFavorite(id: Long, isFavorite: Boolean)
    
    @androidx.room.Query("SELECT COUNT(*) FROM passwords")
    fun getPasswordCount(): Flow<Int>
    
    @androidx.room.Query("DELETE FROM passwords")
    suspend fun deleteAllPasswords()
}
