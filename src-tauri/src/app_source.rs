use serde::Serialize;
use std::{
    fs,
    path::{Component, Path, PathBuf},
};
use tauri::AppHandle;

use crate::{io_error, resolve_data_path};

const CACHE_DIRECTORY_NAME: &str = "app-sources";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedSource {
    pub id: String,
    pub app_name: String,
    pub icon_path: Option<String>,
    pub page_title: Option<String>,
    pub page_url: Option<String>,
}

fn cache_directory(data_path: &Path) -> Result<PathBuf, String> {
    data_path
        .parent()
        .map(|parent| parent.join(CACHE_DIRECTORY_NAME))
        .ok_or_else(|| "The data path has no parent folder.".to_string())
}

fn validated_icon_path(data_path: &Path, relative: &str) -> Result<PathBuf, String> {
    let mut components = Path::new(relative).components();
    let valid = matches!(components.next(), Some(Component::Normal(value)) if value == "icons")
        && matches!(components.next(), Some(Component::Normal(_)))
        && components.next().is_none();
    if !valid {
        return Err("Invalid application source icon path.".to_string());
    }
    Ok(cache_directory(data_path)?.join(relative))
}

#[tauri::command]
pub fn read_app_source_icon(app: AppHandle, path: String) -> Result<tauri::ipc::Response, String> {
    let data_path = resolve_data_path(&app)?;
    let path = validated_icon_path(&data_path, &path)?;
    Ok(tauri::ipc::Response::new(fs::read(path).map_err(io_error)?))
}

fn copy_directory(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(io_error)?;
    for entry in fs::read_dir(source).map_err(io_error)? {
        let entry = entry.map_err(io_error)?;
        let target = destination.join(entry.file_name());
        if entry.file_type().map_err(io_error)?.is_dir() {
            copy_directory(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target).map_err(io_error)?;
        }
    }
    Ok(())
}

pub fn copy_cache(source_data: &Path, destination_data: &Path) -> Result<(), String> {
    let source = cache_directory(source_data)?;
    let destination = cache_directory(destination_data)?;
    if !source.exists() || source == destination {
        return Ok(());
    }
    copy_directory(&source, &destination)
}

