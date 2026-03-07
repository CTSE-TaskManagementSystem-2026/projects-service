// app/api/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Project, { IProject } from "@/model/projects";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectsSummary {
    totalProjects: number;
    activeProjects: number;
    overdue: number;
    totalTasks: number;
}

interface ProjectsSuccessResponse {
    projects: IProject[];
    summary: ProjectsSummary;
}

interface ProjectErrorResponse {
    error: string;
    details?: string;
}

/** Fields accepted when creating a project.
 *  Tasks are NOT part of this payload — they are managed by tasks-service. */
type CreateProjectBody = {
    name: string;
    description?: string;
    active?: boolean;
    status?: "active" | "inactive" | "archived" | "completed";
    dueDate?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSummary(list: IProject[]): ProjectsSummary {
    const now = Date.now();

    return {
        totalProjects: list.length,
        activeProjects: list.filter((p) =>
            typeof p.active === "boolean" ? p.active : p.status === "active"
        ).length,
        overdue: list.filter((p) => {
            if (!p.dueDate) return false;
            const d = Date.parse(p.dueDate.toString());
            return !Number.isNaN(d) && d < now;
        }).length,
        // tasksCount is a denormalised counter maintained by tasks-service
        totalTasks: list.reduce((acc, p) => acc + (p.tasksCount ?? 0), 0),
    };
}

function errorResponse(err: unknown, fallback: string) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json<ProjectErrorResponse>(
        { error: fallback, details },
        { status: 500 }
    );
}

// ─── GET — list all projects with summary ─────────────────────────────────────

export async function GET(): Promise<NextResponse<ProjectsSuccessResponse | ProjectErrorResponse>> {
    try {
        await connectToDatabase();
        const projects = await Project.find().lean<IProject[]>();
        const summary = buildSummary(projects);

        return NextResponse.json({ projects, summary }, { status: 200 });
    } catch (err) {
        return errorResponse(err, "Failed to fetch projects");
    }
}

// ─── POST — create a new project ──────────────────────────────────────────────

export async function POST(
    req: NextRequest
): Promise<NextResponse<IProject | ProjectErrorResponse>> {
    try {
        await connectToDatabase();

        const body = (await req.json()) as CreateProjectBody;

        if (!body?.name?.trim()) {
            return NextResponse.json<ProjectErrorResponse>(
                { error: "Validation error", details: "`name` is required" },
                { status: 400 }
            );
        }

        const project = await Project.create({
            name: body.name.trim(),
            description: body.description?.trim(),
            active: body.active ?? true,
            status: body.status ?? "active",
            dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
            // tasksCount starts at 0; tasks-service will update it via PATCH
        });

        return NextResponse.json(project.toJSON() as IProject, { status: 201 });
    } catch (err) {
        return errorResponse(err, "Failed to create project");
    }
}

// ─── PUT — replace a project by id (?id=…) ────────────────────────────────────

export async function PUT(
    req: NextRequest
): Promise<NextResponse<IProject | ProjectErrorResponse>> {
    try {
        await connectToDatabase();

        const id = req.nextUrl.searchParams.get("id");
        if (!id) {
            return NextResponse.json<ProjectErrorResponse>(
                { error: "Validation error", details: "`id` query param is required" },
                { status: 400 }
            );
        }

        const body = (await req.json()) as Partial<CreateProjectBody>;

        const updated = await Project.findByIdAndUpdate(
            id,
            {
                ...(body.name && { name: body.name.trim() }),
                ...(body.description !== undefined && { description: body.description?.trim() }),
                ...(body.active !== undefined && { active: body.active }),
                ...(body.status && { status: body.status }),
                ...(body.dueDate !== undefined && {
                    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
                }),
                // NOTE: tasks are not part of this service — use tasks-service
            },
            { new: true, runValidators: true }
        ).lean<IProject>();

        if (!updated) {
            return NextResponse.json<ProjectErrorResponse>(
                { error: "Not found", details: `No project with id ${id}` },
                { status: 404 }
            );
        }

        return NextResponse.json(updated, { status: 200 });
    } catch (err) {
        return errorResponse(err, "Failed to update project");
    }
}

// ─── DELETE — remove a project by id (?id=…) ─────────────────────────────────

export async function DELETE(
    req: NextRequest
): Promise<NextResponse<{ message: string } | ProjectErrorResponse>> {
    try {
        await connectToDatabase();

        const id = req.nextUrl.searchParams.get("id");
        if (!id) {
            return NextResponse.json<ProjectErrorResponse>(
                { error: "Validation error", details: "`id` query param is required" },
                { status: 400 }
            );
        }

        const deleted = await Project.findByIdAndDelete(id).lean<IProject>();

        if (!deleted) {
            return NextResponse.json<ProjectErrorResponse>(
                { error: "Not found", details: `No project with id ${id}` },
                { status: 404 }
            );
        }

        return NextResponse.json({ message: `Project ${id} deleted successfully` }, { status: 200 });
    } catch (err) {
        return errorResponse(err, "Failed to delete project");
    }
}

// ─── PATCH — update tasksCount (called by tasks-service only) ─────────────────
// tasks-service calls this after creating or deleting a task so that
// projects-service always has an accurate denormalised counter.
//
// Body: { delta: number }   e.g. { delta: 1 } on create, { delta: -1 } on delete
// Or:   { tasksCount: number }  to set an absolute value

export async function PATCH(
    req: NextRequest
): Promise<NextResponse<IProject | ProjectErrorResponse>> {
    try {
        await connectToDatabase();

        const id = req.nextUrl.searchParams.get("id");
        if (!id) {
            return NextResponse.json<ProjectErrorResponse>(
                { error: "Validation error", details: "`id` query param is required" },
                { status: 400 }
            );
        }

        const body = (await req.json()) as { delta?: number; tasksCount?: number };

        let update: Record<string, unknown>;

        if (typeof body.tasksCount === "number") {
            // Absolute set — e.g., recount after a bulk operation
            update = { $set: { tasksCount: Math.max(0, body.tasksCount) } };
        } else if (typeof body.delta === "number") {
            // Relative increment / decrement
            update = { $inc: { tasksCount: body.delta } };
        } else {
            return NextResponse.json<ProjectErrorResponse>(
                { error: "Validation error", details: "Provide `delta` or `tasksCount` in body" },
                { status: 400 }
            );
        }

        const updated = await Project.findByIdAndUpdate(id, update, {
            new: true,
            runValidators: true,
        }).lean<IProject>();

        if (!updated) {
            return NextResponse.json<ProjectErrorResponse>(
                { error: "Not found", details: `No project with id ${id}` },
                { status: 404 }
            );
        }

        return NextResponse.json(updated, { status: 200 });
    } catch (err) {
        return errorResponse(err, "Failed to update tasksCount");
    }
}