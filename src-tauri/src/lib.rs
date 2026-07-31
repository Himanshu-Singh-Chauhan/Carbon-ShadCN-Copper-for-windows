use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition,
};

const DATA_FILE_NAME: &str = "carbon-data.json";
const LOCATION_FILE_NAME: &str = "data-location.txt";

fn io_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn location_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|path| path.join(LOCATION_FILE_NAME))
        .map_err(io_error)
}

fn default_data_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
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
    write_document(&resolve_data_path(&app)?, &document)
}

#[tauri::command]
fn get_data_file_path(app: AppHandle) -> Result<String, String> {
    resolve_data_path(&app).map(|path| path.to_string_lossy().into_owned())
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
    write_document(&selected, &document)?;
    let pointer = location_file_path(&app)?;
    if let Some(parent) = pointer.parent() {
        fs::create_dir_all(parent).map_err(io_error)?;
    }
    fs::write(&pointer, selected.to_string_lossy().as_bytes()).map_err(io_error)?;
    Ok(Some(selected.to_string_lossy().into_owned()))
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
fn capture_scintilla_selection() -> Result<Option<String>, String> {
    use std::{ffi::c_void, mem::size_of, ptr::null};
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
            GetClassNameW, GetForegroundWindow, GetGUIThreadInfo, GetWindowThreadProcessId,
            SendMessageTimeoutW, GUITHREADINFO, SMTO_ABORTIFHUNG, SMTO_BLOCK,
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
        let foreground = GetForegroundWindow();
        if foreground == HWND::default() {
            return Ok(None);
        }

        let mut process_id = 0u32;
        let thread_id = GetWindowThreadProcessId(foreground, Some(&mut process_id));
        if thread_id == 0 {
            return Ok(None);
        }

        let mut thread_info = GUITHREADINFO {
            cbSize: size_of::<GUITHREADINFO>() as u32,
            ..Default::default()
        };
        GetGUIThreadInfo(thread_id, &mut thread_info).map_err(io_error)?;
        let editor = if thread_info.hwndFocus != HWND::default() {
            thread_info.hwndFocus
        } else {
            foreground
        };

        let mut class_name = [0u16; 128];
        let class_length = GetClassNameW(editor, &mut class_name);
        if class_length <= 0
            || !String::from_utf16_lossy(&class_name[..class_length as usize])
                .eq_ignore_ascii_case("Scintilla")
        {
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
fn show_capture_notification(app: AppHandle, message: String) -> Result<(), String> {
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
    let window_size = window.outer_size().map_err(io_error)?;
    let x = work_area.position.x
        + ((work_area.size.width as i64 - window_size.width as i64) / 2) as i32;
    let y = work_area.position.y + work_area.size.height as i32 - window_size.height as i32 - 28;

    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(io_error)?;
    let _ = window.set_ignore_cursor_events(true);
    let _ = window.set_focusable(false);
    window.show().map_err(io_error)?;
    app.emit_to("capture-toast", "capture-notification", message)
        .map_err(io_error)
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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::default().build())
        .setup(|app| {
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
            choose_data_file,
            reveal_data_file,
            capture_selected_text,
            show_capture_notification,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running Carbon");
}
