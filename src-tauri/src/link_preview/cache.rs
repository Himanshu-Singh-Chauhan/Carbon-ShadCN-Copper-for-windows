use reqwest::Url;
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Component, Path, PathBuf},
    time::{Duration, SystemTime},
};

use crate::io_error;

const FAILED_CACHE_TTL: Duration = Duration::from_secs(60 * 60);

pub(super) fn directory(data_path: &Path) -> Result<PathBuf, String> {
    data_path
        .parent()
        .map(|parent| parent.join("link-previews"))
        .ok_or_else(|| "The data path has no parent folder.".to_string())
}

pub(super) fn key(url: &Url) -> String {
    Sha256::digest(url.as_str().as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub(super) fn metadata_path(root: &Path, key: &str) -> PathBuf {
    root.join("metadata").join(format!("{key}.json"))
}

pub(super) fn failure_path(root: &Path, key: &str) -> PathBuf {
    root.join("metadata").join(format!("{key}.failed"))
}

pub(super) fn image_relative_path(key: &str, extension: &str) -> String {
    format!("images/{key}.{extension}")
}

pub(super) fn validated_image_path(data_path: &Path, relative: &str) -> Result<PathBuf, String> {
    let mut components = Path::new(relative).components();
    let valid = matches!(components.next(), Some(Component::Normal(value)) if value == "images")
        && matches!(components.next(), Some(Component::Normal(_)))
        && components.next().is_none();
    if !valid {
        return Err("Invalid link preview image path.".to_string());
    }
    Ok(directory(data_path)?.join(relative))
}

pub(super) fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "The cache path has no parent folder.".to_string())?;
    fs::create_dir_all(parent).map_err(io_error)?;
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, bytes).map_err(io_error)?;
    if path.exists() {
        fs::remove_file(path).map_err(io_error)?;
    }
    fs::rename(temporary, path).map_err(io_error)
}

pub(super) fn failure_is_fresh(path: &Path) -> bool {
    path.metadata()
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| SystemTime::now().duration_since(modified).ok())
        .is_some_and(|age| age < FAILED_CACHE_TTL)
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

pub(super) fn copy_cache(source_data: &Path, destination_data: &Path) -> Result<(), String> {
    let source = directory(source_data)?;
    let destination = directory(destination_data)?;
    if !source.exists() || source == destination {
        return Ok(());
    }
    copy_directory(&source, &destination)
}
