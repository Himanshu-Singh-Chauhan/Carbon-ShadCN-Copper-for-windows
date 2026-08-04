use serde_json::Value;
use std::{collections::VecDeque, sync::Mutex, thread, time::Duration};
use tauri::{AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, State};

use crate::{io_error, window_manager};

const DESTROY_GRACE_PERIOD: Duration = Duration::from_millis(1_500);

#[derive(Default)]
struct CaptureNotificationState {
    queue: VecDeque<Value>,
    revision: u64,
    frontend_idle: bool,
}

#[derive(Default)]
pub(crate) struct PendingCaptureNotifications(Mutex<CaptureNotificationState>);

impl PendingCaptureNotifications {
    fn enqueue(&self, payload: Value) -> Result<(), String> {
        let mut state = self.0.lock().map_err(io_error)?;
        state.queue.push_back(payload);
        state.frontend_idle = false;
        state.revision = state.revision.wrapping_add(1);
        Ok(())
    }

    fn take_all(&self) -> Result<Vec<Value>, String> {
        Ok(self.0.lock().map_err(io_error)?.queue.drain(..).collect())
    }

    fn begin_idle_grace_period(&self) -> Result<Option<u64>, String> {
        let mut state = self.0.lock().map_err(io_error)?;
        if !state.queue.is_empty() || state.frontend_idle {
            return Ok(None);
        }
        state.frontend_idle = true;
        state.revision = state.revision.wrapping_add(1);
        Ok(Some(state.revision))
    }

    fn destroy_window_if_still_idle(
        &self,
        app: &AppHandle,
        expected_revision: u64,
    ) -> Result<(), String> {
        let state = self.0.lock().map_err(io_error)?;
        if state.revision != expected_revision || !state.frontend_idle || !state.queue.is_empty() {
            return Ok(());
        }
        window_manager::destroy_capture_toast(app)
    }
}

async fn present_capture_notification(app: AppHandle) -> Result<(), String> {
    let builder_app = app.clone();
    let window = tauri::async_runtime::spawn_blocking(move || {
        window_manager::ensure_capture_toast(&builder_app)
    })
    .await
    .map_err(io_error)??;

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
    app.emit_to(
        window_manager::CAPTURE_TOAST_WINDOW_LABEL,
        "capture-notification-ready",
        (),
    )
    .map_err(io_error)
}

pub(crate) fn display_capture_notification(
    app: &AppHandle,
    pending: &PendingCaptureNotifications,
    payload: Value,
) -> Result<(), String> {
    pending.enqueue(payload)?;
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = present_capture_notification(app).await;
    });
    Ok(())
}

#[tauri::command]
pub(crate) fn take_capture_notifications(
    pending: State<'_, PendingCaptureNotifications>,
) -> Result<Vec<Value>, String> {
    pending.take_all()
}

#[tauri::command]
pub(crate) fn capture_notifications_idle(
    app: AppHandle,
    pending: State<'_, PendingCaptureNotifications>,
) -> Result<(), String> {
    let Some(revision) = pending.begin_idle_grace_period()? else {
        return Ok(());
    };

    thread::spawn(move || {
        thread::sleep(DESTROY_GRACE_PERIOD);
        let pending = app.state::<PendingCaptureNotifications>();
        let _ = pending.destroy_window_if_still_idle(&app, revision);
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn queued_notifications_prevent_idle_teardown() {
        let pending = PendingCaptureNotifications::default();
        pending.enqueue(json!({ "kind": "status" })).unwrap();

        assert_eq!(pending.begin_idle_grace_period().unwrap(), None);
        assert_eq!(pending.take_all().unwrap().len(), 1);
        assert!(pending.begin_idle_grace_period().unwrap().is_some());
    }

    #[test]
    fn a_new_notification_invalidates_the_idle_revision() {
        let pending = PendingCaptureNotifications::default();
        let revision = pending.begin_idle_grace_period().unwrap().unwrap();
        pending.enqueue(json!({ "kind": "status" })).unwrap();

        let state = pending.0.lock().unwrap();
        assert_ne!(state.revision, revision);
        assert!(!state.frontend_idle);
    }
}
