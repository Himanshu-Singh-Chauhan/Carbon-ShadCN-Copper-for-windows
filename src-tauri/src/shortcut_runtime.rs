use serde::Serialize;
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::{
    double_shortcut,
    selection_capture::capture_selected_text,
    storage::{append_captured_item, CarbonStorageState},
    PendingCaptureNotifications,
};

static CAPTURE_IN_FLIGHT: AtomicBool = AtomicBool::new(false);

#[derive(Default)]
pub(crate) struct ShortcutRuntimeState(Mutex<RegisteredShortcuts>);

#[derive(Default)]
struct RegisteredShortcuts {
    capture: Option<String>,
    show_window: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShortcutConfiguration {
    capture_ready: bool,
    capture_error: Option<String>,
    show_window_error: Option<String>,
}

fn double_press_modifier(shortcut: &str) -> Option<&'static str> {
    match shortcut {
        "DoubleShift" => Some("shift"),
        "DoubleControl" => Some("control"),
        "DoubleAlt" => Some("alt"),
        _ => None,
    }
}

fn unregister_current(app: &AppHandle, current: &mut Option<String>) {
    if let Some(shortcut) = current.take() {
        let _ = app.global_shortcut().unregister(shortcut.as_str());
    }
}

#[tauri::command]
pub(crate) fn configure_native_shortcuts(
    app: AppHandle,
    state: State<'_, ShortcutRuntimeState>,
    capture_hotkey: String,
    show_window_hotkey: String,
    enabled: bool,
) -> Result<ShortcutConfiguration, String> {
    configure_shortcuts(
        &app,
        state.inner(),
        capture_hotkey,
        show_window_hotkey,
        enabled,
    )
}

pub(crate) fn configure_shortcuts(
    app: &AppHandle,
    state: &ShortcutRuntimeState,
    capture_hotkey: String,
    show_window_hotkey: String,
    enabled: bool,
) -> Result<ShortcutConfiguration, String> {
    let mut registered = state.0.lock().map_err(crate::io_error)?;
    unregister_current(app, &mut registered.capture);
    unregister_current(app, &mut registered.show_window);

    let capture_modifier = enabled
        .then(|| double_press_modifier(&capture_hotkey))
        .flatten();
    let show_modifier = enabled
        .then(|| double_press_modifier(&show_window_hotkey))
        .flatten();
    double_shortcut::configure(capture_modifier, show_modifier)?;

    if !enabled {
        return Ok(ShortcutConfiguration {
            capture_ready: true,
            capture_error: None,
            show_window_error: None,
        });
    }

    let capture_error = if capture_modifier.is_none() {
        match app
            .global_shortcut()
            .on_shortcut(capture_hotkey.as_str(), |app, _, event| {
                if event.state == ShortcutState::Pressed {
                    capture_in_background(app.clone());
                }
            }) {
            Ok(()) => {
                registered.capture = Some(capture_hotkey.clone());
                None
            }
            Err(error) => Some(error.to_string()),
        }
    } else {
        None
    };

    let show_window_error = if show_modifier.is_none() {
        if show_window_hotkey == capture_hotkey && capture_modifier.is_none() {
            Some("The show-window shortcut is already used for capture.".to_string())
        } else {
            match app
                .global_shortcut()
                .on_shortcut(show_window_hotkey.as_str(), |app, _, event| {
                    if event.state == ShortcutState::Pressed {
                        crate::window_manager::request_show_main_window(app);
                    }
                }) {
                Ok(()) => {
                    registered.show_window = Some(show_window_hotkey);
                    None
                }
                Err(error) => Some(error.to_string()),
            }
        }
    } else {
        None
    };

    Ok(ShortcutConfiguration {
        capture_ready: capture_error.is_none(),
        capture_error,
        show_window_error,
    })
}

fn notification_id() -> String {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("capture-status-{timestamp:x}")
}

fn status_payload(message: &str, tone: &str) -> Value {
    json!({
        "kind": "status",
        "message": message,
        "notificationId": notification_id(),
        "tone": tone
    })
}

fn show_status(app: &AppHandle, message: &str, tone: &str) {
    let pending = app.state::<PendingCaptureNotifications>();
    let _ =
        crate::display_capture_notification(app, pending.inner(), status_payload(message, tone));
}

pub(crate) fn capture_in_background(app: AppHandle) {
    if CAPTURE_IN_FLIGHT.swap(true, Ordering::AcqRel) {
        return;
    }
    std::thread::spawn(move || {
        let result = capture_selected_text(app.clone());
        match result {
            Ok(captured) => {
                let text = captured.text.trim().to_string();
                if text.is_empty() {
                    show_status(&app, "No selection", "info");
                } else {
                    let storage = app.state::<CarbonStorageState>();
                    match append_captured_item(&app, storage.inner(), text, captured.source) {
                        Ok(saved) => {
                            let preview = saved
                                .item
                                .get("text")
                                .and_then(Value::as_str)
                                .unwrap_or_default()
                                .split_whitespace()
                                .collect::<Vec<_>>()
                                .join(" ")
                                .chars()
                                .take(160)
                                .collect::<String>();
                            let _ = app.emit_to(
                                "main",
                                "native-captured-item-added",
                                json!({
                                    "item": saved.item.clone(),
                                    "sectionId": saved.section_id.clone()
                                }),
                            );
                            let pending = app.state::<PendingCaptureNotifications>();
                            let _ = crate::display_capture_notification(
                                &app,
                                pending.inner(),
                                json!({
                                    "kind": "saved",
                                    "message": "Captured to Carbon",
                                    "preview": preview,
                                    "itemId": saved.item.get("id").and_then(Value::as_str),
                                    "bucketId": saved.section_id,
                                    "buckets": saved.buckets
                                }),
                            );
                        }
                        Err(_) => show_status(&app, "Couldn’t save the capture", "error"),
                    }
                }
            }
            Err(error) => {
                let message = if error.contains("Editor: Accessibility Support") {
                    "VS Code needs Accessibility Support enabled"
                } else {
                    "Couldn’t read this app’s selection"
                };
                show_status(&app, message, "error");
            }
        }
        CAPTURE_IN_FLIGHT.store(false, Ordering::Release);
    });
}
