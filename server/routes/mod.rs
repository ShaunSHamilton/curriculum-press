use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::HeaderMap,
    response::IntoResponse,
    routing::{get, patch, post},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    domain::{
        models::{
            AddOrganizationMemberInput, BlockSettings, BlockType, CreateBlockInput,
            CreateOrganizationInput, CreateProjectInput, CreateUserInput, ExportedCurriculum,
            Organization, OrganizationMember, OrganizationRole, Project, ProjectStatus,
            ProjectWorkspace, UpdateBlockInput, UpdateProjectInput, User,
        },
        store::Store,
    },
    errors::Error,
    state::ServerState,
};

const USER_HEADER: &str = "x-curriculum-user-id";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub status: &'static str,
    pub service: &'static str,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignUpRequest {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInRequest {
    pub email: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
    pub user: User,
    pub auth_header_name: &'static str,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrganizationRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddMemberRequest {
    pub email: String,
    pub name: Option<String>,
    pub role: Option<OrganizationRole>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectQuery {
    pub organization_id: Uuid,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub organization_id: Uuid,
    pub name: String,
    pub description: String,
    pub status: ProjectStatus,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<ProjectStatus>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBlockRequest {
    #[serde(rename = "type")]
    pub block_type: BlockType,
    pub title: String,
    pub description: Option<String>,
    pub config: serde_json::Value,
    pub settings: BlockSettings,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBlockRequest {
    pub title: String,
    pub description: Option<String>,
    pub config: serde_json::Value,
    pub settings: BlockSettings,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderBlocksRequest {
    pub ordered_ids: Vec<Uuid>,
}

pub fn api_router() -> Router<ServerState> {
    Router::new()
        .route("/catalog", get(get_catalog))
        .route("/auth/signup", post(sign_up))
        .route("/auth/signin", post(sign_in))
        .route("/auth/me", get(get_me))
        .route(
            "/organizations",
            get(list_organizations).post(create_organization),
        )
        .route(
            "/organizations/{organization_id}/members",
            get(list_members).post(add_member),
        )
        .route("/projects", get(list_projects).post(create_project))
        .route("/projects/mine", get(list_my_projects))
        .route(
            "/projects/{project_id}",
            get(get_project).patch(update_project),
        )
        .route("/projects/{project_id}/export", get(export_project))
        .route("/curricula/{curriculum_id}/blocks", post(create_block))
        .route("/curricula/{curriculum_id}/reorder", post(reorder_blocks))
        .route(
            "/blocks/{block_id}",
            patch(update_block).delete(delete_block),
        )
        .route("/blocks/{block_id}/duplicate", post(duplicate_block))
        .route("/public/projects/{project_id}", get(get_public_project))
}

fn require_user_id(headers: &HeaderMap) -> Result<Uuid, Error> {
    let value = headers
        .get(USER_HEADER)
        .ok_or_else(|| Error::unauthorized("Sign in to continue."))?
        .to_str()
        .map_err(|_| Error::unauthorized("Invalid authentication header."))?;

    Uuid::parse_str(value).map_err(|_| Error::unauthorized("Invalid user id."))
}

fn ensure_workspace_access(
    store: &dyn Store,
    user_id: Uuid,
    project: &Project,
) -> Result<(), Error> {
    let organizations = store.list_organizations_for_user(user_id)?;
    if organizations
        .iter()
        .any(|organization| organization.id == project.organization_id)
    {
        return Ok(());
    }

    Err(Error::unauthorized(
        "You do not have access to this project workspace.",
    ))
}

pub async fn get_status_ping() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "curriculum-press",
    })
}

async fn get_catalog() -> Json<Vec<serde_json::Value>> {
    Json(vec![
        serde_json::json!({
            "type": "tile-match",
            "name": "Tile Match",
            "objective": "Memorization of paired concepts",
            "description": "Match image-text or text-text pairs.",
            "mvp": true
        }),
        serde_json::json!({
            "type": "category-sort",
            "name": "Category Sort",
            "objective": "Classification and grouping",
            "description": "Sort items into the correct buckets.",
            "mvp": true
        }),
        serde_json::json!({
            "type": "sequence-sorter",
            "name": "Sequence Sorter",
            "objective": "Timelines and process order",
            "description": "Arrange a sequence into the correct order.",
            "mvp": true
        }),
        serde_json::json!({
            "type": "interactive-diagram",
            "name": "Interactive Diagram",
            "objective": "Anatomy and part identification",
            "description": "Use hotspots to explore and identify regions.",
            "mvp": true
        }),
        serde_json::json!({
            "type": "syntax-sprint",
            "name": "Syntax Sprint",
            "objective": "Typing and syntax fluency",
            "description": "Type a sample accurately under light time pressure.",
            "mvp": true
        }),
        serde_json::json!({
            "type": "binary-blitz",
            "name": "Binary Blitz",
            "objective": "Rapid recognition and classification",
            "description": "Make fast true/false judgments.",
            "mvp": true
        }),
    ])
}

