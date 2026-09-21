import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
// NOTE: Firebase Storage is intentionally NOT used. Images are hosted on
// ImgBB (via POST /api/upload-image); Firebase provides Auth + Firestore only.

/**
 * Firebase config — SAME project as the customer (user) website.
 * Provided by owner:
 *   apiKey: "AIzaSyCY7qLBg_MpcowiqRRiq1E9tjTFQRLqBWo",
 *   authDomain: "laptop-database-24873.firebaseapp.com",
 *   projectId: "laptop-database-24873",
 *   storageBucket: "laptop-database-24873.firebasestorage.app",
 *   messagingSenderId: "967173556613",
 *   appId: "1:967173556613:web:ed82c31f92e0ca815fdcec"
 *
 * Env vars (NEXT_PUBLIC_*) take precedence when set, otherwise the
 * owner-provided values below are used so Admin + Customer site
 * ALWAYS share one Firebase project.
 */
export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyCY7qLBg_MpcowiqRRiq1E9tjTFQRLqBWo",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "laptop-database-24873.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "laptop-database-24873",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "laptop-database-24873.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "967173556613",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:967173556613:web:ed82c31f92e0ca815fdcec",
};

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_AUTH_DOMAIN = firebaseConfig.authDomain;
export const FIREBASE_STORAGE_BUCKET = firebaseConfig.storageBucket;

/** Authorized admin UID from requirements */
export const AUTHORIZED_ADMIN_UID = "qdVg8nA0dVaA7SxE9QrIRzOXiz23";

/** Exact customer (user) website — the ONLY storefront. Never a local/internal URL. */
export const CUSTOMER_WEBSITE_URL =
  process.env.NEXT_PUBLIC_CUSTOMER_WEBSITE_URL ||
  "https://laptop-web-iota.vercel.app/";

/** Collections shared between Admin Panel and customer website */
export const SHARED_COLLECTIONS = [
  "products",
  "categories",
  "brands",
  "blogPosts",
  "videos",
  "offers",
  "reviews",
  "coupons",
  "siteSettings",
  "homepage",
  "users",
  "orders",
  "enquiries",
] as const;

let _app: FirebaseApp;
let _db: Firestore;
let _auth: Auth;

function init() {
  if (!_app) {
    _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    _db = getFirestore(_app);
    _auth = getAuth(_app);
  }
  return { _app, _db, _auth };
}

const started = init();
export const app = started._app;
export const db = started._db;
export const auth = started._auth;

/** True when the Firebase config is complete and matches the expected project. */
export function isFirebaseConfigured() {
  return (
    !!firebaseConfig.apiKey &&
    !!firebaseConfig.projectId &&
    firebaseConfig.projectId === "laptop-database-24873"
  );
}

/** Safe summary for diagnostics UI (never exposes secrets — apiKey is public client key). */
export function getFirebaseSummary() {
  return {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
    customerWebsite: CUSTOMER_WEBSITE_URL,
    configured: isFirebaseConfigured(),
  };
}
