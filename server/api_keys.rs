use sha2::{Digest, Sha256};

pub fn generate_raw_key() -> String {
    // Two UUID v4s concatenated give 256 bits of entropy; strip hyphens for a clean key body
    let part1 = uuid::Uuid::new_v4().as_simple().to_string();
    let part2 = uuid::Uuid::new_v4().as_simple().to_string();
    format!("cp_{part1}{part2}")
}

pub fn hash_key(raw_key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw_key.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn key_prefix(raw_key: &str) -> String {
    raw_key.chars().take(8).collect()
}
