use axum::extract::FromRef;
use axum_extra::extract::cookie::Key;

use crate::config::EnvVars;

#[derive(Clone)]
pub struct ServerState {
    pub key: Key,
    pub env_vars: EnvVars,
}

impl FromRef<ServerState> for Key {
    fn from_ref(state: &ServerState) -> Self {
        state.key.clone()
    }
}
