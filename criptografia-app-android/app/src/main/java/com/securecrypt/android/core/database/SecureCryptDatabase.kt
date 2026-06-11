package com.securecrypt.android.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import androidx.sqlite.db.SupportSQLiteDatabase
import com.securecrypt.android.data.model.PasswordEntry
import com.securecrypt.android.data.model.DocumentEntry
import com.securecrypt.android.data.model.NoteEntry
import net.sqlcipher.database.SupportFactory

@Database(
    entities = [PasswordEntry::class, DocumentEntry::class, NoteEntry::class],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class SecureCryptDatabase : RoomDatabase() {
    
    abstract fun passwordDao(): PasswordDao
    abstract fun documentDao(): DocumentDao
    abstract fun noteDao(): NoteDao
    
    companion object {
        private const val DATABASE_NAME = "securecrypt.db"
        
        @Volatile
        private var INSTANCE: SecureCryptDatabase? = null
        
        fun getInstance(context: Context, passphrase: ByteArray): SecureCryptDatabase {
            return INSTANCE ?: synchronized(this) {
                val factory = SupportFactory(passphrase)
                
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    SecureCryptDatabase::class.java,
                    DATABASE_NAME
                )
                    .openHelperFactory(factory)
                    .fallbackToDestructiveMigration()
                    .addCallback(object : Callback() {
                        override fun onCreate(db: SupportSQLiteDatabase) {
                            super.onCreate(db)
                            db.execSQL("PRAGMA journal_mode=WAL")
                            db.execSQL("PRAGMA secure_delete=ON")
                        }
                    })
                    .build()
                
                INSTANCE = instance
                instance
            }
        }
        
        fun destroyInstance() {
            INSTANCE?.close()
            INSTANCE = null
        }
    }
}
