import { MongoClient } from 'mongodb';

// MongoDB connection string from Vercel environment variables
const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    const { action } = req.query;
    const email = req.query.email;
    
    try {
        await client.connect();
        const db = client.db('store_db');
        const usersCollection = db.collection('users');
        const blacklistCollection = db.collection('blacklist');
        
        // BALANCE OPERATIONS - GET/PUT /api/users?action=balance&email=...
        if (action === 'balance') {
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }
            
            const decodedEmail = decodeURIComponent(email);
            console.log('Balance API - Email:', decodedEmail);
            
            if (req.method === 'GET') {
                const user = await usersCollection.findOne({ email: decodedEmail });
                
                if (user) {
                    console.log('User found, balance:', user.balance);
                    return res.status(200).json({ balance: user.balance || 0 });
                } else {
                    // Create user if doesn't exist
                    console.log('User not found, creating with 0 balance');
                    await usersCollection.insertOne({
                        email: decodedEmail,
                        balance: 0,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    return res.status(200).json({ balance: 0 });
                }
            } else if (req.method === 'PUT') {
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
                return res.status(200).json({ success: true, balance: balance });
            }
        }
        
        // BLACKLIST OPERATIONS - GET/POST/DELETE /api/users?action=blacklist&email=...
        if (action === 'blacklist') {
            // List all blacklist
            if (req.method === 'GET' && !email && req.query.list === 'true') {
                const blacklist = await blacklistCollection
                    .find({})
                    .sort({ blacklistedAt: -1 })
                    .toArray();
                
                return res.status(200).json({ blacklist: blacklist });
            }
            
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }
            
            const decodedEmail = decodeURIComponent(email);
            console.log('Blacklist API - Email:', decodedEmail);
            
            if (req.method === 'GET') {
                const user = await blacklistCollection.findOne({ email: decodedEmail });
                return res.status(200).json({ isBlacklisted: !!user });
            } else if (req.method === 'POST') {
                // Add to blacklist
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
                return res.status(200).json({ success: true, message: 'User added to blacklist' });
            } else if (req.method === 'DELETE') {
                // Remove from blacklist
                const result = await blacklistCollection.deleteOne({ email: decodedEmail });
                console.log('User removed from blacklist:', decodedEmail);
                return res.status(200).json({ success: true, message: 'User removed from blacklist' });
            }
        }
        
        // USER OPERATIONS (default) - GET/POST /api/users?email=...
        if (req.method === 'POST') {
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
            
            return res.status(200).json({ success: true, user: userData });
        } else if (req.method === 'GET') {
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }
            
            const user = await usersCollection.findOne({ email: decodeURIComponent(email) });
            return res.status(200).json(user || null);
        }
        
        // Method not allowed
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Users API error:', error);
        res.status(500).json({ error: 'Failed to process request', details: error.message });
    } finally {
        await client.close();
    }
}
