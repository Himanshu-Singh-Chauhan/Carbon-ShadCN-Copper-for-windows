mod double_shortcut;
mod link_preview;

use serde_json::Value;
use std::{
    collections::{HashSet, VecDeque},
    fs,
    path::{Component, Path, PathBuf},
    sync::Mutex,
    thread,
    time::Duration,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, State,
};

const DATA_FILE_NAME: &str = "carbon-data.json";
const LOCATION_FILE_NAME: &str = "data-location.txt";
#[cfg(debug_assertions)]
const DEVELOPMENT_DIRECTORY_NAME: &str = "development";

#[derive(Default)]
struct PendingCaptureNotifications(Mutex<VecDeque<Value>>);

#[derive(Default)]
struct PendingImageViewer(Mutex<Option<Value>>);

fn io_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn environment_data_dir(path: PathBuf) -> PathBuf {
    #[cfg(debug_assertions)]
    {
        return path.join(DEVELOPMENT_DIRECTORY_NAME);
    }

    #[cfg(not(debug_assertions))]
    path
}

fn location_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(environment_data_dir)
        .map(|path| path.join(LOCATION_FILE_NAME))
        .map_err(io_error)
}

fn default_data_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(environment_data_dir)
        .map(|path| path.join(DATA_FILE_NAME))
        .map_err(io_error)
}

fn resolve_data_path(app: &AppHandle) -> Result<PathBuf, String> {
    let pointer = location_file_path(app)?;
    if let Ok(value) = fs::read_to_string(pointer) {
        let path = PathBuf::from(value.trim());
        if path.is_absolute() {
            return Ok(path);
        }
    }
    default_data_path(app)
}

fn write_document(path: &Path, document: &Value) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "The selected data path has no parent folder.".to_string())?;
    fs::create_dir_all(parent).map_err(io_error)?;
    let contents = serde_json::to_string_pretty(document).map_err(io_error)?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, format!("{contents}\n")).map_err(io_error)?;
    if path.exists() {
        fs::remove_file(path).map_err(io_error)?;
    }
    fs::rename(temporary, path).map_err(io_error)
}

fn assets_directory(data_path: &Path) -> Result<PathBuf, String> {
    data_path
        .parent()
        .map(|parent| parent.join("assets"))
        .ok_or_else(|| "The data path has no parent folder.".to_string())
}

fn validated_asset_path(data_path: &Path, relative: &str) -> Result<PathBuf, String> {
    let mut components = Path::new(relative).components();
    let valid = matches!(components.next(), Some(Component::Normal(value)) if value == "assets")
        && matches!(components.next(), Some(Component::Normal(_)))
        && components.next().is_none();
    if !valid {
        return Err("Invalid image asset path.".to_string());
    }
    Ok(data_path
        .parent()
        .ok_or_else(|| "The data path has no parent folder.".to_string())?
        .join(relative))
}

fn copy_assets(source_data: &Path, destination_data: &Path) -> Result<(), String> {
    let source = assets_directory(source_data)?;
    let destination = assets_directory(destination_data)?;
    if !source.exists() || source == destination {
        return Ok(());
    }
    fs::create_dir_all(&destination).map_err(io_error)?;
    for entry in fs::read_dir(source).map_err(io_error)? {
        let entry = entry.map_err(io_error)?;
        if entry.file_type().map_err(io_error)?.is_file() {
            fs::copy(entry.path(), destination.join(entry.file_name())).map_err(io_error)?;
        }
    }
    Ok(())
}

fn referenced_assets(document: &Value) -> HashSet<String> {
    document
        .get("sections")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|section| section.get("items").and_then(Value::as_array))
        .flatten()
        .filter_map(|item| item.get("attachments").and_then(Value::as_array))
        .flatten()
        .filter_map(|attachment| attachment.get("path").and_then(Value::as_str))
        .filter(|path| validated_asset_path(Path::new("carbon-data.json"), path).is_ok())
        .map(ToOwned::to_owned)
        .collect()
}

fn remove_unreferenced_assets(data_path: &Path, document: &Value) -> Result<(), String> {
    let directory = assets_directory(data_path)?;
    if !directory.exists() {
        return Ok(());
    }
    let referenced = referenced_assets(document);
    for entry in fs::read_dir(directory).map_err(io_error)? {
        let entry = entry.map_err(io_error)?;
        if !entry.file_type().map_err(io_error)?.is_file() {
            continue;
        }
        let relative = format!("assets/{}", entry.file_name().to_string_lossy());
        if !referenced.contains(&relative) {
            trash::delete(entry.path()).map_err(io_error)?;
        }
    }
    Ok(())
}

