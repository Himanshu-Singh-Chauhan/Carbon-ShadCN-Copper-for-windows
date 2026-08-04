use scraper::{Html, Selector};

fn clean_text(value: &str, max_chars: usize) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(max_chars)
        .collect()
}

pub(super) fn parse(
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

#[cfg(test)]
mod tests {
    use super::parse;

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
        let (title, description, site_name, image) = parse(html);
        assert_eq!(title.as_deref(), Some("A useful link"));
        assert_eq!(description.as_deref(), Some("A compact description"));
        assert_eq!(site_name.as_deref(), Some("Example"));
        assert_eq!(image.as_deref(), Some("/preview.png"));
    }
}