async fn sign_up(
    State(state): State<ServerState>,
    Json(payload): Json<SignUpRequest>,
) -> Result<Json<AuthResponse>, Error> {
    let user = state.store.create_user(CreateUserInput {
        name: payload.name,
        email: payload.email,
    })?;

    Ok(Json(AuthResponse {
        user,
        auth_header_name: USER_HEADER,
    }))
}

async fn sign_in(
    State(state): State<ServerState>,
    Json(payload): Json<SignInRequest>,
) -> Result<Json<AuthResponse>, Error> {
    let user = state
        .store
        .find_user_by_email(&payload.email)?
        .ok_or_else(|| Error::unauthorized("No account found for that email."))?;

    Ok(Json(AuthResponse {
        user,
        auth_header_name: USER_HEADER,
    }))
}

async fn get_me(State(state): State<ServerState>, headers: HeaderMap) -> Result<Json<User>, Error> {
    let user_id = require_user_id(&headers)?;
    Ok(Json(state.store.get_user(user_id)?))
}

async fn list_organizations(
    State(state): State<ServerState>,
    headers: HeaderMap,
) -> Result<Json<Vec<Organization>>, Error> {
    let user_id = require_user_id(&headers)?;
    Ok(Json(state.store.list_organizations_for_user(user_id)?))
}

async fn create_organization(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(payload): Json<CreateOrganizationRequest>,
) -> Result<Json<Organization>, Error> {
    let user_id = require_user_id(&headers)?;
    Ok(Json(state.store.create_organization(
        CreateOrganizationInput {
            owner_user_id: user_id,
            name: payload.name,
        },
    )?))
}

