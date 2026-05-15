import { Router, type IRouter } from "express";
import healthRouter from "./health";
import prototypesRouter from "./prototypes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(prototypesRouter);

export default router;
