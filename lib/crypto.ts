export async function createHash(message: string, secretKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(message);
    const secretKeyBuffer = encoder.encode(secretKey);

    const key = await crypto.subtle.importKey(
        'raw',
        secretKeyBuffer,
        {
            name: 'HMAC',
            hash: { name: 'SHA-256' }
        },
        false,
        ['sign']
    );

    // HMAC hesaplama
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        messageBuffer
    );

    // ArrayBuffer'ı hex string'e çevirme
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
} 