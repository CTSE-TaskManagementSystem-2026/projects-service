// model/projects.ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface IProject extends Document {
    name: string;
    description?: string;
    active: boolean;
    status: "active" | "inactive" | "archived" | "completed";
    dueDate?: Date;
    tasksCount: number; // denormalised counter kept in sync by tasks-service
    createdBy: string;  // userId from JWT — owner of the project
    createdAt: Date;
    updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        active: { type: Boolean, default: true },
        status: {
            type: String,
            enum: ["active", "inactive", "archived", "completed"],
            default: "active",
        },
        dueDate: { type: Date },
        // tasks-service increments / decrements this counter via PATCH /api/projects?id=…
        tasksCount: { type: Number, default: 0, min: 0 },
        // Owner — set from JWT on creation; used to scope queries for non-admin users
        createdBy: { type: String, required: true, index: true },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

const Project: Model<IProject> =
    mongoose.models.Project ?? mongoose.model<IProject>("Project", ProjectSchema);

export default Project;