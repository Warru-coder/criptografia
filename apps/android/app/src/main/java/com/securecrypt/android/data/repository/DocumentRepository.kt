package com.securecrypt.android.data.repository

import com.securecrypt.android.core.database.DocumentDao
import com.securecrypt.android.core.security.EncryptionService
import com.securecrypt.android.data.model.DocumentEntry
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DocumentRepository @Inject constructor(
    private val documentDao: DocumentDao,
    private val encryptionService: EncryptionService
) {
    
    companion object {
        private const val ENCRYPTED_DIR = "encrypted_documents"
    }
    
    fun getAllDocuments(): Flow<List<DocumentEntry>> {
        return documentDao.getAllDocuments()
    }
    
    fun searchDocuments(query: String): Flow<List<DocumentEntry>> {
        return documentDao.searchDocuments(query)
    }
    
    fun getFavoriteDocuments(): Flow<List<DocumentEntry>> {
        return documentDao.getFavoriteDocuments()
    }
    
    suspend fun getDocumentById(id: Long): DocumentEntry? {
        return documentDao.getDocumentById(id)
    }
    
    suspend fun importDocument(
        title: String,
        sourceFile: File,
        masterPassword: CharArray,
        tags: String = ""
    ): Result<Long> {
        return try {
            val encryptedDir = File(sourceFile.context?.filesDir, ENCRYPTED_DIR)
            if (!encryptedDir.exists()) {
                encryptedDir.mkdirs()
            }
            
            val encryptedFileName = "${System.currentTimeMillis()}_${sourceFile.name}.scrypt"
            val encryptedFile = File(encryptedDir, encryptedFileName)
            
            val result = encryptionService.encryptFile(
                sourceFile.absolutePath,
                encryptedFile.absolutePath,
                masterPassword
            )
            
            if (!result.success) {
                return Result.failure(Exception("Encryption failed"))
            }
            
            val entry = DocumentEntry(
                title = title,
                originalFileName = sourceFile.name,
                encryptedFilePath = encryptedFile.absolutePath,
                mimeType = sourceFile.getMimeType(),
                fileSize = sourceFile.length(),
                iv = encryptionService.generateIV(),
                hmac = result.hmac,
                tags = tags
            )
            
            val id = documentDao.insertDocument(entry)
            
            sourceFile.delete()
            
            Result.success(id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun exportDocument(
        documentId: Long,
        outputDir: File,
        masterPassword: CharArray
    ): Result<File> {
        return try {
            val document = documentDao.getDocumentById(documentId)
                ?: return Result.failure(Exception("Document not found"))
            
            val outputFile = File(outputDir, document.originalFileName)
            
            val result = encryptionService.decryptFile(
                document.encryptedFilePath,
                outputFile.absolutePath,
                masterPassword
            )
            
            if (!result.success) {
                outputFile.delete()
                return Result.failure(Exception(result.error ?: "Decryption failed"))
            }
            
            documentDao.incrementAccessCount(documentId)
            
            Result.success(outputFile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun deleteDocument(id: Long): Result<Unit> {
        return try {
            val document = documentDao.getDocumentById(id)
            if (document != null) {
                File(document.encryptedFilePath).delete()
                document.thumbnailPath?.let { File(it).delete() }
            }
            documentDao.deleteDocumentById(id)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun toggleFavorite(id: Long, isFavorite: Boolean): Result<Unit> {
        return try {
            documentDao.toggleFavorite(id, isFavorite)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun deleteAll(): Result<Unit> {
        return try {
            val documents = documentDao.getAllDocuments()
            documents.collect { entries ->
                entries.forEach { doc ->
                    File(doc.encryptedFilePath).delete()
                    doc.thumbnailPath?.let { File(it).delete() }
                }
            }
            documentDao.deleteAllDocuments()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun getDocumentCount(): Flow<Int> {
        return documentDao.getDocumentCount()
    }
    
    fun getTotalStorageUsed(): Flow<Long?> {
        return documentDao.getTotalStorageUsed()
    }
    
    private fun File.getMimeType(): String {
        return android.webkit.MimeTypeMap.getSingleton()
            .getMimeTypeFromExtension(extension) ?: "application/octet-stream"
    }
}
