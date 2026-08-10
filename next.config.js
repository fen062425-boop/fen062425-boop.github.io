const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const repositoryOwner = process.env.GITHUB_REPOSITORY_OWNER ?? "";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const basePath =
  isGitHubPages &&
  repositoryName &&
  repositoryName !== `${repositoryOwner}.github.io`
    ? `/${repositoryName}`
    : "";

export default {
  output: isGitHubPages ? "export" : undefined,
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  }
};
