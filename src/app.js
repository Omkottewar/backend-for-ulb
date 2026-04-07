import express from 'express';
import cors from "cors";
import authRoutes from "./routes/auth_routes.js"
import assignableUserRoutes from "./routes/assignable-user.routes.js";
// import fileRoutes from "./routes/file.routes.js"
import attachmentRoutes from "./routes/attachment.routes.js"; 
import fileVersionRoutes from "./routes/file-version.routes.js"; 
import userFileRoutes from "./routes/user-file.routes.js";
import queryRoutes from "./routes/query.routes.js";
import queryAttachmentRoutes from "./routes/query-attachment.routes.js";
import queryDetailRoutes from "./routes/query-detail.routes.js";
import queryReplyRoutes from "./routes/query-reply.routes.js";
import queryActivityLogRoutes from "./routes/query-activity-log.routes.js";
import queryParticipantRoutes from "./routes/query-participant.routes.js";
import eligibleParticipantRoutes from "./routes/eligible-participant.routes.js";
import attachmentDownloadRoutes from "./routes/attachment-download.routes.js";
// Om
import filesRoutes from "./routes/files_routes.js"
import checklistRoutes from "./routes/checklist_routes.js"
import ulbRoutes from "./routes/ulb_routes.js";
import { errorHandler } from './middlewares/error_handler.js';
import supplierRoutes from "./routes/supplier_routes.js";
const app = express()

app.use(cors())
app.use(express.json())

app.use("/api/auth", authRoutes)
// Sahil
// app.use("/api/files", fileRoutes);
app.use("/api/files/:fileId/attachments", attachmentRoutes);
app.use("/api/files/:fileId/versions", fileVersionRoutes);
app.use("/api/files/:fileId/assignable-users", assignableUserRoutes);
app.use("/api/files/:fileId/queries", queryRoutes)
app.use("/api/user-files", userFileRoutes); 
app.use("/api/queries", queryDetailRoutes);
app.use("/api/queries/:queryId/attachments", queryAttachmentRoutes);
app.use("/api/queries/:queryId/replies", queryReplyRoutes);
app.use("/api/queries/:queryId/activity-log", queryActivityLogRoutes);
app.use("/api/queries/:queryId/participants", queryParticipantRoutes);
app.use("/api/queries/:queryId/eligible-participants", eligibleParticipantRoutes);
app.use("/api/query-attachments", attachmentDownloadRoutes);
// Om
app.use("/api/files", filesRoutes)
app.use("/api/checklists", checklistRoutes)

app.use("/api/ulbs", ulbRoutes);


app.use("/api/suppliers", supplierRoutes);
app.get("/health", (req, res) => {
    res.json({status: "Ok", service: "Audit management"})
})
app.use(errorHandler);

export default app;