#[tauri::command]
fn load_carbon_data(app: AppHandle) -> Result<Value, String> {
    let path = resolve_data_path(&app)?;
    if !path.exists() {
        return Ok(Value::Null);
    }
    let contents = fs::read_to_string(path).map_err(io_error)?;
    serde_json::from_str(&contents).map_err(io_error)
}

#[tauri::command]
fn save_carbon_data(app: AppHandle, document: Value) -> Result<(), String> {
    let path = resolve_data_path(&app)?;
    write_document(&path, &document)?;
    remove_unreferenced_assets(&path, &document)
}

#[tauri::command]
fn get_data_file_path(app: AppHandle) -> Result<String, String> {
    resolve_data_path(&app).map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "The main window is unavailable.".to_string())?;
    window.unminimize().map_err(io_error)?;
    window.show().map_err(io_error)?;
    window.set_focus().map_err(io_error)
}

#[tauri::command]
fn choose_data_file(app: AppHandle, document: Value) -> Result<Option<String>, String> {
    let current = resolve_data_path(&app)?;
    let mut dialog = rfd::FileDialog::new()
        .add_filter("Carbon data", &["json"])
        .set_file_name(DATA_FILE_NAME);
    if let Some(parent) = current.parent() {
        dialog = dialog.set_directory(parent);
    }
    let Some(mut selected) = dialog.save_file() else {
        return Ok(None);
    };
    if selected.extension().is_none() {
        selected.set_extension("json");
    }
    copy_assets(&current, &selected)?;
    link_preview::copy_cache(&current, &selected)?;
    write_document(&selected, &document)?;
    remove_unreferenced_assets(&selected, &document)?;
    let pointer = location_file_path(&app)?;
    if let Some(parent) = pointer.parent() {
        fs::create_dir_all(parent).map_err(io_error)?;
    }
    fs::write(&pointer, selected.to_string_lossy().as_bytes()).map_err(io_error)?;
    Ok(Some(selected.to_string_lossy().into_owned()))
}

#[tauri::command]
fn save_image_asset(
    app: AppHandle,
    id: String,
    mime_type: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    if id.is_empty()
        || !id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-_".contains(character))
    {
        return Err("Invalid image identifier.".to_string());
    }
    if bytes.is_empty() || bytes.len() > 25 * 1024 * 1024 {
        return Err("Images must be between 1 byte and 25 MB.".to_string());
    }
    let extension = match mime_type.as_str() {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "image/bmp" => "bmp",
        _ => return Err("This image format is not supported.".to_string()),
    };
    let relative = format!("assets/{id}.{extension}");
    let path = validated_asset_path(&resolve_data_path(&app)?, &relative)?;
    let parent = path
        .parent()
        .ok_or_else(|| "The asset path has no parent folder.".to_string())?;
    fs::create_dir_all(parent).map_err(io_error)?;
    let temporary = path.with_extension(format!("{extension}.tmp"));
    fs::write(&temporary, bytes).map_err(io_error)?;
    fs::rename(temporary, path).map_err(io_error)?;
    Ok(relative)
}

#[tauri::command]
fn read_image_asset(app: AppHandle, path: String) -> Result<tauri::ipc::Response, String> {
    let path = validated_asset_path(&resolve_data_path(&app)?, &path)?;
    let bytes = fs::read(path).map_err(io_error)?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
async fn copy_image_asset(app: AppHandle, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use tauri_plugin_clipboard_manager::ClipboardExt;

        let path = validated_asset_path(&resolve_data_path(&app)?, &path)?;
        let decoded = image::open(path).map_err(io_error)?.into_rgba8();
        let (width, height) = decoded.dimensions();
        let image = tauri::image::Image::new_owned(decoded.into_raw(), width, height);
        app.clipboard().write_image(&image).map_err(io_error)
    })
    .await
    .map_err(io_error)?
}

