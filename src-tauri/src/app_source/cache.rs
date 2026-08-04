use std::{
    fs,
    path::{Component, Path, PathBuf},
};
use tauri::AppHandle;

use crate::{io_error, resolve_data_path};

const CACHE_DIRECTORY_NAME: &str = "app-sources";

pub(super) fn cache_directory(data_path: &Path) -> Result<PathBuf, String> {
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

pub(super) fn read_icon(app: AppHandle, path: String) -> Result<tauri::ipc::Response, String> {
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

pub(crate) fn copy_cache(source_data: &Path, destination_data: &Path) -> Result<(), String> {
    let source = cache_directory(source_data)?;
    let destination = cache_directory(destination_data)?;
    if !source.exists() || source == destination {
        return Ok(());
    }
    copy_directory(&source, &destination)
}
