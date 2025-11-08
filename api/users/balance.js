import { MongoClient } from 'mongodb';

// MongoDB connection string from Vercel environment variables
const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    const { email } = req.query;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    
    const decodedEmail = decodeURIComponent(email);
    console.log('Balance API - Email:', decodedEmail);
    
    if (req.method === 'GET') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const usersCollection = db.collection('users');
            
            const user = await usersCollection.findOne({ email: decodedEmail });
            
            if (user) {
                console.log('User found, balance:', user.balance);
                res.status(200).json({ balance: user.balance || 0 });
            } else {
                // Create user if doesn't exist
                console.log('User not found, creating with 0 balance');
                await usersCollection.insertOne({
                    email: decodedEmail,
                    balance: 0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                res.status(200).json({ balance: 0 });
            }
        } catch (error) {
            console.error('Error getting balance:', error);
            res.status(500).json({ error: 'Failed to get balance', details: error.message });
        } finally {
            await client.close();
        }
    } else if (req.method === 'PUT') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const usersCollection = db.collection('users');
            
            const { balance } = req.body;
            
            if (typeof balance !== 'number') {
                return res.status(400).json({ error: 'Balance must be a number' });
            }
            
            console.log('Updating balance for:', decodedEmail, 'to:', balance);
            
            const result = await usersCollection.updateOne(
                { email: decodedEmail },
                {
                    $set: {
                        balance: balance,
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        email: decodedEmail,
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );
            
            console.log('Update result:', result);
            res.status(200).json({ success: true, balance: balance });
        } catch (error) {
            console.error('Error updating balance:', error);
            res.status(500).json({ error: 'Failed to update balance', details: error.message });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['GET', 'PUT']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

