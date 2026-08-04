use chrono::{SecondsFormat, Utc};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Component, Path},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, State};

use crate::{
    app_source::{self, CapturedSource},
    io_error, link_preview, location_file_path, resolve_data_path, DATA_FILE_NAME,
};

static ITEM_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Clone)]
struct PendingItem {
    section_id: String,
    item: Value,
    at_top: bool,
}

#[derive(Clone)]
struct PendingMove {
    destination_id: String,
    at_top: bool,
}

#[derive(Default)]
struct PendingDocumentChanges {
    items: HashMap<String, PendingItem>,
    moves: HashMap<String, PendingMove>,
}

#[derive(Default)]
pub(crate) struct CarbonStorageState(Mutex<PendingDocumentChanges>);
pub(crate) const DEFAULT_CAPTURE_HOTKEY: &str = "CommandOrControl+Shift+C";
pub(crate) const DEFAULT_SHOW_WINDOW_HOTKEY: &str = "CommandOrControl+Shift+Space";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SavedCapture {
    pub(crate) item: Value,
    pub(crate) section_id: String,
    pub(crate) buckets: Vec<CaptureBucket>,
    pub(crate) placement: String,
}

#[derive(Clone, Serialize)]
pub(crate) struct CaptureBucket {
    id: String,
    name: String,
}

fn read_document(path: &Path) -> Result<Value, String> {
    if !path.exists() {
        return Ok(Value::Null);
    }
    let contents = fs::read_to_string(path).map_err(io_error)?;
    serde_json::from_str(&contents).map_err(io_error)
}

fn default_document() -> Value {
    let section_id = next_identifier("section");
    json!({
        "version": 2,
        "activeSectionId": "all",
        "doneViewBySection": {},
        "sections": [{
            "id": section_id,
            "name": "Inbox",
            "sortMode": "manual",
            "items": []
        }],
        "settings": {
            "theme": "light",
            "alwaysOnTop": true,
            "showLinkPreviews": true,
            "showCreatedAt": true,
            "showItemSources": true,
            "doubleClickAction": "copy",
            "capturePlacement": "top",
            "captureHotkey": DEFAULT_CAPTURE_HOTKEY,
            "showWindowHotkey": DEFAULT_SHOW_WINDOW_HOTKEY
        }
    })
}

pub(crate) fn load_shortcut_settings(
    app: &AppHandle,
    state: &CarbonStorageState,
) -> Result<(String, String), String> {
    let _guard = state.0.lock().map_err(io_error)?;
    let path = resolve_data_path(app)?;
    let mut document = read_document(&path)?;
    if document.is_null() {
        document = default_document();
        write_document(&path, &document)?;
    }
    let settings = document.get("settings");
    let capture = settings
        .and_then(|settings| settings.get("captureHotkey"))
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_CAPTURE_HOTKEY)
        .to_string();
    let show_window = settings
        .and_then(|settings| settings.get("showWindowHotkey"))
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_SHOW_WINDOW_HOTKEY)
        .to_string();
    Ok((capture, show_window))
}

fn next_identifier(prefix: &str) -> String {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let sequence = ITEM_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{timestamp:x}-{sequence:x}")
}

fn sections(document: &Value) -> Option<&Vec<Value>> {
    document.get("sections")?.as_array()
}

fn sections_mut(document: &mut Value) -> Option<&mut Vec<Value>> {
    document.get_mut("sections")?.as_array_mut()
}

fn item_section_id(document: &Value, item_id: &str) -> Option<String> {
    sections(document)?.iter().find_map(|section| {
        section
            .get("items")
            .and_then(Value::as_array)?
            .iter()
            .any(|item| item.get("id").and_then(Value::as_str) == Some(item_id))
            .then(|| {
                section
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string()
            })
    })
}

fn insert_item(document: &mut Value, section_id: &str, item: Value, at_top: bool) -> bool {
    let Some(target) = sections_mut(document).and_then(|sections| {
        sections
            .iter_mut()
            .find(|section| section.get("id").and_then(Value::as_str) == Some(section_id))
    }) else {
        return false;
    };
    let Some(items) = target.get_mut("items").and_then(Value::as_array_mut) else {
        return false;
    };
    if at_top {
        items.insert(0, item);
    } else {
        items.push(item);
    }
    true
}

fn capture_placement(document: &Value) -> &'static str {
    if document
        .get("settings")
        .and_then(|settings| settings.get("capturePlacement"))
        .and_then(Value::as_str)
        == Some("bottom")
    {
        "bottom"
    } else {
        "top"
    }
}

