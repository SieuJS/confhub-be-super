import { Processor , OnQueueEvent, QueueEventsListener, QueueEventsHost, OnWorkerEvent, WorkerHost} from "@nestjs/bullmq";
import { CONFERENCE_QUEUE_NAME } from "../../../constants/queue-name";
import { Job } from "bullmq";

@Processor(CONFERENCE_QUEUE_NAME.CRAWL)
export class ConferenceImportListener extends WorkerHost{
    process(job: Job, token?: string): Promise<any> {
        throw new Error("Method not implemented.");
    }

    @OnWorkerEvent('active')
    onWaiting(job) {
        console.log('Waiting event', JSON.stringify(job) );
    } 
    
    @OnWorkerEvent('progress')
    onActive(job) {
        console.log('Progress event', JSON.stringify(job) );
    }

    @OnWorkerEvent('completed')
    onCompleted(job) {
        console.log('Completed event', JSON.stringify(job) );
    }
}