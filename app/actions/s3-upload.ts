'use server'

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

console.log('Environment Variables Check:', {
    SPACES_ENDPOINT: process.env.SPACES_ENDPOINT ? 'Set' : 'Missing',
    SPACES_KEY: process.env.SPACES_KEY ? 'Set' : 'Missing',
    SPACES_SECRET: process.env.SPACES_SECRET ? 'Set' : 'Missing'
});

console.log('Initializing S3 client with endpoint:', process.env.SPACES_ENDPOINT);

if (!process.env.SPACES_KEY || !process.env.SPACES_SECRET || !process.env.SPACES_ENDPOINT) {
    throw new Error('Missing required environment variables for S3 client');
}

const s3Client = new S3Client({
    endpoint: `https://${process.env.SPACES_ENDPOINT}`,
    region: "sfo3",
    credentials: {
        accessKeyId: process.env.SPACES_KEY,
        secretAccessKey: process.env.SPACES_SECRET
    }
});

console.log('S3 client initialized');

export async function generateUploadUrl(fileType: string) {
    console.log('generateUploadUrl called with fileType:', fileType);
    
    try {
        const key = `audio-uploads/${randomUUID()}.${fileType.split('/')[1]}`;
        console.log('Generated file key:', key);
        
        const command = new PutObjectCommand({
            Bucket: "ugc-storage",
            Key: key,
            ContentType: fileType,
            ACL: 'public-read'
        });

        const signedUrl = await getSignedUrl(s3Client, command, { 
            expiresIn: 60,
            signableHeaders: new Set([
                'host',
                'content-type',
                'content-length',
            ])
        });

        const fileUrl = `https://ugc-storage.${process.env.SPACES_ENDPOINT}/${key}`;
        console.log('Generated file URL:', fileUrl);

        return {
            uploadUrl: signedUrl,
            fileUrl: fileUrl
        };
    } catch (error: any) {
        console.error('Error in generateUploadUrl:', error);
        console.error('Error details:', {
            message: error?.message || 'Unknown error',
            stack: error?.stack || 'Unknown stack',
            name: error?.name || 'Unknown name'
        });
        throw error;
    }
} 