import { MongoClient } from 'mongodb';

const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const blacklistCollection = db.collection('blacklist');
            
            const blacklist = await blacklistCollection
                .find({})
                .sort({ blacklistedAt: -1 })
                .toArray();
            
            res.status(200).json({ blacklist: blacklist });
        } catch (error) {
            console.error('Error getting blacklist:', error);
            res.status(500).json({ error: 'Failed to get blacklist', details: error.message });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