#[tauri::command]
async fn copy_items_to_clipboard_history(
    app: AppHandle,
    image_paths: Vec<String>,
    texts: Vec<String>,
) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use tauri_plugin_clipboard_manager::ClipboardExt;

        // Windows records clipboard history asynchronously. Fast consecutive
        // writes are coalesced, so leave enough time for each entry to be
        // committed before replacing the active clipboard content.
        const CLIPBOARD_HISTORY_SETTLE_TIME: Duration = Duration::from_millis(700);
        const MAX_ENTRIES: usize = 200;

        let entry_count = image_paths.len() + texts.len();
        if entry_count == 0 {
            return Ok(0);
        }
        if entry_count > MAX_ENTRIES {
            return Err(format!(
                "A maximum of {MAX_ENTRIES} clipboard entries can be copied at once."
            ));
        }

        let data_path = resolve_data_path(&app)?;
        for relative_path in image_paths {
            let path = validated_asset_path(&data_path, &relative_path)?;
            let decoded = image::open(path).map_err(io_error)?.into_rgba8();
            let (width, height) = decoded.dimensions();
            let image = tauri::image::Image::new_owned(decoded.into_raw(), width, height);
            app.clipboard().write_image(&image).map_err(io_error)?;
            thread::sleep(CLIPBOARD_HISTORY_SETTLE_TIME);
        }

        for text in texts {
            if text.is_empty() {
                continue;
            }
            app.clipboard().write_text(text).map_err(io_error)?;
            thread::sleep(CLIPBOARD_HISTORY_SETTLE_TIME);
        }

        Ok(entry_count)
    })
    .await
    .map_err(io_error)?
}

#[tauri::command]
fn trash_image_asset(
    app: AppHandle,
    item_id: String,
    attachment_id: String,
    path: String,
) -> Result<(), String> {
    let path = validated_asset_path(&resolve_data_path(&app)?, &path)?;
    if !path.exists() {
        return Err("The image file no longer exists.".to_string());
    }
    trash::delete(path).map_err(io_error)?;
    app.emit_to(
        "main",
        "image-viewer-attachment-trashed",
        serde_json::json!({
            "itemId": item_id,
            "attachmentId": attachment_id,
        }),
    )
    .map_err(io_error)
}