fn move_item(document: &mut Value, item_id: &str, destination_id: &str, at_top: bool) -> bool {
    let Some(all_sections) = sections_mut(document) else {
        return false;
    };
    if !all_sections
        .iter()
        .any(|section| section.get("id").and_then(Value::as_str) == Some(destination_id))
    {
        return false;
    }

    let mut moving = None;
    for section in all_sections.iter_mut() {
        let Some(items) = section.get_mut("items").and_then(Value::as_array_mut) else {
            continue;
        };
        if let Some(index) = items
            .iter()
            .position(|item| item.get("id").and_then(Value::as_str) == Some(item_id))
        {
            moving = Some(items.remove(index));
            break;
        }
    }
    let Some(item) = moving else {
        return false;
    };
    let Some(destination) = all_sections
        .iter_mut()
        .find(|section| section.get("id").and_then(Value::as_str) == Some(destination_id))
    else {
        return false;
    };
    let Some(items) = destination.get_mut("items").and_then(Value::as_array_mut) else {
        return false;
    };
    if at_top {
        items.insert(0, item);
    } else {
        items.push(item);
    }
    true
}

fn merge_pending_changes(
    document: &mut Value,
    pending: &mut PendingDocumentChanges,
    acknowledge_frontend_state: bool,
) {
    pending.items.retain(|item_id, pending_item| {
        if item_section_id(document, item_id).is_some() {
            !acknowledge_frontend_state
        } else {
            let destination = sections(document)
                .into_iter()
                .flatten()
                .find(|section| {
                    section.get("id").and_then(Value::as_str)
                        == Some(pending_item.section_id.as_str())
                })
                .or_else(|| sections(document).and_then(|sections| sections.first()))
                .and_then(|section| section.get("id"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            if let Some(destination) = destination {
                pending_item.section_id = destination;
            }
            let _ = insert_item(
                document,
                &pending_item.section_id,
                pending_item.item.clone(),
                pending_item.at_top,
            );
            true
        }
    });
    pending.moves.retain(|item_id, pending_move| {
        if item_section_id(document, item_id).as_deref()
            == Some(pending_move.destination_id.as_str())
        {
            !acknowledge_frontend_state
        } else {
            let _ = move_item(
                document,
                item_id,
                &pending_move.destination_id,
                pending_move.at_top,
            );
            true
        }
    });
}

fn target_section(document: &Value) -> Option<String> {
    let active = document
        .get("activeSectionId")
        .and_then(Value::as_str)
        .filter(|id| *id != "all");
    let all_sections = sections(document)?;
    active
        .filter(|active_id| {
            all_sections
                .iter()
                .any(|section| section.get("id").and_then(Value::as_str) == Some(*active_id))
        })
        .map(ToOwned::to_owned)
        .or_else(|| {
            all_sections
                .first()
                .and_then(|section| section.get("id"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
}

fn capture_buckets(document: &Value) -> Vec<CaptureBucket> {
    sections(document)
        .into_iter()
        .flatten()
        .filter_map(|section| {
            Some(CaptureBucket {
                id: section.get("id")?.as_str()?.to_string(),
                name: section.get("name")?.as_str()?.to_string(),
            })
        })
        .collect()
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
pub(crate) fn load_carbon_data(
    app: AppHandle,
    state: State<'_, CarbonStorageState>,
) -> Result<Value, String> {
    let _guard = state.0.lock().map_err(io_error)?;
    let path = resolve_data_path(&app)?;
    let mut document = read_document(&path)?;
    if document.is_null() {
        document = default_document();
        write_document(&path, &document)?;
    }
    Ok(document)
}

#[tauri::command]
pub(crate) fn save_carbon_data(
    app: AppHandle,
    state: State<'_, CarbonStorageState>,
    mut document: Value,
) -> Result<(), String> {
    let mut pending = state.0.lock().map_err(io_error)?;
    merge_pending_changes(&mut document, &mut pending, true);
    let path = resolve_data_path(&app)?;
    write_document(&path, &document)?;
    remove_unreferenced_assets(&path, &document)
}

pub(crate) fn append_captured_item(
    app: &AppHandle,
    state: &CarbonStorageState,
    text: String,
    source: Option<CapturedSource>,
) -> Result<SavedCapture, String> {
    let mut pending = state.0.lock().map_err(io_error)?;
    let path = resolve_data_path(app)?;
    let mut document = read_document(&path)?;
    if document.is_null() {
        document = default_document();
    }
    merge_pending_changes(&mut document, &mut pending, false);
    let placement = capture_placement(&document).to_string();
    let at_top = placement == "top";
    let section_id = target_section(&document)
        .ok_or_else(|| "No destination bucket is available.".to_string())?;
    let timestamp = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let item_id = next_identifier("item");
    let mut item = json!({
        "id": item_id,
        "text": text,
        "attachments": [],
        "completed": false,
        "createdAt": timestamp,
        "updatedAt": timestamp
    });
    if let Some(source) = source {
        item.as_object_mut()
            .expect("captured items are JSON objects")
            .insert("source".to_string(), json!(source));
    }
    if !insert_item(&mut document, &section_id, item.clone(), at_top) {
        return Err("The destination bucket could not accept the capture.".to_string());
    }
    write_document(&path, &document)?;
    pending.items.insert(
        item_id,
        PendingItem {
            section_id: section_id.clone(),
            item: item.clone(),
            at_top,
        },
    );
    Ok(SavedCapture {
        item,
        section_id,
        buckets: capture_buckets(&document),
        placement,
    })
}

#[tauri::command]
pub(crate) fn move_captured_item(
    app: AppHandle,
    state: State<'_, CarbonStorageState>,
    item_id: String,
    bucket_id: String,
) -> Result<(), String> {
    let mut pending = state.0.lock().map_err(io_error)?;
    let path = resolve_data_path(&app)?;
    let mut document = read_document(&path)?;
    merge_pending_changes(&mut document, &mut pending, false);
    let placement = capture_placement(&document).to_string();
    let at_top = placement == "top";
    if item_section_id(&document, &item_id).as_deref() != Some(bucket_id.as_str())
        && !move_item(&mut document, &item_id, &bucket_id, at_top)
    {
        return Err("The captured note or destination bucket is unavailable.".to_string());
    }
    write_document(&path, &document)?;
    pending.moves.insert(
        item_id.clone(),
        PendingMove {
            destination_id: bucket_id.clone(),
            at_top,
        },
    );
    let _ = app.emit_to(
        "main",
        "native-captured-item-moved",
        json!({
            "itemId": item_id,
            "bucketId": bucket_id,
            "placement": placement
        }),
    );
    Ok(())
}

#[tauri::command]
pub(crate) fn get_data_file_path(app: AppHandle) -> Result<String, String> {
    resolve_data_path(&app).map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
pub(crate) fn choose_data_file(
    app: AppHandle,
    state: State<'_, CarbonStorageState>,
    mut document: Value,
) -> Result<Option<String>, String> {
    let mut pending = state.0.lock().map_err(io_error)?;
    merge_pending_changes(&mut document, &mut pending, true);
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
pub(crate) fn resolve_image_asset_path(app: AppHandle, path: String) -> Result<String, String> {
    validated_asset_path(&resolve_data_path(&app)?, &path)?
        .canonicalize()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(io_error)
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

#[cfg(test)]
mod tests {
    use super::*;

    fn document_with_sections() -> Value {
        json!({
            "version": 2,
            "activeSectionId": "inbox",
            "sections": [
                { "id": "inbox", "name": "Inbox", "items": [] },
                { "id": "archive", "name": "Archive", "items": [] }
            ],
            "settings": {}
        })
    }

    fn item(id: &str) -> Value {
        json!({
            "id": id,
            "text": "Captured",
            "attachments": [],
            "completed": false,
            "createdAt": "2026-08-04T12:00:00.000Z",
            "updatedAt": "2026-08-04T12:00:00.000Z"
        })
    }

    #[test]
    fn pending_capture_survives_stale_frontend_save_until_acknowledged() {
        let captured = item("captured");
        let mut pending = PendingDocumentChanges::default();
        pending.items.insert(
            "captured".to_string(),
            PendingItem {
                section_id: "inbox".to_string(),
                item: captured.clone(),
                at_top: true,
            },
        );
        let mut stale = document_with_sections();

        merge_pending_changes(&mut stale, &mut pending, true);
        assert_eq!(
            item_section_id(&stale, "captured").as_deref(),
            Some("inbox")
        );
        assert!(pending.items.contains_key("captured"));

        merge_pending_changes(&mut stale, &mut pending, true);
        assert!(!pending.items.contains_key("captured"));
    }

    #[test]
    fn pending_bucket_move_is_enforced_until_frontend_reflects_it() {
        let mut document = document_with_sections();
        assert!(insert_item(&mut document, "inbox", item("captured"), false));
        let mut pending = PendingDocumentChanges::default();
        pending.moves.insert(
            "captured".to_string(),
            PendingMove {
                destination_id: "archive".to_string(),
                at_top: true,
            },
        );

        merge_pending_changes(&mut document, &mut pending, true);
        assert_eq!(
            item_section_id(&document, "captured").as_deref(),
            Some("archive")
        );
        assert!(pending.moves.contains_key("captured"));

        merge_pending_changes(&mut document, &mut pending, true);
        assert!(!pending.moves.contains_key("captured"));
    }

    #[test]
    fn captured_items_can_be_inserted_at_either_edge() {
        let mut document = document_with_sections();
        assert!(insert_item(&mut document, "inbox", item("middle"), false));
        assert!(insert_item(&mut document, "inbox", item("top"), true));
        assert!(insert_item(&mut document, "inbox", item("bottom"), false));

        let ids = sections(&document).unwrap()[0]["items"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|item| item.get("id").and_then(Value::as_str))
            .collect::<Vec<_>>();
        assert_eq!(ids, vec!["top", "middle", "bottom"]);
    }
}