#[cfg(target_os = "windows")]
mod windows_capture {
    use super::{cache_directory, CapturedSource};
    use image::{ImageBuffer, Rgba};
    use sha2::{Digest, Sha256};
    use std::{
        collections::VecDeque,
        ffi::c_void,
        fs,
        mem::size_of,
        os::windows::ffi::OsStrExt,
        path::{Path, PathBuf},
        time::UNIX_EPOCH,
    };
    use tauri::AppHandle;
    use windows::{
        core::{w, PCWSTR, PWSTR},
        Win32::{
            Foundation::{CloseHandle, HWND, SIZE},
            Graphics::Gdi::{
                DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO,
                BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
            },
            Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW},
            System::Threading::{
                OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
                PROCESS_QUERY_LIMITED_INFORMATION,
            },
            UI::{
                Accessibility::{
                    IUIAutomation, IUIAutomationValuePattern, TreeScope_Children,
                    UIA_EditControlTypeId, UIA_ValuePatternId,
                },
                Shell::{
                    IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_BIGGERSIZEOK,
                    SIIGBF_ICONONLY,
                },
                WindowsAndMessaging::{
                    GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
                    GetWindowThreadProcessId,
                },
            },
        },
    };

    const ICON_SIZE: i32 = 128;
    const MAX_AUTOMATION_ELEMENTS: usize = 500;
    const MAX_AUTOMATION_DEPTH: usize = 10;

    struct BitmapGuard(windows::Win32::Graphics::Gdi::HBITMAP);

    impl Drop for BitmapGuard {
        fn drop(&mut self) {
            unsafe {
                let _ = DeleteObject(HGDIOBJ(self.0 .0));
            }
        }
    }

    fn wide(value: &Path) -> Vec<u16> {
        value
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    fn process_path(window: HWND) -> Option<PathBuf> {
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

    fn executable_stem(path: &Path) -> String {
        path.file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("Application")
            .trim()
            .to_string()
    }

    fn is_code_editor_stem(stem: &str) -> bool {
        matches!(
            stem.to_ascii_lowercase().as_str(),
            "code" | "code - insiders" | "code-insiders" | "vscodium" | "cursor" | "windsurf"
        )
    }

    fn browser_name(stem: &str) -> Option<&'static str> {
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

    fn app_name(path: &Path) -> String {
        let stem = executable_stem(path);
        browser_name(&stem)
            .map(str::to_string)
            .or_else(|| version_value(path, "ProductName"))
            .or_else(|| version_value(path, "FileDescription"))
            .unwrap_or(stem)
    }

    fn window_title(window: HWND) -> Option<String> {
        unsafe {
            let length = GetWindowTextLengthW(window);
            if length <= 0 {
                return None;
            }
            let mut buffer = vec![0u16; length as usize + 1];
            let copied = GetWindowTextW(window, &mut buffer);
            if copied <= 0 {
                return None;
            }
            Some(
                String::from_utf16_lossy(&buffer[..copied as usize])
                    .trim()
                    .to_string(),
            )
        }
    }

    fn page_title(window: HWND, browser: &str) -> Option<String> {
        let mut title = window_title(window)?;
        let suffixes: &[&str] = match browser {
            "Google Chrome" => &[" - Google Chrome", " – Google Chrome"],
            "Microsoft Edge" => &[" - Microsoft Edge", " – Microsoft Edge"],
            "Mozilla Firefox" => &[" — Mozilla Firefox", " - Mozilla Firefox"],
            "Brave" => &[" - Brave", " – Brave"],
            "Vivaldi" => &[" - Vivaldi", " – Vivaldi"],
            "Opera" => &[" - Opera", " – Opera"],
            "Opera GX" => &[" - Opera GX", " – Opera GX"],
            "Arc" => &[" - Arc", " – Arc"],
            _ => &[],
        };
        for suffix in suffixes {
            if let Some(stripped) = title.strip_suffix(suffix) {
                title = stripped.trim().to_string();
                break;
            }
        }
        (!title.is_empty()).then_some(title)
    }

    fn normalize_http_url(value: &str) -> Option<String> {
        let parsed = reqwest::Url::parse(value.trim()).ok()?;
        (matches!(parsed.scheme(), "http" | "https") && parsed.host().is_some())
            .then(|| parsed.to_string())
    }

    fn address_bar_url(automation: &IUIAutomation, window: HWND) -> Option<String> {
        unsafe {
            let root = automation.ElementFromHandle(window).ok()?;
            let condition = automation.CreateTrueCondition().ok()?;
            let mut queue = VecDeque::from([(root, 0usize)]);
            let mut visited = 0usize;

            while let Some((element, depth)) = queue.pop_front() {
                visited += 1;
                if visited > MAX_AUTOMATION_ELEMENTS {
                    break;
                }

                if element.CurrentControlType().ok() == Some(UIA_EditControlTypeId)
                    && element
                        .CurrentIsPassword()
                        .ok()
                        .is_none_or(|value| !value.as_bool())
                {
                    let name = element
                        .CurrentName()
                        .ok()
                        .map(|value| value.to_string().to_ascii_lowercase())
                        .unwrap_or_default();
                    let automation_id = element
                        .CurrentAutomationId()
                        .ok()
                        .map(|value| value.to_string().to_ascii_lowercase())
                        .unwrap_or_default();
                    if let Ok(pattern) =
                        element.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId)
                    {
                        if let Ok(value) = pattern.CurrentValue() {
                            if let Some(value) = normalize_http_url(&value.to_string()) {
                                let is_named_address_bar = name.contains("address")
                                    || name.contains("location")
                                    || name.contains("omnibox")
                                    || name.contains("search bar")
                                    || automation_id.contains("address")
                                    || automation_id.contains("location")
                                    || automation_id.contains("omnibox")
                                    || automation_id.contains("urlbar");
                                if is_named_address_bar {
                                    return Some(value);
                                }
                            }
                        }
                    }
                }

                if depth >= MAX_AUTOMATION_DEPTH {
                    continue;
                }
                if let Ok(children) = element.FindAll(TreeScope_Children, &condition) {
                    if let Ok(length) = children.Length() {
                        for index in 0..length {
                            if let Ok(child) = children.GetElement(index) {
                                queue.push_back((child, depth + 1));
                            }
                        }
                    }
                }
            }
            None
        }
    }

    fn source_id(path: &Path) -> String {
        let mut digest = Sha256::new();
        digest.update(path.to_string_lossy().to_ascii_lowercase().as_bytes());
        digest.finalize()[..12]
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }

    fn icon_cache_key(path: &Path, source_id: &str) -> String {
        let modified = fs::metadata(path)
            .and_then(|metadata| metadata.modified())
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs())
            .unwrap_or_default();
        format!("{source_id}-{modified}")
    }

    fn save_shell_icon(path: &Path, destination: &Path) -> Result<(), String> {
        unsafe {
            let path = wide(path);
            let factory: IShellItemImageFactory =
                SHCreateItemFromParsingName(PCWSTR(path.as_ptr()), None)
                    .map_err(|error| error.to_string())?;
            let bitmap = BitmapGuard(
                factory
                    .GetImage(
                        SIZE {
                            cx: ICON_SIZE,
                            cy: ICON_SIZE,
                        },
                        SIIGBF_ICONONLY | SIIGBF_BIGGERSIZEOK,
                    )
                    .map_err(|error| error.to_string())?,
            );
            let mut object = BITMAP::default();
            if GetObjectW(
                HGDIOBJ(bitmap.0 .0),
                size_of::<BITMAP>() as i32,
                Some((&mut object as *mut BITMAP).cast()),
            ) == 0
            {
                return Err("Windows did not return application icon dimensions.".to_string());
            }
            let width = object.bmWidth.unsigned_abs();
            let height = object.bmHeight.unsigned_abs();
            if width == 0 || height == 0 {
                return Err("Windows returned an empty application icon.".to_string());
            }

            let mut info = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: width as i32,
                    biHeight: -(height as i32),
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            let mut bgra = vec![0u8; width as usize * height as usize * 4];
            let dc = GetDC(None);
            let lines = GetDIBits(
                dc,
                bitmap.0,
                0,
                height,
                Some(bgra.as_mut_ptr().cast()),
                &mut info,
                DIB_RGB_COLORS,
            );
            let _ = ReleaseDC(None, dc);
            if lines == 0 {
                return Err("Windows could not read the application icon pixels.".to_string());
            }

            let has_alpha = bgra.chunks_exact(4).any(|pixel| pixel[3] != 0);
            let mut rgba = Vec::with_capacity(bgra.len());
            for pixel in bgra.chunks_exact(4) {
                let alpha = if has_alpha { pixel[3] } else { 255 };
                let unpremultiply = |channel: u8| {
                    if alpha == 0 || alpha == 255 {
                        channel
                    } else {
                        ((channel as u16 * 255) / alpha as u16).min(255) as u8
                    }
                };
                rgba.extend_from_slice(&[
                    unpremultiply(pixel[2]),
                    unpremultiply(pixel[1]),
                    unpremultiply(pixel[0]),
                    alpha,
                ]);
            }
            let image: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_raw(width, height, rgba)
                .ok_or_else(|| "Windows returned invalid application icon pixels.".to_string())?;
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            image
                .save_with_format(destination, image::ImageFormat::Png)
                .map_err(|error| error.to_string())
        }
    }

    fn cached_icon(app: &AppHandle, executable: &Path, id: &str) -> Option<String> {
        let data_path = crate::resolve_data_path(app).ok()?;
        let key = icon_cache_key(executable, id);
        let relative = format!("icons/{key}.png");
        let destination = cache_directory(&data_path).ok()?.join(&relative);
        if !destination.exists() && save_shell_icon(executable, &destination).is_err() {
            return None;
        }
        Some(relative)
    }

    pub fn capture(
        app: &AppHandle,
        automation: &IUIAutomation,
        window: HWND,
    ) -> Option<CapturedSource> {
        let executable = process_path(window)?;
        let stem = executable_stem(&executable);
        let browser = browser_name(&stem);
        let name = app_name(&executable);
        let id = source_id(&executable);
        let (page_title, page_url) = if browser.is_some() {
            (
                page_title(window, &name),
                address_bar_url(automation, window),
            )
        } else {
            (None, None)
        };
        Some(CapturedSource {
            icon_path: cached_icon(app, &executable, &id),
            id,
            app_name: name,
            page_title,
            page_url,
        })
    }

    pub fn foreground_window() -> Option<HWND> {
        let window = unsafe { GetForegroundWindow() };
        (window != HWND::default()).then_some(window)
    }

    pub fn is_code_editor(window: HWND) -> bool {
        process_path(window)
            .as_deref()
            .map(executable_stem)
            .is_some_and(|stem| is_code_editor_stem(&stem))
    }

    #[cfg(test)]
    mod tests {
        use super::{browser_name, is_code_editor_stem, normalize_http_url};

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

        #[test]
        fn only_accepts_web_page_urls() {
            assert_eq!(
                normalize_http_url("https://example.com/page"),
                Some("https://example.com/page".to_string())
            );
            assert!(normalize_http_url(" http://example.com ").is_some());
            assert!(normalize_http_url("https://").is_none());
            assert!(normalize_http_url("chrome://settings").is_none());
            assert!(normalize_http_url("file:///C:/private.txt").is_none());
        }
    }
}

#[cfg(target_os = "windows")]
pub use windows_capture::{capture, foreground_window, is_code_editor};
