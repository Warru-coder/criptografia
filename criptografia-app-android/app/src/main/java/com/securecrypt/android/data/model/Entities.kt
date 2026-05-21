package com.securecrypt.android.data.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize
import androidx.room.Entity
import androidx.room.PrimaryKey

@Parcelize
@Entity(tableName = "passwords")
data class PasswordEntry(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    
    val title: String,
    
    val encryptedUsername: ByteArray,
    
    val encryptedPassword: ByteArray,
    
    val encryptedUrl: ByteArray = ByteArray(0),
    
    val encryptedNotes: ByteArray = ByteArray(0),
    
    val category: String = "",
    
    val iv: ByteArray,
    
    val createdAt: Long = System.currentTimeMillis(),
    
    val updatedAt: Long = System.currentTimeMillis(),
    
    val lastAccessed: Long = 0,
    
    val accessCount: Int = 0,
    
    val isFavorite: Boolean = false,
    
    val tags: String = ""
) : Parcelable {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as PasswordEntry
        if (id != other.id) return false
        if (title != other.title) return false
        if (!encryptedUsername.contentEquals(other.encryptedUsername)) return false
        if (!encryptedPassword.contentEquals(other.encryptedPassword)) return false
        if (!encryptedUrl.contentEquals(other.encryptedUrl)) return false
        if (!encryptedNotes.contentEquals(other.encryptedNotes)) return false
        if (category != other.category) return false
        if (!iv.contentEquals(other.iv)) return false
        if (createdAt != other.createdAt) return false
        if (updatedAt != other.updatedAt) return false
        if (lastAccessed != other.lastAccessed) return false
        if (accessCount != other.accessCount) return false
        if (isFavorite != other.isFavorite) return false
        if (tags != other.tags) return false
        return true
    }
    
    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + title.hashCode()
        result = 31 * result + encryptedUsername.contentHashCode()
        result = 31 * result + encryptedPassword.contentHashCode()
        result = 31 * result + encryptedUrl.contentHashCode()
        result = 31 * result + encryptedNotes.contentHashCode()
        result = 31 * result + category.hashCode()
        result = 31 * result + iv.contentHashCode()
        result = 31 * result + createdAt.hashCode()
        result = 31 * result + updatedAt.hashCode()
        result = 31 * result + lastAccessed.hashCode()
        result = 31 * result + accessCount
        result = 31 * result + isFavorite.hashCode()
        result = 31 * result + tags.hashCode()
        return result
    }
}

@Parcelize
@Entity(tableName = "documents")
data class DocumentEntry(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    
    val title: String,
    
    val originalFileName: String,
    
    val encryptedFilePath: String,
    
    val mimeType: String,
    
    val fileSize: Long,
    
    val iv: ByteArray,
    
    val hmac: ByteArray,
    
    val createdAt: Long = System.currentTimeMillis(),
    
    val lastAccessed: Long = 0,
    
    val accessCount: Int = 0,
    
    val isFavorite: Boolean = false,
    
    val tags: String = "",
    
    val thumbnailPath: String? = null
) : Parcelable {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as DocumentEntry
        if (id != other.id) return false
        if (title != other.title) return false
        if (originalFileName != other.originalFileName) return false
        if (encryptedFilePath != other.encryptedFilePath) return false
        if (mimeType != other.mimeType) return false
        if (fileSize != other.fileSize) return false
        if (!iv.contentEquals(other.iv)) return false
        if (!hmac.contentEquals(other.hmac)) return false
        if (createdAt != other.createdAt) return false
        if (lastAccessed != other.lastAccessed) return false
        if (accessCount != other.accessCount) return false
        if (isFavorite != other.isFavorite) return false
        if (tags != other.tags) return false
        if (thumbnailPath != other.thumbnailPath) return false
        return true
    }
    
    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + title.hashCode()
        result = 31 * result + originalFileName.hashCode()
        result = 31 * result + encryptedFilePath.hashCode()
        result = 31 * result + mimeType.hashCode()
        result = 31 * result + fileSize.hashCode()
        result = 31 * result + iv.contentHashCode()
        result = 31 * result + hmac.contentHashCode()
        result = 31 * result + createdAt.hashCode()
        result = 31 * result + lastAccessed.hashCode()
        result = 31 * result + accessCount
        result = 31 * result + isFavorite.hashCode()
        result = 31 * result + tags.hashCode()
        result = 31 * result + (thumbnailPath?.hashCode() ?: 0)
        return result
    }
}

@Parcelize
@Entity(tableName = "notes")
data class NoteEntry(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    
    val title: String,
    
    val encryptedContent: ByteArray,
    
    val iv: ByteArray,
    
    val createdAt: Long = System.currentTimeMillis(),
    
    val updatedAt: Long = System.currentTimeMillis(),
    
    val isFavorite: Boolean = false,
    
    val tags: String = ""
) : Parcelable {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as NoteEntry
        if (id != other.id) return false
        if (title != other.title) return false
        if (!encryptedContent.contentEquals(other.encryptedContent)) return false
        if (!iv.contentEquals(other.iv)) return false
        if (createdAt != other.createdAt) return false
        if (updatedAt != other.updatedAt) return false
        if (isFavorite != other.isFavorite) return false
        if (tags != other.tags) return false
        return true
    }
    
    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + title.hashCode()
        result = 31 * result + encryptedContent.contentHashCode()
        result = 31 * result + iv.contentHashCode()
        result = 31 * result + createdAt.hashCode()
        result = 31 * result + updatedAt.hashCode()
        result = 31 * result + isFavorite.hashCode()
        result = 31 * result + tags.hashCode()
        return result
    }
}
