#pragma once

#include "../data/model/Models.h"
#include <vector>
#include <optional>

namespace securecrypt::repository {

class NoteRepository {
public:
    static NoteRepository& GetInstance();
    
    bool Initialize();
    
    std::vector<data::DecryptedNote> GetAllNotes();
    
    std::vector<data::DecryptedNote> SearchNotes(const std::wstring& query);
    
    std::vector<data::DecryptedNote> GetFavoriteNotes();
    
    std::optional<data::DecryptedNote> GetNoteById(int id);
    
    bool SaveNote(const std::wstring& title, const std::wstring& content,
                 const std::wstring& tags = L"");
    
    bool UpdateNote(int id, const std::wstring& title, const std::wstring& content,
                   const std::wstring& tags = L"");
    
    bool DeleteNote(int id);
    
    bool ToggleFavorite(int id, bool isFavorite);
    
    bool DeleteAll();
    
    int GetCount();

private:
    NoteRepository();
    ~NoteRepository();
    
    data::DecryptedNote DecryptEntry(const data::NoteEntry& entry);
    data::NoteEntry EncryptEntry(const data::DecryptedNote& entry);
};

}
