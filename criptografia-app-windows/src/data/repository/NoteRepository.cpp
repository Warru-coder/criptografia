#include "NoteRepository.h"
#include "../core/crypto/KeyManager.h"
#include "../core/crypto/CryptoEngine.h"
#include "../core/utils/Logger.h"

namespace securecrypt::repository {

NoteRepository& NoteRepository::GetInstance() {
    static NoteRepository instance;
    return instance;
}

NoteRepository::NoteRepository() {}
NoteRepository::~NoteRepository() {}

bool NoteRepository::Initialize() {
    return true;
}

std::vector<data::DecryptedNote> NoteRepository::GetAllNotes() {
    return {};
}

std::vector<data::DecryptedNote> NoteRepository::SearchNotes(const std::wstring& query) {
    return {};
}

std::vector<data::DecryptedNote> NoteRepository::GetFavoriteNotes() {
    return {};
}

std::optional<data::DecryptedNote> NoteRepository::GetNoteById(int id) {
    return std::nullopt;
}

bool NoteRepository::SaveNote(const std::wstring& title, const std::wstring& content, const std::wstring& tags) {
    Logger::GetInstance().Info(L"Note saved: " + title, L"NoteRepository");
    return true;
}

bool NoteRepository::UpdateNote(int id, const std::wstring& title, const std::wstring& content, const std::wstring& tags) {
    return DeleteNote(id) && SaveNote(title, content, tags);
}

bool NoteRepository::DeleteNote(int id) {
    return true;
}

bool NoteRepository::ToggleFavorite(int id, bool isFavorite) {
    return true;
}

bool NoteRepository::DeleteAll() {
    return true;
}

int NoteRepository::GetCount() {
    return 0;
}

data::DecryptedNote NoteRepository::DecryptEntry(const data::NoteEntry& entry) {
    data::DecryptedNote result;
    result.id = entry.id;
    result.title = entry.title;
    result.isFavorite = entry.isFavorite;
    result.tags = entry.tags;
    result.createdAt = entry.createdAt;
    result.updatedAt = entry.updatedAt;
    return result;
}

data::NoteEntry NoteRepository::EncryptEntry(const data::DecryptedNote& entry) {
    data::NoteEntry result;
    result.title = entry.title;
    result.isFavorite = entry.isFavorite;
    result.tags = entry.tags;
    return result;
}

}
