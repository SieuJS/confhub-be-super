export enum ConferenceAttribute{ 
    JOB_STATUS_PENDING = 'PENDING',
    JOB_STATUS_RUNNING = 'RUNNING',
    JOB_STATUS_COMPLETED = 'COMPLETED',
    JOB_STATUS_FAILED = 'FAILED',
    JOB_STATUS_CANCELLED = 'CANCELLED',
}

export enum ConferenceMessageJob {
    PENDING = 'Conference import job has been added to the queue',
    RUNNING = 'Conference import job is running',
    COMPLETED = 'Conference import job has been completed',
    FAILED = 'Conference import job has been failed',
    CANCELLED = 'Conference import job has been cancelled',
}