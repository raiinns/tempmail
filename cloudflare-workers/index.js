import PostalMime from 'postal-mime';

export default {
    async email(message, env, ctx) {
        // 1. Ambil data mentah email
        const rawEmail = await new Response(message.raw).arrayBuffer();

        // 2. Parse menggunakan postal-mime
        const parser = new PostalMime();
        const parsedEmail = await parser.parse(rawEmail);

        // 3. Kirim hasil parse ke VPS (untuk disimpan ke DB & ditampilkan di Frontend)
        const response = await fetch(env.VPS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Webhook-Secret": env.WEBHOOK_SECRET
            },
            body: JSON.stringify({
                from: parsedEmail.from.address,
                from_name: parsedEmail.from.name,
                to: message.to,
                subject: parsedEmail.subject,
                text: parsedEmail.text,     // Versi teks biasa
                html: parsedEmail.html,     // Versi HTML (sangat penting untuk Frontend)
                date: parsedEmail.date,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            console.error("Gagal meneruskan email ke VPS");
        }
    }
}