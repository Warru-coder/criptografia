package com.securecrypt.android.di

import android.content.Context
import com.securecrypt.android.core.database.DocumentDao
import com.securecrypt.android.core.database.NoteDao
import com.securecrypt.android.core.database.PasswordDao
import com.securecrypt.android.core.database.SecureCryptDatabase
import com.securecrypt.android.core.security.AndroidKeyStoreManager
import com.securecrypt.android.core.security.BiometricAuthManager
import com.securecrypt.android.core.security.EncryptionService
import com.securecrypt.android.core.security.SecureStorageManager
import com.securecrypt.android.data.repository.DocumentRepository
import com.securecrypt.android.data.repository.NoteRepository
import com.securecrypt.android.data.repository.PasswordRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    
    @Provides
    @Singleton
    fun provideAndroidKeyStoreManager(): AndroidKeyStoreManager {
        return AndroidKeyStoreManager()
    }
    
    @Provides
    @Singleton
    fun provideEncryptionService(
        keyStoreManager: AndroidKeyStoreManager
    ): EncryptionService {
        return EncryptionService(keyStoreManager)
    }
    
    @Provides
    @Singleton
    fun provideSecureStorageManager(
        @ApplicationContext context: Context
    ): SecureStorageManager {
        return SecureStorageManager(context)
    }
    
    @Provides
    @Singleton
    fun provideBiometricAuthManager(
        @ApplicationContext context: Context
    ): BiometricAuthManager {
        return BiometricAuthManager(context)
    }
    
    @Provides
    @Singleton
    fun provideDatabase(
        @ApplicationContext context: Context,
        secureStorageManager: SecureStorageManager
    ): SecureCryptDatabase {
        val passphrase = secureStorageManager.getMasterPasswordHash()
            ?: ByteArray(64) { 0 }
        
        return SecureCryptDatabase.getInstance(context, passphrase)
    }
    
    @Provides
    @Singleton
    fun providePasswordDao(database: SecureCryptDatabase): PasswordDao {
        return database.passwordDao()
    }
    
    @Provides
    @Singleton
    fun provideDocumentDao(database: SecureCryptDatabase): DocumentDao {
        return database.documentDao()
    }
    
    @Provides
    @Singleton
    fun provideNoteDao(database: SecureCryptDatabase): NoteDao {
        return database.noteDao()
    }
    
    @Provides
    @Singleton
    fun providePasswordRepository(
        passwordDao: PasswordDao,
        encryptionService: EncryptionService,
        keyStoreManager: AndroidKeyStoreManager
    ): PasswordRepository {
        return PasswordRepository(passwordDao, encryptionService, keyStoreManager)
    }
    
    @Provides
    @Singleton
    fun provideDocumentRepository(
        documentDao: DocumentDao,
        encryptionService: EncryptionService
    ): DocumentRepository {
        return DocumentRepository(documentDao, encryptionService)
    }
    
    @Provides
    @Singleton
    fun provideNoteRepository(
        noteDao: NoteDao,
        encryptionService: EncryptionService,
        keyStoreManager: AndroidKeyStoreManager
    ): NoteRepository {
        return NoteRepository(noteDao, encryptionService, keyStoreManager)
    }
}
