'use server'

import { db } from "@/db"
import { users, videos } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from 'next/headers'
import OpenAI from "openai"
import axios from 'axios'
import { ElevenLabsClient } from "elevenlabs";
import { Readable } from 'stream';
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

export async function deleteVideo(videoId: string) {
    try {
        const headersList = await headers()
        const userId = headersList.get('x-user-external-id')

        if (!userId) {
            throw new Error('Unauthorized')
        }

        // userId is external_id find uuid
        const user = await db.query.users.findFirst({
            where: eq(users.externalId, userId)
        })

        if (!user) {
            throw new Error('User not found')
        }

        console.log('User found:', user)

        const video = await db.query.videos.findFirst({
            where: and(
                eq(videos.id, videoId),
                eq(videos.userId, user.id)
            )
        })

        if (!video) {
            throw new Error('Video not found or unauthorized')
        }

        await db.update(videos)
            .set({ status: 'deleted' })
            .where(
                and(
                    eq(videos.id, videoId),
                    eq(videos.userId, user.id)
                )
            )

        return { success: true }
    } catch (error) {
        console.error('Error deleting video:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}

export async function getActors() {
    'use server'

    try {
        const actorsList = await db.query.actors.findMany({
            orderBy: (actors, { asc }) => [asc(actors.displayOrder)],
            where: (actors, { eq }) => eq(actors.status, 'completed')
        })

        return actorsList
    } catch (error) {
        console.error('Error fetching actors:', error)
        return []
    }
}

export async function createVideo(data: {
    name: string;
    script: string;
    actorId: string;
    userId: string;
    hash: string;
    userName: string;
    userEmail: string;
}) {
    try {
        console.log('Creating video with data:', {
            name: data.name,
            actorId: data.actorId,
            userId: data.userId,
            scriptLength: data.script,
            userName: data.userName,
            userEmail: data.userEmail
        })

        const headersList = await headers()
        const userId = headersList.get('x-user-external-id')

        if (!userId) {
            console.log('Authorization failed: No user ID in headers')
            throw new Error('Unauthorized')
        }

        console.log('Making API request to:', `${process.env.API_URL}/create-ugc-video`)

        const response = await axios.post(
            `${process.env.API_URL}/create-ugc-video`,
            {
                name: data.name,
                script: data.script,
                actorId: data.actorId,
                userId: data.userId,
                userHash: data.hash,
                userName: data.userName,
                userEmail: data.userEmail
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-external-id': userId
                }
            }
        )

        console.log('API response received:', response.data)
        return response.data
    } catch (error) {
        console.error('Error creating video:', error)
        if (axios.isAxiosError(error)) {
            console.error('API Error details:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            })
        }
        throw error
    }
}

export async function generateScript(data: {
    productInfo: string;
    productDesc: string;
    style: string;
}) {
    try {
        const stylePrompts = {
            regular: "Create a clear and professional script",
            storytelling: "Create an engaging narrative script that tells a story about",
            casual: "Create a friendly and conversational script"
        };

        const basePrompt = stylePrompts[data.style as keyof typeof stylePrompts] || stylePrompts.regular;
        
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini-2024-07-18",
            messages: [
                {
                    role: "system",
                    content: "You are a creative scriptwriter specializing in short, engaging UGC (User Generated Content) style video scripts. Maximum length 900 dont go above 900 characters!"
                },
                {
                    role: "user",
                    content: `I need a concise TikTok/Facebook video ad script, written in a natural, conversational tone like I’m sharing a personal experience with friends. The script should be between 30-60 seconds, with each sentence on its own line and a space between sentences. Keep the character count 900 including spaces. Don't use any emojis at all, and use the following details provided as inspiration to create your own. Maximum length 900 dont go above 900 characters! Product Title: ${data.productInfo} Product Description: ${data.productDesc}`
                }
            ],
            max_tokens: 1000,
            temperature: 0.1,
        });

        const generatedScript = response.choices[0].message.content?.trim() || ''

        return generatedScript
    } catch (error) {
        console.error('Error generating script:', error)
        throw error
    }
}

async function streamToBase64(stream: any): Promise<string> {
    console.log('Stream type:', {
        isReadable: stream instanceof Readable,
        hasGetReader: 'getReader' in stream,
        hasReadableStream: 'readableStream' in stream,
        hasReader: 'reader' in stream,
        constructor: stream.constructor.name,
        properties: Object.keys(stream)
    });

    // Handle Node18UniversalStreamWrapper
    if ('reader' in stream) {
        console.log('Handling as Node18UniversalStreamWrapper with existing reader');
        const chunks: Uint8Array[] = [];
        
        try {
            while (true) {
                const { done, value } = await stream.reader.read();
                console.log('Read chunk:', done ? 'done' : `${value?.length} bytes`);
                
                if (done) {
                    break;
                }
                
                chunks.push(value);
            }
            
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            console.log('Total length:', totalLength);
            const concatenated = new Uint8Array(totalLength);
            
            let offset = 0;
            for (const chunk of chunks) {
                concatenated.set(chunk, offset);
                offset += chunk.length;
            }
            
            return Buffer.from(concatenated).toString('base64');
        } catch (error) {
            console.error('Error reading stream:', error);
            throw error;
        }
    }

    // Handle Node.js Readable streams
    if (stream instanceof Readable) {
        console.log('Handling as Node.js Readable stream');
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            stream.on('data', (chunk) => {
                console.log('Received chunk:', chunk.length, 'bytes');
                chunks.push(Buffer.from(chunk));
            });
            stream.on('end', () => {
                console.log('Stream ended, total chunks:', chunks.length);
                const buffer = Buffer.concat(chunks);
                resolve(buffer.toString('base64'));
            });
            stream.on('error', (error) => {
                console.error('Stream error:', error);
                reject(error);
            });
        });
    }

    // Handle Web ReadableStream
    if ('getReader' in stream) {
        console.log('Handling as Web ReadableStream');
        const chunks: Uint8Array[] = [];
        const reader = (stream as ReadableStream).getReader();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                console.log('Read chunk:', done ? 'done' : `${value?.length} bytes`);
                
                if (done) {
                    break;
                }
                
                chunks.push(value);
            }
            
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            console.log('Total length:', totalLength);
            const concatenated = new Uint8Array(totalLength);
            
            let offset = 0;
            for (const chunk of chunks) {
                concatenated.set(chunk, offset);
                offset += chunk.length;
            }
            
            return Buffer.from(concatenated).toString('base64');
        } finally {
            reader.releaseLock();
        }
    }

    console.error('Stream type not supported:', {
        type: typeof stream,
        isBuffer: Buffer.isBuffer(stream),
        isArrayBuffer: stream instanceof ArrayBuffer,
        prototype: Object.getPrototypeOf(stream)
    });
    throw new Error('Unsupported stream type');
}

export async function generateAudioPreview(text: string, voiceId: string, settings: {
    stability: number;
    similarity: number;
    style: number;
}) {
    try {
        console.log('Generating audio preview with:', { text: text.substring(0, 50) + '...', voiceId, settings });
        
        const client = new ElevenLabsClient({
            apiKey: process.env.ELEVENLABS_API_KEY
        });

        const audioStream = await client.textToSpeech.convertAsStream(
            voiceId,
            {
                text,
                voice_settings: {
                    stability: settings.stability,
                    similarity_boost: settings.similarity,
                    style: settings.style,
                },
                model_id: "eleven_multilingual_v2"
            }
        );

        console.log('Received audio stream:', {
            type: typeof audioStream,
            isReadable: audioStream instanceof Readable,
            constructor: audioStream?.constructor?.name,
            properties: audioStream ? Object.keys(audioStream) : 'null'
        });

        return await streamToBase64(audioStream);
    } catch (error) {
        console.error('Error generating audio preview:', error);
        throw error;
    }
} 