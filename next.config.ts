import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin resolves several of its dependencies dynamically, which the
  // bundler cannot follow. Leave it as a real Node require at runtime.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
