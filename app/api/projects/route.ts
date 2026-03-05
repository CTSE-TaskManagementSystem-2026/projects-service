// app/api/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import axios, { AxiosError } from "axios";
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

type CreateProjectBody = {
    name: string;
    description?: string;
    active?: boolean;
    status?: "active" | "inactive" | "archived" | "completed";
    dueDate?: string;
    tasks?: { title: string; completed?: boolean }[];
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
        totalTasks: list.reduce((acc, p) => acc + (p.tasks?.length ?? p.tasksCount ?? 0), 0),
    };
}

function axiosErrorResponse(err: unknown, fallback: string) {
    if (err instanceof AxiosError) {
        return NextResponse.json<ProjectErrorResponse>(
            { error: fallback, details: err.message },
            { status: err.response?.status ?? 500 }
        );
    }
    return NextResponse.json<ProjectErrorResponse>(
        { error: fallback, details: String(err) },
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
        return axiosErrorResponse(err, "Failed to fetch projects");
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
            tasks: body.tasks ?? [],
        });

        // Optionally propagate to an external service via axios
        await axios
            .post(process.env.PROJECTS_SERVICE_URL ?? "", project.toJSON())
            .catch(() => {
                // Non-fatal — external sync failure should not block the response
                console.warn("External projects-service sync failed (POST)");
            });

        return NextResponse.json(project.toJSON() as IProject, { status: 201 });
    } catch (err) {
        return axiosErrorResponse(err, "Failed to create project");
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
                ...(body.tasks && { tasks: body.tasks }),
            },
            { new: true, runValidators: true }
        ).lean<IProject>();

        if (!updated) {
            return NextResponse.json<ProjectErrorResponse>(
                { error: "Not found", details: `No project with id ${id}` },
                { status: 404 }
            );
        }

        await axios
            .put(`${process.env.PROJECTS_SERVICE_URL ?? ""}/${id}`, updated)
            .catch(() => console.warn("External projects-service sync failed (PUT)"));

        return NextResponse.json(updated, { status: 200 });
    } catch (err) {
        return axiosErrorResponse(err, "Failed to update project");
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

        await axios
            .delete(`${process.env.PROJECTS_SERVICE_URL ?? ""}/${id}`)
            .catch(() => console.warn("External projects-service sync failed (DELETE)"));

        return NextResponse.json({ message: `Project ${id} deleted successfully` }, { status: 200 });
    } catch (err) {
        return axiosErrorResponse(err, "Failed to delete project");
    }
}