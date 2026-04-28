export * from "../../packages/blocks/src/types";

export type OrganizationRole = "owner" | "editor";
export type ProjectStatus = "draft" | "review" | "published";

export type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type OrganizationMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: string;
};

export type Project = {
  id: string;
  organizationId: string;
  curriculumId: string;
  createdByUserId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type Curriculum = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  blockIds: string[];
  updatedAt: string;
};

import type { AnyInteractiveBlock } from "../../packages/blocks/src/types";

export type ProjectWorkspace = {
  project: Project;
  curriculum: Curriculum;
  blocks: AnyInteractiveBlock[];
};

export type ExportedCurriculum = {
  project: Project;
  curriculum: Curriculum;
  blocks: AnyInteractiveBlock[];
};

export type AuthResponse = {
  user: User;
  authHeaderName: string;
};
