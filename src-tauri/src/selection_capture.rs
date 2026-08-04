use serde::Serialize;
use tauri::AppHandle;

use crate::{app_source, io_error};

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
            return Ok(Some(String::new()));
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
            Ok(Some(text))
        })();

        let _ = VirtualFreeEx(process, remote_buffer, 0, MEM_RELEASE);
        let _ = CloseHandle(process);
        capture_result
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CapturedContent {
    text: String,
    source: Option<app_source::CapturedSource>,
}

#[cfg(target_os = "windows")]
enum SelectionProbe {
    Unsupported,
    Empty,
    Text(String),
}

#[cfg(target_os = "windows")]
fn capture_accessible_selection(app: AppHandle) -> Result<CapturedContent, String> {
    use windows::{
        core::Result as WindowsResult,
        Win32::{
            System::Com::{
                CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
                COINIT_MULTITHREADED,
            },
            UI::Accessibility::{
                CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationTextPattern,
                TreeScope_Descendants, UIA_TextPatternId,
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
    ) -> WindowsResult<SelectionProbe> {
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

        Ok(if selections.is_empty() {
            SelectionProbe::Empty
        } else {
            SelectionProbe::Text(selections.join("\n"))
        })
    }

    unsafe fn selection_from_focused_element(
        automation: &IUIAutomation,
    ) -> WindowsResult<SelectionProbe> {
        let walker = automation.RawViewWalker()?;
        let mut element = automation.GetFocusedElement()?;
        let mut found_text_provider = false;
        for _ in 0..24 {
            match selection_from_element(&element) {
                Ok(SelectionProbe::Text(text)) => return Ok(SelectionProbe::Text(text)),
                Ok(SelectionProbe::Empty) => found_text_provider = true,
                Ok(SelectionProbe::Unsupported) | Err(_) => {}
            }
            match walker.GetParentElement(&element) {
                Ok(parent) => element = parent,
                Err(_) => break,
            }
        }
        Ok(if found_text_provider {
            SelectionProbe::Empty
        } else {
            SelectionProbe::Unsupported
        })
    }

    unsafe fn selection_from_window_tree(
        automation: &IUIAutomation,
        window: windows::Win32::Foundation::HWND,
    ) -> WindowsResult<SelectionProbe> {
        const MAX_ELEMENTS: i32 = 5_000;

        let root = automation.ElementFromHandle(window)?;
        let condition = automation.CreateTrueCondition()?;
        let elements = root.FindAll(TreeScope_Descendants, &condition)?;
        let length = elements.Length()?.min(MAX_ELEMENTS);
        let mut found_text_provider = false;
        for index in 0..length {
            if let Ok(element) = elements.GetElement(index) {
                match selection_from_element(&element) {
                    Ok(SelectionProbe::Text(text)) => return Ok(SelectionProbe::Text(text)),
                    Ok(SelectionProbe::Empty) => found_text_provider = true,
                    Ok(SelectionProbe::Unsupported) | Err(_) => {}
                }
            }
        }
        Ok(if found_text_provider {
            SelectionProbe::Empty
        } else {
            SelectionProbe::Unsupported
        })
    }

    let source;
    let is_code_editor;
    let foreground;
    let mut found_empty_selection = false;
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED)
            .ok()
            .map_err(io_error)?;
        let _apartment = ComApartment;
        let automation: IUIAutomation =
            CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER).map_err(io_error)?;
        foreground = app_source::foreground_window();
        is_code_editor = foreground.is_some_and(app_source::is_code_editor);
        source = foreground.and_then(|window| app_source::capture(&app, &automation, window));

        for attempt in 0..5 {
            match selection_from_focused_element(&automation) {
                Ok(SelectionProbe::Text(text)) => {
                    return Ok(CapturedContent {
                        text,
                        source: source.clone(),
                    });
                }
                Ok(SelectionProbe::Empty) => found_empty_selection = true,
                Ok(SelectionProbe::Unsupported) | Err(_) => {}
            }
            if attempt < 4 {
                std::thread::sleep(std::time::Duration::from_millis(30));
            }
        }

        if is_code_editor {
            for attempt in 0..20 {
                match selection_from_focused_element(&automation) {
                    Ok(SelectionProbe::Text(text)) => {
                        return Ok(CapturedContent {
                            text,
                            source: source.clone(),
                        });
                    }
                    Ok(SelectionProbe::Empty) => found_empty_selection = true,
                    Ok(SelectionProbe::Unsupported) | Err(_) => {}
                }
                if attempt < 19 {
                    std::thread::sleep(std::time::Duration::from_millis(60));
                }
            }
            if let Some(window) = foreground {
                match selection_from_window_tree(&automation, window) {
                    Ok(SelectionProbe::Text(text)) => {
                        return Ok(CapturedContent {
                            text,
                            source: source.clone(),
                        });
                    }
                    Ok(SelectionProbe::Empty) => found_empty_selection = true,
                    Ok(SelectionProbe::Unsupported) | Err(_) => {}
                }
            }
        }
    }

    if let Some(text) = capture_scintilla_selection()? {
        return Ok(CapturedContent {
            text,
            source: source.clone(),
        });
    }
    if let Some(text) = capture_win32_edit_selection()? {
        return Ok(CapturedContent { text, source });
    }

    if found_empty_selection {
        return Ok(CapturedContent {
            text: String::new(),
            source,
        });
    }

    if is_code_editor {
        Err(
            "VS Code has not exposed the editor selection. Set “Editor: Accessibility Support” to On in VS Code, then try again."
                .to_string(),
        )
    } else {
        Err(
            "The focused app does not expose its selected text through Windows UI Automation."
                .to_string(),
        )
    }
}

#[tauri::command]
pub(crate) fn capture_selected_text(app: AppHandle) -> Result<CapturedContent, String> {
    #[cfg(target_os = "windows")]
    {
        return std::thread::spawn(move || capture_accessible_selection(app))
            .join()
            .map_err(|_| "Windows UI Automation capture stopped unexpectedly.".to_string())?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("Selection capture is currently implemented for Windows.".to_string())
    }
}