#[tauri::command]
fn reveal_data_file(app: AppHandle) -> Result<(), String> {
    let path = resolve_data_path(&app)?;
    if !path.exists() {
        return Err("The data file will be created after your first note.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg("/select,")
            .arg(path)
            .spawn()
            .map_err(io_error)?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(io_error)?;
    }

    #[cfg(target_os = "linux")]
    {
        let parent = path
            .parent()
            .ok_or_else(|| "The data path has no parent folder.".to_string())?;
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(io_error)?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn focused_native_window() -> Result<windows::Win32::Foundation::HWND, String> {
    use std::mem::size_of;
    use windows::Win32::{
        Foundation::HWND,
        UI::WindowsAndMessaging::{
            GetForegroundWindow, GetGUIThreadInfo, GetWindowThreadProcessId, GUITHREADINFO,
        },
    };

    unsafe {
        let foreground = GetForegroundWindow();
        if foreground == HWND::default() {
            return Err("Windows did not report a foreground window.".to_string());
        }
        let thread_id = GetWindowThreadProcessId(foreground, None);
        if thread_id == 0 {
            return Ok(foreground);
        }
        let mut thread_info = GUITHREADINFO {
            cbSize: size_of::<GUITHREADINFO>() as u32,
            ..Default::default()
        };
        if GetGUIThreadInfo(thread_id, &mut thread_info).is_ok()
            && thread_info.hwndFocus != HWND::default()
        {
            Ok(thread_info.hwndFocus)
        } else {
            Ok(foreground)
        }
    }
}

#[cfg(target_os = "windows")]
fn native_window_class(window: windows::Win32::Foundation::HWND) -> String {
    use windows::Win32::UI::WindowsAndMessaging::GetClassNameW;

    let mut class_name = [0u16; 128];
    let length = unsafe { GetClassNameW(window, &mut class_name) };
    (length > 0)
        .then(|| String::from_utf16_lossy(&class_name[..length as usize]))
        .unwrap_or_default()
}

#[cfg(target_os = "windows")]
fn capture_win32_edit_selection() -> Result<Option<String>, String> {
    use std::ffi::c_void;
    use windows::{
        core::w,
        Win32::{
            Foundation::{HWND, LPARAM, WPARAM},
            UI::WindowsAndMessaging::{
                FindWindowExW, GetWindowLongPtrW, SendMessageTimeoutW, ES_PASSWORD, GWL_STYLE,
                SMTO_ABORTIFHUNG, SMTO_BLOCK, WM_GETTEXT, WM_GETTEXTLENGTH,
            },
        },
    };

    const EM_GETSEL: u32 = 0x00B0;
    const MAX_EDIT_CHARACTERS: usize = 16 * 1024 * 1024;

    unsafe fn message(
        window: HWND,
        message: u32,
        wparam: usize,
        lparam: isize,
    ) -> Result<usize, String> {
        let mut result = 0usize;
        let sent = SendMessageTimeoutW(
            window,
            message,
            WPARAM(wparam),
            LPARAM(lparam),
            SMTO_ABORTIFHUNG | SMTO_BLOCK,
            700,
            Some(&mut result),
        );
        (sent.0 != 0).then_some(result).ok_or_else(|| {
            "The Win32 edit control did not answer the selection request.".to_string()
        })
    }

    unsafe {
        let mut editor = focused_native_window()?;
        let mut class_name = native_window_class(editor);
        if class_name.eq_ignore_ascii_case("ComboBox") {
            if let Ok(child) = FindWindowExW(Some(editor), None, w!("Edit"), None) {
                editor = child;
                class_name = native_window_class(editor);
            }
        }

        let lower_class = class_name.to_ascii_lowercase();
        if lower_class != "edit" && !lower_class.starts_with("richedit") {
            return Ok(None);
        }
        if GetWindowLongPtrW(editor, GWL_STYLE) & ES_PASSWORD as isize != 0 {
            return Err("Carbon will not capture text from a password field.".to_string());
        }

        let mut selection_start = 0u32;
        let mut selection_end = 0u32;
        message(
            editor,
            EM_GETSEL,
            (&mut selection_start as *mut u32) as usize,
            (&mut selection_end as *mut u32) as isize,
        )?;
        if selection_start == selection_end {
            return Ok(None);
        }

        let text_length = message(editor, WM_GETTEXTLENGTH, 0, 0)?;
        if text_length == 0 || text_length > MAX_EDIT_CHARACTERS {
            return Ok(None);
        }
        let mut buffer = vec![0u16; text_length + 1];
        let copied = message(
            editor,
            WM_GETTEXT,
            buffer.len(),
            buffer.as_mut_ptr().cast::<c_void>() as isize,
        )?;
        buffer.truncate(copied.min(text_length));

        let start = selection_start as usize;
        let end = selection_end as usize;
        if start >= end || end > buffer.len() {
            return Ok(None);
        }
        Ok(Some(String::from_utf16_lossy(&buffer[start..end])))
    }
}

#[cfg(target_os = "windows")]
fn capture_scintilla_selection() -> Result<Option<String>, String> {
    use std::{ffi::c_void, ptr::null};
    use windows::Win32::{
        Foundation::{CloseHandle, HWND, LPARAM, WPARAM},
        System::{
            Diagnostics::Debug::ReadProcessMemory,
            Memory::{
                VirtualAllocEx, VirtualFreeEx, MEM_COMMIT, MEM_RELEASE, MEM_RESERVE, PAGE_READWRITE,
            },
            Threading::{OpenProcess, PROCESS_VM_OPERATION, PROCESS_VM_READ},
        },
        UI::WindowsAndMessaging::{
            GetWindowThreadProcessId, SendMessageTimeoutW, SMTO_ABORTIFHUNG, SMTO_BLOCK,
        },
    };

    const SCI_GETSELTEXT: u32 = 2161;
    const MAX_CAPTURE_BYTES: usize = 16 * 1024 * 1024;

    unsafe fn scintilla_message(
        window: HWND,
        message: u32,
        remote_buffer: *const c_void,
    ) -> Result<usize, String> {
        let mut result = 0usize;
        let sent = SendMessageTimeoutW(
            window,
            message,
            WPARAM(0),
            LPARAM(remote_buffer as isize),
            SMTO_ABORTIFHUNG | SMTO_BLOCK,
            700,
            Some(&mut result),
        );
        if sent.0 == 0 {
            Err("The Scintilla editor did not answer the selection request.".to_string())
        } else {
            Ok(result)
        }
    }

    unsafe {
        let editor = focused_native_window()?;
        let mut process_id = 0u32;
        if !native_window_class(editor).eq_ignore_ascii_case("Scintilla") {
            return Ok(None);
        }

        GetWindowThreadProcessId(editor, Some(&mut process_id));
        let selection_bytes = scintilla_message(editor, SCI_GETSELTEXT, null())?;
        if selection_bytes == 0 {
            return Ok(None);
        }
        let byte_length = selection_bytes
            .checked_add(1)
            .ok_or_else(|| "The Scintilla selection size overflowed.".to_string())?;
        if byte_length > MAX_CAPTURE_BYTES {
            return Err("The selected Scintilla text is too large to capture safely.".to_string());
        }

        let process = OpenProcess(PROCESS_VM_OPERATION | PROCESS_VM_READ, false, process_id)
            .map_err(io_error)?;
        let remote_buffer = VirtualAllocEx(
            process,
            None,
            byte_length,
            MEM_COMMIT | MEM_RESERVE,
            PAGE_READWRITE,
        );
        if remote_buffer.is_null() {
            let _ = CloseHandle(process);
            return Err("Could not allocate the Scintilla selection buffer.".to_string());
        }

        let capture_result = (|| {
            scintilla_message(editor, SCI_GETSELTEXT, remote_buffer)?;
            let mut bytes = vec![0u8; byte_length];
            let mut bytes_read = 0usize;
            ReadProcessMemory(
                process,
                remote_buffer,
                bytes.as_mut_ptr().cast(),
                byte_length,
                Some(&mut bytes_read),
            )
            .map_err(io_error)?;
            bytes.truncate(bytes_read);
            if let Some(nul) = bytes.iter().position(|byte| *byte == 0) {
                bytes.truncate(nul);
            }
            let text = String::from_utf8_lossy(&bytes).into_owned();
            Ok((!text.is_empty()).then_some(text))
        })();

        let _ = VirtualFreeEx(process, remote_buffer, 0, MEM_RELEASE);
        let _ = CloseHandle(process);
        capture_result
    }
}

#[cfg(target_os = "windows")]
fn capture_accessible_selection() -> Result<String, String> {
    use windows::{
        core::Result as WindowsResult,
        Win32::{
            System::Com::{
                CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
                COINIT_MULTITHREADED,
            },
            UI::Accessibility::{
                CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationTextPattern,
                UIA_TextPatternId,
            },
        },
    };

    struct ComApartment;
    impl Drop for ComApartment {
        fn drop(&mut self) {
            unsafe { CoUninitialize() };
        }
    }

    unsafe fn selection_from_element(
        element: &IUIAutomationElement,
    ) -> WindowsResult<Option<String>> {
        let pattern: IUIAutomationTextPattern = element.GetCurrentPatternAs(UIA_TextPatternId)?;
        let ranges = pattern.GetSelection()?;
        let length = ranges.Length()?;
        let mut selections = Vec::new();

        for index in 0..length {
            let text = ranges.GetElement(index)?.GetText(-1)?.to_string();
            if !text.is_empty() {
                selections.push(text);
            }
        }

        Ok((!selections.is_empty()).then(|| selections.join("\n")))
    }

    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED)
            .ok()
            .map_err(io_error)?;
        let _apartment = ComApartment;
        let automation: IUIAutomation =
            CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER).map_err(io_error)?;
        let walker = automation.RawViewWalker().map_err(io_error)?;
        // Providers can briefly rebuild their accessibility tree while a
        // shortcut is handled. Retry against a fresh focused element rather
        // than surfacing a transient error to the user.
        for attempt in 0..5 {
            if let Ok(mut element) = automation.GetFocusedElement() {
                // The focused leaf in browsers and document editors is not
                // always the element that owns TextPattern.
                for _ in 0..16 {
                    if let Ok(Some(text)) = selection_from_element(&element) {
                        return Ok(text);
                    }
                    match walker.GetParentElement(&element) {
                        Ok(parent) => element = parent,
                        Err(_) => break,
                    }
                }
            }
            if attempt < 4 {
                std::thread::sleep(std::time::Duration::from_millis(30));
            }
        }
    }

    if let Some(text) = capture_scintilla_selection()? {
        return Ok(text);
    }
    if let Some(text) = capture_win32_edit_selection()? {
        return Ok(text);
    }

    Err(
        "The focused app does not expose its selected text through Windows UI Automation."
            .to_string(),
    )
}

