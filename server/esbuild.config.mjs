// Escape hatch for Serverless v4's built-in esbuild (referenced from
// serverless.yml as build.esbuild.configFile). The only place we can set esbuild
// options the YAML block does not expose — here, the `banner`. It also selects
// the target platform for native dependencies installed by Serverless.
//
// v4 emits an ESM bundle (package.json is "type": "module"), but our CJS deps
// (serverless-http, express) call `require("http")` and friends. In an ESM
// bundle there is no `require`, so esbuild's shim throws "Dynamic require of
// 'http' is not supported" at cold start (502s on every route). Defining
// `require` via createRequire restores it for those runtime lookups.
export default (serverless) => {
  // Serverless installs external dependencies after reading this configuration.
  // Optional native packages must target Lambda, even when packaging on macOS.
  process.env.npm_config_os = 'linux';
  process.env.npm_config_libc = 'glibc';
  process.env.npm_config_cpu =
    serverless.service.provider.architecture === 'arm64' ? 'arm64' : 'x64';
  return {
    banner: {
      js: "import { createRequire as topLevelCreateRequire } from 'module'; const require = topLevelCreateRequire(import.meta.url);",
    },
  };
};
