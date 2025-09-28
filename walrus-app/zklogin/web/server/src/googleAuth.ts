import { Router, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config.json from the main src folder
const configPath = path.join(__dirname, "..", "..", "src", "config.json");
if (!fs.existsSync(configPath)) {
    throw new Error("config.json not found in src folder. Create it with GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI");
}
const raw = fs.readFileSync(configPath, "utf8");
const config = JSON.parse(raw) as {
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_REDIRECT_URI: string;
    CLIENT_ID_GOOGLE: string;
};

const router: Router = Router();

const oauth2Client = new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI
);

// Scopes we request
const SCOPES = ["openid", "profile", "email"];

// Endpoint: return the Google auth URL (useful for SPA frontends)
router.get("/auth/google/url", (req: Request, res: Response) => {
    try {
        const nonce = req.query.nonce as string;
        const redirectUri = req.query.redirect_uri as string || "http://localhost:5173";
        
        const url = oauth2Client.generateAuthUrl({
            access_type: "offline", // so we get a refresh_token on first consent
            scope: SCOPES,
            prompt: "consent",
            state: JSON.stringify({ nonce, frontend_redirect: redirectUri })
        });
        res.json({ url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "failed_to_generate_auth_url" });
    }
});

// Redirect style (user visits backend which redirects to Google)
router.get("/auth/google", (req: Request, res: Response) => {
    const nonce = req.query.nonce as string;
    const redirectUri = req.query.redirect_uri as string || "http://localhost:5173";
    
    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
        state: JSON.stringify({ nonce, frontend_redirect: redirectUri })
    });
    res.redirect(url);
});

// Callback that Google redirects to (exchanges code for tokens and returns tokens+profile)
router.get("/auth/google/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;
    const state = req.query.state as string | undefined;

    if (error) {
        return res.status(400).json({ error: "access_denied", details: error });
    }

    if (!code) {
        return res.status(400).json({ error: "missing_code" });
    }

    try {
        // Exchange the code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get user profile information
        const ticket = await oauth2Client.verifyIdToken({
            idToken: tokens.id_token!,
            audience: config.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();

        if (!payload) {
            return res.status(400).json({ error: "invalid_token" });
        }

        // Parse state to get frontend redirect and nonce
        let frontendRedirect = "http://localhost:5173";
        let nonce = null;
        
        if (state) {
            try {
                const parsedState = JSON.parse(state);
                frontendRedirect = parsedState.frontend_redirect || frontendRedirect;
                nonce = parsedState.nonce;
            } catch (e) {
                console.error("Error parsing state:", e);
            }
        }

        // Redirect to frontend with the id_token in URL fragment
        const redirectUrl = `${frontendRedirect}#id_token=${tokens.id_token}`;
        res.redirect(redirectUrl);

    } catch (err) {
        console.error("OAuth callback error:", err);
        res.status(500).json({ error: "oauth_callback_failed" });
    }
});

export default router;