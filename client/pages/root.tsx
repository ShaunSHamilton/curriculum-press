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
import { toast } from "sonner";

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
import { z } from "zod/v4";

const authSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Valid email required"),
});

const signInSchema = z.object({
  email: z.email("Valid email required"),
});

const organizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
});

const memberSchema = z.object({
  email: z.email("Valid email required"),
  name: z.string().optional(),
});

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  organizationId: z.string().min(1, "Organization is required"),
});

function firstZodError(result: z.ZodSafeParseError<unknown>): string {
  return result.error.issues[0]?.message ?? "Invalid input";
}

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

function AuthCard() {
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
      toast.success("Account created");
    },
    onError: (error) => toast.error(error.message),
  });

  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: (response) => {
      setUserId(response.user.id);
      queryClient.invalidateQueries();
      toast.success("Signed in");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card
      className="auth-card"
      subtitle="Create an account or sign in to start building."
      title="Get Started"
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
              const result = authSchema.safeParse(authForm);
              if (!result.success) { toast.error(firstZodError(result)); return; }
              signUpMutation.mutate(authForm);
              return;
            }
            const result = signInSchema.safeParse({ email: authForm.email });
            if (!result.success) { toast.error(firstZodError(result)); return; }
            signInMutation.mutate({ email: authForm.email });
          }}
          type="button"
        >
          {authMode === "signup" ? "Create Account" : "Sign In"}
        </Button>
      </div>
    </Card>
  );
}

function AuthScreen() {
  return (
    <div className="auth-shell">
      <AuthCard />
    </div>
  );
}

function LandingPage() {
  const { userId } = useAppSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    void navigate({ to: "/projects", replace: true });
  }, [navigate, userId]);

  if (userId) {
    return (
      <div className="workspace-empty">
        <Card subtitle="Loading workspace." title="Redirecting" />
      </div>
    );
  }

  return (
    <div className="landing-shell">
      <div className="landing-hero">
        <span className="eyebrow">Builder Platform</span>
        <h1>Curriculum Press</h1>
        <p>
          Compose interactive curricula from reusable block templates. Organize projects across team
          workspaces, preview the full learner experience, and export a portable curriculum any
          front end can play back.
        </p>
        <ul className="landing-features">
          <li>Six block types: tile match, category sort, sequence sorter, interactive diagram, syntax sprint, binary blitz</li>
          <li>Team workspaces with role-based member access</li>
          <li>Export to JSON or consume via the public REST API</li>
        </ul>
      </div>
      <AuthCard />
    </div>
  );
}

