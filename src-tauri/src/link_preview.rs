use reqwest::{
    blocking::{Client, Response},
    header::{ACCEPT, CONTENT_LENGTH, CONTENT_TYPE, LOCATION},
    redirect::Policy,
    Url,
};
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    net::{IpAddr, Ipv6Addr, ToSocketAddrs},
    path::{Component, Path, PathBuf},
    time::{Duration, SystemTime},
};
use tauri::AppHandle;

use super::{io_error, resolve_data_path};

const MAX_HTML_BYTES: u64 = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES: u64 = 8 * 1024 * 1024;
const FAILED_CACHE_TTL: Duration = Duration::from_secs(60 * 60);
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/124.0 Safari/537.36 CarbonLinkPreview/0.1";

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

fn cache_directory(data_path: &Path) -> Result<PathBuf, String> {
    data_path
        .parent()
        .map(|parent| parent.join("link-previews"))
        .ok_or_else(|| "The data path has no parent folder.".to_string())
}

fn cache_key(url: &Url) -> String {
    Sha256::digest(url.as_str().as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn metadata_path(root: &Path, key: &str) -> PathBuf {
    root.join("metadata").join(format!("{key}.json"))
}

fn failure_path(root: &Path, key: &str) -> PathBuf {
    root.join("metadata").join(format!("{key}.failed"))
}

fn image_relative_path(key: &str, extension: &str) -> String {
    format!("images/{key}.{extension}")
}

fn validated_cache_path(data_path: &Path, relative: &str) -> Result<PathBuf, String> {
    let mut components = Path::new(relative).components();
    let valid = matches!(components.next(), Some(Component::Normal(value)) if value == "images")
        && matches!(components.next(), Some(Component::Normal(_)))
        && components.next().is_none();
    if !valid {
        return Err("Invalid link preview image path.".to_string());
    }
    Ok(cache_directory(data_path)?.join(relative))
}

fn is_public_ip(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => {
            !(address.is_private()
                || address.is_loopback()
                || address.is_link_local()
                || address.is_broadcast()
                || address.is_documentation()
                || address.is_unspecified()
                || address.is_multicast()
                || address.octets()[0] == 0)
        }
        IpAddr::V6(address) => {
            if let Some(mapped) = address.to_ipv4_mapped() {
                return is_public_ip(IpAddr::V4(mapped));
            }
            !(address.is_loopback()
                || address.is_unspecified()
                || address.is_multicast()
                || is_unique_local(address)
                || is_ipv6_link_local(address))
        }
    }
}

fn is_unique_local(address: Ipv6Addr) -> bool {
    address.segments()[0] & 0xfe00 == 0xfc00
}

fn is_ipv6_link_local(address: Ipv6Addr) -> bool {
    address.segments()[0] & 0xffc0 == 0xfe80
}

fn validate_public_url(url: &Url) -> Result<(), String> {
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Only HTTP and HTTPS links can be previewed.".to_string());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "The link has no host.".to_string())?;
    if host.eq_ignore_ascii_case("localhost") || host.ends_with(".local") {
        return Err("Local network links are not previewed.".to_string());
    }

    if let Ok(address) = host.parse::<IpAddr>() {
        return is_public_ip(address)
            .then_some(())
            .ok_or_else(|| "Local network links are not previewed.".to_string());
    }

    let port = url
        .port_or_known_default()
        .ok_or_else(|| "The link uses an unsupported port.".to_string())?;
    let addresses = (host, port).to_socket_addrs().map_err(io_error)?;
    let addresses: Vec<_> = addresses.collect();
    if addresses.is_empty() || addresses.iter().any(|address| !is_public_ip(address.ip())) {
        return Err("Local network links are not previewed.".to_string());
    }
    Ok(())
}

fn limited_body(response: Response, limit: u64) -> Result<Vec<u8>, String> {
    if response
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
        .is_some_and(|length| length > limit)
    {
        return Err("The remote preview is too large.".to_string());
    }

    let mut bytes = Vec::new();
    response
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(io_error)?;
    if bytes.len() as u64 > limit {
        return Err("The remote preview is too large.".to_string());
    }
    Ok(bytes)
}

fn fetch(
    client: &Client,
    mut url: Url,
    accept: &str,
    limit: u64,
) -> Result<(Url, String, Vec<u8>), String> {
    for _ in 0..=5 {
        validate_public_url(&url)?;
        let response = client
            .get(url.clone())
            .header(ACCEPT, accept)
            .send()
            .map_err(io_error)?;

        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or_else(|| "The link redirected without a destination.".to_string())?;
            url = url.join(location).map_err(io_error)?;
            continue;
        }
        if !response.status().is_success() {
            return Err(format!(
                "The preview request returned {}.",
                response.status()
            ));
        }

        let mime_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .split(';')
            .next()
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase();
        return Ok((url, mime_type, limited_body(response, limit)?));
    }
    Err("The link redirected too many times.".to_string())
}

fn clean_text(value: &str, max_chars: usize) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(max_chars)
        .collect()
}

