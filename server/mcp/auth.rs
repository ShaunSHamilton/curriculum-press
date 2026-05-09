use std::sync::Arc;

use axum::{extract::Request, middleware::Next, response::Response};
use http::header::AUTHORIZATION;
use uuid::Uuid;

use crate::{api_keys::hash_key, domain::store::Store, errors::Error};

#[derive(Clone, Debug)]
pub struct McpAuthContext {
    pub user_id: Uuid,
    pub project_scope: Option<Vec<Uuid>>,
}

pub async fn mcp_auth_middleware(
    axum::extract::State(store): axum::extract::State<Arc<dyn Store>>,
    mut request: Request,
    next: Next,
) -> Result<Response, Error> {
    let raw_key = extract_bearer_token(request.headers())?;
    let key_hash = hash_key(&raw_key);
    let api_key = store
        .find_api_key_by_hash(&key_hash)?
        .ok_or_else(|| Error::unauthorized("Invalid or revoked API key."))?;

    request.extensions_mut().insert(McpAuthContext {
        user_id: api_key.user_id,
        project_scope: api_key.project_scope,
    });
    Ok(next.run(request).await)
}

fn extract_bearer_token(headers: &http::HeaderMap) -> Result<String, Error> {
    let value = headers
        .get(AUTHORIZATION)
        .ok_or_else(|| Error::unauthorized("Authorization header required."))?
        .to_str()
        .map_err(|_| Error::unauthorized("Invalid Authorization header."))?;

    value
        .strip_prefix("Bearer ")
        .map(str::to_owned)
        .ok_or_else(|| Error::unauthorized("Bearer token required."))
}
