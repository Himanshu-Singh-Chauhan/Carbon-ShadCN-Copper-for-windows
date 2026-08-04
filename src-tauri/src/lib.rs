mod app_source;
mod double_shortcut;
mod link_preview;
mod selection_capture;
mod storage;

use serde_json::Value;
use std::{collections::VecDeque, fs, path::PathBuf, sync::Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, State,
};

use selection_capture::capture_selected_text;
use storage::{
    choose_data_file, copy_image_asset, copy_items_to_clipboard_history, get_data_file_path,
    load_carbon_data, read_image_asset, reveal_data_file, save_carbon_data, save_image_asset,
    trash_image_asset,
};

pub(crate) const DATA_FILE_NAME: &str = "carbon-data.json";
const LOCATION_FILE_NAME: &str = "data-location.txt";
#[cfg(debug_assertions)]
const DEVELOPMENT_DIRECTORY_NAME: &str = "development";

#[derive(Default)]
struct PendingCaptureNotifications(Mutex<VecDeque<Value>>);

#[derive(Default)]
struct PendingImageViewer(Mutex<Option<Value>>);

pub(crate) fn io_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn environment_data_dir(path: PathBuf) -> PathBuf {
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
fn show_main_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "The main window is unavailable.".to_string())?;
    window.unminimize().map_err(io_error)?;
    window.show().map_err(io_error)?;
    window.set_focus().map_err(io_error)
}

#[tauri::command]
fn show_capture_notification(
    app: AppHandle,
    pending: State<'_, PendingCaptureNotifications>,
    payload: Value,
) -> Result<(), String> {
    pending.0.lock().map_err(io_error)?.push_back(payload);
    let window = app
        .get_webview_window("capture-toast")
        .ok_or_else(|| "The capture notification window is unavailable.".to_string())?;
    let cursor = app.cursor_position().map_err(io_error)?;
    let monitor = app
        .monitor_from_point(cursor.x, cursor.y)
        .map_err(io_error)?
        .or(app.primary_monitor().map_err(io_error)?)
        .ok_or_else(|| "No active monitor was found.".to_string())?;
    let work_area = monitor.work_area();
    window
        .set_size(LogicalSize::new(360.0, 520.0))
        .map_err(io_error)?;
    let window_size = window.outer_size().map_err(io_error)?;
    let x = work_area.position.x
        + ((work_area.size.width as i64 - window_size.width as i64) / 2) as i32;
    let y = work_area.position.y + work_area.size.height as i32 - window_size.height as i32 - 28;

    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(io_error)?;
    let _ = window.set_ignore_cursor_events(false);
    let _ = window.set_focusable(false);
    window.show().map_err(io_error)?;
    app.emit_to("capture-toast", "capture-notification-ready", ())
        .map_err(io_error)
}

#[tauri::command]
fn take_capture_notifications(
    pending: State<'_, PendingCaptureNotifications>,
) -> Result<Vec<Value>, String> {
    Ok(pending.0.lock().map_err(io_error)?.drain(..).collect())
}

#[tauri::command]
fn show_image_viewer(
    app: AppHandle,
    pending: State<'_, PendingImageViewer>,
    payload: Value,
) -> Result<(), String> {
    *pending.0.lock().map_err(io_error)? = Some(payload);
    let window = app
        .get_webview_window("image-viewer")
        .ok_or_else(|| "The image viewer window is unavailable.".to_string())?;
    let _ = window.unminimize();
    window.show().map_err(io_error)?;
    window.set_focus().map_err(io_error)?;
    app.emit_to("image-viewer", "image-viewer-ready", ())
        .map_err(io_error)
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

fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn configure_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    double_shortcut::start(app.handle().clone());
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
            "show" => show_window(app),
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
                show_window(tray.app_handle());
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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::default().build())
        .setup(configure_tray)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_carbon_data,
            save_carbon_data,
            get_data_file_path,
            show_main_window,
            double_shortcut::configure_double_press_shortcuts,
            choose_data_file,
            reveal_data_file,
            save_image_asset,
            read_image_asset,
            copy_image_asset,
            copy_items_to_clipboard_history,
            link_preview::get_link_preview,
            link_preview::read_link_preview_image,
            app_source::read_app_source_icon,
            trash_image_asset,
            capture_selected_text,
            show_capture_notification,
            take_capture_notifications,
            show_image_viewer,
            take_image_viewer_payload,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running Carbon");
}