fn parse_metadata(
    html: &str,
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
) {
    let document = Html::parse_document(html);
    let meta_selector = Selector::parse("meta").expect("valid meta selector");
    let title_selector = Selector::parse("title").expect("valid title selector");
    let mut title = None;
    let mut description = None;
    let mut site_name = None;
    let mut image = None;

    for element in document.select(&meta_selector) {
        let value = element.value();
        let key = value
            .attr("property")
            .or_else(|| value.attr("name"))
            .unwrap_or_default()
            .to_ascii_lowercase();
        let Some(content) = value
            .attr("content")
            .filter(|content| !content.trim().is_empty())
        else {
            continue;
        };
        match key.as_str() {
            "og:title" if title.is_none() => title = Some(clean_text(content, 180)),
            "twitter:title" if title.is_none() => title = Some(clean_text(content, 180)),
            "og:description" if description.is_none() => {
                description = Some(clean_text(content, 320))
            }
            "twitter:description" if description.is_none() => {
                description = Some(clean_text(content, 320))
            }
            "og:site_name" if site_name.is_none() => site_name = Some(clean_text(content, 80)),
            "og:image" | "og:image:url" if image.is_none() => image = Some(content.to_string()),
            "twitter:image" | "twitter:image:src" if image.is_none() => {
                image = Some(content.to_string())
            }
            _ => {}
        }
    }

    if title.is_none() {
        title = document
            .select(&title_selector)
            .next()
            .map(|element| clean_text(&element.text().collect::<String>(), 180))
            .filter(|value| !value.is_empty());
    }
    (title, description, site_name, image)
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

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
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

fn failure_is_fresh(path: &Path) -> bool {
    path.metadata()
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| SystemTime::now().duration_since(modified).ok())
        .is_some_and(|age| age < FAILED_CACHE_TTL)
}

fn load_preview(app: &AppHandle, raw_url: &str) -> Result<Option<LinkPreview>, String> {
    let url = Url::parse(raw_url).map_err(io_error)?;
    validate_public_url(&url)?;
    let data_path = resolve_data_path(app)?;
    let root = cache_directory(&data_path)?;
    let key = cache_key(&url);
    let metadata = metadata_path(&root, &key);
    let failure = failure_path(&root, &key);

    if let Ok(bytes) = fs::read(&metadata) {
        if let Ok(preview) = serde_json::from_slice(&bytes) {
            return Ok(Some(preview));
        }
    }
    if failure_is_fresh(&failure) {
        return Ok(None);
    }

    let result = (|| {
        let client = Client::builder()
            .redirect(Policy::none())
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(12))
            .user_agent(USER_AGENT)
            .build()
            .map_err(io_error)?;
        let (page_url, _, html_bytes) = fetch(
            &client,
            url.clone(),
            "text/html,application/xhtml+xml",
            MAX_HTML_BYTES,
        )?;
        let html = String::from_utf8_lossy(&html_bytes);
        let (title, description, site_name, image_url) = parse_metadata(&html);
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
                    fetch(&client, image_url, "image/*", MAX_IMAGE_BYTES)
                {
                    if let Some(extension) = image_format(&mime_type) {
                        let relative = image_relative_path(&key, extension);
                        write_atomic(&root.join(&relative), &bytes)?;
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
        write_atomic(&metadata, &serde_json::to_vec(&preview).map_err(io_error)?)?;
        let _ = fs::remove_file(&failure);
        Ok(Some(preview))
    })();

    if !matches!(result, Ok(Some(_))) {
        let _ = write_atomic(&failure, b"");
    }
    result
}

#[tauri::command]
pub async fn get_link_preview(app: AppHandle, url: String) -> Result<Option<LinkPreview>, String> {
    tauri::async_runtime::spawn_blocking(move || load_preview(&app, &url).unwrap_or(None))
        .await
        .map_err(io_error)
}

#[tauri::command]
pub fn read_link_preview_image(
    app: AppHandle,
    path: String,
) -> Result<tauri::ipc::Response, String> {
    let data_path = resolve_data_path(&app)?;
    let path = validated_cache_path(&data_path, &path)?;
    let bytes = fs::read(path).map_err(io_error)?;
    Ok(tauri::ipc::Response::new(bytes))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_open_graph_and_twitter_fallbacks() {
        let html = r#"
            <html>
              <head>
                <title>Document title</title>
                <meta property="og:title" content="A useful link">
                <meta property="og:site_name" content="Example">
                <meta name="twitter:description" content="A compact description">
                <meta property="og:image" content="/preview.png">
              </head>
            </html>
        "#;
        let (title, description, site_name, image) = parse_metadata(html);
        assert_eq!(title.as_deref(), Some("A useful link"));
        assert_eq!(description.as_deref(), Some("A compact description"));
        assert_eq!(site_name.as_deref(), Some("Example"));
        assert_eq!(image.as_deref(), Some("/preview.png"));
    }

    #[test]
    fn rejects_local_network_urls() {
        for value in [
            "http://localhost",
            "http://127.0.0.1",
            "http://192.168.1.10",
            "http://[::1]",
            "file:///C:/private.txt",
        ] {
            let url = Url::parse(value).expect("valid test URL");
            assert!(validate_public_url(&url).is_err(), "{value}");
        }
    }
}
