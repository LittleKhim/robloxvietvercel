import { MongoClient } from 'mongodb';

const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    const { email } = req.query;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    
    const decodedEmail = decodeURIComponent(email);
    console.log('Blacklist API - Email:', decodedEmail);
    
    if (req.method === 'GET') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const blacklistCollection = db.collection('blacklist');
            
            const user = await blacklistCollection.findOne({ email: decodedEmail });
            
            res.status(200).json({ isBlacklisted: !!user });
        } catch (error) {
            console.error('Error checking blacklist:', error);
            res.status(500).json({ error: 'Failed to check blacklist', details: error.message });
        } finally {
            await client.close();
        }
    } else if (req.method === 'POST') {
        // Add to blacklist
        try {
            await client.connect();
            const db = client.db('store_db');
            const blacklistCollection = db.collection('blacklist');
            
            const result = await blacklistCollection.updateOne(
                { email: decodedEmail },
                {
                    $set: {
                        email: decodedEmail,
                        blacklistedAt: new Date(),
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );
            
            console.log('User added to blacklist:', decodedEmail);
            res.status(200).json({ success: true, message: 'User added to blacklist' });
        } catch (error) {
            console.error('Error adding to blacklist:', error);
            res.status(500).json({ error: 'Failed to add to blacklist', details: error.message });
        } finally {
            await client.close();
        }
    } else if (req.method === 'DELETE') {
        // Remove from blacklist
        try {
            await client.connect();
            const db = client.db('store_db');
            const blacklistCollection = db.collection('blacklist');
            
            const result = await blacklistCollection.deleteOne({ email: decodedEmail });
            
            console.log('User removed from blacklist:', decodedEmail);
            res.status(200).json({ success: true, message: 'User removed from blacklist' });
        } catch (error) {
            console.error('Error removing from blacklist:', error);
            res.status(500).json({ error: 'Failed to remove from blacklist', details: error.message });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

