import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

import { rootRoute } from "../pages/root";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const routeTree = rootRoute;

export const router = createRouter({ routeTree, context: { queryClient } });
