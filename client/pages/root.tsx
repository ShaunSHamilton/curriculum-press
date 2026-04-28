import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { createRootRoute } from "@tanstack/react-router";
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
  listOrganizations,
  listProjects,
  reorderBlocks,
  signIn,
  signUp,
  updateBlock,
  updateProject,
} from "../lib/api";
import type { AnyInteractiveBlock, BlockType, ExportedCurriculum, Organization, ProjectStatus } from "../types";
import { BLOCK_CATALOG, createDefaultBlock } from "../types";
import { CurriculumPlayer, InteractiveBlockRenderer } from "../../packages/blocks/src";

type PreviewTab = "block" | "curriculum" | "export";

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

function downloadExport(payload: ExportedCurriculum) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${payload.project.name.toLowerCase().replace(/\s+/g, "-") || "curriculum"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function App() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = usePersistentState(AUTH_STORAGE_KEY, "");
  const [selectedOrganizationId, setSelectedOrganizationId] = usePersistentState(
    "curriculum-press.organization-id",
    "",
  );
  const [selectedProjectId, setSelectedProjectId] = usePersistentState(
    "curriculum-press.project-id",
    "",
  );
  const [selectedBlockId, setSelectedBlockId] = usePersistentState("curriculum-press.block-id", "");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("block");
  const [draftBlock, setDraftBlock] = useState<AnyInteractiveBlock | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    audience: "",
    status: "draft" as ProjectStatus,
  });
  const [projectDetailsDraft, setProjectDetailsDraft] = useState(projectForm);
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [authForm, setAuthForm] = useState({ name: "", email: "" });

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

  const projectsQuery = useQuery({
    enabled: Boolean(userId && selectedOrganizationId),
    queryKey: ["projects", userId, selectedOrganizationId],
    queryFn: () => listProjects(userId, selectedOrganizationId),
  });

  const membersQuery = useQuery({
    enabled: Boolean(userId && selectedOrganizationId),
    queryKey: ["members", userId, selectedOrganizationId],
    queryFn: () => listMembers(userId, selectedOrganizationId),
  });

  const workspaceQuery = useQuery({
    enabled: Boolean(userId && selectedProjectId),
    queryKey: ["workspace", userId, selectedProjectId],
    queryFn: () => getProjectWorkspace(userId, selectedProjectId),
  });

  const exportMutation = useMutation({
    mutationFn: () => exportProject(userId, selectedProjectId),
    onSuccess: (payload) => {
      downloadExport(payload);
      setPreviewTab("export");
    },
  });

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

  const createOrganizationMutation = useMutation({
    mutationFn: (payload: { name: string }) => createOrganization(userId, payload),
    onSuccess: (organization) => {
      setOrganizationName("");
      setSelectedOrganizationId(organization.id);
      queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (payload: { email: string; name?: string }) =>
      addMember(userId, selectedOrganizationId, payload),
    onSuccess: () => {
      setMemberEmail("");
      setMemberName("");
      queryClient.invalidateQueries({ queryKey: ["members", userId, selectedOrganizationId] });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: () =>
      createProject(userId, {
        organizationId: selectedOrganizationId,
        ...projectForm,
      }),
    onSuccess: (project) => {
      setProjectForm({
        name: "",
        description: "",
        audience: "",
        status: "draft",
      });
      setSelectedProjectId(project.id);
      queryClient.invalidateQueries({ queryKey: ["projects", userId, selectedOrganizationId] });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: () => updateProject(userId, selectedProjectId, projectDetailsDraft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ["projects", userId, selectedOrganizationId] });
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: (type: BlockType) => {
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
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, selectedProjectId] });
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
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, selectedProjectId] });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: string) => deleteBlock(userId, blockId),
    onSuccess: () => {
      setSelectedBlockId("");
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, selectedProjectId] });
    },
  });

  const duplicateBlockMutation = useMutation({
    mutationFn: (blockId: string) => duplicateBlock(userId, blockId),
    onSuccess: (block) => {
      setSelectedBlockId(block.id);
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, selectedProjectId] });
    },
  });

  const reorderBlocksMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      reorderBlocks(userId, workspaceQuery.data!.curriculum.id, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", userId, selectedProjectId] });
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

  useEffect(() => {
    const projects = projectsQuery.data ?? [];
    if (!projects.length) {
      return;
    }

    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0]?.id ?? "");
    }
  }, [projectsQuery.data, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    const project = workspaceQuery.data?.project;
    if (!project) {
      return;
    }

    setProjectDetailsDraft({
      name: project.name,
      description: project.description,
      audience: project.audience,
      status: project.status,
    });
  }, [workspaceQuery.data?.project]);

  useEffect(() => {
    const blocks = workspaceQuery.data?.blocks ?? [];
    if (!blocks.length) {
      setSelectedBlockId("");
      setDraftBlock(null);
      return;
    }

    const selected = blocks.find((block) => block.id === selectedBlockId) ?? blocks[0];
    setSelectedBlockId(selected.id);
    setDraftBlock(selected);
  }, [selectedBlockId, setSelectedBlockId, workspaceQuery.data?.blocks]);

  const selectedOrganization =
    organizationsQuery.data?.find((organization) => organization.id === selectedOrganizationId) ?? null;
  const selectedBlock =
    workspaceQuery.data?.blocks.find((block) => block.id === selectedBlockId) ?? null;
  const deferredDraftBlock = useDeferredValue(draftBlock);

  if (!userId || meQuery.error) {
    return (
      <div className="auth-shell">
        <Card
          className="auth-card"
          subtitle="Create an account, create an organization, then build and preview curricula in one workspace."
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
              <Field label="Name">
                <Input
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, name: event.currentTarget.value }))
                  }
                  value={authForm.name}
                />
              </Field>
            ) : null}
            <Field label="Email">
              <Input
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, email: event.currentTarget.value }))
                }
                value={authForm.email}
              />
            </Field>
            {(signUpMutation.error || signInMutation.error || meQuery.error) ? (
              <p className="inline-error">
                {(signUpMutation.error ?? signInMutation.error ?? meQuery.error)?.message}
              </p>
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

  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div>
            <span className="eyebrow">Builder Workspace</span>
            <h1>Curriculum Press</h1>
          </div>
          <Badge tone="accent">{meQuery.data?.name ?? "Author"}</Badge>
        </div>

        <Card subtitle="Switch between collaborative workspaces." title="Organizations">
          <div className="stack">
            <Field label="Current Organization">
              <Select
                onChange={(event) => setSelectedOrganizationId(event.currentTarget.value)}
                value={selectedOrganizationId}
              >
                {(organizationsQuery.data ?? []).map((organization: Organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Create Organization">
              <Input
                onChange={(event) => setOrganizationName(event.currentTarget.value)}
                placeholder="Northwind Training"
                value={organizationName}
              />
            </Field>
            <Button
              disabled={!organizationName.trim() || createOrganizationMutation.isPending}
              onClick={() => createOrganizationMutation.mutate({ name: organizationName })}
              type="button"
            >
              Create Organization
            </Button>
          </div>
        </Card>

        <Card subtitle="Simple MVP membership flow for collaborators." title="Members">
          {selectedOrganization ? (
            <div className="stack">
              <div className="member-list">
                {(membersQuery.data ?? []).map((member) => (
                  <div className="member-row" key={member.id}>
                    <span>{member.userId.slice(0, 8)}</span>
                    <Badge>{member.role}</Badge>
                  </div>
                ))}
              </div>
              <Field label="Member Name">
                <Input
                  onChange={(event) => setMemberName(event.currentTarget.value)}
                  value={memberName}
                />
              </Field>
              <Field label="Member Email">
                <Input
                  onChange={(event) => setMemberEmail(event.currentTarget.value)}
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
          ) : (
            <EmptyState
              body="Create an organization to unlock member management."
              title="No Organization Selected"
            />
          )}
        </Card>

        <Card subtitle="Create a project and open its builder workflow." title="Projects">
          {selectedOrganization ? (
            <div className="stack">
              <div className="project-list">
                {(projectsQuery.data ?? []).map((project) => (
                  <button
                    className={`project-list-item ${project.id === selectedProjectId ? "is-active" : ""}`}
                    key={project.id}
                    onClick={() =>
                      startTransition(() => {
                        setSelectedProjectId(project.id);
                        setPreviewTab("block");
                      })
                    }
                    type="button"
                  >
                    <strong>{project.name}</strong>
                    <span>{project.audience}</span>
                  </button>
                ))}
              </div>
              <div className="stack">
                <Field label="Project Name">
                  <Input
                    onChange={(event) =>
                      setProjectForm((current) => ({ ...current, name: event.currentTarget.value }))
                    }
                    value={projectForm.name}
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    onChange={(event) =>
                      setProjectForm((current) => ({
                        ...current,
                        description: event.currentTarget.value,
                      }))
                    }
                    rows={3}
                    value={projectForm.description}
                  />
                </Field>
                <Field label="Audience">
                  <Input
                    onChange={(event) =>
                      setProjectForm((current) => ({
                        ...current,
                        audience: event.currentTarget.value,
                      }))
                    }
                    value={projectForm.audience}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    onChange={(event) =>
                      setProjectForm((current) => ({
                        ...current,
                        status: event.currentTarget.value as ProjectStatus,
                      }))
                    }
                    value={projectForm.status}
                  >
                    <option value="draft">Draft</option>
                    <option value="review">In Review</option>
                    <option value="published">Published</option>
                  </Select>
                </Field>
                <Button
                  disabled={
                    !projectForm.name.trim() ||
                    !projectForm.audience.trim() ||
                    createProjectMutation.isPending
                  }
                  onClick={() => createProjectMutation.mutate()}
                  type="button"
                >
                  Create Project
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              body="Create an organization first so projects have a home."
              title="Start With An Organization"
            />
          )}
        </Card>
      </aside>

      <main className="workspace-main">
        {workspaceQuery.data ? (
          <div className="stack-lg">
            <Card
              actions={
                <div className="button-row">
                  <Button
                    disabled={updateProjectMutation.isPending}
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
              subtitle="Update the project context authors and reviewers see alongside the curriculum."
              title={workspaceQuery.data.project.name}
            >
              <div className="form-grid split triple">
                <Field label="Project Name">
                  <Input
                    onChange={(event) =>
                      setProjectDetailsDraft((current) => ({
                        ...current,
                        name: event.currentTarget.value,
                      }))
                    }
                    value={projectDetailsDraft.name}
                  />
                </Field>
                <Field label="Audience">
                  <Input
                    onChange={(event) =>
                      setProjectDetailsDraft((current) => ({
                        ...current,
                        audience: event.currentTarget.value,
                      }))
                    }
                    value={projectDetailsDraft.audience}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    onChange={(event) =>
                      setProjectDetailsDraft((current) => ({
                        ...current,
                        status: event.currentTarget.value as ProjectStatus,
                      }))
                    }
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
                  onChange={(event) =>
                    setProjectDetailsDraft((current) => ({
                      ...current,
                      description: event.currentTarget.value,
                    }))
                  }
                  rows={3}
                  value={projectDetailsDraft.description}
                />
              </Field>
            </Card>

            <div className="builder-layout">
              <Card
                actions={<Badge tone="accent">{workspaceQuery.data.blocks.length} blocks</Badge>}
                className="panel-stretch"
                subtitle="Choose an interaction model based on the learning goal, then manage order, duplication, and deletion here."
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

              <div className="stack-lg panel-stretch">
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
                  <Card subtitle="Select a block or add one from the catalog." title="Block Editor">
                    <EmptyState
                      body="Blocks appear here with structured fields for authoring and validation."
                      title="No Block Selected"
                    />
                  </Card>
                )}
              </div>

              <Card
                className="panel-stretch"
                subtitle="Preview the selected block, run through the whole curriculum, or inspect the export payload."
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
                    projectId={workspaceQuery.data.project.id}
                    projectName={workspaceQuery.data.project.name}
                    payload={exportMutation.data}
                    onRefresh={() => exportMutation.mutate()}
                  />
                ) : null}
              </Card>
            </div>
          </div>
        ) : (
          <div className="workspace-empty">
            <EmptyState
              action={
                <Badge tone="accent">
                  {selectedOrganization ? `${selectedOrganization.name} selected` : "Choose an organization"}
                </Badge>
              }
              body="Select a project from the sidebar or create a new one to start authoring."
              title="Builder Ready"
            />
          </div>
        )}
      </main>
    </div>
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
  component: App,
});
