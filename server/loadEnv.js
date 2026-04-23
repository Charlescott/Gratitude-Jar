import dotenv from "dotenv";

dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env" : ".env.local",
});
dotenv.config({ path: ".env.secrets", override: true });
