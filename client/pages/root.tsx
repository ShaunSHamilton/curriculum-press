import {
  createContext,
  startTransition,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Outlet,
  createRootRoute,
  createRoute,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { BlockEditor } from "../components/block-editor";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Tabs, Textarea } from "../components/ui";
import {
  AUTH_STORAGE_KEY,
  addMember,
  createBlock,
  createOrganization,
  createProject,
  deleteBlock,
  duplicateBlock,
  exportProject,
  getMe,
  getProjectWorkspace,
  listMembers,
  listMyProjects,
  listOrganizations,
  listProjects,
  reorderBlocks,
  signIn,
  signUp,
  updateBlock,
  updateProject,
} from "../lib/api";
import type {
  AnyInteractiveBlock,
  ExportedCurriculum,
  Organization,
  OrganizationMember,
  Project,
  ProjectStatus,
} from "../types";
import { BLOCK_CATALOG, createDefaultBlock } from "../types";
import { CurriculumPlayer, InteractiveBlockRenderer } from "../../packages/blocks/src";

type PreviewTab = "block" | "curriculum" | "export";

type AppSessionValue = {
  userId: string;
  setUserId: (value: string) => void;
  selectedOrganizationId: string;
  setSelectedOrganizationId: (value: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
};

const AppSessionContext = createContext<AppSessionValue | null>(null);

function usePersistentState(key: string, initialValue: string) {
  const [value, setValue] = useState(() => localStorage.getItem(key) ?? initialValue);

  useEffect(() => {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  }, [key, value]);

  return [value, setValue] as const;
}

function useAppSession() {
  const context = useContext(AppSessionContext);

  if (!context) {
    throw new Error("App session context is unavailable.");
  }

  return context;
}

function downloadExport(payload: ExportedCurriculum) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${payload.project.name.toLowerCase().replace(/\s+/g, "-") || "curriculum"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function RootComponent() {
  const [userId, setUserId] = usePersistentState(AUTH_STORAGE_KEY, "");
  const [selectedOrganizationId, setSelectedOrganizationId] = usePersistentState(
    "curriculum-press.organization-id",
    "",
  );
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState(
    "curriculum-press.sidebar-collapsed",
    "false",
  );

  const session = useMemo<AppSessionValue>(
    () => ({
      userId,
      setUserId,
      selectedOrganizationId,
      setSelectedOrganizationId,
      sidebarCollapsed: sidebarCollapsed === "true",
      setSidebarCollapsed: (value) => setSidebarCollapsed(value ? "true" : "false"),
    }),
    [selectedOrganizationId, setSelectedOrganizationId, setSidebarCollapsed, sidebarCollapsed, userId, setUserId],
  );

  return (
    <AppSessionContext.Provider value={session}>
      <Outlet />
    </AppSessionContext.Provider>
  );
}

function AuthScreen() {
  const queryClient = useQueryClient();
  const { setUserId } = useAppSession();
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [authForm, setAuthForm] = useState({ name: "", email: "" });

  const signUpMutation = useMutation({
    mutationFn: signUp,
    onSuccess: (response) => {
      setUserId(response.user.id);
      setAuthForm({ name: "", email: "" });
      queryClient.invalidateQueries();
    },
  });

  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: (response) => {
      setUserId(response.user.id);
      queryClient.invalidateQueries();
    },
  });

  return (
    <div className="auth-shell">
      <Card
        className="auth-card"
        subtitle="Build interactive curricula with reusable block templates, project-level previews, and exportable learner experiences."
        title="Curriculum Press"
      >
        <Tabs
          items={[
            { label: "Sign Up", value: "signup" },
            { label: "Sign In", value: "signin" },
          ]}
          onChange={(value) => setAuthMode(value as "signup" | "signin")}
          value={authMode}
        />
        <div className="stack">
          {authMode === "signup" ? (
            <Field hint="Required" label="Name" required>
              <Input
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setAuthForm((current) => ({ ...current, name: value }));
                }}
                required
                value={authForm.name}
              />
            </Field>
          ) : null}
          <Field hint="Required" label="Email" required>
            <Input
              onChange={(event) => {
                const value = event.currentTarget.value;
                setAuthForm((current) => ({ ...current, email: value }));
              }}
              required
              value={authForm.email}
            />
          </Field>
          {(signUpMutation.error || signInMutation.error) ? (
            <p className="inline-error">{(signUpMutation.error ?? signInMutation.error)?.message}</p>
          ) : null}
          <Button
            onClick={() => {
              if (authMode === "signup") {
                signUpMutation.mutate(authForm);
                return;
              }
              signInMutation.mutate({ email: authForm.email });
            }}
            type="button"
          >
            {authMode === "signup" ? "Create Account" : "Sign In"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function HomeRoute() {
  const { userId } = useAppSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) {
      return;
    }

    void navigate({ to: "/projects/mine", replace: true });
  }, [navigate, userId]);

  if (!userId) {
    return <AuthScreen />;
  }

  return (
    <div className="workspace-empty">
      <Card subtitle="Loading your workspace routes." title="Redirecting" />
    </div>
  );
}

