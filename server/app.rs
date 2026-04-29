use axum::Router;
use axum::extract::MatchedPath;
use axum::extract::Request;
use axum::routing::get;
use http::HeaderName;
use http::StatusCode;
use http::header::ACCEPT;
use http::header::AUTHORIZATION;
use http::header::ORIGIN;
use http::header::SET_COOKIE;
use http::header::X_CONTENT_TYPE_OPTIONS;
use reqwest::Method;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;
use tower_http::{cors::CorsLayer, services::{ServeDir, ServeFile}};
use tracing::info;

use crate::domain::store::InMemoryStore;
use crate::errors::Error;

use crate::config::EnvVars;
use crate::routes::{api_router, get_status_ping};
use crate::state::ServerState;

pub async fn app(env_vars: EnvVars) -> Result<Router, Error> {
    info!("Creating app...");

    let cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::CONNECT,
            Method::DELETE,
        ])
        .allow_headers([
            AUTHORIZATION,
            ACCEPT,
            ORIGIN,
            X_CONTENT_TYPE_OPTIONS,
            SET_COOKIE,
            HeaderName::from_static("x-curriculum-user-id"),
        ])
        .allow_credentials(true)
        .allow_origin(env_vars.allowed_origins.clone());

    let state = ServerState {
        store: InMemoryStore::new(),
    };

    let app = Router::new()
        .nest(
            "/api",
            Router::new()
                .route("/healthz", get(get_status_ping))
                .route("/status/ping", get(get_status_ping))
                .nest("/v1", api_router()),
        )
        .with_state(state)
        .fallback_service(ServeDir::new("dist").not_found_service(ServeFile::new("dist/index.html")))
        .layer(cors)
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            std::time::Duration::from_millis(env_vars.request_timeout_in_ms),
        ))
        .layer(RequestBodyLimitLayer::new(env_vars.request_body_size_limit))
        .layer(
            TraceLayer::new_for_http()
                // Create span for the request and include the matched path. The matched
                // path is useful for figuring out which handler the request was routed to.
                .make_span_with(|req: &Request| {
                    let method = req.method();
                    let uri = req.uri();

                    // axum automatically adds this extension.
                    let matched_path = req
                        .extensions()
                        .get::<MatchedPath>()
                        .map(|matched_path| matched_path.as_str());

                    tracing::debug_span!("request", %method, %uri, matched_path)
                })
                .on_request(|request: &Request, _span: &tracing::Span| {
                    let method = request.method();
                    let uri = request.uri();
                    tracing::debug!("--> {} {}", method, uri);
                })
                .on_response(
                    |response: &axum::http::Response<_>,
                     latency: std::time::Duration,
                     _span: &tracing::Span| {
                        tracing::debug!("<-- {} ({} ms)", response.status(), latency.as_millis());
                    },
                )
                // By default `TraceLayer` will log 5xx
                .on_failure(()),
        );

    info!("Successfully created app.");
    Ok(app)
}
