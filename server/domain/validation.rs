use serde::Deserialize;

use crate::domain::models::{BlockType, CreateProjectInput, CreateUserInput};
use crate::errors::Error;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TileMatchConfig {
    prompt: String,
    pairs: Vec<TileMatchPair>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TileMatchPair {
    left: String,
    right: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CategorySortConfig {
    prompt: String,
    categories: Vec<Category>,
    items: Vec<CategoryItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Category {
    id: String,
    label: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CategoryItem {
    label: String,
    category_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SequenceSorterConfig {
    prompt: String,
    items: Vec<SequenceItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SequenceItem {
    label: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InteractiveDiagramConfig {
    prompt: String,
    image_url: String,
    hotspots: Vec<DiagramHotspot>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiagramHotspot {
    label: String,
    x: f64,
    y: f64,
    radius: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyntaxSprintConfig {
    prompt: String,
    target_text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BinaryBlitzConfig {
    prompt: String,
    statements: Vec<BinaryStatement>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BinaryStatement {
    text: String,
}

fn bad_request(message: impl Into<String>) -> Error {
    Error::bad_request(message)
}

pub fn validate_user(input: &CreateUserInput) -> Result<(), Error> {
    if input.name.trim().is_empty() {
        return Err(bad_request("Name is required."));
    }

    if !input.email.contains('@') {
        return Err(bad_request("A valid email address is required."));
    }

    Ok(())
}

pub fn validate_project(input: &CreateProjectInput) -> Result<(), Error> {
    if input.name.trim().is_empty() {
        return Err(bad_request("Project name is required."));
    }

    if input.audience.trim().is_empty() {
        return Err(bad_request("Audience is required."));
    }

    Ok(())
}

pub fn validate_block_config(
    block_type: &BlockType,
    config: &serde_json::Value,
) -> Result<(), Error> {
    match block_type {
        BlockType::TileMatch => {
            let parsed: TileMatchConfig = serde_json::from_value(config.clone())
                .map_err(|_| bad_request("Tile Match config shape is invalid."))?;
            if parsed.prompt.trim().is_empty() || parsed.pairs.len() < 2 {
                return Err(bad_request(
                    "Tile Match needs a prompt and at least two left/right pairs.",
                ));
            }

            if parsed
                .pairs
                .iter()
                .any(|pair| pair.left.trim().is_empty() || pair.right.trim().is_empty())
            {
                return Err(bad_request(
                    "Every Tile Match pair needs both sides filled in.",
                ));
            }
        }
        BlockType::CategorySort => {
            let parsed: CategorySortConfig = serde_json::from_value(config.clone())
                .map_err(|_| bad_request("Category Sort config shape is invalid."))?;
            if parsed.prompt.trim().is_empty()
                || parsed.categories.len() < 2
                || parsed.items.len() < 2
            {
                return Err(bad_request(
                    "Category Sort needs a prompt, at least two categories, and at least two items.",
                ));
            }

            for category in &parsed.categories {
                if category.id.trim().is_empty() || category.label.trim().is_empty() {
                    return Err(bad_request("Every category needs an id and label."));
                }
            }

            for item in &parsed.items {
                if item.label.trim().is_empty()
                    || !parsed
                        .categories
                        .iter()
                        .any(|category| category.id == item.category_id)
                {
                    return Err(bad_request(
                        "Each Category Sort item needs text and a valid category reference.",
                    ));
                }
            }
        }
        BlockType::SequenceSorter => {
            let parsed: SequenceSorterConfig = serde_json::from_value(config.clone())
                .map_err(|_| bad_request("Sequence Sorter config shape is invalid."))?;
            if parsed.prompt.trim().is_empty() || parsed.items.len() < 2 {
                return Err(bad_request(
                    "Sequence Sorter needs a prompt and at least two ordered items.",
                ));
            }

            if parsed.items.iter().any(|item| item.label.trim().is_empty()) {
                return Err(bad_request("Sequence Sorter items cannot be blank."));
            }
        }
        BlockType::InteractiveDiagram => {
            let parsed: InteractiveDiagramConfig = serde_json::from_value(config.clone())
                .map_err(|_| bad_request("Interactive Diagram config shape is invalid."))?;
            if parsed.prompt.trim().is_empty()
                || parsed.image_url.trim().is_empty()
                || parsed.hotspots.is_empty()
            {
                return Err(bad_request(
                    "Interactive Diagram needs a prompt, image URL, and at least one hotspot.",
                ));
            }

            if parsed.hotspots.iter().any(|hotspot| {
                hotspot.label.trim().is_empty()
                    || hotspot.x.is_nan()
                    || hotspot.y.is_nan()
                    || hotspot.radius <= 0.0
            }) {
                return Err(bad_request(
                    "Each hotspot needs a label and a positive radius.",
                ));
            }
        }
        BlockType::SyntaxSprint => {
            let parsed: SyntaxSprintConfig = serde_json::from_value(config.clone())
                .map_err(|_| bad_request("Syntax Sprint config shape is invalid."))?;
            if parsed.prompt.trim().is_empty() || parsed.target_text.trim().is_empty() {
                return Err(bad_request(
                    "Syntax Sprint needs a prompt and a target text sample.",
                ));
            }
        }
        BlockType::BinaryBlitz => {
            let parsed: BinaryBlitzConfig = serde_json::from_value(config.clone())
                .map_err(|_| bad_request("Binary Blitz config shape is invalid."))?;
            if parsed.prompt.trim().is_empty() || parsed.statements.len() < 2 {
                return Err(bad_request(
                    "Binary Blitz needs a prompt and at least two statements.",
                ));
            }

            if parsed
                .statements
                .iter()
                .any(|statement| statement.text.trim().is_empty())
            {
                return Err(bad_request("Binary Blitz statements cannot be blank."));
            }
        }
    }

    Ok(())
}
