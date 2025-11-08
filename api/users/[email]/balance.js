import { MongoClient } from 'mongodb';

// MongoDB connection string from Vercel environment variables
// Set STORAGE_URL or MONGODB_URI in Vercel dashboard
const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const usersCollection = db.collection('users');
            
            const email = decodeURIComponent(req.query.email);
            
            const user = await usersCollection.findOne({ email: email });
            
            if (user) {
                res.status(200).json({ balance: user.balance || 0 });
            } else {
                // Create user if doesn't exist
                await usersCollection.insertOne({
                    email: email,
                    balance: 0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                res.status(200).json({ balance: 0 });
            }
        } catch (error) {
            console.error('Error getting balance:', error);
            res.status(500).json({ error: 'Failed to get balance' });
        } finally {
            await client.close();
        }
    } else if (req.method === 'PUT') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const usersCollection = db.collection('users');
            
            const email = decodeURIComponent(req.query.email);
            const { balance } = req.body;
            
            if (typeof balance !== 'number') {
                return res.status(400).json({ error: 'Balance must be a number' });
            }
            
            const result = await usersCollection.updateOne(
                { email: email },
                {
                    $set: {
                        balance: balance,
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        email: email,
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );
            
            res.status(200).json({ success: true, balance: balance });
        } catch (error) {
            console.error('Error updating balance:', error);
            res.status(500).json({ error: 'Failed to update balance' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['GET', 'PUT']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

