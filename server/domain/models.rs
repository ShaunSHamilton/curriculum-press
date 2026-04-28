use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum BlockType {
    TileMatch,
    CategorySort,
    SequenceSorter,
    InteractiveDiagram,
    SyntaxSprint,
    BinaryBlitz,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Difficulty {
    Easy,
    Medium,
    Hard,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OrganizationRole {
    Owner,
    Editor,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProjectStatus {
    Draft,
    Review,
    Published,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrganizationMember {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub user_id: Uuid,
    pub role: OrganizationRole,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub curriculum_id: Uuid,
    pub name: String,
    pub description: String,
    pub audience: String,
    pub status: ProjectStatus,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Curriculum {
    pub id: Uuid,
    pub project_id: Uuid,
    pub title: String,
    pub description: String,
    pub block_ids: Vec<Uuid>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BlockSettings {
    pub timer_seconds: Option<u32>,
    pub show_score: bool,
    pub allow_retry: bool,
    pub difficulty: Option<Difficulty>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractiveBlock {
    pub id: Uuid,
    #[serde(rename = "type")]
    pub block_type: BlockType,
    pub title: String,
    pub description: Option<String>,
    pub config: serde_json::Value,
    pub settings: BlockSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectWorkspace {
    pub project: Project,
    pub curriculum: Curriculum,
    pub blocks: Vec<InteractiveBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedCurriculum {
    pub project: Project,
    pub curriculum: Curriculum,
    pub blocks: Vec<InteractiveBlock>,
}

#[derive(Debug, Clone)]
pub struct CreateUserInput {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Clone)]
pub struct CreateOrganizationInput {
    pub owner_user_id: Uuid,
    pub name: String,
}

#[derive(Debug, Clone)]
pub struct AddOrganizationMemberInput {
    pub organization_id: Uuid,
    pub email: String,
    pub name: Option<String>,
    pub role: OrganizationRole,
}

#[derive(Debug, Clone)]
pub struct CreateProjectInput {
    pub organization_id: Uuid,
    pub name: String,
    pub description: String,
    pub audience: String,
    pub status: ProjectStatus,
}

#[derive(Debug, Clone)]
pub struct UpdateProjectInput {
    pub project_id: Uuid,
    pub name: Option<String>,
    pub description: Option<String>,
    pub audience: Option<String>,
    pub status: Option<ProjectStatus>,
}

#[derive(Debug, Clone)]
pub struct CreateBlockInput {
    pub curriculum_id: Uuid,
    pub block_type: BlockType,
    pub title: String,
    pub description: Option<String>,
    pub config: serde_json::Value,
    pub settings: BlockSettings,
}

#[derive(Debug, Clone)]
pub struct UpdateBlockInput {
    pub block_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub config: serde_json::Value,
    pub settings: BlockSettings,
}
