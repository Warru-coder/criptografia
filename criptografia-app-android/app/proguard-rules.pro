# SecureCrypt ProGuard Rules

# Keep data classes
-keep class com.securecrypt.android.data.model.** { *; }

# Keep Room entities
-keep class com.securecrypt.android.core.database.** { *; }

# Keep Hilt generated classes
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class javax.annotation.** { *; }

# Keep serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.SerializationKt
-keep,includedescriptorclasses class com.securecrypt.android.**$$serializer { *; }
-keepclassmembers class com.securecrypt.android.** {
    *** Companion;
}
-keepclasseswithmembers class com.securecrypt.android.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# SQLCipher
-keep class net.sqlcipher.** { *; }
-keep class net.sqlcipher.database.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Remove logging in release
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
