import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase";
import { ensureUserProfileExists } from "./firestore";
import { logAuditEvent } from "./audit";
import { getDemoUserProfile, getDemoUsers, DEMO_SEED_USERS, DEMO_LOGGED_OUT_KEY, getLocalItem } from "./localStore";
import { userService } from "../services/users";

const DEMO_AUTH_KEY = "kandahar_wms_demo_auth_user";
const DEMO_AUTH_EVENT = "kandahar-wms-demo-auth-change";
const DEMO_AUTH_EXPLICIT_KEY = "kandahar_wms_demo_auth_explicit";

const safeRun = async (task: () => Promise<unknown>, label: string) => {
  try {
    await task();
  } catch (error) {
    console.warn(`${label} failed, but auth flow continued:`, error);
  }
};

const createDemoUser = (email: string, uid?: string, displayName?: string): User => {
  const cleanEmail = email.trim() || "superadmin@ku.edu.af";
  return {
    uid: uid || "seed_super_admin",
    email: cleanEmail,
    displayName: displayName || "Super Admin",
    emailVerified: true,
    isAnonymous: false,
    metadata: {} as User["metadata"],
    providerData: [],
    refreshToken: "demo-refresh-token",
    tenantId: null,
    delete: async () => undefined,
    getIdToken: async () => "demo-token",
    getIdTokenResult: async () => ({ token: "demo-token" } as Awaited<ReturnType<User["getIdTokenResult"]>>),
    reload: async () => undefined,
    toJSON: () => ({ uid: uid || "seed_super_admin", email: cleanEmail }),
    phoneNumber: null,
    photoURL: null,
    providerId: "demo",
  } as unknown as User;
};

const getStoredDemoUser = (): User | null => {
  if (typeof window === "undefined") return null;
  if (!window.localStorage.getItem(DEMO_AUTH_EXPLICIT_KEY)) {
    window.localStorage.removeItem(DEMO_AUTH_KEY);
    return null;
  }
  const raw = window.localStorage.getItem(DEMO_AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { email?: string; uid?: string; displayName?: string };
    return createDemoUser(
      parsed.email || "superadmin@ku.edu.af",
      parsed.uid,
      parsed.displayName
    );
  } catch {
    return null;
  }
};

const notifyDemoAuthChanged = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DEMO_AUTH_EVENT));
  }
};

export const login = async (email: string, pass: string): Promise<User> => {
  const cleanEmail = email.trim().toLowerCase();

  if (!isFirebaseConfigured) {
    try {
      const profile = await userService.login(cleanEmail, pass);
      const user = createDemoUser(profile.email, profile.uid, profile.name || "");
      (user as any).wmsRole = profile.role;
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DEMO_LOGGED_OUT_KEY);
        window.localStorage.setItem(DEMO_AUTH_EXPLICIT_KEY, "1");
        window.localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify({
          email: profile.email,
          uid: profile.uid,
          displayName: profile.name,
          role: profile.role,
        }));
        notifyDemoAuthChanged();
      }
      return user;
    } catch (apiError: any) {
      const message = String(apiError?.message || "");
      if (message.includes("HTTP ")) {
        const err: any = new Error(message.includes("403") ? "auth/user-disabled" : "auth/wrong-password");
        err.code = message.includes("403") ? "auth/user-disabled" : "auth/wrong-password";
        throw err;
      }
      console.warn("Backend login unavailable; falling back to local demo login:", apiError);
    }

    // Check localStorage users first (handles updated emails), then fallback to DEMO_SEED_USERS
    const localUsers = getDemoUsers();
    const localUser = localUsers.find(u => u.email.toLowerCase() === cleanEmail);
    const seedUser = DEMO_SEED_USERS.find(u => u.email.toLowerCase() === cleanEmail);
    const matched = localUser || seedUser;

    if (!matched) {
      const err: any = new Error("auth/user-not-found");
      err.code = "auth/user-not-found";
      throw err;
    }

    // Check if user is active
    if ("active" in matched && matched.active === false) {
      const err: any = new Error("auth/user-not-found");
      err.code = "auth/user-not-found";
      throw err;
    }

    const overrides = getLocalItem<{ email: string; password: string }[]>("password_overrides", []);
    const override = overrides.find(o => o.email.toLowerCase() === cleanEmail);

    let effectivePassword: string;
    if (override) {
      effectivePassword = override.password;
    } else if (seedUser) {
      // Find seed user by UID (handles case where localStorage user was originally a seed user)
      const seedByUid = DEMO_SEED_USERS.find(s => s.uid === matched.uid);
      effectivePassword = seedByUid ? seedByUid.password : "";
    } else {
      const err: any = new Error("auth/wrong-password");
      err.code = "auth/wrong-password";
      throw err;
    }

    if (effectivePassword !== pass) {
      const err: any = new Error("auth/wrong-password");
      err.code = "auth/wrong-password";
      throw err;
    }

    const user = createDemoUser(matched.email, matched.uid, matched.name || "");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEMO_LOGGED_OUT_KEY);
      window.localStorage.setItem(DEMO_AUTH_EXPLICIT_KEY, "1");
      window.localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify({
        email: matched.email,
        uid: matched.uid,
        displayName: matched.name,
      }));
      getDemoUserProfile(matched.email);
      notifyDemoAuthChanged();
    }
    return user;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    const user = userCredential.user;

    await safeRun(
      () => ensureUserProfileExists(user.uid, user.email || cleanEmail),
      "Ensure user profile"
    );

    safeRun(
      () => logAuditEvent(user.uid, user.email || cleanEmail, "login"),
      "Login audit log"
    );

    return user;
  } catch (error: any) {
    console.error("Login error:", error);
    throw error;
  }
};

export const register = async (email: string, pass: string, name: string): Promise<User> => {
  const cleanEmail = email.trim();

  if (!isFirebaseConfigured) {
    const user = createDemoUser(cleanEmail);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEMO_AUTH_EXPLICIT_KEY, "1");
      window.localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify({ email: user.email }));
      getDemoUserProfile(user.email);
      notifyDemoAuthChanged();
    }
    return user;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    const user = userCredential.user;

    await safeRun(
      () => ensureUserProfileExists(user.uid, user.email || cleanEmail, name),
      "Create user profile"
    );

    safeRun(
      () => logAuditEvent(user.uid, user.email || cleanEmail, "signup"),
      "Signup audit log"
    );

    return user;
  } catch (error: any) {
    console.error("Registration error:", error);
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  if (!isFirebaseConfigured) {
    if (typeof window !== "undefined") {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      window.localStorage.removeItem(DEMO_AUTH_KEY);
      window.localStorage.removeItem(DEMO_AUTH_EXPLICIT_KEY);
      window.localStorage.setItem(DEMO_LOGGED_OUT_KEY, "1");
      notifyDemoAuthChanged();
    }
    return;
  }

  const currentUser = auth.currentUser;
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error("Logout error:", error);
    throw error;
  } finally {
    if (currentUser) {
      safeRun(
        () => logAuditEvent(currentUser.uid, currentUser.email || "", "logout"),
        "Logout audit log"
      );
    }
  }
};

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  if (!isFirebaseConfigured) {
    callback(getStoredDemoUser());
    const handler = () => callback(getStoredDemoUser());
    window.addEventListener(DEMO_AUTH_EVENT, handler);
    return () => window.removeEventListener(DEMO_AUTH_EVENT, handler);
  }

  return onAuthStateChanged(auth, callback);
};

export const loginUser = login;
export const logoutUser = logout;
