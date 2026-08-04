mod cache;
mod metadata;
mod network;
mod service;

use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::AppHandle;

use crate::{io_error, resolve_data_path};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkPreview {
    pub url: String,
    pub title: String,
    pub description: Option<String>,
    pub site_name: String,
    pub image_path: Option<String>,
    pub image_mime_type: Option<String>,
}

#[tauri::command]
pub async fn get_link_preview(app: AppHandle, url: String) -> Result<Option<LinkPreview>, String> {
    tauri::async_runtime::spawn_blocking(move || service::load_preview(&app, &url).unwrap_or(None))
        .await
        .map_err(io_error)
}

#[tauri::command]
pub fn read_link_preview_image(
    app: AppHandle,
    path: String,
) -> Result<tauri::ipc::Response, String> {
    let data_path = resolve_data_path(&app)?;
    let path = cache::validated_image_path(&data_path, &path)?;
    let bytes = std::fs::read(path).map_err(io_error)?;
    Ok(tauri::ipc::Response::new(bytes))
}

pub fn copy_cache(source_data: &Path, destination_data: &Path) -> Result<(), String> {
    cache::copy_cache(source_data, destination_data)
}