#[tauri::command]
fn capture_selected_text() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // Use a dedicated COM apartment so capture works consistently regardless
        // of which Tauri IPC worker receives the command.
        return std::thread::spawn(capture_accessible_selection)
            .join()
            .map_err(|_| "Windows UI Automation capture stopped unexpectedly.".to_string())?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Selection capture is currently implemented for Windows.".to_string())
    }
}

#[tauri::command]
fn show_capture_notification(
    app: AppHandle,
    pending: State<'_, PendingCaptureNotifications>,
    payload: Value,
) -> Result<(), String> {
    pending.0.lock().map_err(io_error)?.push_back(payload);
    let window = app
        .get_webview_window("capture-toast")
        .ok_or_else(|| "The capture notification window is unavailable.".to_string())?;
    let cursor = app.cursor_position().map_err(io_error)?;
    let monitor = app
        .monitor_from_point(cursor.x, cursor.y)
        .map_err(io_error)?
        .or(app.primary_monitor().map_err(io_error)?)
        .ok_or_else(|| "No active monitor was found.".to_string())?;
    let work_area = monitor.work_area();
    window
        .set_size(LogicalSize::new(360.0, 520.0))
        .map_err(io_error)?;
    let window_size = window.outer_size().map_err(io_error)?;
    let x = work_area.position.x
        + ((work_area.size.width as i64 - window_size.width as i64) / 2) as i32;
    let y = work_area.position.y + work_area.size.height as i32 - window_size.height as i32 - 28;

    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(io_error)?;
    let _ = window.set_ignore_cursor_events(false);
    let _ = window.set_focusable(false);
    window.show().map_err(io_error)?;
    app.emit_to("capture-toast", "capture-notification-ready", ())
        .map_err(io_error)
}

