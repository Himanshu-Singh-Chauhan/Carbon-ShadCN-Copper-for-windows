use std::{
    sync::{
        mpsc::{self, Sender},
        Mutex, OnceLock,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};
use windows::Win32::{
    Foundation::{LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage,
        UnhookWindowsHookEx, KBDLLHOOKSTRUCT, LLKHF_INJECTED, LLKHF_UP, MSG, WH_KEYBOARD_LL,
    },
};

const DOUBLE_TAP_WINDOW: Duration = Duration::from_millis(500);
const MAX_TAP_DURATION: Duration = Duration::from_millis(650);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Modifier {
    Shift,
    Control,
    Alt,
}

#[derive(Clone, Copy, Debug)]
enum ShortcutAction {
    Capture,
    ShowWindow,
}

#[derive(Default)]
struct TapTracker {
    pressed: bool,
    clean: bool,
    pressed_at: Option<Instant>,
    last_tap: Option<Instant>,
}

#[derive(Default)]
struct Detector {
    sender: Option<Sender<ShortcutAction>>,
    capture: Option<Modifier>,
    show_window: Option<Modifier>,
    shift: TapTracker,
    control: TapTracker,
    alt: TapTracker,
}

static DETECTOR: OnceLock<Mutex<Detector>> = OnceLock::new();

fn detector() -> &'static Mutex<Detector> {
    DETECTOR.get_or_init(|| Mutex::new(Detector::default()))
}

impl Detector {
    fn tracker_mut(&mut self, modifier: Modifier) -> &mut TapTracker {
        match modifier {
            Modifier::Shift => &mut self.shift,
            Modifier::Control => &mut self.control,
            Modifier::Alt => &mut self.alt,
        }
    }

    fn reset_other_taps(&mut self, modifier: Modifier) {
        if modifier != Modifier::Shift {
            self.shift.last_tap = None;
        }
        if modifier != Modifier::Control {
            self.control.last_tap = None;
        }
        if modifier != Modifier::Alt {
            self.alt.last_tap = None;
        }
    }

    fn any_other_pressed(&self, modifier: Modifier) -> bool {
        (modifier != Modifier::Shift && self.shift.pressed)
            || (modifier != Modifier::Control && self.control.pressed)
            || (modifier != Modifier::Alt && self.alt.pressed)
    }

    fn modifier_down(&mut self, modifier: Modifier, now: Instant) {
        self.reset_other_taps(modifier);
        let chorded = self.any_other_pressed(modifier);
        if chorded {
            self.shift.clean = false;
            self.control.clean = false;
            self.alt.clean = false;
        }
        let tracker = self.tracker_mut(modifier);
        if tracker.pressed {
            return;
        }
        tracker.pressed = true;
        tracker.clean = !chorded;
        tracker.pressed_at = Some(now);
    }

    fn modifier_up(&mut self, modifier: Modifier, now: Instant) {
        let tracker = self.tracker_mut(modifier);
        if !tracker.pressed {
            return;
        }
        let is_tap = tracker.clean
            && tracker
                .pressed_at
                .is_some_and(|pressed_at| now.duration_since(pressed_at) <= MAX_TAP_DURATION);
        tracker.pressed = false;
        tracker.clean = false;
        tracker.pressed_at = None;

        if !is_tap {
            tracker.last_tap = None;
            return;
        }
        let is_double = tracker
            .last_tap
            .is_some_and(|last_tap| now.duration_since(last_tap) <= DOUBLE_TAP_WINDOW);
        tracker.last_tap = (!is_double).then_some(now);
        if !is_double {
            return;
        }

        if self.capture == Some(modifier) {
            let _ = self
                .sender
                .as_ref()
                .map(|sender| sender.send(ShortcutAction::Capture));
        }
        if self.show_window == Some(modifier) {
            let _ = self
                .sender
                .as_ref()
                .map(|sender| sender.send(ShortcutAction::ShowWindow));
        }
    }

    fn non_modifier_down(&mut self) {
        self.shift.clean = false;
        self.control.clean = false;
        self.alt.clean = false;
        self.shift.last_tap = None;
        self.control.last_tap = None;
        self.alt.last_tap = None;
    }
}

