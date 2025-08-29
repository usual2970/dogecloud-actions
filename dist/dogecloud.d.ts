import { S3Client } from '@aws-sdk/client-s3';
import { ReadStream } from 'fs';
type DogeCloudS3TmpToken = {
    Credentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken: string;
    };
    ExpiredAt: number;
    Buckets: {
        name: string;
        s3Bucket: string;
        s3Endpoint: string;
    }[];
};
export declare class DogeCloud {
    private accessKey;
    private secretKey;
    private bucket;
    private s3Client?;
    private tmpToken?;
    private tokenExpireTime;
    constructor(accessKey: string, secretKey: string, bucket: string);
    uploadFile(key: string, file: ReadStream): Promise<string>;
    deleteFile(key: string): Promise<void>;
    allFiles(): Promise<string[]>;
    initS3Client(): Promise<S3Client>;
    getTmpToken(): Promise<DogeCloudS3TmpToken>;
    private dogecloudApi;
}
export {};