#[tauri::command]
fn take_capture_notifications(
    pending: State<'_, PendingCaptureNotifications>,
) -> Result<Vec<Value>, String> {
    Ok(pending.0.lock().map_err(io_error)?.drain(..).collect())
}

#[tauri::command]
fn show_image_viewer(
    app: AppHandle,
    pending: State<'_, PendingImageViewer>,
    payload: Value,
) -> Result<(), String> {
    *pending.0.lock().map_err(io_error)? = Some(payload);
    let window = app
        .get_webview_window("image-viewer")
        .ok_or_else(|| "The image viewer window is unavailable.".to_string())?;
    let _ = window.unminimize();
    window.show().map_err(io_error)?;
    window.set_focus().map_err(io_error)?;
    app.emit_to("image-viewer", "image-viewer-ready", ())
        .map_err(io_error)
}

#[tauri::command]
fn take_image_viewer_payload(
    pending: State<'_, PendingImageViewer>,
) -> Result<Option<Value>, String> {
    Ok(pending.0.lock().map_err(io_error)?.take())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PendingCaptureNotifications::default())
        .manage(PendingImageViewer::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::default().build())
        .setup(|app| {
            double_shortcut::start(app.handle().clone());
            let show = MenuItem::with_id(app, "show", "Show Carbon", true, None::<&str>)?;
            let always_on_top = MenuItem::with_id(
                app,
                "always-on-top",
                "Toggle Always on Top",
                true,
                None::<&str>,
            )?;
            let quit = MenuItem::with_id(app, "quit", "Quit Carbon", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &always_on_top, &quit])?;

            let mut tray = TrayIconBuilder::new()
                .tooltip("Carbon — capture what matters")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_window(app),
                    "always-on-top" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if let Ok(current) = window.is_always_on_top() {
                                let _ = window.set_always_on_top(!current);
                                let _ = app.emit("always-on-top-changed", !current);
                            }
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_window(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_carbon_data,
            save_carbon_data,
            get_data_file_path,
            show_main_window,
            double_shortcut::configure_double_press_shortcuts,
            choose_data_file,
            reveal_data_file,
            save_image_asset,
            read_image_asset,
            copy_image_asset,
            copy_items_to_clipboard_history,
            link_preview::get_link_preview,
            link_preview::read_link_preview_image,
            trash_image_asset,
            capture_selected_text,
            show_capture_notification,
            take_capture_notifications,
            show_image_viewer,
            take_image_viewer_payload,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running Carbon");
}
