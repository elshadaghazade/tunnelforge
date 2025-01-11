import express from 'express';
import main from './main';

const router = express.Router();

router.use(main);

export default router;