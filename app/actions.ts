'use server'

import { db } from "@/db"
import { users, videos } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from 'next/headers'
import OpenAI from "openai"
import axios from 'axios'

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
}) {
    try {
        console.log('Creating video with data:', {
            name: data.name,
            actorId: data.actorId,
            userId: data.userId,
            scriptLength: data.script
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
                userHash: data.hash
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
}) {
    try {
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