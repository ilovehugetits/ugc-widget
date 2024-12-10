'use server'

import { db } from "@/db"
import { videos } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from 'next/headers'
import { actors } from "@/db/schema"
import OpenAI from "openai"

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

export async function deleteVideo(jobId: string) {
    try {
        const headersList = await headers()
        const userId = headersList.get('x-user-external-id')

        if (!userId) {
            throw new Error('Unauthorized')
        }

        // Önce videoyu ve sahibini kontrol et
        const video = await db.query.videos.findFirst({
            where: and(
                eq(videos.jobId, jobId),
                eq(videos.userId, userId)
            )
        })

        if (!video) {
            throw new Error('Video not found or unauthorized')
        }

        // Video bulundu ve kullanıcıya ait, şimdi silebiliriz
        await db.update(videos)
            .set({ status: 'deleted' })
            .where(
                and(
                    eq(videos.jobId, jobId),
                    eq(videos.userId, userId)
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
}) {
    try {
        const headersList = await headers()
        const userId = headersList.get('x-user-external-id')

        if (!userId) {
            throw new Error('Unauthorized')
        }

        const response = await fetch(`${process.env.API_URL}/videos/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-external-id': userId
            },
            body: JSON.stringify(data)
        })

        if (!response.ok) {
            throw new Error('Failed to create video')
        }

        return await response.json()
    } catch (error) {
        console.error('Error creating video:', error)
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
					content: "You are a creative scriptwriter specializing in short, engaging UGC (User Generated Content) style video scripts. Maximum length 400 dont go above 400 characters!"
				},
				{
					role: "user",
					content: `I need a concise TikTok/Facebook video ad script, written in a natural, conversational tone like I’m sharing a personal experience with friends. The script should be between 30-60 seconds, with each sentence on its own line and a space between sentences. Keep the character count 400 including spaces. Don't use any emojis at all, and use the following details provided as inspiration to create your own. Maximum length 400 dont go above 400 characters! Product Title: ${data.productInfo} Product Description: ${data.productDesc}`
				}
			],
			max_tokens: 500,
			temperature: 0,
		});

        const generatedScript = response.choices[0].message.content?.trim() || ''

        return generatedScript
    } catch (error) {
        console.error('Error generating script:', error)
        throw error
    }
} 