async fn list_members(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> Result<Json<Vec<OrganizationMember>>, Error> {
    let user_id = require_user_id(&headers)?;
    let organizations = state.store.list_organizations_for_user(user_id)?;
    if !organizations
        .iter()
        .any(|organization| organization.id == organization_id)
    {
        return Err(Error::unauthorized(
            "You do not have access to that organization.",
        ));
    }

    Ok(Json(state.store.list_members(organization_id)?))
}

async fn add_member(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
    Json(payload): Json<AddMemberRequest>,
) -> Result<Json<OrganizationMember>, Error> {
    let user_id = require_user_id(&headers)?;
    let organizations = state.store.list_organizations_for_user(user_id)?;
    if !organizations
        .iter()
        .any(|organization| organization.id == organization_id)
    {
        return Err(Error::unauthorized(
            "You do not have access to that organization.",
        ));
    }

    Ok(Json(state.store.add_member(
        AddOrganizationMemberInput {
            organization_id,
            email: payload.email,
            name: payload.name,
            role: payload.role.unwrap_or(OrganizationRole::Editor),
        },
    )?))
}

async fn list_projects(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Query(query): Query<ProjectQuery>,
) -> Result<Json<Vec<Project>>, Error> {
    let user_id = require_user_id(&headers)?;
    let organizations = state.store.list_organizations_for_user(user_id)?;
    if !organizations
        .iter()
        .any(|organization| organization.id == query.organization_id)
    {
        return Err(Error::unauthorized(
            "You do not have access to that organization.",
        ));
    }

    Ok(Json(state.store.list_projects(query.organization_id)?))
}

async fn create_project(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(payload): Json<CreateProjectRequest>,
) -> Result<Json<Project>, Error> {
    let user_id = require_user_id(&headers)?;
    let organizations = state.store.list_organizations_for_user(user_id)?;
    if !organizations
        .iter()
        .any(|organization| organization.id == payload.organization_id)
    {
        return Err(Error::unauthorized(
            "You do not have access to that organization.",
        ));
    }

    Ok(Json(state.store.create_project(CreateProjectInput {
        organization_id: payload.organization_id,
        created_by_user_id: user_id,
        name: payload.name,
        description: payload.description,
        status: payload.status,
    })?))
}

async fn list_my_projects(
    State(state): State<ServerState>,
    headers: HeaderMap,
) -> Result<Json<Vec<Project>>, Error> {
    let user_id = require_user_id(&headers)?;
    Ok(Json(state.store.list_projects_for_user(user_id)?))
}

async fn get_project(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
) -> Result<Json<ProjectWorkspace>, Error> {
    let user_id = require_user_id(&headers)?;
    let project = state.store.get_project(project_id)?;
    ensure_workspace_access(state.store.as_ref(), user_id, &project)?;
    Ok(Json(state.store.get_project_workspace(project_id)?))
}

async fn update_project(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<UpdateProjectRequest>,
) -> Result<Json<Project>, Error> {
    let user_id = require_user_id(&headers)?;
    let project = state.store.get_project(project_id)?;
    ensure_workspace_access(state.store.as_ref(), user_id, &project)?;

    Ok(Json(state.store.update_project(UpdateProjectInput {
        project_id,
        name: payload.name,
        description: payload.description,
        status: payload.status,
    })?))
}

async fn create_block(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Path(curriculum_id): Path<Uuid>,
    Json(payload): Json<CreateBlockRequest>,
) -> Result<Json<crate::domain::models::InteractiveBlock>, Error> {
    let user_id = require_user_id(&headers)?;
    let project = state.store.get_project_by_curriculum_id(curriculum_id)?;
    ensure_workspace_access(state.store.as_ref(), user_id, &project)?;

    Ok(Json(state.store.create_block(CreateBlockInput {
        curriculum_id,
        block_type: payload.block_type,
        title: payload.title,
        description: payload.description,
        config: payload.config,
        settings: payload.settings,
    })?))
}

async fn update_block(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Path(block_id): Path<Uuid>,
    Json(payload): Json<UpdateBlockRequest>,
) -> Result<Json<crate::domain::models::InteractiveBlock>, Error> {
    let user_id = require_user_id(&headers)?;
    let project = state.store.get_project_by_block_id(block_id)?;
    ensure_workspace_access(state.store.as_ref(), user_id, &project)?;

    Ok(Json(state.store.update_block(UpdateBlockInput {
        block_id,
        title: payload.title,
        description: payload.description,
        config: payload.config,
        settings: payload.settings,
    })?))
}

async fn delete_block(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Path(block_id): Path<Uuid>,
) -> Result<impl IntoResponse, Error> {
    let user_id = require_user_id(&headers)?;
    let project = state.store.get_project_by_block_id(block_id)?;
    ensure_workspace_access(state.store.as_ref(), user_id, &project)?;
    state.store.delete_block(block_id)?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

async fn duplicate_block(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Path(block_id): Path<Uuid>,
) -> Result<Json<crate::domain::models::InteractiveBlock>, Error> {
    let user_id = require_user_id(&headers)?;
    let project = state.store.get_project_by_block_id(block_id)?;
    ensure_workspace_access(state.store.as_ref(), user_id, &project)?;
    Ok(Json(state.store.duplicate_block(block_id)?))
}

async fn reorder_blocks(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Path(curriculum_id): Path<Uuid>,
    Json(payload): Json<ReorderBlocksRequest>,
) -> Result<Json<crate::domain::models::Curriculum>, Error> {
    let user_id = require_user_id(&headers)?;
    let project = state.store.get_project_by_curriculum_id(curriculum_id)?;
    ensure_workspace_access(state.store.as_ref(), user_id, &project)?;
    Ok(Json(
        state
            .store
            .reorder_blocks(curriculum_id, payload.ordered_ids)?,
    ))
}

async fn export_project(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
) -> Result<Json<ExportedCurriculum>, Error> {
    let user_id = require_user_id(&headers)?;
    let project = state.store.get_project(project_id)?;
    ensure_workspace_access(state.store.as_ref(), user_id, &project)?;
    Ok(Json(state.store.export_curriculum(project_id)?))
}

async fn get_public_project(
    State(state): State<ServerState>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<ExportedCurriculum>, Error> {
    Ok(Json(state.store.export_curriculum(project_id)?))
}
