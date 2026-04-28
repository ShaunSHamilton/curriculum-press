use axum::response::{IntoResponse, Response};
use http::StatusCode;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("{1}")]
    Server(StatusCode, String),
    // Froms
    #[error("{0}")]
    ParseError(#[from] url::ParseError),
    #[error("{0}")]
    Reqwest(#[from] reqwest::Error),
    #[error("{0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    SystemTimeError(#[from] std::time::SystemTimeError),
    #[error("{0}")]
    TowerSessions(#[from] tower_sessions::session::Error),
}

impl Error {
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::Server(StatusCode::BAD_REQUEST, message.into())
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::Server(StatusCode::NOT_FOUND, message.into())
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::Server(StatusCode::CONFLICT, message.into())
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::Server(StatusCode::UNAUTHORIZED, message.into())
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let msg = format!("{}", self.to_string());
        let status: StatusCode = self.into();

        (status, msg).into_response()
    }
}

impl From<Error> for StatusCode {
    fn from(error: Error) -> Self {
        match error {
            Error::Server(c, _) => c,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}
