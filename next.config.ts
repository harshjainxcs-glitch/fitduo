import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile in the home dir
  // otherwise gets mis-detected as the root).
  turbopack: {
    root: path.resolve(),
  },
};

export default nextConfig;
