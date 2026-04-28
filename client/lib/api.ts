import type {
  AnyInteractiveBlock,
  AuthResponse,
  BlockSettings,
  BlockType,
  ExportedCurriculum,
  Organization,
  OrganizationMember,
  OrganizationRole,
  Project,
  ProjectStatus,
  ProjectWorkspace,
  User,
} from "../types";

const API_ROOT = "/api/v1";
export const AUTH_STORAGE_KEY = "curriculum-press.user-id";

type RequestOptions = RequestInit & {
  userId?: string | null;
};

async function apiFetch<T>(path: string, options?: RequestOptions): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  if (options?.userId) {
    headers.set("x-curriculum-user-id", options.userId);
  }

  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function signUp(payload: { name: string; email: string }) {
  return apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function signIn(payload: { email: string }) {
  return apiFetch<AuthResponse>("/auth/signin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMe(userId: string) {
  return apiFetch<User>("/auth/me", { userId });
}

export function listOrganizations(userId: string) {
  return apiFetch<Organization[]>("/organizations", { userId });
}

export function createOrganization(userId: string, payload: { name: string }) {
  return apiFetch<Organization>("/organizations", {
    method: "POST",
    userId,
    body: JSON.stringify(payload),
  });
}

export function listMembers(userId: string, organizationId: string) {
  return apiFetch<OrganizationMember[]>(`/organizations/${organizationId}/members`, {
    userId,
  });
}

export function addMember(
  userId: string,
  organizationId: string,
  payload: { email: string; name?: string; role?: OrganizationRole },
) {
  return apiFetch<OrganizationMember>(`/organizations/${organizationId}/members`, {
    method: "POST",
    userId,
    body: JSON.stringify(payload),
  });
}

export function listProjects(userId: string, organizationId: string) {
  return apiFetch<Project[]>(`/projects?organizationId=${organizationId}`, { userId });
}

export function listMyProjects(userId: string) {
  return apiFetch<Project[]>("/projects/mine", { userId });
}

export function createProject(
  userId: string,
  payload: {
    organizationId: string;
    name: string;
    description: string;
    status: ProjectStatus;
  },
) {
  return apiFetch<Project>("/projects", {
    method: "POST",
    userId,
    body: JSON.stringify(payload),
  });
}

export function getProjectWorkspace(userId: string, projectId: string) {
  return apiFetch<ProjectWorkspace>(`/projects/${projectId}`, { userId });
}

export function updateProject(
  userId: string,
  projectId: string,
  payload: Partial<Pick<Project, "name" | "description" | "status">>,
) {
  return apiFetch<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    userId,
    body: JSON.stringify(payload),
  });
}

export function createBlock(
  userId: string,
  curriculumId: string,
  payload: {
    type: BlockType;
    title: string;
    description?: string | null;
    config: AnyInteractiveBlock["config"];
    settings: BlockSettings;
  },
) {
  return apiFetch<AnyInteractiveBlock>(`/curricula/${curriculumId}/blocks`, {
    method: "POST",
    userId,
    body: JSON.stringify(payload),
  });
}

export function updateBlock(
  userId: string,
  blockId: string,
  payload: {
    title: string;
    description?: string | null;
    config: AnyInteractiveBlock["config"];
    settings: BlockSettings;
  },
) {
  return apiFetch<AnyInteractiveBlock>(`/blocks/${blockId}`, {
    method: "PATCH",
    userId,
    body: JSON.stringify(payload),
  });
}

export function deleteBlock(userId: string, blockId: string) {
  return apiFetch<void>(`/blocks/${blockId}`, {
    method: "DELETE",
    userId,
  });
}

export function duplicateBlock(userId: string, blockId: string) {
  return apiFetch<AnyInteractiveBlock>(`/blocks/${blockId}/duplicate`, {
    method: "POST",
    userId,
  });
}

export function reorderBlocks(userId: string, curriculumId: string, orderedIds: string[]) {
  return apiFetch(`/curricula/${curriculumId}/reorder`, {
    method: "POST",
    userId,
    body: JSON.stringify({ orderedIds }),
  });
}

export function exportProject(userId: string, projectId: string) {
  return apiFetch<ExportedCurriculum>(`/projects/${projectId}/export`, { userId });
}
