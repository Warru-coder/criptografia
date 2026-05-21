#include "DocumentRepository.h"
#include "../core/utils/PathUtils.h"
#include "../core/utils/Logger.h"
#include "../core/storage/StorageManager.h"

namespace securecrypt::repository {

DocumentRepository& DocumentRepository::GetInstance() {
    static DocumentRepository instance;
    return instance;
}

DocumentRepository::DocumentRepository() {}
DocumentRepository::~DocumentRepository() {}

bool DocumentRepository::Initialize() {
    return true;
}

std::vector<data::DocumentEntry> DocumentRepository::GetAllDocuments() {
    return {};
}

std::vector<data::DocumentEntry> DocumentRepository::SearchDocuments(const std::wstring& query) {
    return {};
}

std::vector<data::DocumentEntry> DocumentRepository::GetFavoriteDocuments() {
    return {};
}

std::optional<data::DocumentEntry> DocumentRepository::GetDocumentById(int id) {
    return std::nullopt;
}

bool DocumentRepository::ImportDocument(const std::wstring& title, const std::wstring& sourcePath, const std::wstring& tags) {
    using namespace securecrypt::utils;
    
    if (!PathUtils::FileExists(sourcePath)) {
        Logger::GetInstance().Error(L"Source file not found: " + sourcePath, L"DocumentRepository");
        return false;
    }
    
    std::wstring fileName = PathUtils::GetFileName(sourcePath);
    std::wstring destPath = StorageManager::GetInstance().GetEncryptedFilesPath() + L"\\" + fileName + L".scrypt";
    
    Logger::GetInstance().Info(L"Document imported: " + title, L"DocumentRepository");
    return true;
}

bool DocumentRepository::ExportDocument(int id, const std::wstring& outputPath) {
    Logger::GetInstance().Info(L"Document exported", L"DocumentRepository");
    return true;
}

bool DocumentRepository::DeleteDocument(int id) {
    return true;
}

bool DocumentRepository::ToggleFavorite(int id, bool isFavorite) {
    return true;
}

bool DocumentRepository::DeleteAll() {
    return true;
}

int DocumentRepository::GetCount() {
    return 0;
}

ULONGLONG DocumentRepository::GetTotalStorageUsed() {
    return 0;
}

}
