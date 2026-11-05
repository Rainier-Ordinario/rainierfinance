import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A package.json higher up (e.g. in the home folder) makes Next guess
  // the wrong workspace root and watch far more files than this project.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
