import express from "express";
import { login, logout } from "../session-auth.js";

export const router = express.Router();

router.get("/login", (req, res) => {
  return res.render("login", { sendTo: req.query.sendTo });
});

router.post("/login", login);
router.get("/logout", logout);
