import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

import { rootRoute } from "../pages/root";

export const queryClient = new QueryClient();

export const routeTree = rootRoute.addChildren([]);

export const router = createRouter({ routeTree, context: { queryClient } });
