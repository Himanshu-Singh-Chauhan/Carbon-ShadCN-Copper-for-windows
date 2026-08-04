mod app_source;
mod capture_notifications;
mod double_shortcut;
mod link_preview;
mod selection_capture;
mod shortcut_runtime;
mod storage;
mod window_manager;

use serde_json::Value;
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State,
};

use capture_notifications::{
    capture_notifications_idle, take_capture_notifications, PendingCaptureNotifications,
};
use storage::{
    choose_data_file, copy_image_asset, copy_items_to_clipboard_history, get_data_file_path,
    load_carbon_data, load_shortcut_settings, move_captured_item, read_image_asset,
    resolve_image_asset_path, reveal_data_file, save_carbon_data, save_image_asset,
    trash_image_asset, CarbonStorageState, DEFAULT_CAPTURE_HOTKEY, DEFAULT_SHOW_WINDOW_HOTKEY,
};

pub(crate) const DATA_FILE_NAME: &str = "carbon-data.json";
const LOCATION_FILE_NAME: &str = "data-location.txt";
#[cfg(debug_assertions)]
const DEVELOPMENT_DIRECTORY_NAME: &str = "development";

#[derive(Default)]
struct PendingImageViewer(Mutex<Option<Value>>);

pub(crate) fn io_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

pub(crate) fn environment_data_dir(path: PathBuf) -> PathBuf {
    #[cfg(debug_assertions)]
    {
        return path.join(DEVELOPMENT_DIRECTORY_NAME);
    }

    #[cfg(not(debug_assertions))]
    path
}

pub(crate) fn location_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(environment_data_dir)
        .map(|path| path.join(LOCATION_FILE_NAME))
        .map_err(io_error)
}

fn default_data_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(environment_data_dir)
        .map(|path| path.join(DATA_FILE_NAME))
        .map_err(io_error)
}

pub(crate) fn resolve_data_path(app: &AppHandle) -> Result<PathBuf, String> {
    let pointer = location_file_path(app)?;
    if let Ok(value) = fs::read_to_string(pointer) {
        let path = PathBuf::from(value.trim());
        if path.is_absolute() {
            return Ok(path);
        }
    }
    default_data_path(app)
}

#[tauri::command]
async fn show_main_window(app: AppHandle) -> Result<(), String> {
    window_manager::show_main_window(app).await
}

#[tauri::command]
fn minimize_main_window(app: AppHandle) -> Result<(), String> {
    window_manager::minimize_main_window(&app)
}

#[tauri::command]
fn main_window_ready(app: AppHandle) -> Result<(), String> {
    window_manager::main_window_ready(&app)
}

#[tauri::command]
async fn show_image_viewer(
    app: AppHandle,
    pending: State<'_, PendingImageViewer>,
    payload: Value,
) -> Result<(), String> {
    *pending.0.lock().map_err(io_error)? = Some(payload);
    let viewer_app = app.clone();
    let window = tauri::async_runtime::spawn_blocking(move || {
        window_manager::ensure_image_viewer(&viewer_app)
    })
    .await
    .map_err(io_error)??;
    let _ = window.unminimize();
    window.show().map_err(io_error)?;
    window.set_focus().map_err(io_error)?;
    app.emit_to(
        window_manager::IMAGE_VIEWER_WINDOW_LABEL,
        "image-viewer-ready",
        (),
    )
    .map_err(io_error)
}

#[tauri::command]
fn close_image_viewer(app: AppHandle) -> Result<(), String> {
    window_manager::destroy_image_viewer(&app)
}

#[tauri::command]
fn take_image_viewer_payload(
    pending: State<'_, PendingImageViewer>,
) -> Result<Option<Value>, String> {
    Ok(pending.0.lock().map_err(io_error)?.take())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn configure_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    double_shortcut::start(app.handle().clone());
    window_manager::create_initial_windows(app.handle())?;
    let shortcut_settings =
        load_shortcut_settings(app.handle(), app.state::<CarbonStorageState>().inner())
            .unwrap_or_else(|_| {
                (
                    DEFAULT_CAPTURE_HOTKEY.to_string(),
                    DEFAULT_SHOW_WINDOW_HOTKEY.to_string(),
                )
            });
    let _ = shortcut_runtime::configure_shortcuts(
        app.handle(),
        app.state::<shortcut_runtime::ShortcutRuntimeState>()
            .inner(),
        shortcut_settings.0,
        shortcut_settings.1,
        true,
    );
    let show = MenuItem::with_id(app, "show", "Show Carbon", true, None::<&str>)?;
    let always_on_top = MenuItem::with_id(
        app,
        "always-on-top",
        "Toggle Always on Top",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Quit Carbon", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &always_on_top, &quit])?;

    let mut tray = TrayIconBuilder::new()
        .tooltip("Carbon — capture what matters")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => window_manager::request_show_main_window(app),
            "always-on-top" => {
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(current) = window.is_always_on_top() {
                        let _ = window.set_always_on_top(!current);
                        let _ = app.emit("always-on-top-changed", !current);
                    }
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                window_manager::request_show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PendingCaptureNotifications::default())
        .manage(PendingImageViewer::default())
        .manage(CarbonStorageState::default())
        .manage(shortcut_runtime::ShortcutRuntimeState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_global_shortcut::Builder::default().build())
        .setup(configure_tray)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != window_manager::IMAGE_VIEWER_WINDOW_LABEL {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_carbon_data,
            save_carbon_data,
            get_data_file_path,
            show_main_window,
            minimize_main_window,
            main_window_ready,
            shortcut_runtime::configure_native_shortcuts,
            choose_data_file,
            reveal_data_file,
            save_image_asset,
            read_image_asset,
            resolve_image_asset_path,
            copy_image_asset,
            copy_items_to_clipboard_history,
            move_captured_item,
            link_preview::get_link_preview,
            link_preview::read_link_preview_image,
            link_preview::fetch_dropped_image,
            app_source::read_app_source_icon,
            trash_image_asset,
            take_capture_notifications,
            capture_notifications_idle,
            show_image_viewer,
            close_image_viewer,
            take_image_viewer_payload,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running Carbon");
}
