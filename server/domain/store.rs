use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
};

use chrono::Utc;
use uuid::Uuid;

use crate::{
    domain::{
        models::{
            AddOrganizationMemberInput, CreateBlockInput, CreateOrganizationInput,
            CreateProjectInput, CreateUserInput, Curriculum, ExportedCurriculum, InteractiveBlock,
            Organization, OrganizationMember, OrganizationRole, Project, ProjectWorkspace,
            UpdateBlockInput, UpdateProjectInput, User,
        },
        validation::{validate_block_config, validate_project, validate_user},
    },
    errors::Error,
};

pub trait Store: Send + Sync {
    fn create_user(&self, input: CreateUserInput) -> Result<User, Error>;
    fn find_user_by_email(&self, email: &str) -> Result<Option<User>, Error>;
    fn get_user(&self, user_id: Uuid) -> Result<User, Error>;

    fn create_organization(&self, input: CreateOrganizationInput) -> Result<Organization, Error>;
    fn list_organizations_for_user(&self, user_id: Uuid) -> Result<Vec<Organization>, Error>;
    fn add_member(&self, input: AddOrganizationMemberInput) -> Result<OrganizationMember, Error>;
    fn list_members(&self, organization_id: Uuid) -> Result<Vec<OrganizationMember>, Error>;

    fn create_project(&self, input: CreateProjectInput) -> Result<Project, Error>;
    fn list_projects(&self, organization_id: Uuid) -> Result<Vec<Project>, Error>;
    fn list_projects_for_user(&self, user_id: Uuid) -> Result<Vec<Project>, Error>;
    fn get_project(&self, project_id: Uuid) -> Result<Project, Error>;
    fn get_project_by_curriculum_id(&self, curriculum_id: Uuid) -> Result<Project, Error>;
    fn get_project_by_block_id(&self, block_id: Uuid) -> Result<Project, Error>;
    fn update_project(&self, input: UpdateProjectInput) -> Result<Project, Error>;
    fn get_project_workspace(&self, project_id: Uuid) -> Result<ProjectWorkspace, Error>;

    fn create_block(&self, input: CreateBlockInput) -> Result<InteractiveBlock, Error>;
    fn update_block(&self, input: UpdateBlockInput) -> Result<InteractiveBlock, Error>;
    fn delete_block(&self, block_id: Uuid) -> Result<(), Error>;
    fn duplicate_block(&self, block_id: Uuid) -> Result<InteractiveBlock, Error>;
    fn reorder_blocks(
        &self,
        curriculum_id: Uuid,
        ordered_ids: Vec<Uuid>,
    ) -> Result<Curriculum, Error>;

    fn export_curriculum(&self, project_id: Uuid) -> Result<ExportedCurriculum, Error>;
}

#[derive(Default)]
struct Database {
    users: HashMap<Uuid, User>,
    users_by_email: HashMap<String, Uuid>,
    organizations: HashMap<Uuid, Organization>,
    members: HashMap<Uuid, OrganizationMember>,
    projects: HashMap<Uuid, Project>,
    curricula: HashMap<Uuid, Curriculum>,
    blocks: HashMap<Uuid, InteractiveBlock>,
}

pub struct InMemoryStore {
    db: RwLock<Database>,
}

