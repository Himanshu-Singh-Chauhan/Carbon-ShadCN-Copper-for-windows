use reqwest::{blocking::Client, redirect::Policy, Url};
use std::{fs, time::Duration};
use tauri::AppHandle;

use super::{cache, metadata, network, LinkPreview};
use crate::{io_error, resolve_data_path};

const MAX_HTML_BYTES: u64 = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES: u64 = 8 * 1024 * 1024;
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/124.0 Safari/537.36 CarbonLinkPreview/0.1";

fn client() -> Result<Client, String> {
    Client::builder()
        .redirect(Policy::none())
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(12))
        .user_agent(USER_AGENT)
        .build()
        .map_err(io_error)
}

fn image_format(mime_type: &str) -> Option<&'static str> {
    match mime_type {
        "image/jpeg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/webp" => Some("webp"),
        "image/gif" => Some("gif"),
        _ => None,
    }
}

pub(super) fn load_preview(app: &AppHandle, raw_url: &str) -> Result<Option<LinkPreview>, String> {
    let url = Url::parse(raw_url).map_err(io_error)?;
    network::validate_public_url(&url)?;
    let data_path = resolve_data_path(app)?;
    let root = cache::directory(&data_path)?;
    let key = cache::key(&url);
    let metadata_path = cache::metadata_path(&root, &key);
    let failure_path = cache::failure_path(&root, &key);

    if let Ok(bytes) = fs::read(&metadata_path) {
        if let Ok(preview) = serde_json::from_slice(&bytes) {
            return Ok(Some(preview));
        }
    }
    if cache::failure_is_fresh(&failure_path) {
        return Ok(None);
    }

    let result = (|| {
        let client = client()?;
        let (page_url, _, html_bytes) = network::fetch(
            &client,
            url.clone(),
            "text/html,application/xhtml+xml",
            MAX_HTML_BYTES,
        )?;
        let html = String::from_utf8_lossy(&html_bytes);
        let (title, description, site_name, image_url) = metadata::parse(&html);
        let site_name = site_name.unwrap_or_else(|| {
            page_url
                .host_str()
                .unwrap_or("Link")
                .trim_start_matches("www.")
                .to_string()
        });

        let mut image_path = None;
        let mut image_mime_type = None;
        if let Some(raw_image_url) = image_url {
            if let Ok(image_url) = page_url.join(&raw_image_url) {
                if let Ok((_, mime_type, bytes)) =
                    network::fetch(&client, image_url, "image/*", MAX_IMAGE_BYTES)
                {
                    if let Some(extension) = image_format(&mime_type) {
                        let relative = cache::image_relative_path(&key, extension);
                        cache::write_atomic(&root.join(&relative), &bytes)?;
                        image_path = Some(relative);
                        image_mime_type = Some(mime_type);
                    }
                }
            }
        }

        if title.is_none() && description.is_none() && image_path.is_none() {
            return Ok(None);
        }
        let preview = LinkPreview {
            url: url.to_string(),
            title: title.unwrap_or_else(|| site_name.clone()),
            description,
            site_name,
            image_path,
            image_mime_type,
        };
        cache::write_atomic(
            &metadata_path,
            &serde_json::to_vec(&preview).map_err(io_error)?,
        )?;
        let _ = fs::remove_file(&failure_path);
        Ok(Some(preview))
    })();

    if !matches!(result, Ok(Some(_))) {
        let _ = cache::write_atomic(&failure_path, b"");
    }
    result
}

pub(super) fn load_dropped_image(raw_url: &str) -> Result<Vec<u8>, String> {
    let url = Url::parse(raw_url).map_err(io_error)?;
    let (_, _, bytes) = network::fetch(&client()?, url, "image/*", MAX_IMAGE_BYTES)?;
    match image::guess_format(&bytes).map_err(io_error)? {
        image::ImageFormat::Bmp
        | image::ImageFormat::Gif
        | image::ImageFormat::Jpeg
        | image::ImageFormat::Png
        | image::ImageFormat::WebP => Ok(bytes),
        _ => Err("This image format is not supported.".to_string()),
    }
}
