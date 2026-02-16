
//definitions of structs/types involved in the lifecycle page
//and enums for struct/type settings, mostly specific to SBI

//task struct/type -- "child" to project, main source of information
export type Task = {
    id: string; //or number
    title: string;
    description: string;
    status: TaskStatus; //tag
    team: TeamName; //tag
    due_date: Date;
    tentative: boolean;
    assigned_by: string;
    assignees: string[];
    priority: Priority; //tag
    project_id: string; //to set up a 2 way association/mapping
    //good to track for both client and team
    created_at: Date;
    last_updated: Date;
};

//project struct/type -- "parent" to the tasks
export type Project = {
    id: string; //in the case that there are duplicate project names which there shouldn't be
    title: string;
    client: string; //check if this project is accessible to them
    //can possibly be a tag, or an id string instead i need to check database
    completed: boolean;
    progress_percent: number; //out of 100, taken from each of the task's
    //task status, not sure if it should be stored in this struct or just updated
    //in the a function that will set the tast status because all of them will start
    //off with not started which we know is == 0, and can update to its associated project
    tasks: Task[];
    //optional image to project card, from civil team -> file path reference
    image?: string;
};
export enum TaskStatus {
    NOT_STARTED = "Not Started",
    IN_PROGRESS = "In Progress",
    PENDING = "Pending Approval",
    //thinking about adding another status here, where the client can also approve
    //themselves or also request more information, or like just an intermediate stage
    //where the client gets the final say in whether a specific task is completed or not
    //although this depends on how many tasks will be made and because they are assigned
    //by internal team members, clients might not be fully aware of the tasks and may
    //instead get bogged down with too many notifications on things they dont care about
    COMPLETED = "Completed",
}

//having ordering to TaskStatus enums so that they can be sorted in a particular way
export const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
    [TaskStatus.NOT_STARTED]: 0,
    [TaskStatus.IN_PROGRESS]: 1,
    [TaskStatus.PENDING]: 2,
    [TaskStatus.COMPLETED]: 3,
};

//possibly adjustable by the client? but initially set by who it was made by
export enum Priority {
    EX_HIGH = "Extremely High Priority",
    HIGH = "High Priority",
    MED = "Medium Priority",
    LOW = "Low Priority",
    STRETCH = "Stretch Feature",
}

//having ordering to Priority enums so that they can be sorted in a particular way
export const PRIORITY_ORDER: Record<Priority, number> = {
    [Priority.STRETCH]: 0,
    [Priority.LOW]: 1,
    [Priority.MED]: 2,
    [Priority.HIGH]: 3,
    [Priority.EX_HIGH]: 4,
};

//all of the teams in SBI
export enum TeamName {
    TECH = "Technology Team",
    ARCH = "Architecture Team",
    PR = "Public Relations Team",
    ENG = "Engineering Team",
    FIN = "Finance Team",
    RD = "Research and Development Team",
    LEGAL = "Legal Team",
    EXEC = "Executive Board",
}

