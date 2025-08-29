import { S3Client } from '@aws-sdk/client-s3';
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
    uploadFile(key: string, file: Buffer, contentType?: string): Promise<string>;
    deleteFile(key: string): Promise<void>;
    allFiles(): Promise<string[]>;
    refreshUrls(urls: string[]): Promise<void>;
    initS3Client(): Promise<S3Client>;
    getTmpToken(): Promise<DogeCloudS3TmpToken>;
    private dogecloudApi;
}
export {};
