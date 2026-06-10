package com.securecrypt.android.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.securecrypt.android.core.security.EncryptionService
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
class PasswordViewModel @Inject constructor(
    private val passwordRepository: PasswordRepository,
    private val encryptionService: EncryptionService
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(PasswordUiState())
    val uiState: StateFlow<PasswordUiState> = _uiState.asStateFlow()
    
    init {
        loadPasswords()
    }
    
    fun loadPasswords() {
        viewModelScope.launch {
            passwordRepository.getAllPasswords().collect { passwords ->
                _uiState.update { it.copy(passwords = passwords, isLoading = false) }
            }
        }
    }
    
    fun searchPasswords(query: String) {
        viewModelScope.launch {
            if (query.isBlank()) {
                loadPasswords()
            } else {
                passwordRepository.searchPasswords(query).collect { passwords ->
                    _uiState.update { it.copy(passwords = passwords) }
                }
            }
        }
    }
    
    fun savePassword(
        title: String,
        username: String,
        password: String,
        url: String = "",
        notes: String = "",
        category: String = "",
        tags: String = ""
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            
            val result = passwordRepository.savePassword(
                title = title,
                username = username,
                password = password,
                url = url,
                notes = notes,
                category = category,
                tags = tags
            )
            
            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(isLoading = false, successMessage = "Password saved securely") }
                },
                onFailure = { e ->
                    _uiState.update { it.copy(isLoading = false, errorMessage = "Failed to save: ${e.message}") }
                }
            )
        }
    }
    
    fun deletePassword(id: Long) {
        viewModelScope.launch {
            val result = passwordRepository.deletePassword(id)
            result.fold(
                onSuccess = { },
                onFailure = { e ->
                    _uiState.update { it.copy(errorMessage = "Failed to delete: ${e.message}") }
                }
            )
        }
    }
    
    fun toggleFavorite(id: Long, isFavorite: Boolean) {
        viewModelScope.launch {
            passwordRepository.toggleFavorite(id, isFavorite)
        }
    }
    
    fun generatePassword(
        length: Int = 24,
        includeUppercase: Boolean = true,
        includeLowercase: Boolean = true,
        includeNumbers: Boolean = true,
        includeSymbols: Boolean = true
    ): String {
        return encryptionService.generateSecurePassword(
            length = length,
            includeUppercase = includeUppercase,
            includeLowercase = includeLowercase,
            includeNumbers = includeNumbers,
            includeSymbols = includeSymbols
        )
    }
    
    fun clearMessages() {
        _uiState.update { it.copy(successMessage = null, errorMessage = null) }
    }
}

data class PasswordUiState(
    val passwords: List<DecryptedPassword> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null
)
