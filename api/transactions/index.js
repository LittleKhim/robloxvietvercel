import { MongoClient } from 'mongodb';

// MongoDB connection string from Vercel environment variables
const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const transactionsCollection = db.collection('transactions');
            
            const transaction = {
                ...req.body,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const result = await transactionsCollection.insertOne(transaction);
            
            res.status(200).json({ 
                success: true, 
                transactionId: result.insertedId,
                transaction: transaction
            });
        } catch (error) {
            console.error('Error saving transaction:', error);
            res.status(500).json({ error: 'Failed to save transaction' });
        } finally {
            await client.close();
        }
    } else if (req.method === 'GET') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const transactionsCollection = db.collection('transactions');
            
            const { userEmail } = req.query;
            
            let query = {};
            if (userEmail) {
                query.userEmail = decodeURIComponent(userEmail);
            }
            
            const transactions = await transactionsCollection
                .find(query)
                .sort({ createdAt: -1 })
                .toArray();
            
            res.status(200).json({ transactions: transactions });
        } catch (error) {
            console.error('Error getting transactions:', error);
            res.status(500).json({ error: 'Failed to get transactions' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['POST', 'GET']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

