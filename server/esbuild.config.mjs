// Serverless emits ESM; CommonJS dependencies still need require for Node built-ins.
// Keep this banner paired with serverless.yml's configFile reference.
export default () => ({
  banner: {
    js: "import { createRequire as topLevelCreateRequire } from 'module'; const require = topLevelCreateRequire(import.meta.url);",
  },
});
