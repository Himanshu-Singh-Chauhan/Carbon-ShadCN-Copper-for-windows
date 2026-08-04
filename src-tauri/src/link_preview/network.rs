use reqwest::{
    blocking::{Client, Response},
    header::{ACCEPT, CONTENT_LENGTH, CONTENT_TYPE, LOCATION},
    Url,
};
use std::{
    io::Read,
    net::{IpAddr, Ipv6Addr, ToSocketAddrs},
};

use crate::io_error;

fn is_public_ip(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => {
            !(address.is_private()
                || address.is_loopback()
                || address.is_link_local()
                || address.is_broadcast()
                || address.is_documentation()
                || address.is_unspecified()
                || address.is_multicast()
                || address.octets()[0] == 0)
        }
        IpAddr::V6(address) => {
            if let Some(mapped) = address.to_ipv4_mapped() {
                return is_public_ip(IpAddr::V4(mapped));
            }
            !(address.is_loopback()
                || address.is_unspecified()
                || address.is_multicast()
                || is_unique_local(address)
                || is_ipv6_link_local(address))
        }
    }
}

fn is_unique_local(address: Ipv6Addr) -> bool {
    address.segments()[0] & 0xfe00 == 0xfc00
}

fn is_ipv6_link_local(address: Ipv6Addr) -> bool {
    address.segments()[0] & 0xffc0 == 0xfe80
}

pub(super) fn validate_public_url(url: &Url) -> Result<(), String> {
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Only HTTP and HTTPS links can be previewed.".to_string());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "The link has no host.".to_string())?;
    if host.eq_ignore_ascii_case("localhost") || host.ends_with(".local") {
        return Err("Local network links are not previewed.".to_string());
    }

    if let Ok(address) = host.parse::<IpAddr>() {
        return is_public_ip(address)
            .then_some(())
            .ok_or_else(|| "Local network links are not previewed.".to_string());
    }

    let port = url
        .port_or_known_default()
        .ok_or_else(|| "The link uses an unsupported port.".to_string())?;
    let addresses = (host, port).to_socket_addrs().map_err(io_error)?;
    let addresses: Vec<_> = addresses.collect();
    if addresses.is_empty() || addresses.iter().any(|address| !is_public_ip(address.ip())) {
        return Err("Local network links are not previewed.".to_string());
    }
    Ok(())
}

fn limited_body(response: Response, limit: u64) -> Result<Vec<u8>, String> {
    if response
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
        .is_some_and(|length| length > limit)
    {
        return Err("The remote preview is too large.".to_string());
    }

    let mut bytes = Vec::new();
    response
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(io_error)?;
    if bytes.len() as u64 > limit {
        return Err("The remote preview is too large.".to_string());
    }
    Ok(bytes)
}

pub(super) fn fetch(
    client: &Client,
    mut url: Url,
    accept: &str,
    limit: u64,
) -> Result<(Url, String, Vec<u8>), String> {
    for _ in 0..=5 {
        validate_public_url(&url)?;
        let response = client
            .get(url.clone())
            .header(ACCEPT, accept)
            .send()
            .map_err(io_error)?;

        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or_else(|| "The link redirected without a destination.".to_string())?;
            url = url.join(location).map_err(io_error)?;
            continue;
        }
        if !response.status().is_success() {
            return Err(format!(
                "The preview request returned {}.",
                response.status()
            ));
        }

        let mime_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .split(';')
            .next()
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase();
        return Ok((url, mime_type, limited_body(response, limit)?));
    }
    Err("The link redirected too many times.".to_string())
}

#[cfg(test)]
mod tests {
    use super::validate_public_url;
    use reqwest::Url;

    #[test]
    fn rejects_local_network_urls() {
        for value in [
            "http://localhost",
            "http://127.0.0.1",
            "http://192.168.1.10",
            "http://[::1]",
            "file:///C:/private.txt",
        ] {
            let url = Url::parse(value).expect("valid test URL");
            assert!(validate_public_url(&url).is_err(), "{value}");
        }
    }
}
