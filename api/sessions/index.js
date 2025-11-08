import { MongoClient } from 'mongodb';

const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const sessionsCollection = db.collection('login_sessions');
            
            const { email, userAgent, ip, timestamp, status, error } = req.body;
            
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }
            
            const session = {
                email: email,
                userAgent: userAgent || 'Unknown',
                ip: ip || 'Unknown',
                timestamp: timestamp || new Date(),
                status: status || 'attempt', // 'attempt', 'success', 'failed'
                error: error || null,
                createdAt: new Date()
            };
            
            const result = await sessionsCollection.insertOne(session);
            
            res.status(200).json({ 
                success: true, 
                sessionId: result.insertedId,
                message: 'Session logged successfully'
            });
        } catch (error) {
            console.error('Error logging session:', error);
            res.status(500).json({ error: 'Failed to log session', details: error.message });
        } finally {
            await client.close();
        }
    } else if (req.method === 'GET') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const sessionsCollection = db.collection('login_sessions');
            
            const { email, limit = 50 } = req.query;
            
            let query = {};
            if (email) {
                query.email = decodeURIComponent(email);
            }
            
            const sessions = await sessionsCollection
                .find(query)
                .sort({ timestamp: -1 })
                .limit(parseInt(limit))
                .toArray();
            
            res.status(200).json({ sessions });
        } catch (error) {
            console.error('Error getting sessions:', error);
            res.status(500).json({ error: 'Failed to get sessions' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['POST', 'GET']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

