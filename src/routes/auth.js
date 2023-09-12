import express from 'express';
import { login, logout } from '../session-auth';

const router = express.Router();

router.get('/login', (req, res) => res.render('login', { sendTo: req.query.sendTo }));

router.post('/login', login);
router.get('/logout', logout);

export default router;
