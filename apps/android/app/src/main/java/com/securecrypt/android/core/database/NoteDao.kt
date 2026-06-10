package com.securecrypt.android.core.database

import com.securecrypt.android.data.model.NoteEntry
import kotlinx.coroutines.flow.Flow

@androidx.room.Dao
interface NoteDao {
    
    @androidx.room.Query("SELECT * FROM notes ORDER BY updatedAt DESC")
    fun getAllNotes(): Flow<List<NoteEntry>>
    
    @androidx.room.Query("SELECT * FROM notes WHERE id = :id")
    suspend fun getNoteById(id: Long): NoteEntry?
    
    @androidx.room.Query("SELECT * FROM notes WHERE title LIKE '%' || :query || '%' OR tags LIKE '%' || :query || '%'")
    fun searchNotes(query: String): Flow<List<NoteEntry>>
    
    @androidx.room.Query("SELECT * FROM notes WHERE isFavorite = 1 ORDER BY updatedAt DESC")
    fun getFavoriteNotes(): Flow<List<NoteEntry>>
    
    @androidx.room.Insert
    suspend fun insertNote(note: NoteEntry): Long
    
    @androidx.room.Update
    suspend fun updateNote(note: NoteEntry)
    
    @androidx.room.Delete
    suspend fun deleteNote(note: NoteEntry)
    
    @androidx.room.Query("DELETE FROM notes WHERE id = :id")
    suspend fun deleteNoteById(id: Long)
    
    @androidx.room.Query("UPDATE notes SET isFavorite = :isFavorite WHERE id = :id")
    suspend fun toggleFavorite(id: Long, isFavorite: Boolean)
    
    @androidx.room.Query("SELECT COUNT(*) FROM notes")
    fun getNoteCount(): Flow<Int>
    
    @androidx.room.Query("DELETE FROM notes")
    suspend fun deleteAllNotes()
}
