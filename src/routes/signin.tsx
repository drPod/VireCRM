import { createFileRoute, redirect } from "@tanstack/react-router";

type SigninSearch = { redirect?: string };

export const Route = createFileRoute("/signin")({
  validateSearch: (search: Record<string, unknown>): SigninSearch => {
    const out: SigninSearch = {};
    if (
      typeof search.redirect === "string" &&
      search.redirect.startsWith("/") &&
      !search.redirect.startsWith("//")
    ) {
      out.redirect = search.redirect;
    }
    return out;
  },
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/login",
      search: search.redirect ? { redirect: search.redirect } : {},
      replace: true,
    });
  },
});
