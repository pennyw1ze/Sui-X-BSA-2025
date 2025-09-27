import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import googleAuthRoutes from "./googleAuth";


dotenv.config();


const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;


app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Root endpoint with API information
app.get("/", (req, res) => {
  res.json({
    message: "Google OAuth Backend API",
    endpoints: {
      "GET /": "This help message",
      "GET /auth/google/url": "Get Google OAuth URL for frontend",
      "GET /auth/google": "Redirect to Google OAuth (for direct browser use)",
      "GET /auth/google/callback": "OAuth callback endpoint (used by Google)"
    },
    status: "running"
  });
});

app.use("/", googleAuthRoutes);


app.listen(PORT, () => {
console.log(`Google OAuth backend running on http://localhost:${PORT}`);
});