function AppShell() {
  const { userId, selectedOrganizationId, setSelectedOrganizationId, sidebarCollapsed, setSidebarCollapsed } =
    useAppSession();
  const navigate = useNavigate();
  const [showOrganizationCreator, setShowOrganizationCreator] = useState(false);
  const [organizationName, setOrganizationName] = useState("");

  const meQuery = useQuery({
    enabled: Boolean(userId),
    queryKey: ["me", userId],
    queryFn: () => getMe(userId),
    retry: false,
  });

  const organizationsQuery = useQuery({
    enabled: Boolean(userId),
    queryKey: ["organizations", userId],
    queryFn: () => listOrganizations(userId),
  });

  const createOrganizationMutation = useMutation({
    mutationFn: (payload: { name: string }) => createOrganization(userId, payload),
    onSuccess: (organization) => {
      setOrganizationName("");
      setShowOrganizationCreator(false);
      setSelectedOrganizationId(organization.id);
      void navigate({
        to: "/organizations/$organizationId/projects",
        params: { organizationId: organization.id },
      });
    },
  });

  useEffect(() => {
    const organizations = organizationsQuery.data ?? [];
    if (!organizations.length) {
      return;
    }

    if (!organizations.some((organization) => organization.id === selectedOrganizationId)) {
      setSelectedOrganizationId(organizations[0]?.id ?? "");
    }
  }, [organizationsQuery.data, selectedOrganizationId, setSelectedOrganizationId]);

  if (!userId) {
    return <AuthScreen />;
  }

  return (
    <div className={`workspace-shell ${sidebarCollapsed ? "is-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-copy">
            <span className="eyebrow">Builder Workspace</span>
            {!sidebarCollapsed ? <h1>Curriculum Press</h1> : null}
          </div>
          <Button
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            type="button"
            variant="ghost"
          >
            {sidebarCollapsed ? ">>" : "<<"}
          </Button>
        </div>

        <Card className="sidebar-section" subtitle={!sidebarCollapsed ? "Compact workspace controls." : undefined} title={!sidebarCollapsed ? "Workspace" : undefined}>
          <div className="stack-sm">
            {!sidebarCollapsed ? (
              <>
                <Badge tone="accent">{meQuery.data?.name ?? "Author"}</Badge>
                <Field label="Current Organization">
                  <Select
                    onChange={(event) => {
                      const organizationId = event.currentTarget.value;
                      setSelectedOrganizationId(organizationId);
                      if (organizationId) {
                        void navigate({
                          to: "/organizations/$organizationId/projects",
                          params: { organizationId },
                        });
                      }
                    }}
                    value={selectedOrganizationId}
                  >
                    <option value="">Select organization</option>
                    {(organizationsQuery.data ?? []).map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {showOrganizationCreator ? (
                  <div className="stack-sm">
                    <Field hint="Required" label="New Organization" required>
                      <Input
                        onChange={(event) => setOrganizationName(event.currentTarget.value)}
                        placeholder="Northwind Training"
                        required
                        value={organizationName}
                      />
                    </Field>
                    <div className="button-row">
                      <Button
                        disabled={!organizationName.trim() || createOrganizationMutation.isPending}
                        onClick={() => createOrganizationMutation.mutate({ name: organizationName })}
                        type="button"
                      >
                        Create
                      </Button>
                      <Button
                        onClick={() => {
                          setShowOrganizationCreator(false);
                          setOrganizationName("");
                        }}
                        type="button"
                        variant="ghost"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setShowOrganizationCreator(true)} type="button" variant="secondary">
                    New Organization
                  </Button>
                )}
              </>
            ) : (
              <Badge tone="accent">{meQuery.data?.name?.slice(0, 1) ?? "A"}</Badge>
            )}
          </div>
        </Card>

        <nav className="sidebar-nav">
          <SidebarNavButton
            collapsed={sidebarCollapsed}
            label="My Projects"
            onClick={() => void navigate({ to: "/projects/mine" })}
          />
          <SidebarNavButton
            collapsed={sidebarCollapsed}
            disabled={!selectedOrganizationId}
            label="Organization Projects"
            onClick={() => {
              if (!selectedOrganizationId) {
                return;
              }

              void navigate({
                to: "/organizations/$organizationId/projects",
                params: { organizationId: selectedOrganizationId },
              });
            }}
          />
        </nav>
      </aside>

      <main className="workspace-main">
        <Outlet />
      </main>
    </div>
  );
}

function SidebarNavButton({
  collapsed,
  disabled,
  label,
  onClick,
}: {
  collapsed: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`sidebar-nav-button ${collapsed ? "is-collapsed" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <strong>{collapsed ? label.slice(0, 2).toUpperCase() : label}</strong>
    </button>
  );
}

function MyProjectsPage() {
  const { userId, selectedOrganizationId } = useAppSession();
  const navigate = useNavigate();

  const projectsQuery = useQuery({
    enabled: Boolean(userId),
    queryKey: ["projects", "mine", userId],
    queryFn: () => listMyProjects(userId),
  });

  const organizationsQuery = useQuery({
    enabled: Boolean(userId),
    queryKey: ["organizations", userId],
    queryFn: () => listOrganizations(userId),
  });

  return (
    <div className="stack">
      <PageHeader
        title="My Projects"
        subtitle="Every project you created across organizations, with quick access back into the builder."
      />
      <div className="page-grid">
        <ProjectCreatePanel
          defaultOrganizationId={selectedOrganizationId}
          organizations={organizationsQuery.data ?? []}
          userId={userId}
          onCreated={(projectId) => void navigate({ to: "/projects/$projectId", params: { projectId } })}
        />
        <ProjectsListCard
          emptyBody="Create a project to start building a curriculum."
          emptyTitle="No Projects Yet"
          projects={projectsQuery.data ?? []}
          subtitle="Projects you personally created."
          title="Created By You"
        />
      </div>
    </div>
  );
}

function OrganizationProjectsPage() {
  const { organizationId } = useParams({ from: "/organizations/$organizationId/projects" });
  const { userId, setSelectedOrganizationId } = useAppSession();
  const navigate = useNavigate();
  const [memberEmail, setMemberEmail] = useState("");
  const [memberName, setMemberName] = useState("");

  const organizationsQuery = useQuery({
    enabled: Boolean(userId),
    queryKey: ["organizations", userId],
    queryFn: () => listOrganizations(userId),
  });

  const projectsQuery = useQuery({
    enabled: Boolean(userId && organizationId),
    queryKey: ["projects", userId, organizationId],
    queryFn: () => listProjects(userId, organizationId),
  });

  const membersQuery = useQuery({
    enabled: Boolean(userId && organizationId),
    queryKey: ["members", userId, organizationId],
    queryFn: () => listMembers(userId, organizationId),
  });

  const addMemberMutation = useMutation({
    mutationFn: (payload: { email: string; name?: string }) => addMember(userId, organizationId, payload),
    onSuccess: () => {
      setMemberEmail("");
      setMemberName("");
      void membersQuery.refetch();
    },
  });

  useEffect(() => {
    setSelectedOrganizationId(organizationId);
  }, [organizationId, setSelectedOrganizationId]);

  const organization =
    organizationsQuery.data?.find((candidate) => candidate.id === organizationId) ?? null;

  return (
    <div className="stack">
      <PageHeader
        title={organization ? `${organization.name} Projects` : "Organization Projects"}
        subtitle="Projects shared inside the selected organization, plus the members who can collaborate on them."
      />
      <div className="page-grid">
        <ProjectCreatePanel
          fixedOrganizationId={organizationId}
          organizations={organizationsQuery.data ?? []}
          userId={userId}
          onCreated={(projectId) => void navigate({ to: "/projects/$projectId", params: { projectId } })}
        />
        <Card
          subtitle="Members belong to this organization and gain access to its collaborative project workspace."
          title="Members"
        >
          <div className="stack">
            {(membersQuery.data ?? []).length ? (
              <div className="member-list">
                {(membersQuery.data ?? []).map((member: OrganizationMember) => (
                  <div className="member-row" key={member.id}>
                    <span>{member.userId.slice(0, 8)}</span>
                    <Badge>{member.role}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                body="Add a teammate to grant them access to this organization's projects."
                title="No Members Yet"
              />
            )}
            <Field label="Member Name">
              <Input
                onChange={(event) => setMemberName(event.currentTarget.value)}
                value={memberName}
              />
            </Field>
            <Field hint="Required" label="Member Email" required>
              <Input
                onChange={(event) => setMemberEmail(event.currentTarget.value)}
                required
                value={memberEmail}
              />
            </Field>
            <Button
              disabled={!memberEmail.trim() || addMemberMutation.isPending}
              onClick={() => addMemberMutation.mutate({ email: memberEmail, name: memberName })}
              type="button"
              variant="secondary"
            >
              Add Member
            </Button>
          </div>
        </Card>
      </div>

      <ProjectsListCard
        emptyBody="This organization doesn't have any projects yet."
        emptyTitle="No Organization Projects"
        projects={projectsQuery.data ?? []}
        subtitle="All projects inside this organization."
        title="Organization Projects"
      />
    </div>
  );
}

function ProjectBuilderPage() {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const { userId } = useAppSession();
  const queryClient = useQueryClient();
  const [selectedBlockId, setSelectedBlockId] = usePersistentState("curriculum-press.block-id", "");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("block");
  const [draftBlock, setDraftBlock] = useState<AnyInteractiveBlock | null>(null);
  const [projectDetailsDraft, setProjectDetailsDraft] = useState({
    name: "",
    description: "",
    status: "draft" as ProjectStatus,
  });

  const workspaceQuery = useQuery({
    enabled: Boolean(userId && projectId),
    queryKey: ["workspace", userId, projectId],
    queryFn: () => getProjectWorkspace(userId, projectId),
  });

  const exportMutation = useMutation({
    mutationFn: () => exportProject(userId, projectId),
    onSuccess: (payload) => {
      downloadExport(payload);
      setPreviewTab("export");
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: () => updateProject(userId, projectId, projectDetailsDraft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: (type: (typeof BLOCK_CATALOG)[number]["type"]) => {
      const block = createDefaultBlock(type);
      return createBlock(userId, workspaceQuery.data!.curriculum.id, {
        type: block.type,
        title: block.title,
        description: block.description,
        config: block.config,
        settings: block.settings,
      });
    },
    onSuccess: (block) => {
      setSelectedBlockId(block.id);
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, projectId] });
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: (block: AnyInteractiveBlock) =>
      updateBlock(userId, block.id, {
        title: block.title,
        description: block.description,
        config: block.config,
        settings: block.settings,
      }),
    onSuccess: () => {
      setSelectedBlockId("");
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, projectId] });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: string) => deleteBlock(userId, blockId),
    onSuccess: () => {
      setSelectedBlockId("");
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, projectId] });
    },
  });

  const duplicateBlockMutation = useMutation({
    mutationFn: (blockId: string) => duplicateBlock(userId, blockId),
    onSuccess: (block) => {
      setSelectedBlockId(block.id);
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, projectId] });
    },
  });

  const reorderBlocksMutation = useMutation({
    mutationFn: (orderedIds: string[]) => reorderBlocks(userId, workspaceQuery.data!.curriculum.id, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, projectId] });
    },
  });

  useEffect(() => {
    const project = workspaceQuery.data?.project;
    if (!project) {
      return;
    }

    setProjectDetailsDraft({
      name: project.name,
      description: project.description,
      status: project.status,
    });
  }, [workspaceQuery.data?.project]);

  useEffect(() => {
    const blocks = workspaceQuery.data?.blocks ?? [];
    if (!blocks.length) {
      setDraftBlock(null);
      return;
    }

    if (!selectedBlockId) {
      setDraftBlock(null);
      return;
    }

    const selected = blocks.find((block) => block.id === selectedBlockId);
    if (selected) {
      setDraftBlock(selected);
      return;
    }

    setSelectedBlockId(blocks[0]?.id ?? "");
  }, [selectedBlockId, setSelectedBlockId, workspaceQuery.data?.blocks]);

  const selectedBlock =
    workspaceQuery.data?.blocks.find((block) => block.id === selectedBlockId) ?? null;
  const deferredDraftBlock = useDeferredValue(draftBlock);
  const project = workspaceQuery.data?.project;
  const projectIsDirty = Boolean(
    project &&
      JSON.stringify({
        name: project.name,
        description: project.description,
        status: project.status,
      }) !== JSON.stringify(projectDetailsDraft),
  );

  if (!workspaceQuery.data || !project) {
    return (
      <div className="workspace-empty">
        <Card subtitle="Loading project workspace." title="Project Builder" />
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        title={project.name}
        subtitle="Edit project details, manage the ordered curriculum, and preview the learner-facing experience from the same block engine."
      />

      <Card
        actions={
          <div className="button-row">
            <Button
              disabled={!projectIsDirty || updateProjectMutation.isPending}
              onClick={() => updateProjectMutation.mutate()}
              type="button"
              variant="secondary"
            >
              Save Project
            </Button>
            <Button
              disabled={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
              type="button"
            >
              Export JSON
            </Button>
          </div>
        }
        subtitle="Keep the project metadata tight and save only when something has changed."
        title="Project Details"
      >
        <div className="form-grid split">
          <Field hint="Required" label="Project Name" required>
            <Input
              onChange={(event) => {
                const value = event.currentTarget.value;
                setProjectDetailsDraft((current) => ({
                  ...current,
                  name: value,
                }));
              }}
              required
              value={projectDetailsDraft.name}
            />
          </Field>
          <Field label="Status">
            <Select
              onChange={(event) => {
                const value = event.currentTarget.value as ProjectStatus;
                setProjectDetailsDraft((current) => ({
                  ...current,
                  status: value,
                }));
              }}
              value={projectDetailsDraft.status}
            >
              <option value="draft">Draft</option>
              <option value="review">In Review</option>
              <option value="published">Published</option>
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            onChange={(event) => {
              const value = event.currentTarget.value;
              setProjectDetailsDraft((current) => ({
                ...current,
                description: value,
              }));
            }}
            rows={3}
            value={projectDetailsDraft.description}
          />
        </Field>
      </Card>

      <div className="builder-layout">
        <Card
          actions={<Badge tone="accent">{workspaceQuery.data.blocks.length} blocks</Badge>}
          className="panel-stretch"
          subtitle="Choose an interaction model, reorder the sequence, and open a block when you want to edit it."
          title="Curriculum Outline"
        >
          <div className="catalog-grid">
            {BLOCK_CATALOG.map((entry) => (
              <button
                className="catalog-card"
                key={entry.type}
                onClick={() => createBlockMutation.mutate(entry.type)}
                type="button"
              >
                <strong>{entry.name}</strong>
                <span>{entry.objective}</span>
                <p>{entry.description}</p>
              </button>
            ))}
          </div>
          <div className="outline-list">
            {workspaceQuery.data.blocks.map((block, index, blocks) => (
              <div
                className={`outline-item ${block.id === selectedBlockId ? "is-active" : ""}`}
                key={block.id}
              >
                <button
                  className="outline-select"
                  onClick={() => setSelectedBlockId(block.id)}
                  type="button"
                >
                  <strong>{block.title}</strong>
                  <span>{BLOCK_CATALOG.find((entry) => entry.type === block.type)?.name}</span>
                </button>
                <div className="button-row compact">
                  <Button
                    disabled={index === 0 || reorderBlocksMutation.isPending}
                    onClick={() => {
                      const orderedIds = [...blocks.map((item) => item.id)];
                      [orderedIds[index - 1], orderedIds[index]] = [
                        orderedIds[index],
                        orderedIds[index - 1],
                      ];
                      reorderBlocksMutation.mutate(orderedIds);
                    }}
                    type="button"
                    variant="ghost"
                  >
                    Up
                  </Button>
                  <Button
                    disabled={index === blocks.length - 1 || reorderBlocksMutation.isPending}
                    onClick={() => {
                      const orderedIds = [...blocks.map((item) => item.id)];
                      [orderedIds[index], orderedIds[index + 1]] = [
                        orderedIds[index + 1],
                        orderedIds[index],
                      ];
                      reorderBlocksMutation.mutate(orderedIds);
                    }}
                    type="button"
                    variant="ghost"
                  >
                    Down
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="stack panel-stretch">
          {selectedBlock ? (
            <BlockEditor
              block={selectedBlock}
              onDelete={() => deleteBlockMutation.mutate(selectedBlock.id)}
              onDraftChange={setDraftBlock}
              onDuplicate={() => duplicateBlockMutation.mutate(selectedBlock.id)}
              onSave={(block) => updateBlockMutation.mutate(block)}
              pending={updateBlockMutation.isPending}
            />
          ) : (
            <Card subtitle="Select a block only when you're ready to edit it." title="Block Editor">
              <EmptyState
                body="After saving a block, selection clears so you can review the sequence or choose the next block deliberately."
                title="No Block Selected"
              />
            </Card>
          )}
        </div>

        <Card
          className="panel-stretch"
          subtitle="Preview a single block, play the full curriculum, or inspect the export payload."
          title="Preview"
        >
          <Tabs
            items={[
              { label: "Block Preview", value: "block" },
              { label: "Curriculum Preview", value: "curriculum" },
              { label: "Export / API", value: "export" },
            ]}
            onChange={(value) => setPreviewTab(value as PreviewTab)}
            value={previewTab}
          />
          {previewTab === "block" ? (
            deferredDraftBlock ? (
              <InteractiveBlockRenderer block={deferredDraftBlock} />
            ) : (
              <EmptyState
                body="Select a block to preview it with the shared learner-facing renderer."
                title="Nothing To Preview"
              />
            )
          ) : null}
          {previewTab === "curriculum" ? (
            <CurriculumPlayer blocks={workspaceQuery.data.blocks} />
          ) : null}
          {previewTab === "export" ? (
            <ExportPanel
              projectId={project.id}
              projectName={project.name}
              payload={exportMutation.data}
              onRefresh={() => exportMutation.mutate()}
            />
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function ProjectCreatePanel({
  defaultOrganizationId,
  fixedOrganizationId,
  organizations,
  userId,
  onCreated,
}: {
  defaultOrganizationId?: string;
  fixedOrganizationId?: string;
  organizations: Organization[];
  userId: string;
  onCreated: (projectId: string) => void;
}) {
  const [organizationId, setOrganizationId] = useState(fixedOrganizationId ?? defaultOrganizationId ?? "");
  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    status: "draft" as ProjectStatus,
  });

  useEffect(() => {
    if (fixedOrganizationId) {
      setOrganizationId(fixedOrganizationId);
      return;
    }

    if (defaultOrganizationId && !organizationId) {
      setOrganizationId(defaultOrganizationId);
    }
  }, [defaultOrganizationId, fixedOrganizationId, organizationId]);

  const createProjectMutation = useMutation({
    mutationFn: () =>
      createProject(userId, {
        organizationId,
        ...projectForm,
      }),
    onSuccess: (project) => {
      setProjectForm({
        name: "",
        description: "",
        status: "draft",
      });
      onCreated(project.id);
    },
  });

  return (
    <Card
      subtitle="Required fields are marked so you can create a project without guessing what the API expects."
      title="Create Project"
    >
      <div className="stack">
        {!fixedOrganizationId ? (
          <Field hint="Required" label="Organization" required>
            <Select
              onChange={(event) => setOrganizationId(event.currentTarget.value)}
              required
              value={organizationId}
            >
              <option value="">Select organization</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field hint="Required" label="Project Name" required>
          <Input
            onChange={(event) => {
              const value = event.currentTarget.value;
              setProjectForm((current) => ({ ...current, name: value }));
            }}
            required
            value={projectForm.name}
          />
        </Field>
        <Field label="Description">
          <Textarea
            onChange={(event) => {
              const value = event.currentTarget.value;
              setProjectForm((current) => ({ ...current, description: value }));
            }}
            rows={4}
            value={projectForm.description}
          />
        </Field>
        <Field label="Status">
          <Select
            onChange={(event) => {
              const value = event.currentTarget.value as ProjectStatus;
              setProjectForm((current) => ({ ...current, status: value }));
            }}
            value={projectForm.status}
          >
            <option value="draft">Draft</option>
            <option value="review">In Review</option>
            <option value="published">Published</option>
          </Select>
        </Field>
        <Button
          disabled={!organizationId || !projectForm.name.trim() || createProjectMutation.isPending}
          onClick={() => createProjectMutation.mutate()}
          type="button"
        >
          Create Project
        </Button>
      </div>
    </Card>
  );
}

function ProjectsListCard({
  emptyBody,
  emptyTitle,
  projects,
  subtitle,
  title,
}: {
  emptyBody: string;
  emptyTitle: string;
  projects: Project[];
  subtitle: string;
  title: string;
}) {
  const navigate = useNavigate();

  return (
    <Card subtitle={subtitle} title={title}>
      {projects.length ? (
        <div className="project-list">
          {projects.map((project) => (
            <button
              className="project-list-item"
              key={project.id}
              onClick={() =>
                startTransition(() => {
                  void navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
                })
              }
              type="button"
            >
              <strong>{project.name}</strong>
              <span>{project.status}</span>
              {project.description ? <p>{project.description}</p> : null}
            </button>
          ))}
        </div>
      ) : (
        <EmptyState body={emptyBody} title={emptyTitle} />
      )}
    </Card>
  );
}

function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">Curriculum Press</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}

function ExportPanel({
  payload,
  projectId,
  projectName,
  onRefresh,
}: {
  payload?: ExportedCurriculum;
  projectId: string;
  projectName: string;
  onRefresh: () => void;
}) {
  return (
    <div className="stack">
      <div className="inline-card export-meta">
        <div>
          <strong>Public API</strong>
          <p>/api/v1/public/projects/{projectId}</p>
        </div>
        <div>
          <strong>Shared Renderer</strong>
          <p>
            Import <code>@curriculum-press/blocks</code> and pass the exported block array into{" "}
            <code>CurriculumPlayer</code>.
          </p>
        </div>
      </div>
      <Button onClick={onRefresh} type="button" variant="secondary">
        Refresh Export Payload
      </Button>
      {payload ? (
        <div className="code-panel">
          <div className="code-panel-header">
            <strong>{projectName}.json</strong>
            <span>{payload.blocks.length} renderable blocks</span>
          </div>
          <pre>{JSON.stringify(payload, null, 2)}</pre>
        </div>
      ) : (
        <EmptyState
          body="Generate an export to inspect the public curriculum payload and integration path."
          title="No Export Generated Yet"
        />
      )}
    </div>
  );
}

export const rootRoute = createRootRoute({
  component: RootComponent,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeRoute,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppShell,
});

const myProjectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "projects/mine",
  component: MyProjectsPage,
});

const organizationProjectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "organizations/$organizationId/projects",
  component: OrganizationProjectsPage,
});

const projectBuilderRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "projects/$projectId",
  component: ProjectBuilderPage,
});

export const routeTree = rootRoute.addChildren([
  homeRoute,
  appRoute.addChildren([myProjectsRoute, organizationProjectsRoute, projectBuilderRoute]),
]);
