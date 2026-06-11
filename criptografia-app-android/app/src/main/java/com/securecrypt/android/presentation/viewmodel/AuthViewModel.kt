package com.securecrypt.android.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.securecrypt.android.core.security.BiometricAuthManager
import com.securecrypt.android.core.security.EncryptionService
import com.securecrypt.android.core.security.PasswordValidationResult
import com.securecrypt.android.core.security.PasswordStrength
import com.securecrypt.android.core.security.SecureStorageManager
import com.securecrypt.android.data.repository.DecryptedPassword
import com.securecrypt.android.data.repository.PasswordRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val secureStorageManager: SecureStorageManager,
    private val encryptionService: EncryptionService,
    private val biometricAuthManager: BiometricAuthManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()
    
    fun checkSetupStatus() {
        viewModelScope.launch {
            val isSetupComplete = secureStorageManager.isSetupComplete()
            _uiState.update { it.copy(isSetupComplete = isSetupComplete) }
        }
    }
    
    fun validateMasterPassword(password: String): PasswordValidationResult {
        return encryptionService.validatePasswordStrength(password)
    }
    
    fun setupMasterPassword(password: CharArray, confirmPassword: CharArray) {
        viewModelScope.launch {
            if (!password.contentEquals(confirmPassword)) {
                _uiState.update { it.copy(error = "Passwords do not match") }
                return@launch
            }
            
            val validation = encryptionService.validatePasswordStrength(password.concatToString())
            if (validation.strength != PasswordStrength.STRONG && validation.strength != PasswordStrength.VERY_STRONG) {
                _uiState.update { it.copy(error = "Password is too weak. ${validation.issues.joinToString(", ")}") }
                return@launch
            }
            
            try {
                val salt = encryptionService.generateSalt()
                val hash = encryptionService.deriveKeyFromPassword(password, salt)
                secureStorageManager.storeMasterPasswordSalt(salt)
                secureStorageManager.storeMasterPasswordHash(hash)
                secureStorageManager.setSetupComplete(true)
                secureStorageManager.recordUnlockTime()
                
                encryptionService.secureClear(password, confirmPassword, hash)
                
                _uiState.update { it.copy(isSetupComplete = true, error = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = "Failed to setup: ${e.message}") }
            }
        }
    }
    
    fun authenticateWithPassword(password: CharArray) {
        viewModelScope.launch {
            if (secureStorageManager.isLockedOut()) {
                val remaining = secureStorageManager.getLockoutRemainingMs()
                _uiState.update { it.copy(error = "Too many failed attempts. Try again in ${remaining / 1000}s") }
                return@launch
            }
            
            try {
                val storedHash = secureStorageManager.getMasterPasswordHash()
                    ?: throw IllegalStateException("No master password set")
                val storedSalt = secureStorageManager.getMasterPasswordSalt()
                    ?: throw IllegalStateException("No master password salt set")

                val inputHash = encryptionService.deriveKeyFromPassword(password, storedSalt)

                val isValid = java.security.MessageDigest.isEqual(storedHash, inputHash)
                
                encryptionService.secureClear(password, inputHash, storedHash)
                
                if (isValid) {
                    secureStorageManager.resetFailedAttempts()
                    secureStorageManager.recordUnlockTime()
                    _uiState.update { it.copy(isAuthenticated = true, error = null) }
                } else {
                    val isLockedOut = secureStorageManager.recordFailedAttempt()
                    val attempts = secureStorageManager.getFailedAttempts()
                    
                    if (isLockedOut) {
                        _uiState.update { it.copy(error = "Too many failed attempts. Locked for 30 seconds.") }
                    } else {
                        _uiState.update { it.copy(error = "Incorrect password. $attempts attempts remaining.") }
                    }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = "Authentication failed: ${e.message}") }
            }
        }
    }
    
    fun lockApp() {
        _uiState.update { it.copy(isAuthenticated = false) }
    }
    
    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
    
    fun isBiometricAvailable(): Boolean {
        return biometricAuthManager.isBiometricAvailable()
    }
}

data class AuthUiState(
    val isSetupComplete: Boolean = false,
    val isAuthenticated: Boolean = false,
    val error: String? = null,
    val isLoading: Boolean = false
)
