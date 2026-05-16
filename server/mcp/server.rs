use std::sync::Arc;

use rmcp::{
    ErrorData as McpError, RoleServer, ServerHandler,
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::*,
    schemars,
    service::RequestContext,
    tool, tool_handler, tool_router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    domain::{
        models::{BlockSettings, BlockType, CreateBlockInput, UpdateBlockInput},
        store::Store,
    },
    mcp::auth::McpAuthContext,
};

fn mcp_err(e: impl std::fmt::Display) -> McpError {
    McpError::internal_error(e.to_string(), None)
}

fn auth_missing() -> McpError {
    McpError::invalid_request("Missing authentication context.", None)
}

fn get_auth(ctx: &RequestContext<RoleServer>) -> Result<McpAuthContext, McpError> {
    ctx.extensions
        .get::<axum::http::request::Parts>()
        .and_then(|parts| parts.extensions.get::<McpAuthContext>())
        .cloned()
        .ok_or_else(auth_missing)
}

fn check_project_scope(scope: &Option<Vec<Uuid>>, project_id: Uuid) -> Result<(), McpError> {
    match scope {
        None => Ok(()),
        Some(ids) if ids.contains(&project_id) => Ok(()),
        _ => Err(McpError::invalid_params(
            "API key is not scoped to this project.",
            None,
        )),
    }
}

fn parse_uuid(s: &str) -> Result<Uuid, McpError> {
    Uuid::parse_str(s).map_err(|_| McpError::invalid_params(format!("Invalid UUID: {s}"), None))
}

