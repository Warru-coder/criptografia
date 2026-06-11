#pragma once

#include "../data/model/Models.h"
#include <vector>
#include <optional>

namespace securecrypt::repository {

class DocumentRepository {
public:
    static DocumentRepository& GetInstance();
    
    bool Initialize();
    
    std::vector<data::DocumentEntry> GetAllDocuments();
    
    std::vector<data::DocumentEntry> SearchDocuments(const std::wstring& query);
    
    std::vector<data::DocumentEntry> GetFavoriteDocuments();
    
    std::optional<data::DocumentEntry> GetDocumentById(int id);
    
    bool ImportDocument(const std::wstring& title, const std::wstring& sourcePath,
                       const std::wstring& tags = L"");
    
    bool ExportDocument(int id, const std::wstring& outputPath);
    
    bool DeleteDocument(int id);
    
    bool ToggleFavorite(int id, bool isFavorite);
    
    bool DeleteAll();
    
    int GetCount();
    
    ULONGLONG GetTotalStorageUsed();

private:
    DocumentRepository();
    ~DocumentRepository();
};

}
