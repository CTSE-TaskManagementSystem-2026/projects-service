// models/project.ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface IProject extends Document {
    name: string;
    description?: string;
    active: boolean;
    status: "active" | "inactive" | "archived" | "completed";
    dueDate?: Date;
    tasks: ITask[];
    tasksCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ITask {
    title: string;
    completed: boolean;
    createdAt: Date;
}

const TaskSchema = new Schema<ITask>(
    {
        title: { type: String, required: true, trim: true },
        completed: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true }
);

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
        tasks: { type: [TaskSchema], default: [] },
        tasksCount: { type: Number, default: 0 },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Keep tasksCount in sync automatically
ProjectSchema.pre("save", async function () {
    this.tasksCount = this.tasks.length;
});

const Project: Model<IProject> =
    mongoose.models.Project ?? mongoose.model<IProject>("Project", ProjectSchema);

export default Project;