fn modifier_for_key(key: u32) -> Option<Modifier> {
    match key {
        0x10 | 0xA0 | 0xA1 => Some(Modifier::Shift),
        0x11 | 0xA2 | 0xA3 => Some(Modifier::Control),
        0x12 | 0xA4 | 0xA5 => Some(Modifier::Alt),
        _ => None,
    }
}

unsafe extern "system" fn keyboard_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let event = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };
        if !event.flags.contains(LLKHF_INJECTED) {
            if let Ok(mut state) = detector().lock() {
                let is_up = event.flags.contains(LLKHF_UP);
                if let Some(modifier) = modifier_for_key(event.vkCode) {
                    if is_up {
                        state.modifier_up(modifier, Instant::now());
                    } else {
                        state.modifier_down(modifier, Instant::now());
                    }
                } else if !is_up {
                    state.non_modifier_down();
                }
            }
        }
    }
    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

fn parse_modifier(value: Option<String>) -> Result<Option<Modifier>, String> {
    value
        .map(|value| match value.as_str() {
            "shift" => Ok(Modifier::Shift),
            "control" => Ok(Modifier::Control),
            "alt" => Ok(Modifier::Alt),
            _ => Err("Unsupported double-press modifier.".to_string()),
        })
        .transpose()
}

#[tauri::command]
pub fn configure_double_press_shortcuts(
    capture: Option<String>,
    show_window: Option<String>,
) -> Result<(), String> {
    let mut state = detector().lock().map_err(|error| error.to_string())?;
    state.capture = parse_modifier(capture)?;
    state.show_window = parse_modifier(show_window)?;
    state.shift.last_tap = None;
    state.control.last_tap = None;
    state.alt.last_tap = None;
    Ok(())
}

pub fn start(app: AppHandle) {
    let (sender, receiver) = mpsc::channel();
    if let Ok(mut state) = detector().lock() {
        if state.sender.is_some() {
            return;
        }
        state.sender = Some(sender);
    }

    let emitter_app = app.clone();
    thread::spawn(move || {
        while let Ok(action) = receiver.recv() {
            match action {
                ShortcutAction::Capture => {
                    let _ = emitter_app.emit_to("main", "double-shortcut-capture", ());
                }
                ShortcutAction::ShowWindow => {
                    let _ = super::show_main_window(emitter_app.clone());
                }
            }
        }
    });

    thread::spawn(move || unsafe {
        let Ok(hook) = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook), None, 0) else {
            return;
        };
        let mut message = MSG::default();
        loop {
            let result = GetMessageW(&mut message, None, 0, 0);
            if result.0 <= 0 {
                break;
            }
            let _ = TranslateMessage(&message);
            DispatchMessageW(&message);
        }
        let _ = UnhookWindowsHookEx(hook);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emits_after_two_clean_modifier_taps() {
        let (sender, receiver) = mpsc::channel();
        let mut state = Detector {
            sender: Some(sender),
            capture: Some(Modifier::Shift),
            ..Detector::default()
        };
        let start = Instant::now();
        state.modifier_down(Modifier::Shift, start);
        state.modifier_up(Modifier::Shift, start + Duration::from_millis(40));
        state.modifier_down(Modifier::Shift, start + Duration::from_millis(150));
        state.modifier_up(Modifier::Shift, start + Duration::from_millis(190));
        assert!(matches!(receiver.try_recv(), Ok(ShortcutAction::Capture)));
    }

    #[test]
    fn ignores_modifier_taps_used_in_a_chord() {
        let (sender, receiver) = mpsc::channel();
        let mut state = Detector {
            sender: Some(sender),
            capture: Some(Modifier::Control),
            ..Detector::default()
        };
        let start = Instant::now();
        state.modifier_down(Modifier::Control, start);
        state.non_modifier_down();
        state.modifier_up(Modifier::Control, start + Duration::from_millis(40));
        state.modifier_down(Modifier::Control, start + Duration::from_millis(120));
        state.modifier_up(Modifier::Control, start + Duration::from_millis(160));
        assert!(receiver.try_recv().is_err());
    }
}
