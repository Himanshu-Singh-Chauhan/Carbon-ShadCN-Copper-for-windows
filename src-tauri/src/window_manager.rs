use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder};

use crate::{environment_data_dir, io_error};

pub(crate) const MAIN_WINDOW_LABEL: &str = "main";
pub(crate) const CAPTURE_TOAST_WINDOW_LABEL: &str = "capture-toast";
pub(crate) const IMAGE_VIEWER_WINDOW_LABEL: &str = "image-viewer";
static MAIN_WINDOW_CREATION: Mutex<()> = Mutex::new(());
static CAPTURE_TOAST_CREATION: Mutex<()> = Mutex::new(());
static MAIN_WINDOW_LIFECYCLE: Mutex<MainWindowLifecycle> = Mutex::new(MainWindowLifecycle {
    ready: false,
    show_requested: false,
});

struct MainWindowLifecycle {
    ready: bool,
    show_requested: bool,
}

fn shared_webview_data_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map(environment_data_dir)
        .map(|path| path.join("webview"))
        .map_err(io_error)?;
    fs::create_dir_all(&directory).map_err(io_error)?;
    Ok(directory)
}

fn configured_window(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|config| config.label == label)
        .ok_or_else(|| format!("Window configuration `{label}` is unavailable."))?;

    WebviewWindowBuilder::from_config(app, config)
        .map_err(io_error)?
        .data_directory(shared_webview_data_directory(app)?)
        .build()
        .map_err(io_error)
}

pub(crate) fn create_initial_windows(_app: &AppHandle) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        MAIN_WINDOW_LIFECYCLE
            .lock()
            .map_err(io_error)?
            .show_requested = true;
        ensure_main_window(_app)?;
    }
    Ok(())
}

pub(crate) fn ensure_capture_toast(app: &AppHandle) -> Result<WebviewWindow, String> {
    let _creation = CAPTURE_TOAST_CREATION.lock().map_err(io_error)?;
    if let Some(window) = app.get_webview_window(CAPTURE_TOAST_WINDOW_LABEL) {
        return Ok(window);
    }
    configured_window(app, CAPTURE_TOAST_WINDOW_LABEL)
}

pub(crate) fn destroy_capture_toast(app: &AppHandle) -> Result<(), String> {
    let _creation = CAPTURE_TOAST_CREATION.lock().map_err(io_error)?;
    if let Some(window) = app.get_webview_window(CAPTURE_TOAST_WINDOW_LABEL) {
        window.destroy().map_err(io_error)?;
    }
    Ok(())
}

fn ensure_main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    let _creation = MAIN_WINDOW_CREATION.lock().map_err(io_error)?;
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        return Ok(window);
    }
    configured_window(app, MAIN_WINDOW_LABEL)
}

pub(crate) async fn show_main_window(app: AppHandle) -> Result<(), String> {
    MAIN_WINDOW_LIFECYCLE
        .lock()
        .map_err(io_error)?
        .show_requested = true;
    let builder_app = app.clone();
    tauri::async_runtime::spawn_blocking(move || ensure_main_window(&builder_app))
        .await
        .map_err(io_error)??;
    show_main_window_if_ready(&app)
}

fn show_main_window_if_ready(app: &AppHandle) -> Result<(), String> {
    let should_show = {
        let mut lifecycle = MAIN_WINDOW_LIFECYCLE.lock().map_err(io_error)?;
        if !lifecycle.ready || !lifecycle.show_requested {
            false
        } else {
            lifecycle.show_requested = false;
            true
        }
    };
    if !should_show {
        return Ok(());
    }
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "The main window is unavailable.".to_string())?;
    let _ = window.unminimize();
    window.show().map_err(io_error)?;
    window.set_focus().map_err(io_error)
}

pub(crate) fn main_window_ready(app: &AppHandle) -> Result<(), String> {
    MAIN_WINDOW_LIFECYCLE.lock().map_err(io_error)?.ready = true;
    show_main_window_if_ready(app)
}

pub(crate) fn request_show_main_window(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = show_main_window(app).await;
    });
}

pub(crate) fn minimize_main_window(app: &AppHandle) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        MAIN_WINDOW_LIFECYCLE
            .lock()
            .map_err(io_error)?
            .show_requested = false;
        if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
            window.hide().map_err(io_error)?;
        }
        return Ok(());
    }

    #[cfg(not(debug_assertions))]
    {
        if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
            window.destroy().map_err(io_error)?;
        }
        let mut lifecycle = MAIN_WINDOW_LIFECYCLE.lock().map_err(io_error)?;
        lifecycle.ready = false;
        lifecycle.show_requested = false;
        Ok(())
    }
}

pub(crate) fn ensure_image_viewer(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(IMAGE_VIEWER_WINDOW_LABEL) {
        return Ok(window);
    }
    configured_window(app, IMAGE_VIEWER_WINDOW_LABEL)
}

pub(crate) fn destroy_image_viewer(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(IMAGE_VIEWER_WINDOW_LABEL) {
        window.destroy().map_err(io_error)?;
    }
    Ok(())
}
