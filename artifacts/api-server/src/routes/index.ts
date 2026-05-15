import { Router, type IRouter } from "express";
import healthRouter from "./health";
import prototypesRouter from "./prototypes";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(prototypesRouter);

export default router;
