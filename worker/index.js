import handler from "vinext/server/app-router-entry";

export default {
  async fetch(request, env, context) {
    return handler.fetch(request, env, context);
  }
};