// ── param structs ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct GetCurriculumParams {
    /// UUID of the project to retrieve
    pub project_id: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct CreateBlockParams {
    /// UUID of the curriculum to add the block to
    pub curriculum_id: String,
    /// Block type: tile-match, category-sort, sequence-sorter, interactive-diagram, syntax-sprint, binary-blitz, multiple-choice
    pub block_type: String,
    pub title: String,
    pub description: Option<String>,
    /// Block-type-specific configuration JSON
    pub config: serde_json::Value,
    /// Block settings: {"timerSeconds":null,"showScore":true,"allowRetry":true,"difficulty":null}
    pub settings: serde_json::Value,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct UpdateBlockParams {
    /// UUID of the block to update
    pub block_id: String,
    pub title: String,
    pub description: Option<String>,
    pub config: serde_json::Value,
    pub settings: serde_json::Value,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct DeleteBlockParams {
    /// UUID of the block to delete
    pub block_id: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ReorderBlocksParams {
    /// UUID of the curriculum
    pub curriculum_id: String,
    /// Ordered list of block UUIDs
    pub ordered_ids: Vec<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ExportCurriculumParams {
    /// UUID of the project to export
    pub project_id: String,
}

// ── server ───────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct CurriculumMcpServer {
    store: Arc<dyn Store>,
    tool_router: ToolRouter<Self>,
}

#[tool_router]
impl CurriculumMcpServer {
    pub fn new(store: Arc<dyn Store>) -> Self {
        Self {
            store,
            tool_router: Self::tool_router(),
        }
    }

    #[tool(description = "List all projects accessible to the current API key")]
    async fn list_projects(
        &self,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let auth = get_auth(&ctx)?;
        let orgs = self
            .store
            .list_organizations_for_user(auth.user_id)
            .map_err(mcp_err)?;

        let mut projects = Vec::new();
        for org in orgs {
            let mut org_projects = self.store.list_projects(org.id).map_err(mcp_err)?;
            projects.append(&mut org_projects);
        }

        if let Some(scope) = &auth.project_scope {
            projects.retain(|p| scope.contains(&p.id));
        }

        let json = serde_json::to_string_pretty(&projects).map_err(mcp_err)?;
        Ok(CallToolResult::success(vec![Content::text(json)]))
    }

    #[tool(description = "Get the full workspace (project + curriculum + blocks) for a project")]
    async fn get_curriculum(
        &self,
        Parameters(params): Parameters<GetCurriculumParams>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let auth = get_auth(&ctx)?;
        let project_id = parse_uuid(&params.project_id)?;
        check_project_scope(&auth.project_scope, project_id)?;

        let project = self.store.get_project(project_id).map_err(mcp_err)?;
        let orgs = self
            .store
            .list_organizations_for_user(auth.user_id)
            .map_err(mcp_err)?;
        if !orgs.iter().any(|o| o.id == project.organization_id) {
            return Err(McpError::invalid_params(
                "No access to this project.",
                None,
            ));
        }

        let workspace = self.store.get_project_workspace(project_id).map_err(mcp_err)?;
        let json = serde_json::to_string_pretty(&workspace).map_err(mcp_err)?;
        Ok(CallToolResult::success(vec![Content::text(json)]))
    }

    #[tool(description = "Create a new interactive block in a curriculum")]
    async fn create_block(
        &self,
        Parameters(params): Parameters<CreateBlockParams>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let auth = get_auth(&ctx)?;
        let curriculum_id = parse_uuid(&params.curriculum_id)?;

        let project = self
            .store
            .get_project_by_curriculum_id(curriculum_id)
            .map_err(mcp_err)?;
        check_project_scope(&auth.project_scope, project.id)?;

        let orgs = self
            .store
            .list_organizations_for_user(auth.user_id)
            .map_err(mcp_err)?;
        if !orgs.iter().any(|o| o.id == project.organization_id) {
            return Err(McpError::invalid_params("No access to this project.", None));
        }

        let block_type: BlockType =
            serde_json::from_value(serde_json::Value::String(params.block_type))
                .map_err(|e| McpError::invalid_params(format!("Invalid block type: {e}"), None))?;
        let settings: BlockSettings = serde_json::from_value(params.settings)
            .map_err(|e| McpError::invalid_params(format!("Invalid settings: {e}"), None))?;

        let block = self
            .store
            .create_block(CreateBlockInput {
                curriculum_id,
                block_type,
                title: params.title,
                description: params.description,
                config: params.config,
                settings,
            })
            .map_err(mcp_err)?;

        let json = serde_json::to_string_pretty(&block).map_err(mcp_err)?;
        Ok(CallToolResult::success(vec![Content::text(json)]))
    }

    #[tool(description = "Update an existing block")]
    async fn update_block(
        &self,
        Parameters(params): Parameters<UpdateBlockParams>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let auth = get_auth(&ctx)?;
        let block_id = parse_uuid(&params.block_id)?;

        let project = self
            .store
            .get_project_by_block_id(block_id)
            .map_err(mcp_err)?;
        check_project_scope(&auth.project_scope, project.id)?;

        let orgs = self
            .store
            .list_organizations_for_user(auth.user_id)
            .map_err(mcp_err)?;
        if !orgs.iter().any(|o| o.id == project.organization_id) {
            return Err(McpError::invalid_params("No access to this project.", None));
        }

        let settings: BlockSettings = serde_json::from_value(params.settings)
            .map_err(|e| McpError::invalid_params(format!("Invalid settings: {e}"), None))?;

        let block = self
            .store
            .update_block(UpdateBlockInput {
                block_id,
                title: params.title,
                description: params.description,
                config: params.config,
                settings,
            })
            .map_err(mcp_err)?;

        let json = serde_json::to_string_pretty(&block).map_err(mcp_err)?;
        Ok(CallToolResult::success(vec![Content::text(json)]))
    }

    #[tool(description = "Delete a block from a curriculum")]
    async fn delete_block(
        &self,
        Parameters(params): Parameters<DeleteBlockParams>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let auth = get_auth(&ctx)?;
        let block_id = parse_uuid(&params.block_id)?;

        let project = self
            .store
            .get_project_by_block_id(block_id)
            .map_err(mcp_err)?;
        check_project_scope(&auth.project_scope, project.id)?;

        let orgs = self
            .store
            .list_organizations_for_user(auth.user_id)
            .map_err(mcp_err)?;
        if !orgs.iter().any(|o| o.id == project.organization_id) {
            return Err(McpError::invalid_params("No access to this project.", None));
        }

        self.store.delete_block(block_id).map_err(mcp_err)?;
        Ok(CallToolResult::success(vec![Content::text("Block deleted.")]))
    }

    #[tool(description = "Reorder blocks within a curriculum")]
    async fn reorder_blocks(
        &self,
        Parameters(params): Parameters<ReorderBlocksParams>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let auth = get_auth(&ctx)?;
        let curriculum_id = parse_uuid(&params.curriculum_id)?;

        let project = self
            .store
            .get_project_by_curriculum_id(curriculum_id)
            .map_err(mcp_err)?;
        check_project_scope(&auth.project_scope, project.id)?;

        let orgs = self
            .store
            .list_organizations_for_user(auth.user_id)
            .map_err(mcp_err)?;
        if !orgs.iter().any(|o| o.id == project.organization_id) {
            return Err(McpError::invalid_params("No access to this project.", None));
        }

        let ordered_ids = params
            .ordered_ids
            .iter()
            .map(|s| parse_uuid(s))
            .collect::<Result<Vec<_>, _>>()?;

        let curriculum = self
            .store
            .reorder_blocks(curriculum_id, ordered_ids)
            .map_err(mcp_err)?;

        let json = serde_json::to_string_pretty(&curriculum).map_err(mcp_err)?;
        Ok(CallToolResult::success(vec![Content::text(json)]))
    }

    #[tool(description = "Export the full curriculum as JSON (project + curriculum + all blocks)")]
    async fn export_curriculum(
        &self,
        Parameters(params): Parameters<ExportCurriculumParams>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, McpError> {
        let auth = get_auth(&ctx)?;
        let project_id = parse_uuid(&params.project_id)?;
        check_project_scope(&auth.project_scope, project_id)?;

        let project = self.store.get_project(project_id).map_err(mcp_err)?;
        let orgs = self
            .store
            .list_organizations_for_user(auth.user_id)
            .map_err(mcp_err)?;
        if !orgs.iter().any(|o| o.id == project.organization_id) {
            return Err(McpError::invalid_params("No access to this project.", None));
        }

        let exported = self.store.export_curriculum(project_id).map_err(mcp_err)?;
        let json = serde_json::to_string_pretty(&exported).map_err(mcp_err)?;
        Ok(CallToolResult::success(vec![Content::text(json)]))
    }
}

#[tool_handler]
impl ServerHandler for CurriculumMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::from_build_env())
    }
}
