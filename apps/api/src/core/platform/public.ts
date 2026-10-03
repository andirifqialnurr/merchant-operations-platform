// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export { PlatformAuthService } from "./platform-auth.service.js";
export {
  PLATFORM_SESSION_COOKIE_NAME,
  readPlatformSessionToken,
} from "./platform-session-cookie.js";
export { PlatformModule } from "./platform.module.js";
