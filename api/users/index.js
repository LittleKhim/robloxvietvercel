import { MongoClient } from 'mongodb';

// MongoDB connection string from Vercel environment variables
const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const usersCollection = db.collection('users');
            
            const { email, name, balance } = req.body;
            
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }
            
            const userData = {
                email: email,
                name: name || email,
                balance: balance || 0,
                updatedAt: new Date()
            };
            
            const result = await usersCollection.updateOne(
                { email: email },
                {
                    $set: userData,
                    $setOnInsert: {
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );
            
            res.status(200).json({ success: true, user: userData });
        } catch (error) {
            console.error('Error saving user:', error);
            res.status(500).json({ error: 'Failed to save user' });
        } finally {
            await client.close();
        }
    } else if (req.method === 'GET') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const usersCollection = db.collection('users');
            
            const email = req.query.email;
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }
            
            const user = await usersCollection.findOne({ email: decodeURIComponent(email) });
            
            res.status(200).json(user || null);
        } catch (error) {
            console.error('Error fetching user:', error);
            res.status(500).json({ error: 'Failed to fetch user' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['POST', 'GET']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

