use axum::{
    http::header::{CACHE_CONTROL, CONTENT_TYPE},
    response::Response,
};
use tracing::info;

pub async fn get_status_ping() -> Response {
    info!("Health check ping received");

    let mut response = Response::new("pong".into());
    response.headers_mut().insert(
        CACHE_CONTROL,
        "no-cache"
            .parse()
            .expect("Unreachable. static str into HeaderValue"),
    );
    response.headers_mut().insert(
        CONTENT_TYPE,
        "text/plain; charset=utf-8"
            .parse()
            .expect("Unreachable. static str into HeaderValue"),
    );
    response
}
