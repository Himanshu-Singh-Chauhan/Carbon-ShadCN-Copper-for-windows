use std::{
    ffi::c_void,
    mem::size_of,
    os::windows::ffi::OsStrExt,
    path::{Path, PathBuf},
};
use windows::{
    core::{w, PCWSTR, PWSTR},
    Win32::{
        Foundation::{CloseHandle, HWND},
        Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW},
        System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
            PROCESS_QUERY_LIMITED_INFORMATION,
        },
        UI::WindowsAndMessaging::GetWindowThreadProcessId,
    },
};

fn wide(value: &Path) -> Vec<u16> {
    value
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

pub(super) fn process_path(window: HWND) -> Option<PathBuf> {
    unsafe {
        let mut process_id = 0u32;
        GetWindowThreadProcessId(window, Some(&mut process_id));
        if process_id == 0 {
            return None;
        }
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id).ok()?;
        let mut buffer = vec![0u16; 32_768];
        let mut length = buffer.len() as u32;
        let result = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(buffer.as_mut_ptr()),
            &mut length,
        );
        let _ = CloseHandle(process);
        result.ok()?;
        buffer.truncate(length as usize);
        Some(PathBuf::from(String::from_utf16_lossy(&buffer)))
    }
}

fn version_value(path: &Path, key: &str) -> Option<String> {
    unsafe {
        let path = wide(path);
        let size = GetFileVersionInfoSizeW(PCWSTR(path.as_ptr()), None);
        if size == 0 {
            return None;
        }
        let mut data = vec![0u8; size as usize];
        GetFileVersionInfoW(
            PCWSTR(path.as_ptr()),
            Some(0),
            size,
            data.as_mut_ptr().cast(),
        )
        .ok()?;

        let mut translations: *mut c_void = std::ptr::null_mut();
        let mut translation_bytes = 0u32;
        if !VerQueryValueW(
            data.as_ptr().cast(),
            w!("\\VarFileInfo\\Translation"),
            &mut translations,
            &mut translation_bytes,
        )
        .as_bool()
        {
            return None;
        }
        if translations.is_null() || translation_bytes < 4 {
            return None;
        }
        let words = std::slice::from_raw_parts(
            translations.cast::<u16>(),
            translation_bytes as usize / size_of::<u16>(),
        );

        for pair in words.chunks_exact(2) {
            let query = format!("\\StringFileInfo\\{:04x}{:04x}\\{key}\0", pair[0], pair[1]);
            let query: Vec<u16> = query.encode_utf16().collect();
            let mut value: *mut c_void = std::ptr::null_mut();
            let mut value_chars = 0u32;
            if VerQueryValueW(
                data.as_ptr().cast(),
                PCWSTR(query.as_ptr()),
                &mut value,
                &mut value_chars,
            )
            .as_bool()
                && !value.is_null()
                && value_chars > 1
            {
                let text = String::from_utf16_lossy(std::slice::from_raw_parts(
                    value.cast::<u16>(),
                    value_chars.saturating_sub(1) as usize,
                ));
                let text = text.trim();
                if !text.is_empty() {
                    return Some(text.to_string());
                }
            }
        }
        None
    }
}

pub(super) fn executable_stem(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Application")
        .trim()
        .to_string()
}

pub(super) fn is_code_editor_stem(stem: &str) -> bool {
    matches!(
        stem.to_ascii_lowercase().as_str(),
        "code" | "code - insiders" | "code-insiders" | "vscodium" | "cursor" | "windsurf"
    )
}

pub(super) fn browser_name(stem: &str) -> Option<&'static str> {
    match stem.to_ascii_lowercase().as_str() {
        "chrome" => Some("Google Chrome"),
        "msedge" => Some("Microsoft Edge"),
        "firefox" => Some("Mozilla Firefox"),
        "brave" => Some("Brave"),
        "vivaldi" => Some("Vivaldi"),
        "opera" => Some("Opera"),
        "opera_gx" => Some("Opera GX"),
        "arc" => Some("Arc"),
        _ => None,
    }
}

pub(super) fn app_name(path: &Path) -> String {
    let stem = executable_stem(path);
    browser_name(&stem)
        .map(str::to_string)
        .or_else(|| {
            stem.eq_ignore_ascii_case("explorer")
                .then(|| "File Explorer".to_string())
        })
        .or_else(|| version_value(path, "FileDescription"))
        .or_else(|| version_value(path, "ProductName"))
        .unwrap_or(stem)
}

#[cfg(test)]
mod tests {
    use super::{browser_name, is_code_editor_stem};

    #[test]
    fn recognizes_supported_browsers() {
        assert_eq!(browser_name("chrome"), Some("Google Chrome"));
        assert_eq!(browser_name("MSEDGE"), Some("Microsoft Edge"));
        assert_eq!(browser_name("notepad"), None);
    }

    #[test]
    fn recognizes_monaco_desktop_editors() {
        assert!(is_code_editor_stem("Code"));
        assert!(is_code_editor_stem("Code - Insiders"));
        assert!(is_code_editor_stem("VSCodium"));
        assert!(is_code_editor_stem("Cursor"));
        assert!(!is_code_editor_stem("chrome"));
    }
}
