use serde_json::Value;
use std::{
    collections::HashSet,
    fs,
    path::{Component, Path},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter};

use crate::{
    app_source, io_error, link_preview, location_file_path, resolve_data_path, DATA_FILE_NAME,
};

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

fn assets_directory(data_path: &Path) -> Result<std::path::PathBuf, String> {
    data_path
        .parent()
        .map(|parent| parent.join("assets"))
        .ok_or_else(|| "The data path has no parent folder.".to_string())
}

fn validated_asset_path(data_path: &Path, relative: &str) -> Result<std::path::PathBuf, String> {
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
pub(crate) fn load_carbon_data(app: AppHandle) -> Result<Value, String> {
    let path = resolve_data_path(&app)?;
    if !path.exists() {
        return Ok(Value::Null);
    }
    let contents = fs::read_to_string(path).map_err(io_error)?;
    serde_json::from_str(&contents).map_err(io_error)
}

#[tauri::command]
pub(crate) fn save_carbon_data(app: AppHandle, document: Value) -> Result<(), String> {
    let path = resolve_data_path(&app)?;
    write_document(&path, &document)?;
    remove_unreferenced_assets(&path, &document)
}

#[tauri::command]
pub(crate) fn get_data_file_path(app: AppHandle) -> Result<String, String> {
    resolve_data_path(&app).map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
pub(crate) fn choose_data_file(app: AppHandle, document: Value) -> Result<Option<String>, String> {
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
    app_source::copy_cache(&current, &selected)?;
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
pub(crate) fn save_image_asset(
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
pub(crate) fn read_image_asset(
    app: AppHandle,
    path: String,
) -> Result<tauri::ipc::Response, String> {
    let path = validated_asset_path(&resolve_data_path(&app)?, &path)?;
    let bytes = fs::read(path).map_err(io_error)?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub(crate) async fn copy_image_asset(app: AppHandle, path: String) -> Result<(), String> {
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
pub(crate) async fn copy_items_to_clipboard_history(
    app: AppHandle,
    image_paths: Vec<String>,
    texts: Vec<String>,
) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use tauri_plugin_clipboard_manager::ClipboardExt;

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
pub(crate) fn trash_image_asset(
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
pub(crate) fn reveal_data_file(app: AppHandle) -> Result<(), String> {
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
