import { createFileRoute, redirect } from "@tanstack/react-router";

// "/app/mediuns/new" → send user to the edit form under a virtual "new" id
export const Route = createFileRoute("/app/mediuns/new")({
  beforeLoad: () => {
    throw redirect({ to: "/app/mediuns/$id/edit", params: { id: "new" } });
  },
});
