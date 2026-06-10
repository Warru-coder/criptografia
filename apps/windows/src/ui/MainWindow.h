#pragma once

#include <windows.h>
#include <commctrl.h>
#include <string>
#include <vector>
#include <functional>

namespace securecrypt::ui {

enum class TabIndex {
    Passwords = 0,
    Documents = 1,
    Notes = 2,
    Settings = 3
};

class MainWindow {
public:
    MainWindow();
    ~MainWindow();
    
    bool Create(HINSTANCE hInstance, int nCmdShow);
    
    int Run();
    
    static LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam);
    
    void ShowAuthDialog();
    
    void ShowPasswordDialog(bool isEdit = false, int editId = -1);
    
    void ShowDocumentDialog();
    
    void ShowSettingsDialog();
    
    void LockApp();
    
    bool IsLocked() const;

private:
    HWND m_hWnd;
    HWND m_hTab;
    HWND m_hListView;
    HWND m_hToolBar;
    HWND m_hStatusBar;
    HINSTANCE m_hInstance;
    bool m_isLocked;
    bool m_isInitialized;
    
    std::wstring m_searchText;
    
    bool RegisterWindowClass();
    
    bool CreateMainWindow(int nCmdShow);
    
    bool CreateTabControl();
    
    bool CreateListView();
    
    bool CreateToolBar();
    
    bool CreateStatusBar();
    
    void OnSize(WPARAM wParam, LPARAM lParam);
    
    void OnTabChanged();
    
    void OnSearch();
    
    void OnAdd();
    
    void OnDelete();
    
    void OnEdit();
    
    void OnCopyToClipboard(const std::wstring& text);
    
    void OnToggleFavorite();
    
    void OnRefresh();
    
    void LoadPasswords();
    
    void LoadDocuments();
    
    void LoadNotes();
    
    void UpdateStatusBar(const std::wstring& text);
    
    void ApplyModernTheme();
    
    void EnableDarkTitleBar();
    
    static MainWindow* s_instance;
};

}
