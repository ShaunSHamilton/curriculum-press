import { Outlet, createRootRoute, createRoute } from "@tanstack/react-router";

import {
  AppShell,
  ErrorPage,
  LandingPage,
  MyProjectsPage,
  NotFoundPage,
  OrganizationProjectsPage,
  OrganizationSelectorPage,
  ProjectBuilderPage,
  RootComponent,
  SettingsPage,
} from "./root";

const rootRoute = createRootRoute({
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

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "settings",
  component: SettingsPage,
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
      organizationContextRoute.addChildren([organizationProjectsRoute]),
    ]),
    settingsRoute,
    projectBuilderRoute,
  ]),
]);
