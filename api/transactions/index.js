import { MongoClient } from 'mongodb';

// MongoDB connection string from Vercel environment variables
const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    const { id } = req.query;
    
    try {
        await client.connect();
        const db = client.db('store_db');
        const transactionsCollection = db.collection('transactions');
        const usersCollection = db.collection('users');
        
        // UPDATE TRANSACTION BY ID - PUT /api/transactions?id=...
        if (req.method === 'PUT' && id) {
            const { status, userEmail, amount } = req.body;
            
            if (!status || !['pending', 'completed', 'cancelled'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }
            
            // Update transaction
            const result = await transactionsCollection.updateOne(
                { id: id },
                {
                    $set: {
                        status: status,
                        updatedAt: new Date(),
                        ...(status === 'completed' && { completedAt: new Date() }),
                        ...(status === 'cancelled' && { cancelledAt: new Date() })
                    }
                }
            );
            
            // If transaction is completed, add money to user balance
            if (status === 'completed' && userEmail) {
                // Get transaction to get amount
                const transaction = await transactionsCollection.findOne({ id: id });
                if (transaction && transaction.amount) {
                    await usersCollection.updateOne(
                        { email: userEmail },
                        {
                            $inc: { balance: transaction.amount },
                            $set: { updatedAt: new Date() }
                        },
                        { upsert: true }
                    );
                }
            }
            
            return res.status(200).json({ success: true });
        }
        
        // CREATE TRANSACTION - POST /api/transactions
        if (req.method === 'POST') {
            const transaction = {
                ...req.body,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const result = await transactionsCollection.insertOne(transaction);
            
            return res.status(200).json({ 
                success: true, 
                transactionId: result.insertedId,
                transaction: transaction
            });
        }
        
        // GET TRANSACTIONS - GET /api/transactions?userEmail=...
        if (req.method === 'GET') {
            const { userEmail } = req.query;
            
            let query = {};
            if (userEmail) {
                query.userEmail = decodeURIComponent(userEmail);
            }
            
            const transactions = await transactionsCollection
                .find(query)
                .sort({ createdAt: -1 })
                .toArray();
            
            return res.status(200).json({ transactions: transactions });
        }
        
        // Method not allowed
        res.setHeader('Allow', ['POST', 'GET', 'PUT']);
        res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Transactions API error:', error);
        res.status(500).json({ error: 'Failed to process request', details: error.message });
    } finally {
        await client.close();
    }
}
