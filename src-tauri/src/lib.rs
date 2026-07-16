mod engine;

use std::sync::Mutex;

use tauri::{Manager, State};

use engine::{
    session, AppError, AppState, ConnectResult, ConnectionDraft, ConnectionTestResult,
    DatabaseObjectDetails, DatabaseTreeNode, QueryExecution, Session,
};

// Service name under which connection passwords are stored in the OS keychain
// (Windows Credential Manager / macOS Keychain / Linux Secret Service). Entries
// are keyed by the frontend's connection key as the account.
const KEYCHAIN_SERVICE: &str = "dev.databara.app";

#[tauri::command]
async fn test_postgres_connection(
    draft: ConnectionDraft,
) -> Result<ConnectionTestResult, AppError> {
    engine::test(draft).await
}

#[tauri::command]
async fn connect_postgres(
    state: State<'_, Mutex<AppState>>,
    draft: ConnectionDraft,
) -> Result<ConnectResult, AppError> {
    let (handle, profile) = engine::connect(draft).await?;
    let tree = handle.list_tree(&profile).await?;
    let id = profile.id.clone();

    {
        let mut guard = state.lock().map_err(|_| AppError::StateLock)?;
        guard.sessions.insert(
            id,
            Session {
                profile: profile.clone(),
                handle,
            },
        );
    }

    Ok(ConnectResult {
        connection: profile,
        tree,
        selected_object_id: None,
        selected_object: None,
    })
}

// Persists a connection password in the OS keychain so the connection can be
// reconnected on startup without prompting (opt-in "keep connections active").
#[tauri::command]
fn store_connection_password(account: String, password: String) -> Result<(), AppError> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &account)
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    entry
        .set_password(&password)
        .map_err(|e| AppError::Keychain(e.to_string()))
}

// Returns the stored password for a connection, or None when nothing is saved.
#[tauri::command]
fn get_connection_password(account: String) -> Result<Option<String>, AppError> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &account)
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Keychain(e.to_string())),
    }
}

// Removes a connection's stored password (on disable or connection deletion).
#[tauri::command]
fn delete_connection_password(account: String) -> Result<(), AppError> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &account)
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::Keychain(e.to_string())),
    }
}

#[tauri::command]
async fn list_postgres_tree(
    state: State<'_, Mutex<AppState>>,
    connection_id: String,
) -> Result<Vec<DatabaseTreeNode>, AppError> {
    let (handle, profile) = session(&state, &connection_id)?;
    handle.list_tree(&profile).await
}

#[tauri::command]
async fn get_postgres_object_details(
    state: State<'_, Mutex<AppState>>,
    connection_id: String,
    object_id: String,
) -> Result<DatabaseObjectDetails, AppError> {
    let (handle, _) = session(&state, &connection_id)?;
    handle.object_details(&object_id).await
}

#[tauri::command]
async fn run_postgres_query(
    state: State<'_, Mutex<AppState>>,
    connection_id: String,
    sql: String,
) -> Result<QueryExecution, AppError> {
    let (handle, _) = session(&state, &connection_id)?;
    handle.run_query(&sql).await
}

#[tauri::command]
fn set_unsaved_sql_tabs(
    state: State<'_, Mutex<AppState>>,
    has_unsaved: bool,
) -> Result<(), AppError> {
    let mut guard = state.lock().map_err(|_| AppError::StateLock)?;
    guard.has_unsaved_sql_tabs = has_unsaved;
    Ok(())
}

#[tauri::command]
fn close_main_window_after_unsaved_resolution(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AppState>>,
) -> Result<(), AppError> {
    {
        let mut guard = state.lock().map_err(|_| AppError::StateLock)?;
        guard.has_unsaved_sql_tabs = false;
        guard.allow_next_close = true;
    }

    let window = app
        .get_webview_window("main")
        .ok_or(AppError::MainWindowNotFound)?;
    window
        .close()
        .map_err(|error| AppError::Connection(error.to_string()))
}

/// Whether this installation can apply an in-app update.
/// On Linux the updater can only replace an AppImage (which sets the `APPIMAGE`
/// env var); `.deb`/`.rpm` installs live in root-owned system paths and can't be
/// updated in place. macOS and Windows always support it.
#[tauri::command]
fn updates_supported() -> bool {
    #[cfg(target_os = "linux")]
    {
        std::env::var_os("APPIMAGE").is_some()
    }
    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}

/// Finish the startup sequence: close the splash window and reveal the main
/// window. The main window starts hidden (`visible: false` in tauri.conf.json)
/// so the frontend can do its slow startup work (reconnecting saved databases,
/// checking for updates) behind the splash, then call this once it is ready —
/// so the main window appears already fully populated.
#[tauri::command]
fn complete_startup(app: tauri::AppHandle) {
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
}

/// Writes UTF-8 text to a user-chosen path. The frontend picks the path via the
/// native save dialog (tauri-plugin-dialog) and passes it here so result exports
/// land wherever the user wants, using std::fs directly (no fs-plugin scope needed).
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), AppError> {
    std::fs::write(&path, content).map_err(|e| AppError::Connection(e.to_string()))
}

/// Reads UTF-8 text from a user-chosen path. The frontend picks the path via the
/// native open dialog (tauri-plugin-dialog) and passes it here so a configuration
/// file can be loaded, using std::fs directly (no fs-plugin scope needed).
#[tauri::command]
fn read_text_file(path: String) -> Result<String, AppError> {
    std::fs::read_to_string(&path).map_err(|e| AppError::Connection(e.to_string()))
}

#[tauri::command]
async fn backup_database(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AppState>>,
    connection_id: String,
    directory: String,
    file_name: String,
) -> Result<String, AppError> {
    let (handle, profile) = session(&state, &connection_id)?;
    handle.backup(&app, &profile, &directory, &file_name).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(AppState::default()))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let should_prompt = window
                    .state::<Mutex<AppState>>()
                    .lock()
                    .map(|mut guard| {
                        if guard.allow_next_close {
                            guard.allow_next_close = false;
                            false
                        } else {
                            guard.has_unsaved_sql_tabs
                        }
                    })
                    .unwrap_or(false);

                if should_prompt {
                    api.prevent_close();
                    if let Some(webview_window) = window.get_webview_window(window.label()) {
                        let _ = webview_window.eval(
                            "window.dispatchEvent(new CustomEvent('databara-unsaved-tabs-close-requested'));",
                        );
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            test_postgres_connection,
            connect_postgres,
            store_connection_password,
            get_connection_password,
            delete_connection_password,
            list_postgres_tree,
            get_postgres_object_details,
            run_postgres_query,
            set_unsaved_sql_tabs,
            close_main_window_after_unsaved_resolution,
            updates_supported,
            complete_startup,
            write_text_file,
            read_text_file,
            backup_database
        ])
        .run(tauri::generate_context!())
        .expect("error while running Databara");
}
