use axum::extract::MatchedPath;
use axum::extract::Request;
use axum::routing::get;
use axum::{Extension, Router};
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
use tower_http::{cors::CorsLayer, services::ServeDir};
use tracing::info;

use crate::errors::Error;

use crate::config::EnvVars;
use crate::routes::get_status_ping;

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
        ])
        .allow_credentials(true)
        .allow_origin(env_vars.allowed_origins);

    let http_client = reqwest::ClientBuilder::new()
        // Following redirects opens the client up to SSRF vulnerabilities.
        .redirect(reqwest::redirect::Policy::none())
        .build()?;

    let app = Router::new()
        .route("/healthz", get(get_status_ping))
        .fallback_service(ServeDir::new("dist"))
        .layer(cors)
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            std::time::Duration::from_millis(env_vars.request_timeout_in_ms),
        ))
        .layer(RequestBodyLimitLayer::new(env_vars.request_body_size_limit))
        .layer(Extension(http_client))
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
