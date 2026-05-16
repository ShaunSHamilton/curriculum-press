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
    MultipleChoice,
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
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationMember {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub user_id: Uuid,
    pub role: OrganizationRole,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub curriculum_id: Uuid,
    pub created_by_user_id: Uuid,
    pub name: String,
    pub description: String,
    pub status: ProjectStatus,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Curriculum {
    pub id: Uuid,
    pub project_id: Uuid,
    pub title: String,
    pub description: String,
    pub block_ids: Vec<Uuid>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BlockSettings {
    pub timer_seconds: Option<u32>,
    pub show_score: bool,
    pub allow_retry: bool,
    pub difficulty: Option<Difficulty>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKey {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub prefix: String,
    pub key_hash: String,
    pub project_scope: Option<Vec<Uuid>>,
    pub created_at: String,
    pub last_used_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyInfo {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub prefix: String,
    pub project_scope: Option<Vec<Uuid>>,
    pub created_at: String,
    pub last_used_at: Option<String>,
}

impl From<ApiKey> for ApiKeyInfo {
    fn from(key: ApiKey) -> Self {
        Self {
            id: key.id,
            user_id: key.user_id,
            name: key.name,
            prefix: key.prefix,
            project_scope: key.project_scope,
            created_at: key.created_at,
            last_used_at: key.last_used_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedApiKey {
    pub key: ApiKeyInfo,
    pub raw_key: String,
}

#[derive(Debug, Clone)]
pub struct CreateApiKeyInput {
    pub user_id: Uuid,
    pub name: String,
    pub prefix: String,
    pub project_scope: Option<Vec<Uuid>>,
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
    pub created_by_user_id: Uuid,
    pub name: String,
    pub description: String,
    pub status: ProjectStatus,
}

#[derive(Debug, Clone)]
pub struct UpdateProjectInput {
    pub project_id: Uuid,
    pub name: Option<String>,
    pub description: Option<String>,
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
