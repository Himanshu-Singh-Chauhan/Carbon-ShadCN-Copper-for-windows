mod cache;
#[cfg(target_os = "windows")]
mod windows;

use serde::Serialize;
use tauri::AppHandle;

pub(crate) use cache::copy_cache;
#[cfg(target_os = "windows")]
pub use windows::{capture, foreground_window, is_code_editor};

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
