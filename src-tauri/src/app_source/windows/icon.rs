use image::{ImageBuffer, Rgba};
use sha2::{Digest, Sha256};
use std::{fs, mem::size_of, os::windows::ffi::OsStrExt, path::Path, time::UNIX_EPOCH};
use tauri::AppHandle;
use windows::{
    core::PCWSTR,
    Win32::{
        Foundation::SIZE,
        Graphics::Gdi::{
            DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO,
            BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
        },
        UI::Shell::{
            IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_BIGGERSIZEOK,
            SIIGBF_ICONONLY,
        },
    },
};

use super::super::cache::cache_directory;
use crate::{io_error, resolve_data_path};

const ICON_SIZE: i32 = 128;

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

pub(super) fn source_id(path: &Path) -> String {
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
            fs::create_dir_all(parent).map_err(io_error)?;
        }
        image
            .save_with_format(destination, image::ImageFormat::Png)
            .map_err(io_error)
    }
}

pub(super) fn cached_icon(app: &AppHandle, executable: &Path, id: &str) -> Option<String> {
    let data_path = resolve_data_path(app).ok()?;
    let key = icon_cache_key(executable, id);
    let relative = format!("icons/{key}.png");
    let destination = cache_directory(&data_path).ok()?.join(&relative);
    if !destination.exists() && save_shell_icon(executable, &destination).is_err() {
        return None;
    }
    Some(relative)
}