function AppShell() {
  const { userId, setUserId, selectedOrganizationId, setSelectedOrganizationId, sidebarCollapsed, setSidebarCollapsed } =
    useAppSession();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (!meQuery.isError) return;
    setUserId("");
    setSelectedOrganizationId("");
  }, [meQuery.isError, setUserId, setSelectedOrganizationId]);

  useEffect(() => {
    const organizations = organizationsQuery.data ?? [];
    if (!selectedOrganizationId || !organizations.length) return;
    if (!organizations.some((org) => org.id === selectedOrganizationId)) {
      setSelectedOrganizationId("");
    }
  }, [organizationsQuery.data, selectedOrganizationId, setSelectedOrganizationId]);

  if (!userId) {
    return <AuthScreen />;
  }

  const selectedOrganization =
    (organizationsQuery.data ?? []).find((org) => org.id === selectedOrganizationId) ?? null;

  return (
    <div className={`workspace-shell ${sidebarCollapsed ? "is-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          {!sidebarCollapsed ? (
            <div className="sidebar-brand-copy">
              <span className="eyebrow">Builder Workspace</span>
              <h1>Curriculum Press</h1>
            </div>
          ) : null}
          <Button
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            type="button"
            variant="ghost"
          >
            {sidebarCollapsed ? ">>" : "<<"}
          </Button>
        </div>

        <Card
          className="sidebar-section"
          subtitle={!sidebarCollapsed ? "Your session and active workspace." : undefined}
          title={!sidebarCollapsed ? "Workspace" : undefined}
        >
          <div className="stack-sm">
            {!sidebarCollapsed ? (
              <>
                <Badge tone="accent">{meQuery.data?.name ?? "Author"}</Badge>
                {selectedOrganization ? (
                  <div className="org-indicator">
                    <span className="eyebrow">Organization</span>
                    <strong>{selectedOrganization.name}</strong>
                  </div>
                ) : (
                  <p className="sidebar-hint">No organization selected</p>
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
            onClick={() => void navigate({ to: "/projects" })}
          />
          <SidebarNavButton
            collapsed={sidebarCollapsed}
            label="Organizations"
            onClick={() => void navigate({ to: "/organizations" })}
          />
          <SidebarNavButton
            collapsed={sidebarCollapsed}
            disabled={!selectedOrganizationId}
            label="Org Projects"
            onClick={() => {
              if (!selectedOrganizationId) return;
              void navigate({
                to: "/organizations/$organizationId/projects",
                params: { organizationId: selectedOrganizationId },
              });
            }}
          />
          <SidebarNavButton
            collapsed={sidebarCollapsed}
            disabled={!selectedOrganizationId}
            label="Org Settings"
            onClick={() => {
              if (!selectedOrganizationId) return;
              void navigate({
                to: "/organizations/$organizationId/settings",
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

function OrganizationSelectorPage() {
  const { userId, setSelectedOrganizationId } = useAppSession();
  const navigate = useNavigate();
  const [newOrgName, setNewOrgName] = useState("");

  const organizationsQuery = useQuery({
    enabled: Boolean(userId),
    queryKey: ["organizations", userId],
    queryFn: () => listOrganizations(userId),
  });

  const createOrganizationMutation = useMutation({
    mutationFn: (payload: { name: string }) => createOrganization(userId, payload),
    onSuccess: (organization) => {
      setNewOrgName("");
      setSelectedOrganizationId(organization.id);
      toast.success("Organization created");
      void organizationsQuery.refetch();
      void navigate({
        to: "/organizations/$organizationId/projects",
        params: { organizationId: organization.id },
      });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="stack">
      <PageHeader
        title="Organizations"
        subtitle="Select a workspace or create a new organization to collaborate with your team."
      />
      <div className="page-grid">
        <Card subtitle="Create a shared workspace for your team's projects." title="New Organization">
          <div className="stack">
            <Field hint="Required" label="Name" required>
              <Input
                onChange={(event) => setNewOrgName(event.currentTarget.value)}
                placeholder="Northwind Training"
                required
                value={newOrgName}
              />
            </Field>
            <Button
              disabled={!newOrgName.trim() || createOrganizationMutation.isPending}
              onClick={() => {
                const result = organizationSchema.safeParse({ name: newOrgName });
                if (!result.success) { toast.error(firstZodError(result)); return; }
                createOrganizationMutation.mutate({ name: newOrgName });
              }}
              type="button"
            >
              Create Organization
            </Button>
          </div>
        </Card>

        <Card subtitle="Organizations you belong to." title="Your Organizations">
          {(organizationsQuery.data ?? []).length ? (
            <div className="org-list">
              {(organizationsQuery.data ?? []).map((org) => (
                <div className="org-list-item" key={org.id}>
                  <div>
                    <strong>{org.name}</strong>
                    <span>{org.slug}</span>
                  </div>
                  <div className="button-row">
                    <Button
                      onClick={() => {
                        setSelectedOrganizationId(org.id);
                        void navigate({
                          to: "/organizations/$organizationId/projects",
                          params: { organizationId: org.id },
                        });
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Projects
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedOrganizationId(org.id);
                        void navigate({
                          to: "/organizations/$organizationId/settings",
                          params: { organizationId: org.id },
                        });
                      }}
                      type="button"
                      variant="ghost"
                    >
                      Settings
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              body="Create your first organization to start collaborating with your team."
              title="No Organizations Yet"
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function OrganizationProjectsPage() {
  const { organizationId } = useParams({ from: "/organizations/$organizationId/projects" });
  const { userId, setSelectedOrganizationId } = useAppSession();
  const navigate = useNavigate();

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

  useEffect(() => {
    setSelectedOrganizationId(organizationId);
  }, [organizationId, setSelectedOrganizationId]);

  const organization =
    organizationsQuery.data?.find((candidate) => candidate.id === organizationId) ?? null;

  return (
    <div className="stack">
      <PageHeader
        title={organization ? `${organization.name} Projects` : "Organization Projects"}
        subtitle="Projects shared inside this organization."
      />
      <ProjectCreatePanel
        fixedOrganizationId={organizationId}
        organizations={organizationsQuery.data ?? []}
        userId={userId}
        onCreated={(projectId) => void navigate({ to: "/projects/$projectId", params: { projectId } })}
      />
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

function OrganizationSettingsPage() {
  const { organizationId } = useParams({ from: "/organizations/$organizationId/settings" });
  const { userId, setSelectedOrganizationId } = useAppSession();
  const [memberEmail, setMemberEmail] = useState("");
  const [memberName, setMemberName] = useState("");

  const organizationsQuery = useQuery({
    enabled: Boolean(userId),
    queryKey: ["organizations", userId],
    queryFn: () => listOrganizations(userId),
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
      toast.success("Member added");
      void membersQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    setSelectedOrganizationId(organizationId);
  }, [organizationId, setSelectedOrganizationId]);

  const organization =
    organizationsQuery.data?.find((candidate) => candidate.id === organizationId) ?? null;

  return (
    <div className="stack">
      <PageHeader
        title={organization ? `${organization.name} Settings` : "Organization Settings"}
        subtitle="Manage members and organization details."
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
            onClick={() => {
              const result = memberSchema.safeParse({ email: memberEmail, name: memberName });
              if (!result.success) { toast.error(firstZodError(result)); return; }
              addMemberMutation.mutate({ email: memberEmail, name: memberName });
            }}
            type="button"
            variant="secondary"
          >
            Add Member
          </Button>
        </div>
      </Card>
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
      toast.success("Export downloaded");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateProjectMutation = useMutation({
    mutationFn: () => updateProject(userId, projectId, projectDetailsDraft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project saved");
    },
    onError: (error) => toast.error(error.message),
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
      toast.success("Block added");
    },
    onError: (error) => toast.error(error.message),
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
      toast.success("Block saved");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: string) => deleteBlock(userId, blockId),
    onSuccess: () => {
      setSelectedBlockId("");
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, projectId] });
      toast.success("Block deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const duplicateBlockMutation = useMutation({
    mutationFn: (blockId: string) => duplicateBlock(userId, blockId),
    onSuccess: (block) => {
      setSelectedBlockId(block.id);
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, projectId] });
      toast.success("Block duplicated");
    },
    onError: (error) => toast.error(error.message),
  });

  const reorderBlocksMutation = useMutation({
    mutationFn: (orderedIds: string[]) => reorderBlocks(userId, workspaceQuery.data!.curriculum.id, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, projectId] });
    },
    onError: (error) => toast.error(error.message),
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
      toast.success("Project created");
      onCreated(project.id);
    },
    onError: (error) => toast.error(error.message),
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
          onClick={() => {
            const result = projectSchema.safeParse({ name: projectForm.name, organizationId });
            if (!result.success) { toast.error(firstZodError(result)); return; }
            createProjectMutation.mutate();
          }}
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

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="workspace-empty">
      <Card subtitle="The page you're looking for doesn't exist." title="404 Not Found">
        <Button onClick={() => void navigate({ to: "/" })} type="button" variant="secondary">
          Back to Home
        </Button>
      </Card>
    </div>
  );
}

function ErrorPage({ error }: { error: Error }) {
  const navigate = useNavigate();
  return (
    <div className="workspace-empty">
      <Card subtitle={error.message || "Something went wrong."} title="Error">
        <Button onClick={() => void navigate({ to: "/" })} type="button" variant="secondary">
          Back to Home
        </Button>
      </Card>
    </div>
  );
}

export const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppShell,
});

const myProjectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "projects",
  component: MyProjectsPage,
});

// Layout owns the "organizations" segment — prevents prefix-collision with org-specific routes.
const organizationsLayoutRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "organizations",
  component: () => <Outlet />,
});

const organizationsIndexRoute = createRoute({
  getParentRoute: () => organizationsLayoutRoute,
  path: "/",
  component: OrganizationSelectorPage,
});

// Context route owns "$organizationId" — children only see "projects" / "settings".
const organizationContextRoute = createRoute({
  getParentRoute: () => organizationsLayoutRoute,
  path: "$organizationId",
  component: () => <Outlet />,
});

const organizationProjectsRoute = createRoute({
  getParentRoute: () => organizationContextRoute,
  path: "projects",
  component: OrganizationProjectsPage,
});

const organizationSettingsRoute = createRoute({
  getParentRoute: () => organizationContextRoute,
  path: "settings",
  component: OrganizationSettingsPage,
});

const projectBuilderRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "projects/$projectId",
  component: ProjectBuilderPage,
});

export const routeTree = rootRoute.addChildren([
  homeRoute,
  appRoute.addChildren([
    myProjectsRoute,
    organizationsLayoutRoute.addChildren([
      organizationsIndexRoute,
      organizationContextRoute.addChildren([organizationProjectsRoute, organizationSettingsRoute]),
    ]),
    projectBuilderRoute,
  ]),
]);
