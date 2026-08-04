mod browser;
mod icon;
mod process;

use tauri::AppHandle;
use windows::Win32::{
    Foundation::HWND,
    UI::{Accessibility::IUIAutomation, WindowsAndMessaging::GetForegroundWindow},
};

use super::CapturedSource;
use browser::{address_bar_url, page_title};
use icon::{cached_icon, source_id};
use process::{app_name, browser_name, executable_stem, is_code_editor_stem, process_path};

pub fn capture(
    app: &AppHandle,
    automation: &IUIAutomation,
    window: HWND,
) -> Option<CapturedSource> {
    let executable = process_path(window)?;
    let stem = executable_stem(&executable);
    let browser = browser_name(&stem);
    let name = app_name(&executable);
    let id = source_id(&executable);
    let (page_title, page_url) = if browser.is_some() {
        (
            page_title(window, &name),
            address_bar_url(automation, window),
        )
    } else {
        (None, None)
    };
    Some(CapturedSource {
        icon_path: cached_icon(app, &executable, &id),
        id,
        app_name: name,
        page_title,
        page_url,
    })
}

pub fn foreground_window() -> Option<HWND> {
    let window = unsafe { GetForegroundWindow() };
    (window != HWND::default()).then_some(window)
}

pub fn is_code_editor(window: HWND) -> bool {
    process_path(window)
        .as_deref()
        .map(executable_stem)
        .is_some_and(|stem| is_code_editor_stem(&stem))
}
