use std::env::var;

use http::HeaderValue;
use tracing::{error, warn};

#[derive(Clone, Debug)]
pub struct EnvVars {
    /// Allowed origins for CORS
    ///
    /// ALLOWED_ORIGINS=http://localhost:3000,https://myapp.com
    pub allowed_origins: Vec<HeaderValue>,
    /// Cookie key for signing cookies
    ///
    /// Must be 64 bytes
    pub cookie_key: String,
    /// Port to run the server on
    pub port: u16,
    /// Request body size limit in bytes
    pub request_body_size_limit: usize,
    /// Request timeout in milliseconds
    pub request_timeout_in_ms: u64,
}

impl EnvVars {
    pub fn new() -> Self {
        let port = match var("PORT") {
            Ok(port_string) => port_string.parse().expect("PORT to be parseable as u16"),
            Err(_e) => {
                let default_port = 8080;
                warn!("PORT not set. Defaulting to {default_port}");
                default_port
            }
        };

        let allowed_origins = match var("ALLOWED_ORIGINS") {
            Ok(origins_string) => origins_string
                .split(',')
                .map(|o| match o.parse() {
                    Ok(origin) => origin,
                    Err(e) => {
                        error!("{o} cannot be parsed as HeaderValue");
                        panic!("{}", e);
                    }
                })
                .collect(),
            Err(_e) => {
                let default_allowed_origin = format!("http://127.0.0.1:{port}")
                    .parse::<HeaderValue>()
                    .expect("default origin to be parseable as HeaderValue");
                warn!("No allowed origins set, defaulting to {default_allowed_origin:?}");
                vec![default_allowed_origin]
            }
        };

        let Ok(cookie_key) = var("COOKIE_KEY") else {
            error!("COOKIE_KEY not set");
            panic!("COOKIE_KEY required");
        };
        assert_eq!(cookie_key.len(), 64, "COOKIE_KEY env var must be 64 bytes");

        let request_body_size_limit = match var("REQUEST_BODY_SIZE_LIMIT") {
            Ok(s) => s
                .parse()
                .expect("REQUEST_BODY_SIZE_LIMIT to be valid unsigned integer"),
            Err(_e) => {
                let base: usize = 2;
                let exp = 20;
                let default_request_body_size_limit = 5 * base.pow(exp);
                warn!(
                    "REQUEST_BODY_SIZE_LIMIT not set. Defaulting to {default_request_body_size_limit}"
                );
                default_request_body_size_limit
            }
        };

        let request_timeout_in_ms = match var("REQUEST_TIMEOUT_IN_MS") {
            Ok(s) => s
                .parse()
                .expect("REQUEST_TIMEOUT_IN_MS to be valid unsigned integer"),
            Err(_e) => {
                // Note: This could cause the generation stream to end early
                let default_request_timeout = 11_000;
                warn!("REQUEST_TIMEOUT_IN_MS not set. Defaulting to {default_request_timeout}");
                default_request_timeout
            }
        };

        let env_vars = Self {
            allowed_origins,
            cookie_key,
            port,
            request_body_size_limit,
            request_timeout_in_ms,
        };

        env_vars
    }
}
