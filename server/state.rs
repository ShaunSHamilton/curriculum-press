use std::sync::Arc;

use crate::domain::store::Store;

#[derive(Clone)]
pub struct ServerState {
    pub store: Arc<dyn Store>,
}
