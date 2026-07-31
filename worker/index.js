import handler from "vinext/server/app-router-entry";

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const isEditorPath =
      url.pathname === "/editor" || url.pathname.startsWith("/editor/");
    const isLocalEditorApi =
      url.pathname === "/__local-editor" ||
      url.pathname.startsWith("/__local-editor/");

    if (!import.meta.env.DEV && isEditorPath) {
      return Response.redirect(new URL("/", url), 302);
    }
    if (!import.meta.env.DEV && isLocalEditorApi) {
      return new Response("Not Found", { status: 404 });
    }

    return handler.fetch(request, env, context);
  }
};
