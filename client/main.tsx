import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import "./index.css";
import "../packages/blocks/src/blocks.css";
import { queryClient, router } from "./contexts";
import { ErrorBoundary } from "./components/ui";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <main className="app-root">
          <RouterProvider router={router}></RouterProvider>
        </main>
      </ErrorBoundary>
      <Toaster position="bottom-right" theme="dark" richColors />
    </QueryClientProvider>
  </React.StrictMode>,
);