impl InMemoryStore {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            db: RwLock::new(Database::default()),
        })
    }
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn slugify(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn not_found(message: impl Into<String>) -> Error {
    Error::not_found(message)
}

fn conflict(message: impl Into<String>) -> Error {
    Error::conflict(message)
}

impl Store for InMemoryStore {
    fn create_user(&self, input: CreateUserInput) -> Result<User, Error> {
        validate_user(&input)?;

        let email = input.email.trim().to_lowercase();
        let mut db = self.db.write().expect("store write lock");

        if db.users_by_email.contains_key(&email) {
            return Err(conflict("A user with that email already exists."));
        }

        let user = User {
            id: Uuid::new_v4(),
            name: input.name.trim().to_string(),
            email: email.clone(),
            created_at: now(),
        };

        db.users_by_email.insert(email, user.id);
        db.users.insert(user.id, user.clone());

        Ok(user)
    }

    fn find_user_by_email(&self, email: &str) -> Result<Option<User>, Error> {
        let db = self.db.read().expect("store read lock");
        let Some(user_id) = db.users_by_email.get(&email.trim().to_lowercase()) else {
            return Ok(None);
        };

        Ok(db.users.get(user_id).cloned())
    }

    fn get_user(&self, user_id: Uuid) -> Result<User, Error> {
        let db = self.db.read().expect("store read lock");
        db.users
            .get(&user_id)
            .cloned()
            .ok_or_else(|| not_found("User not found."))
    }

    fn create_organization(&self, input: CreateOrganizationInput) -> Result<Organization, Error> {
        let mut db = self.db.write().expect("store write lock");
        if !db.users.contains_key(&input.owner_user_id) {
            return Err(not_found("Owner user not found."));
        }

        let organization = Organization {
            id: Uuid::new_v4(),
            name: input.name.trim().to_string(),
            slug: slugify(&input.name),
            created_at: now(),
        };

        let membership = OrganizationMember {
            id: Uuid::new_v4(),
            organization_id: organization.id,
            user_id: input.owner_user_id,
            role: OrganizationRole::Owner,
            created_at: now(),
        };

        db.organizations
            .insert(organization.id, organization.clone());
        db.members.insert(membership.id, membership);

        Ok(organization)
    }

    fn list_organizations_for_user(&self, user_id: Uuid) -> Result<Vec<Organization>, Error> {
        let db = self.db.read().expect("store read lock");
        let mut organizations = db
            .members
            .values()
            .filter(|member| member.user_id == user_id)
            .filter_map(|member| db.organizations.get(&member.organization_id).cloned())
            .collect::<Vec<_>>();
        organizations.sort_by(|left, right| left.name.cmp(&right.name));
        Ok(organizations)
    }

    fn add_member(&self, input: AddOrganizationMemberInput) -> Result<OrganizationMember, Error> {
        let mut db = self.db.write().expect("store write lock");
        if !db.organizations.contains_key(&input.organization_id) {
            return Err(not_found("Organization not found."));
        }

        let normalized_email = input.email.trim().to_lowercase();
        let user_id = if let Some(existing_id) = db.users_by_email.get(&normalized_email) {
            *existing_id
        } else {
            let user = User {
                id: Uuid::new_v4(),
                name: input.name.clone().unwrap_or_else(|| {
                    normalized_email
                        .split('@')
                        .next()
                        .unwrap_or("Member")
                        .to_string()
                }),
                email: normalized_email.clone(),
                created_at: now(),
            };
            let id = user.id;
            db.users_by_email.insert(normalized_email, id);
            db.users.insert(id, user);
            id
        };

        if db.members.values().any(|member| {
            member.organization_id == input.organization_id && member.user_id == user_id
        }) {
            return Err(conflict(
                "That user is already a member of this organization.",
            ));
        }

        let member = OrganizationMember {
            id: Uuid::new_v4(),
            organization_id: input.organization_id,
            user_id,
            role: input.role,
            created_at: now(),
        };
        db.members.insert(member.id, member.clone());
        Ok(member)
    }

    fn list_members(&self, organization_id: Uuid) -> Result<Vec<OrganizationMember>, Error> {
        let db = self.db.read().expect("store read lock");
        let mut members = db
            .members
            .values()
            .filter(|member| member.organization_id == organization_id)
            .cloned()
            .collect::<Vec<_>>();
        members.sort_by(|left, right| left.created_at.cmp(&right.created_at));
        Ok(members)
    }

    fn create_project(&self, input: CreateProjectInput) -> Result<Project, Error> {
        validate_project(&input)?;

        let mut db = self.db.write().expect("store write lock");
        if !db.organizations.contains_key(&input.organization_id) {
            return Err(not_found("Organization not found."));
        }

        let timestamp = now();
        let curriculum = Curriculum {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            title: input.name.trim().to_string(),
            description: input.description.trim().to_string(),
            block_ids: Vec::new(),
            updated_at: timestamp.clone(),
        };

        let project = Project {
            id: curriculum.project_id,
            organization_id: input.organization_id,
            curriculum_id: curriculum.id,
            created_by_user_id: input.created_by_user_id,
            name: input.name.trim().to_string(),
            description: input.description.trim().to_string(),
            status: input.status,
            created_at: timestamp.clone(),
            updated_at: timestamp,
        };

        db.curricula.insert(curriculum.id, curriculum);
        db.projects.insert(project.id, project.clone());

        Ok(project)
    }

    fn list_projects(&self, organization_id: Uuid) -> Result<Vec<Project>, Error> {
        let db = self.db.read().expect("store read lock");
        let mut projects = db
            .projects
            .values()
            .filter(|project| project.organization_id == organization_id)
            .cloned()
            .collect::<Vec<_>>();
        projects.sort_by(|left, right| left.updated_at.cmp(&right.updated_at));
        projects.reverse();
        Ok(projects)
    }

    fn get_project(&self, project_id: Uuid) -> Result<Project, Error> {
        let db = self.db.read().expect("store read lock");
        db.projects
            .get(&project_id)
            .cloned()
            .ok_or_else(|| not_found("Project not found."))
    }

    fn list_projects_for_user(&self, user_id: Uuid) -> Result<Vec<Project>, Error> {
        let db = self.db.read().expect("store read lock");
        let mut projects = db
            .projects
            .values()
            .filter(|project| project.created_by_user_id == user_id)
            .cloned()
            .collect::<Vec<_>>();
        projects.sort_by(|left, right| left.updated_at.cmp(&right.updated_at));
        projects.reverse();
        Ok(projects)
    }

    fn get_project_by_curriculum_id(&self, curriculum_id: Uuid) -> Result<Project, Error> {
        let db = self.db.read().expect("store read lock");
        db.projects
            .values()
            .find(|project| project.curriculum_id == curriculum_id)
            .cloned()
            .ok_or_else(|| not_found("Project not found for curriculum."))
    }

    fn get_project_by_block_id(&self, block_id: Uuid) -> Result<Project, Error> {
        let db = self.db.read().expect("store read lock");
        let curriculum = db
            .curricula
            .values()
            .find(|curriculum| curriculum.block_ids.contains(&block_id))
            .ok_or_else(|| not_found("Curriculum not found for block."))?;
        db.projects
            .values()
            .find(|project| project.curriculum_id == curriculum.id)
            .cloned()
            .ok_or_else(|| not_found("Project not found for block."))
    }

    fn update_project(&self, input: UpdateProjectInput) -> Result<Project, Error> {
        let mut db = self.db.write().expect("store write lock");
        let (curriculum_id, project_name, project_description, project_updated_at, project_clone) = {
            let project = db
                .projects
                .get_mut(&input.project_id)
                .ok_or_else(|| not_found("Project not found."))?;

            if let Some(name) = input.name {
                project.name = name.trim().to_string();
            }
            if let Some(description) = input.description {
                project.description = description.trim().to_string();
            }
            if let Some(status) = input.status {
                project.status = status;
            }
            project.updated_at = now();

            (
                project.curriculum_id,
                project.name.clone(),
                project.description.clone(),
                project.updated_at.clone(),
                project.clone(),
            )
        };

        if let Some(curriculum) = db.curricula.get_mut(&curriculum_id) {
            curriculum.title = project_name;
            curriculum.description = project_description;
            curriculum.updated_at = project_updated_at;
        }

        Ok(project_clone)
    }

    fn get_project_workspace(&self, project_id: Uuid) -> Result<ProjectWorkspace, Error> {
        let db = self.db.read().expect("store read lock");
        let project = db
            .projects
            .get(&project_id)
            .cloned()
            .ok_or_else(|| not_found("Project not found."))?;
        let curriculum = db
            .curricula
            .get(&project.curriculum_id)
            .cloned()
            .ok_or_else(|| not_found("Curriculum not found."))?;
        let blocks = curriculum
            .block_ids
            .iter()
            .filter_map(|block_id| db.blocks.get(block_id).cloned())
            .collect::<Vec<_>>();

        Ok(ProjectWorkspace {
            project,
            curriculum,
            blocks,
        })
    }

    fn create_block(&self, input: CreateBlockInput) -> Result<InteractiveBlock, Error> {
        validate_block_config(&input.block_type, &input.config)?;

        let mut db = self.db.write().expect("store write lock");
        let curriculum = db
            .curricula
            .get_mut(&input.curriculum_id)
            .ok_or_else(|| not_found("Curriculum not found."))?;
        let block = InteractiveBlock {
            id: Uuid::new_v4(),
            block_type: input.block_type,
            title: input.title.trim().to_string(),
            description: input.description,
            config: input.config,
            settings: input.settings,
        };

        curriculum.block_ids.push(block.id);
        curriculum.updated_at = now();
        db.blocks.insert(block.id, block.clone());

        Ok(block)
    }

    fn update_block(&self, input: UpdateBlockInput) -> Result<InteractiveBlock, Error> {
        let mut db = self.db.write().expect("store write lock");
        let updated_block = {
            let block = db
                .blocks
                .get_mut(&input.block_id)
                .ok_or_else(|| not_found("Block not found."))?;

            validate_block_config(&block.block_type, &input.config)?;

            block.title = input.title.trim().to_string();
            block.description = input.description;
            block.config = input.config;
            block.settings = input.settings;
            block.clone()
        };

        if let Some(curriculum) = db
            .curricula
            .values_mut()
            .find(|curriculum| curriculum.block_ids.contains(&input.block_id))
        {
            curriculum.updated_at = now();
        }

        Ok(updated_block)
    }

    fn delete_block(&self, block_id: Uuid) -> Result<(), Error> {
        let mut db = self.db.write().expect("store write lock");
        if db.blocks.remove(&block_id).is_none() {
            return Err(not_found("Block not found."));
        }

        if let Some(curriculum) = db
            .curricula
            .values_mut()
            .find(|curriculum| curriculum.block_ids.contains(&block_id))
        {
            curriculum
                .block_ids
                .retain(|candidate| candidate != &block_id);
            curriculum.updated_at = now();
        }

        Ok(())
    }

    fn duplicate_block(&self, block_id: Uuid) -> Result<InteractiveBlock, Error> {
        let mut db = self.db.write().expect("store write lock");
        let original = db
            .blocks
            .get(&block_id)
            .cloned()
            .ok_or_else(|| not_found("Block not found."))?;

        let duplicated = InteractiveBlock {
            id: Uuid::new_v4(),
            title: format!("{} Copy", original.title),
            ..original
        };

        if let Some(curriculum) = db
            .curricula
            .values_mut()
            .find(|curriculum| curriculum.block_ids.contains(&block_id))
        {
            let index = curriculum
                .block_ids
                .iter()
                .position(|candidate| candidate == &block_id)
                .unwrap_or(curriculum.block_ids.len());
            curriculum.block_ids.insert(index + 1, duplicated.id);
            curriculum.updated_at = now();
        }

        db.blocks.insert(duplicated.id, duplicated.clone());
        Ok(duplicated)
    }

    fn reorder_blocks(
        &self,
        curriculum_id: Uuid,
        ordered_ids: Vec<Uuid>,
    ) -> Result<Curriculum, Error> {
        let mut db = self.db.write().expect("store write lock");
        let curriculum = db
            .curricula
            .get_mut(&curriculum_id)
            .ok_or_else(|| not_found("Curriculum not found."))?;

        let mut existing = curriculum.block_ids.clone();
        existing.sort();
        let mut proposed = ordered_ids.clone();
        proposed.sort();

        if existing != proposed {
            return Err(Error::bad_request(
                "Reordered block ids must match the existing curriculum block set.",
            ));
        }

        curriculum.block_ids = ordered_ids;
        curriculum.updated_at = now();
        Ok(curriculum.clone())
    }

    fn export_curriculum(&self, project_id: Uuid) -> Result<ExportedCurriculum, Error> {
        let workspace = self.get_project_workspace(project_id)?;
        Ok(ExportedCurriculum {
            project: workspace.project,
            curriculum: workspace.curriculum,
            blocks: workspace.blocks,
        })
    }
}
