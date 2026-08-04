use std::collections::VecDeque;
use windows::Win32::{
    Foundation::HWND,
    UI::{
        Accessibility::{
            IUIAutomation, IUIAutomationValuePattern, TreeScope_Children, UIA_EditControlTypeId,
            UIA_ValuePatternId,
        },
        WindowsAndMessaging::{GetWindowTextLengthW, GetWindowTextW},
    },
};

const MAX_AUTOMATION_ELEMENTS: usize = 500;
const MAX_AUTOMATION_DEPTH: usize = 10;

fn window_title(window: HWND) -> Option<String> {
    unsafe {
        let length = GetWindowTextLengthW(window);
        if length <= 0 {
            return None;
        }
        let mut buffer = vec![0u16; length as usize + 1];
        let copied = GetWindowTextW(window, &mut buffer);
        if copied <= 0 {
            return None;
        }
        Some(
            String::from_utf16_lossy(&buffer[..copied as usize])
                .trim()
                .to_string(),
        )
    }
}

pub(super) fn page_title(window: HWND, browser: &str) -> Option<String> {
    let mut title = window_title(window)?;
    let suffixes: &[&str] = match browser {
        "Google Chrome" => &[" - Google Chrome", " – Google Chrome"],
        "Microsoft Edge" => &[" - Microsoft Edge", " – Microsoft Edge"],
        "Mozilla Firefox" => &[" — Mozilla Firefox", " - Mozilla Firefox"],
        "Brave" => &[" - Brave", " – Brave"],
        "Vivaldi" => &[" - Vivaldi", " – Vivaldi"],
        "Opera" => &[" - Opera", " – Opera"],
        "Opera GX" => &[" - Opera GX", " – Opera GX"],
        "Arc" => &[" - Arc", " – Arc"],
        _ => &[],
    };
    for suffix in suffixes {
        if let Some(stripped) = title.strip_suffix(suffix) {
            title = stripped.trim().to_string();
            break;
        }
    }
    (!title.is_empty()).then_some(title)
}

fn normalize_http_url(value: &str) -> Option<String> {
    let parsed = reqwest::Url::parse(value.trim()).ok()?;
    (matches!(parsed.scheme(), "http" | "https") && parsed.host().is_some())
        .then(|| parsed.to_string())
}

pub(super) fn address_bar_url(automation: &IUIAutomation, window: HWND) -> Option<String> {
    unsafe {
        let root = automation.ElementFromHandle(window).ok()?;
        let condition = automation.CreateTrueCondition().ok()?;
        let mut queue = VecDeque::from([(root, 0usize)]);
        let mut visited = 0usize;

        while let Some((element, depth)) = queue.pop_front() {
            visited += 1;
            if visited > MAX_AUTOMATION_ELEMENTS {
                break;
            }

            if element.CurrentControlType().ok() == Some(UIA_EditControlTypeId)
                && element
                    .CurrentIsPassword()
                    .ok()
                    .is_none_or(|value| !value.as_bool())
            {
                let name = element
                    .CurrentName()
                    .ok()
                    .map(|value| value.to_string().to_ascii_lowercase())
                    .unwrap_or_default();
                let automation_id = element
                    .CurrentAutomationId()
                    .ok()
                    .map(|value| value.to_string().to_ascii_lowercase())
                    .unwrap_or_default();
                if let Ok(pattern) =
                    element.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId)
                {
                    if let Ok(value) = pattern.CurrentValue() {
                        if let Some(value) = normalize_http_url(&value.to_string()) {
                            let is_named_address_bar = name.contains("address")
                                || name.contains("location")
                                || name.contains("omnibox")
                                || name.contains("search bar")
                                || automation_id.contains("address")
                                || automation_id.contains("location")
                                || automation_id.contains("omnibox")
                                || automation_id.contains("urlbar");
                            if is_named_address_bar {
                                return Some(value);
                            }
                        }
                    }
                }
            }

            if depth >= MAX_AUTOMATION_DEPTH {
                continue;
            }
            if let Ok(children) = element.FindAll(TreeScope_Children, &condition) {
                if let Ok(length) = children.Length() {
                    for index in 0..length {
                        if let Ok(child) = children.GetElement(index) {
                            queue.push_back((child, depth + 1));
                        }
                    }
                }
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_http_url;

    #[test]
    fn only_accepts_web_page_urls() {
        assert_eq!(
            normalize_http_url("https://example.com/page"),
            Some("https://example.com/page".to_string())
        );
        assert!(normalize_http_url(" http://example.com ").is_some());
        assert!(normalize_http_url("https://").is_none());
        assert!(normalize_http_url("chrome://settings").is_none());
        assert!(normalize_http_url("file:///C:/private.txt").is_none());
    }
}
