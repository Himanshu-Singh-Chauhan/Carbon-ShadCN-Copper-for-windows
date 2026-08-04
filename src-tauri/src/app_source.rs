mod cache;
#[cfg(target_os = "windows")]
mod windows;

use serde::Serialize;
use tauri::AppHandle;

pub(crate) use cache::copy_cache;
#[cfg(target_os = "windows")]
pub use windows::{capture, foreground_window, is_code_editor, is_current_process};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedSource {
    pub id: String,
    pub app_name: String,
    pub icon_path: Option<String>,
    pub page_title: Option<String>,
    pub page_url: Option<String>,
}

#[tauri::command]
pub fn read_app_source_icon(app: AppHandle, path: String) -> Result<tauri::ipc::Response, String> {
    cache::read_icon(app, path)
}

#[cfg(target_os = "windows")]
fn foreground_source(app: &AppHandle) -> Result<Option<CapturedSource>, String> {
    use ::windows::Win32::{
        System::Com::{
            CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
            COINIT_MULTITHREADED,
        },
        UI::Accessibility::{CUIAutomation, IUIAutomation},
    };

    struct ComApartment;
    impl Drop for ComApartment {
        fn drop(&mut self) {
            unsafe { CoUninitialize() };
        }
    }

    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED)
            .ok()
            .map_err(|error| error.to_string())?;
        let _apartment = ComApartment;
        let Some(window) = foreground_window() else {
            return Ok(None);
        };
        if is_current_process(window) {
            return Ok(None);
        }
        let automation: IUIAutomation =
            CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)
                .map_err(|error| error.to_string())?;
        Ok(capture(app, &automation, window))
    }
}

#[tauri::command]
pub async fn capture_foreground_source(app: AppHandle) -> Result<Option<CapturedSource>, String> {
    #[cfg(target_os = "windows")]
    {
        return tauri::async_runtime::spawn_blocking(move || foreground_source(&app))
            .await
            .map_err(|error| error.to_string())?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Ok(None)
    }
}
